import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from core.models import FamiliaWorkspace, MembroFamilia, FamiliaNode, Pessoa, Evento, Solicitacao, RegistroAtividade


class ApiSolicitacoesTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.password = "TestePass123!"

        # Criar usuários
        self.admin_user = User.objects.create_user(username="admin_teste", password=self.password, is_staff=True)
        self.leitor_user = User.objects.create_user(username="leitor_teste", password=self.password)
        self.outro_user = User.objects.create_user(username="outro_teste", password=self.password)
        self.superuser = User.objects.create_superuser(username="super_teste", password=self.password)

        # Criar família no banco relacional
        self.uuid_familia = "test-uuid-familia-unit"
        self.familia_ws = FamiliaWorkspace.objects.create(
            nome="Família Unidade Teste",
            uuid_referencia=self.uuid_familia
        )

        # Criar nó da família no Neo4j
        self.familia_node = FamiliaNode(uuid=self.uuid_familia, nome="Família Unidade Teste").save()

        # Associar membros com funções distintas
        self.membro_admin = MembroFamilia.objects.create(
            usuario=self.admin_user,
            familia=self.familia_ws,
            funcao='ADMIN'
        )
        self.membro_leitor = MembroFamilia.objects.create(
            usuario=self.leitor_user,
            familia=self.familia_ws,
            funcao='LEITOR'
        )

        # Criar pessoas de base no grafo ligadas à família
        self.pessoa = Pessoa(nomeCompleto="Pessoa Unidade Teste", apelido="Unidade").save()
        self.pessoa.pertence_a.connect(self.familia_node)

        self.pessoa2 = Pessoa(nomeCompleto="Segunda Pessoa Teste", apelido="P2").save()
        self.pessoa2.pertence_a.connect(self.familia_node)

    def tearDown(self):
        # Limpar nós no Neo4j
        for p in [self.pessoa, self.pessoa2]:
            try:
                p.delete()
            except Exception:
                pass
        try:
            for p in Pessoa.nodes.filter(nomeCompleto="Novo Familiar Solicitado"):
                p.delete()
        except Exception:
            pass
        try:
            for e in Evento.nodes.filter(tipo="Festa Familiar Solicitada"):
                e.delete()
        except Exception:
            pass
        try:
            for fn in FamiliaNode.nodes.filter(nome__icontains="Solicitação"):
                fn.delete()
            for fn in FamiliaNode.nodes.filter(nome__icontains="Direta"):
                fn.delete()
            self.familia_node.delete()
        except Exception:
            pass

    # 1. Autenticação e cabeçalhos
    def test_sem_autenticacao_retorna_403(self):
        response_get = self.client.get('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response_get.status_code, 403)

        response_post = self.client.post(
            '/api/solicitacoes/',
            data=json.dumps({'motivo': 'teste'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(response_post.status_code, 403)

    def test_sem_cabecalho_familia_retorna_400(self):
        self.client.login(username="admin_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/')
        self.assertEqual(response.status_code, 400)
        self.assertIn("Cabeçalho X-Familia-UUID é obrigatório", response.content.decode('utf-8'))

    def test_cabecalho_familia_inexistente_retorna_403(self):
        self.client.login(username="admin_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/', HTTP_X_FAMILIA_UUID="uuid-nao-existe")
        self.assertEqual(response.status_code, 403)

    def test_usuario_sem_acesso_a_familia_retorna_403(self):
        self.client.login(username="outro_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 403)

    # 2. Permissão de listagem (GET)
    def test_leitor_nao_pode_listar_solicitacoes(self):
        self.client.login(username="leitor_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 403)
        self.assertIn("Apenas administradores podem gerir", response.content.decode('utf-8'))

    def test_admin_pode_listar_solicitacoes(self):
        Solicitacao.objects.create(
            usuario=self.leitor_user,
            familia=self.familia_ws,
            tipo_acao='Editar',
            entidade='Pessoa',
            uuid_entidade=self.pessoa.uuid,
            motivo='Nome incorreto',
            dados_novos=json.dumps({'nomeCompleto': 'Novo Nome'})
        )

        self.client.login(username="admin_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 200)

        dados = response.json()
        self.assertEqual(len(dados), 1)
        self.assertEqual(dados[0]['usuario'], 'leitor_teste')
        self.assertEqual(dados[0]['tipo_acao'], 'Editar')
        self.assertEqual(dados[0]['motivo'], 'Nome incorreto')
        self.assertEqual(dados[0]['dados_novos'], {'nomeCompleto': 'Novo Nome'})

    # 3. Bloqueio de criação direta por usuário comum
    def test_usuario_comum_bloqueado_ao_criar_diretamente(self):
        self.client.login(username="leitor_teste", password=self.password)

        # Tentativa de criar Pessoa diretamente
        resp_p = self.client.post(
            '/api/pessoas/',
            data=json.dumps({'nomeCompleto': 'Direto'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(resp_p.status_code, 403)

        # Tentativa de criar Evento diretamente
        resp_e = self.client.post(
            '/api/eventos/',
            data=json.dumps({'tipo': 'Direto'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(resp_e.status_code, 403)

        # Tentativa de criar Relacionamento diretamente
        resp_r = self.client.post(
            '/api/relacionar/',
            data=json.dumps({'origem_uuid': self.pessoa.uuid, 'destino_uuid': self.pessoa2.uuid, 'tipo': 'IRMAO'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(resp_r.status_code, 403)

    # 4. Criação de solicitações do tipo 'Criar' e aprovação pelo Admin
    def test_solicitacao_criar_pessoa_e_aprovacao_admin(self):
        self.client.login(username="leitor_teste", password=self.password)
        payload = {
            'tipo_acao': 'Criar',
            'entidade': 'Pessoa',
            'uuid_entidade': '',
            'motivo': 'Cadastrar novo familiar',
            'dados_novos': {
                'nomeCompleto': 'Novo Familiar Solicitado',
                'apelido': 'Fami',
                'dataNascimento': '1992-06-10'
            }
        }
        res_post = self.client.post(
            '/api/solicitacoes/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(res_post.status_code, 200)

        solic = Solicitacao.objects.filter(entidade='Pessoa', tipo_acao='Criar').first()
        self.assertIsNotNone(solic)
        self.assertEqual(solic.status, 'PENDENTE')

        # Admin aprova
        self.client.login(username="admin_teste", password=self.password)
        res_aprov = self.client.put(
            f'/api/solicitacoes/{solic.id}/',
            data=json.dumps({'acao': 'APROVAR'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(res_aprov.status_code, 200)

        # Verificar se nó foi criado no Neo4j e vinculado à família
        pessoa_criada = Pessoa.nodes.get_or_none(nomeCompleto="Novo Familiar Solicitado")
        self.assertIsNotNone(pessoa_criada)
        self.assertTrue(pessoa_criada.pertence_a.is_connected(self.familia_node))
        # Limpar nó criado
        pessoa_criada.delete()

    def test_solicitacao_criar_evento_e_aprovacao_admin(self):
        self.client.login(username="leitor_teste", password=self.password)
        payload = {
            'tipo_acao': 'Criar',
            'entidade': 'Evento',
            'uuid_entidade': '',
            'motivo': 'Registrar festa histórica',
            'dados_novos': {
                'tipo': 'Festa Familiar Solicitada',
                'data': '2021-12-31',
                'local': 'Casa de Campo',
                'descricao': 'Réveillon em família'
            }
        }
        res_post = self.client.post(
            '/api/solicitacoes/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(res_post.status_code, 200)

        solic = Solicitacao.objects.filter(entidade='Evento', tipo_acao='Criar').first()
        self.assertIsNotNone(solic)

        # Admin aprova
        self.client.login(username="admin_teste", password=self.password)
        res_aprov = self.client.put(
            f'/api/solicitacoes/{solic.id}/',
            data=json.dumps({'acao': 'APROVAR'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(res_aprov.status_code, 200)

        evento_criado = Evento.nodes.get_or_none(tipo="Festa Familiar Solicitada")
        self.assertIsNotNone(evento_criado)
        self.assertTrue(evento_criado.pertence_a.is_connected(self.familia_node))
        evento_criado.delete()

    def test_solicitacao_criar_relacionamento_e_aprovacao_admin(self):
        self.client.login(username="leitor_teste", password=self.password)
        payload = {
            'tipo_acao': 'Criar',
            'entidade': 'Relacionamento',
            'uuid_entidade': '',
            'motivo': 'Conectar irmãos',
            'dados_novos': {
                'origem_uuid': self.pessoa.uuid,
                'destino_uuid': self.pessoa2.uuid,
                'tipo': 'IRMAO'
            }
        }
        res_post = self.client.post(
            '/api/solicitacoes/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(res_post.status_code, 200)

        solic = Solicitacao.objects.filter(entidade='Relacionamento', tipo_acao='Criar').first()
        self.assertIsNotNone(solic)

        # Admin aprova
        self.client.login(username="admin_teste", password=self.password)
        res_aprov = self.client.put(
            f'/api/solicitacoes/{solic.id}/',
            data=json.dumps({'acao': 'APROVAR'}),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(res_aprov.status_code, 200)

        # Verificar conexão no Neo4j
        self.assertTrue(self.pessoa.irmao_de.is_connected(self.pessoa2))

    # 5. Método HTTP não suportado
    def test_metodo_nao_permitido_retorna_400(self):
        self.client.login(username="admin_teste", password=self.password)
        response = self.client.delete('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Método não permitido", response.content.decode('utf-8'))

    # 6. Criação de Família e Moderação por Superusuário
    def test_usuario_comum_criar_familia_gera_solicitacao_pendente(self):
        self.client.login(username="outro_teste", password=self.password)
        response = self.client.post(
            '/api/familias/criar/',
            data=json.dumps({'nome': 'Família Solicitação Teste', 'motivo': 'Quero iniciar minha árvore'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 202)
        dados = response.json()
        self.assertTrue(dados.get('pendente'))

        solic = Solicitacao.objects.filter(entidade='Familia', tipo_acao='Criar', usuario=self.outro_user).first()
        self.assertIsNotNone(solic)
        self.assertEqual(solic.status, 'PENDENTE')
        self.assertIsNone(solic.familia)

    def test_superuser_criar_familia_direto(self):
        self.client.login(username="super_teste", password=self.password)
        response = self.client.post(
            '/api/familias/criar/',
            data=json.dumps({'nome': 'Família Direta Teste'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        dados = response.json()
        self.assertFalse(dados.get('pendente'))
        self.assertIn('uuid', dados)

        # Verificar se workspace e nó foram criados
        ws = FamiliaWorkspace.objects.filter(uuid_referencia=dados['uuid']).first()
        self.assertIsNotNone(ws)
        self.assertTrue(MembroFamilia.objects.filter(usuario=self.superuser, familia=ws, funcao='ADMIN').exists())

    def test_superuser_sem_cabecalho_lista_todas_solicitacoes_pendentes(self):
        solic = Solicitacao.objects.create(
            usuario=self.outro_user,
            familia=None,
            tipo_acao='Criar',
            entidade='Familia',
            motivo='Pedido de nova família',
            dados_novos=json.dumps({'nome': 'Família Solicitação Nova'})
        )

        self.client.login(username="super_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/')
        self.assertEqual(response.status_code, 200)

        dados = response.json()
        ids = [item['id'] for item in dados]
        self.assertIn(solic.id, ids)

    def test_superuser_aprova_solicitacao_familia(self):
        solic = Solicitacao.objects.create(
            usuario=self.outro_user,
            familia=None,
            tipo_acao='Criar',
            entidade='Familia',
            motivo='Criar família Souza',
            dados_novos=json.dumps({'nome': 'Família Solicitação Souza'})
        )

        self.client.login(username="super_teste", password=self.password)
        response = self.client.put(
            f'/api/solicitacoes/{solic.id}/',
            data=json.dumps({'acao': 'APROVAR'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

        solic.refresh_from_db()
        self.assertEqual(solic.status, 'APROVADA')
        self.assertIsNotNone(solic.familia)

        # O solicitante deve ser ADMIN da nova família
        self.assertTrue(MembroFamilia.objects.filter(
            usuario=self.outro_user, familia=solic.familia, funcao='ADMIN'
        ).exists())

    def test_usuario_comum_nao_pode_aprovar_solicitacao_familia(self):
        solic = Solicitacao.objects.create(
            usuario=self.outro_user,
            familia=None,
            tipo_acao='Criar',
            entidade='Familia',
            motivo='Tentativa de invasão',
            dados_novos=json.dumps({'nome': 'Família Invasão'})
        )

        # Usuário admin da família (não superusuário geral) não pode aprovar criação de novas famílias
        self.client.login(username="admin_teste", password=self.password)
        response = self.client.put(
            f'/api/solicitacoes/{solic.id}/',
            data=json.dumps({'acao': 'APROVAR'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)

    # 7. Exclusão de Família por Superusuário
    def test_superuser_pode_excluir_familia(self):
        # Cria uma família com nó no Neo4j e pessoa vinculada
        uuid_del = "test-uuid-deletar"
        ws = FamiliaWorkspace.objects.create(nome="Família Para Deletar", uuid_referencia=uuid_del)
        fn = FamiliaNode(uuid=uuid_del, nome="Família Para Deletar").save()
        p = Pessoa(nomeCompleto="Pessoa Deletar").save()
        p.pertence_a.connect(fn)

        self.client.login(username="super_teste", password=self.password)
        response = self.client.delete(f'/api/familias/{uuid_del}/')
        self.assertEqual(response.status_code, 200)

        # Verificar se foi removido do SQLite
        self.assertFalse(FamiliaWorkspace.objects.filter(uuid_referencia=uuid_del).exists())

        # Verificar se nó da família e pessoa foram removidos do Neo4j
        self.assertIsNone(FamiliaNode.nodes.get_or_none(uuid=uuid_del))
        self.assertIsNone(Pessoa.nodes.get_or_none(uuid=p.uuid))

    def test_usuario_comum_nao_pode_excluir_familia(self):
        self.client.login(username="admin_teste", password=self.password)
        response = self.client.delete(f'/api/familias/{self.uuid_familia}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(FamiliaWorkspace.objects.filter(uuid_referencia=self.uuid_familia).exists())

    def test_excluir_familia_inexistente_retorna_404(self):
        self.client.login(username="super_teste", password=self.password)
        response = self.client.delete('/api/familias/uuid-que-nao-existe/')
        self.assertEqual(response.status_code, 404)

    # 8. Listagem de Membros da Família
    def test_superuser_pode_listar_membros(self):
        self.client.login(username="super_teste", password=self.password)
        response = self.client.get(f'/api/familias/{self.uuid_familia}/membros/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        usernames = [m['username'] for m in data]
        self.assertIn("admin_teste", usernames)
        self.assertIn("leitor_teste", usernames)

    def test_membro_pode_listar_membros_sua_familia(self):
        self.client.login(username="leitor_teste", password=self.password)
        response = self.client.get('/api/membros/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)

    def test_usuario_externo_nao_pode_listar_membros(self):
        self.client.login(username="outro_teste", password=self.password)
        response = self.client.get('/api/membros/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 403)

    # 9. Dados Atuais em Solicitações
    def test_solicitacao_retorna_dados_atuais(self):
        solic = Solicitacao.objects.create(
            usuario=self.leitor_user,
            familia=self.familia_ws,
            tipo_acao='Editar',
            entidade='Pessoa',
            uuid_entidade=self.pessoa.uuid,
            motivo='Atualizar apelido',
            dados_novos=json.dumps({'nomeCompleto': 'Pessoa Unidade Teste', 'apelido': 'Novo Apelido'})
        )
        self.client.login(username="super_teste", password=self.password)
        response = self.client.get('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(len(data) >= 1)
        item = [d for d in data if d['id'] == solic.id][0]
        self.assertIn('dados_atuais', item)
        self.assertEqual(item['dados_atuais']['nomeCompleto'], 'Pessoa Unidade Teste')
        self.assertEqual(item['dados_atuais']['apelido'], 'Unidade')

    # 10. Testes de Seleção de Função ao Criar e Entrar em Família
    def test_usuario_entrar_familia_com_funcao(self):
        self.client.login(username="outro_teste", password=self.password)
        # Entra como leitor
        resp1 = self.client.post(
            '/api/familias/entrar/',
            data=json.dumps({'familia_uuid': self.uuid_familia, 'funcao': 'LEITOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp1.status_code, 200)
        membro = MembroFamilia.objects.filter(usuario=self.outro_user, familia=self.familia_ws).first()
        self.assertIsNotNone(membro)
        self.assertEqual(membro.funcao, 'LEITOR')

        # Altera para colaborador/editor
        resp2 = self.client.post(
            '/api/familias/entrar/',
            data=json.dumps({'familia_uuid': self.uuid_familia, 'funcao': 'EDITOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp2.status_code, 200)
        membro.refresh_from_db()
        self.assertEqual(membro.funcao, 'COLABORADOR')

    def test_entrar_familia_validacoes(self):
        # Não logado
        resp_unauth = self.client.post(
            '/api/familias/entrar/',
            data=json.dumps({'familia_uuid': self.uuid_familia, 'funcao': 'LEITOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp_unauth.status_code, 403)

        # Logado com função inválida
        self.client.login(username="outro_teste", password=self.password)
        resp_inv = self.client.post(
            '/api/familias/entrar/',
            data=json.dumps({'familia_uuid': self.uuid_familia, 'funcao': 'INVALIDA'}),
            content_type='application/json'
        )
        self.assertEqual(resp_inv.status_code, 400)

        # Logado sem familia_uuid
        resp_missing = self.client.post(
            '/api/familias/entrar/',
            data=json.dumps({'funcao': 'LEITOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp_missing.status_code, 400)

    def test_usuario_comum_solicita_familia_com_funcao_desejada_e_admin_aprova(self):
        self.client.login(username="outro_teste", password=self.password)
        resp_criar = self.client.post(
            '/api/familias/criar/',
            data=json.dumps({
                'nome': 'Família Solicitação Função',
                'motivo': 'Quero ser editor',
                'funcao': 'COLABORADOR'
            }),
            content_type='application/json'
        )
        self.assertEqual(resp_criar.status_code, 202)
        solic = Solicitacao.objects.filter(entidade='Familia', usuario=self.outro_user, status='PENDENTE').first()
        self.assertIsNotNone(solic)

        # Superusuário aprova
        self.client.login(username="super_teste", password=self.password)
        resp_aprov = self.client.put(
            f'/api/solicitacoes/{solic.id}/',
            data=json.dumps({'acao': 'APROVAR'}),
            content_type='application/json'
        )
        self.assertEqual(resp_aprov.status_code, 200)

        solic.refresh_from_db()
        self.assertEqual(solic.status, 'APROVADA')

        # O usuário solicitante deve ter a função COLABORADOR na nova família, conforme solicitado
        membro = MembroFamilia.objects.filter(usuario=self.outro_user, familia=solic.familia).first()
        self.assertIsNotNone(membro)
        self.assertEqual(membro.funcao, 'COLABORADOR')

    def test_alterar_funcao_membro_permissoes(self):
        # 1. Leitor tenta alterar a função de outro membro -> 403
        self.client.login(username="leitor_teste", password=self.password)
        resp_leitor = self.client.put(
            f'/api/membros/{self.membro_admin.id}/funcao/',
            data=json.dumps({'funcao': 'LEITOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp_leitor.status_code, 403)

        # 2. Administrador da família altera a função do leitor para COLABORADOR -> 200
        self.client.login(username="admin_teste", password=self.password)
        resp_admin = self.client.put(
            f'/api/membros/{self.membro_leitor.id}/funcao/',
            data=json.dumps({'funcao': 'COLABORADOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp_admin.status_code, 200)
        self.membro_leitor.refresh_from_db()
        self.assertEqual(self.membro_leitor.funcao, 'COLABORADOR')

        # 3. Superusuário altera a função do membro de volta para LEITOR -> 200
        self.client.login(username="super_teste", password=self.password)
        resp_super = self.client.put(
            f'/api/membros/{self.membro_leitor.id}/funcao/',
            data=json.dumps({'funcao': 'LEITOR'}),
            content_type='application/json'
        )
        self.assertEqual(resp_super.status_code, 200)
        self.membro_leitor.refresh_from_db()
        self.assertEqual(self.membro_leitor.funcao, 'LEITOR')

        # 4. Função inválida -> 400
        resp_inv = self.client.put(
            f'/api/membros/{self.membro_leitor.id}/funcao/',
            data=json.dumps({'funcao': 'DONO'}),
            content_type='application/json'
        )
        self.assertEqual(resp_inv.status_code, 400)




