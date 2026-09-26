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
