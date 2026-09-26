import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from core.models import FamiliaWorkspace, MembroFamilia, FamiliaNode, Pessoa, Solicitacao, RegistroAtividade


class ApiSolicitacoesTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.password = "TestePass123!"

        # Criar usuários
        self.admin_user = User.objects.create_user(username="admin_teste", password=self.password)
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

        # Criar pessoa no grafo ligada à família
        self.pessoa = Pessoa(nomeCompleto="Pessoa Unidade Teste", apelido="Unidade").save()
        self.pessoa.pertence_a.connect(self.familia_node)

    def tearDown(self):
        # Limpar nós no Neo4j
        try:
            self.pessoa.delete()
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
        # Cria uma solicitação prévia
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

    # 3. Criação de solicitação (POST)
    def test_leitor_cria_solicitacao_com_sucesso(self):
        self.client.login(username="leitor_teste", password=self.password)
        payload = {
            'tipo_acao': 'Editar',
            'entidade': 'Pessoa',
            'uuid_entidade': self.pessoa.uuid,
            'motivo': 'Atualizar apelido',
            'dados_novos': {'apelido': 'Apelido Novo'}
        }

        response = self.client.post(
            '/api/solicitacoes/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message'], 'Solicitação enviada aos administradores da família!')

        # Verificar se foi salvo no SQLite
        solicitacao = Solicitacao.objects.filter(uuid_entidade=self.pessoa.uuid).first()
        self.assertIsNotNone(solicitacao)
        self.assertEqual(solicitacao.usuario, self.leitor_user)
        self.assertEqual(solicitacao.status, 'PENDENTE')

        # Verificar se foi registrado log de auditoria
        log = RegistroAtividade.objects.filter(familia=self.familia_ws, acao="Solicitou").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.usuario, self.leitor_user)

    def test_post_payload_invalido_retorna_400(self):
        self.client.login(username="leitor_teste", password=self.password)
        payload_incompleto = {
            'tipo_acao': 'Editar'
            # Faltando campos obrigatórios
        }
        response = self.client.post(
            '/api/solicitacoes/',
            data=json.dumps(payload_incompleto),
            content_type='application/json',
            HTTP_X_FAMILIA_UUID=self.uuid_familia
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Erro ao solicitar", response.content.decode('utf-8'))

    # 4. Método HTTP não suportado
    def test_metodo_nao_permitido_retorna_400(self):
        self.client.login(username="admin_teste", password=self.password)
        response = self.client.delete('/api/solicitacoes/', HTTP_X_FAMILIA_UUID=self.uuid_familia)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Método não permitido", response.content.decode('utf-8'))
