import json
import uuid as uuid_lib  # Para gerar IDs únicos manualmente se necessário
from datetime import datetime
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden, HttpResponseNotFound
from neomodel import db
from .models import Pessoa, Evento, Comentario, RegistroAtividade, Solicitacao


# ==========================================
# FUNÇÃO AUXILIAR DE LOGS (Auditoria)
# ==========================================
def registrar_log(usuario, acao, entidade, detalhes):
    """Salva uma ação no banco relacional (SQLite)"""
    nome_usuario = usuario.username if hasattr(
        usuario, 'username') else str(usuario)
    RegistroAtividade.objects.create(
        usuario=nome_usuario,
        acao=acao,
        entidade=entidade,
        detalhes=detalhes
    )


# ==========================================
# 1. AUTENTICAÇÃO E CONTA
# ==========================================

@csrf_exempt
def api_registrar_usuario(request):
    if request.method == 'POST':
        try:
            dados = json.loads(request.body)
            username = dados.get('username')
            password = dados.get('password')
            email = dados.get('email', '')

            if User.objects.filter(username=username).exists():
                return HttpResponseBadRequest("Nome de usuário já existe.")

            User.objects.create_user(
                username=username, password=password, email=email)
            return JsonResponse({'message': 'Usuário criado com sucesso!'})
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao registrar: {str(e)}")


@csrf_exempt
def api_login(request):
    if request.method == 'POST':
        dados = json.loads(request.body)
        username = dados.get('username')
        password = dados.get('password')

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)  # Cria o Cookie de Sessão
            return JsonResponse({
                'message': 'Login realizado!',
                'user': {'id': user.id, 'username': user.username, 'is_admin': user.is_superuser}
            })
        else:
            return JsonResponse({'message': 'Usuário ou senha incorretos.'}, status=401)


@csrf_exempt
def api_logout(request):
    logout(request)
    return JsonResponse({'message': 'Logout realizado'})


def api_check_auth(request):
    """Verifica se o cookie de sessão ainda é válido"""
    if request.user.is_authenticated:
        return JsonResponse({
            'is_logged_in': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'is_admin': request.user.is_superuser
            }
        })
    return JsonResponse({'is_logged_in': False})


# ==========================================
# 2. API DO GRAFO (Visualização Geral)
# ==========================================

def api_grafo(request):
    nodes = []
    edges = []

    pessoas = Pessoa.nodes.all()
    eventos = Evento.nodes.all()

    # Nós de Pessoas
    for p in pessoas:
        nodes.append({
            'id': p.uuid,
            'label': p.nomeCompleto,
            'group': 'pessoa',
            'apelido': p.apelido,
        })

        # Arestas (Relacionamentos)
        for filho in p.pai_de.all():
            edges.append({'from': p.uuid, 'to': filho.uuid, 'label': 'PAI'})
        for filho in p.mae_de.all():
            edges.append({'from': p.uuid, 'to': filho.uuid, 'label': 'MAE'})
        for conjuge in p.casado_com.all():
            edges.append(
                {'from': p.uuid, 'to': conjuge.uuid, 'label': 'CASADO'})
        for evento in p.participou.all():
            edges.append({'from': p.uuid, 'to': evento.uuid, 'label': 'FOI'})

        # NOVO: Renderiza a linha de Irmão na Árvore Genealógica
        for irmao in p.irmao_de.all():
            # Como a relação de irmão é dupla, evitamos desenhar duas setas iguais
            # verificando se a aresta inversa já não existe na lista.
            if not any(e['from'] == irmao.uuid and e['to'] == p.uuid and e['label'] == 'IRMAO' for e in edges):
                edges.append(
                    {'from': p.uuid, 'to': irmao.uuid, 'label': 'IRMAO'})

    # Nós de Eventos
    for e in eventos:
        nodes.append({'id': e.uuid, 'label': e.tipo, 'group': 'evento'})

    return JsonResponse({'nodes': nodes, 'edges': edges})


# ==========================================
# 3. API DE PESSOAS (CRUD + Auditoria)
# ==========================================

@csrf_exempt
def api_listar_pessoas(request):
    if request.method == 'GET':
        pessoas = Pessoa.nodes.all()
        data = [{'uuid': p.uuid, 'nome': p.nomeCompleto,
                 'apelido': p.apelido} for p in pessoas]
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Você precisa estar logado para cadastrar.")

        try:
            dados = json.loads(request.body)

            # 1. TRATAMENTO DA DATA DE NASCIMENTO
            data_str = dados.get('dataNascimento')
            data_nasc_obj = None
            if data_str:
                try:
                    data_nasc_obj = datetime.strptime(
                        data_str, '%Y-%m-%d').date()
                except ValueError:
                    return HttpResponseBadRequest("Data nascimento inválida.")

            # 2. CRIA A PESSOA
            nova_pessoa = Pessoa(
                nomeCompleto=dados.get('nomeCompleto'),
                apelido=dados.get('apelido'),
                dataNascimento=data_nasc_obj,
                criado_por_id=request.user.id,
                criado_por_nome=request.user.username,
                criado_em=datetime.now().isoformat()
            ).save()

            # --- LOG DE CRIAÇÃO ---
            registrar_log(request.user, "Criou", "Pessoa",
                          f"Cadastrou: {nova_pessoa.nomeCompleto}")

            # 3. AUTOMAÇÃO: EVENTO DE NASCIMENTO
            if data_nasc_obj:
                evento_nasc = Evento(
                    tipo='Nascimento',
                    data=data_nasc_obj,
                    descricao=f"Nascimento de {nova_pessoa.nomeCompleto}",
                    local="Local de Nascimento"
                ).save()
                nova_pessoa.participou.connect(evento_nasc)

            # 4. AUTOMAÇÃO: PAIS
            uuid_pai = dados.get('pai_uuid')
            if uuid_pai:
                pai = Pessoa.nodes.get(uuid=uuid_pai)
                pai.pai_de.connect(nova_pessoa)

            uuid_mae = dados.get('mae_uuid')
            if uuid_mae:
                mae = Pessoa.nodes.get(uuid=uuid_mae)
                mae.mae_de.connect(nova_pessoa)

            # 5. AUTOMAÇÃO: CASAMENTO
            uuid_conjuge = dados.get('conjuge_uuid')
            if uuid_conjuge:
                conjuge = Pessoa.nodes.get(uuid=uuid_conjuge)
                nova_pessoa.casado_com.connect(conjuge)

                data_casamento_str = dados.get('dataCasamento')
                if data_casamento_str:
                    try:
                        dt_casamento = datetime.strptime(
                            data_casamento_str, '%Y-%m-%d').date()
                        evento_casamento = Evento(
                            tipo='Casamento',
                            data=dt_casamento,
                            descricao=f"Casamento de {nova_pessoa.nomeCompleto} e {conjuge.nomeCompleto}"
                        ).save()
                        nova_pessoa.participou.connect(evento_casamento)
                        conjuge.participou.connect(evento_casamento)
                    except ValueError:
                        pass

            return JsonResponse({'message': 'Pessoa e eventos automáticos criados!', 'uuid': nova_pessoa.uuid}, status=201)

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao processar: {str(e)}")


@csrf_exempt
def api_detalhe_pessoa(request, uuid):
    try:
        pessoa = Pessoa.nodes.get(uuid=uuid)
    except Pessoa.DoesNotExist:
        return HttpResponseNotFound("Pessoa não encontrada")

    if request.method == 'GET':
        eventos_participados = []
        for evento in pessoa.participou.all():
            eventos_participados.append({
                'tipo': evento.tipo,
                'data': str(evento.data) if evento.data else 'Data desc.',
                'descricao': getattr(evento, 'descricao', '')
            })

        return JsonResponse({
            'uuid': pessoa.uuid,
            'nome': pessoa.nomeCompleto,
            'apelido': pessoa.apelido,
            'data_nascimento': str(pessoa.dataNascimento) if pessoa.dataNascimento else None,
            'criado_por_nome': getattr(pessoa, 'criado_por_nome', 'Sistema'),
            'criado_por_id': getattr(pessoa, 'criado_por_id', None),
            'eventos': eventos_participados
        })

    elif request.method == 'DELETE':
        # BLOQUEIO DE ADMIN
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponseForbidden("Apenas administradores podem excluir.")

        nome_pessoa = pessoa.nomeCompleto
        pessoa.delete()

        # GERA O LOG
        registrar_log(request.user, "Excluiu", "Pessoa",
                      f"Apagou permanentemente a pessoa: {nome_pessoa}")
        return JsonResponse({'message': 'Registro excluído.'})

    elif request.method == 'PUT':
        # BLOQUEIO DE ADMIN
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponseForbidden("Apenas administradores podem editar.")

        dados = json.loads(request.body)
        nome_antigo = pessoa.nomeCompleto

        pessoa.nomeCompleto = dados.get('nomeCompleto', pessoa.nomeCompleto)
        pessoa.apelido = dados.get('apelido', pessoa.apelido)
        pessoa.save()

        # GERA O LOG
        registrar_log(request.user, "Editou", "Pessoa",
                      f"Alterou dados de: {nome_antigo}")
        return JsonResponse({'message': 'Dados atualizados!'})


# ==========================================
# 4. API DE COMENTÁRIOS
# ==========================================

@csrf_exempt
def api_adicionar_comentario(request, uuid):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Logue para comentar.")

        try:
            dados = json.loads(request.body)
            texto = dados.get('texto')

            query = """
            MATCH (p:Pessoa {uuid: $uuid_pessoa})
            CREATE (c:Comentario {
                texto: $texto,
                autor: $autor,
                data: $data,
                uuid: $uuid_comentario
            })
            CREATE (c)-[:SOBRE]->(p)
            """

            db.cypher_query(query, {
                'uuid_pessoa': uuid,
                'uuid_comentario': str(uuid_lib.uuid4()),
                'texto': texto,
                'autor': request.user.username,
                'data': datetime.now().strftime("%d/%m/%Y %H:%M")
            })

            return JsonResponse({'message': 'Comentário adicionado!'})
        except Exception as e:
            return HttpResponseBadRequest(str(e))


# ==========================================
# 5. API DE EVENTOS
# ==========================================

@csrf_exempt
def api_listar_eventos(request):
    if request.method == 'GET':
        eventos = Evento.nodes.order_by('data')
        data = []
        for e in eventos:
            # Busca os participantes deste evento específico
            query = """
            MATCH (p:Pessoa)-[]->(e:Evento {uuid: $uuid})
            RETURN p
            """
            results, meta = db.cypher_query(query, {'uuid': e.uuid})

            participantes = []
            for row in results:
                node_pessoa = row[0]
                participantes.append({
                    'uuid': node_pessoa.get('uuid'),
                    'nome': node_pessoa.get('nomeCompleto'),
                    'apelido': node_pessoa.get('apelido', '')
                })

            data.append({
                'uuid': e.uuid,
                'tipo': e.tipo,
                'data': str(e.data) if e.data else "Data desc.",
                'local': getattr(e, 'local', ''),
                'descricao': getattr(e, 'descricao', ''),
                'participantes': participantes
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Login necessário.")

        try:
            dados = json.loads(request.body)
            data_str = dados.get('data')
            data_formatada = None

            if data_str:
                try:
                    data_formatada = datetime.strptime(
                        data_str, '%Y-%m-%d').date()
                except ValueError:
                    return HttpResponseBadRequest("Data inválida. Use AAAA-MM-DD.")

            novo_evento = Evento(
                tipo=dados.get('tipo'),
                data=data_formatada,
                local=dados.get('local'),
                descricao=dados.get('descricao')
            ).save()

            registrar_log(request.user, "Criou", "Evento",
                          f"Registrou o evento: {novo_evento.tipo}")
            return JsonResponse({'message': 'Evento criado!', 'uuid': novo_evento.uuid}, status=201)

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao criar evento: {str(e)}")


@csrf_exempt
def api_detalhe_evento(request, uuid):
    try:
        evento = Evento.nodes.get(uuid=uuid)
    except Evento.DoesNotExist:
        return HttpResponseNotFound("Evento não encontrado")

    if request.method == 'GET':
        query = """
        MATCH (p:Pessoa)-[]->(e:Evento {uuid: $uuid})
        RETURN p
        """
        results, meta = db.cypher_query(query, {'uuid': uuid})

        participantes = []
        for row in results:
            node_pessoa = row[0]
            participantes.append({
                'uuid': node_pessoa.get('uuid'),
                'nome': node_pessoa.get('nomeCompleto')
            })

        return JsonResponse({
            'uuid': evento.uuid,
            'tipo': evento.tipo,
            'data': str(evento.data) if evento.data else "Data desc.",
            'local': getattr(evento, 'local', 'Local não informado'),
            'descricao': getattr(evento, 'descricao', ''),
            'participantes': participantes
        })

    elif request.method == 'DELETE':
        # BLOQUEIO DE ADMIN
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponseForbidden("Apenas administradores podem excluir eventos.")

        tipo_evento = evento.tipo
        evento.delete()

        registrar_log(request.user, "Excluiu", "Evento",
                      f"Apagou permanentemente o evento: {tipo_evento}")
        return JsonResponse({'message': 'Evento excluído.'})

    elif request.method == 'PUT':
        # BLOQUEIO DE ADMIN
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponseForbidden("Apenas administradores podem editar eventos.")

        dados = json.loads(request.body)
        tipo_antigo = evento.tipo

        evento.tipo = dados.get('tipo', evento.tipo)
        evento.local = dados.get('local', evento.local)
        evento.descricao = dados.get('descricao', evento.descricao)
        evento.save()

        registrar_log(request.user, "Editou", "Evento",
                      f"Alterou dados do evento: {tipo_antigo}")
        return JsonResponse({'message': 'Evento atualizado!'})


# ==========================================
# 6. API DE RELACIONAMENTOS
# ==========================================

@csrf_exempt
def api_criar_relacionamento(request):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Login necessário.")

        try:
            dados = json.loads(request.body)
            origem = Pessoa.nodes.get(uuid=dados['origem_uuid'])
            tipo = dados['tipo']

            if tipo == 'FOI':
                destino = Evento.nodes.get(uuid=dados['destino_uuid'])
                origem.participou.connect(destino)
                registrar_log(request.user, "Criou Laço", "Relacionamento",
                              f"Conectou {origem.nomeCompleto} ao evento {destino.tipo}")
                return JsonResponse({'message': 'Presença confirmada!'})

            else:
                destino = Pessoa.nodes.get(uuid=dados['destino_uuid'])
                if tipo == 'PAI':
                    origem.pai_de.connect(destino)
                elif tipo == 'MAE':
                    origem.mae_de.connect(destino)
                elif tipo == 'CASADO':
                    origem.casado_com.connect(destino)
                elif tipo == 'IRMAO':
                    origem.irmao_de.connect(destino)
                    destino.irmao_de.connect(origem)
                else:
                    return HttpResponseBadRequest("Tipo inválido")

                registrar_log(request.user, "Criou Laço", "Relacionamento",
                              f"Conectou {origem.nomeCompleto} como {tipo} de {destino.nomeCompleto}")
                return JsonResponse({'message': f'Relacionamento {tipo} criado!'})

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao conectar: {str(e)}")

    return HttpResponseBadRequest("Método não permitido")


# ==========================================
# 7. API DE LOGS (Auditoria)
# ==========================================

@csrf_exempt
def api_listar_logs(request):
    if not request.user.is_authenticated or not request.user.is_superuser:
        return HttpResponseForbidden("Acesso negado. Apenas administradores.")

    logs = RegistroAtividade.objects.all()[:100]  # Pega os 100 mais recentes
    data = [{
        'id': log.id,
        'usuario': log.usuario,
        'acao': log.acao,
        'entidade': log.entidade,
        'detalhes': log.detalhes,
        'data_hora': log.data_hora.strftime("%d/%m/%Y - %H:%M:%S")
    } for log in logs]

    return JsonResponse(data, safe=False)

# ==========================================
# 8. API DE SOLICITAÇÕES (Workflow de Aprovação)
# ==========================================


@csrf_exempt
def api_solicitacoes(request):
    # GET: Admin visualiza as pendentes
    if request.method == 'GET':
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponseForbidden("Apenas admins podem ver as solicitações.")

        solicitacoes = Solicitacao.objects.filter(status='PENDENTE').values()
        # Converte para lista para enviar no JSON
        data = list(solicitacoes)
        for s in data:
            s['data_solicitacao'] = s['data_solicitacao'].strftime(
                "%d/%m/%Y - %H:%M")
        return JsonResponse(data, safe=False)

    # POST: Usuário comum cria uma solicitação
    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Login necessário.")

        try:
            dados = json.loads(request.body)
            # Salva a solicitação no banco
            Solicitacao.objects.create(
                usuario=request.user.username,
                tipo_acao=dados['tipo_acao'],
                entidade=dados['entidade'],
                uuid_entidade=dados['uuid_entidade'],
                motivo=dados['motivo'],
                dados_novos=json.dumps(dados.get('dados_novos', {}))
            )

            registrar_log(request.user, "Solicitou",
                          dados['entidade'], f"Pediu para {dados['tipo_acao']} - Motivo: {dados['motivo']}")
            return JsonResponse({'message': 'Solicitação enviada aos administradores!'})
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao solicitar: {str(e)}")


@csrf_exempt
def api_processar_solicitacao(request, id):
    """Admin aprova ou nega uma solicitação"""
    if request.method == 'PUT':
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponseForbidden("Apenas admins.")

        try:
            dados = json.loads(request.body)
            acao_admin = dados.get('acao')  # 'APROVAR' ou 'NEGAR'
            solicitacao = Solicitacao.objects.get(id=id)

            if acao_admin == 'NEGAR':
                solicitacao.status = 'NEGADA'
                solicitacao.save()
                registrar_log(request.user, "Negou", "Solicitação",
                              f"Negou pedido de {solicitacao.usuario}")
                return JsonResponse({'message': 'Solicitação negada.'})

            elif acao_admin == 'APROVAR':
                # 1. Busca o nó correto no Neo4j
                if solicitacao.entidade == 'Pessoa':
                    node = Pessoa.nodes.get(uuid=solicitacao.uuid_entidade)
                else:
                    node = Evento.nodes.get(uuid=solicitacao.uuid_entidade)

                # 2. Executa a Ação (Excluir ou Editar)
                if solicitacao.tipo_acao == 'Excluir':
                    nome_registro = getattr(
                        node, 'nomeCompleto', getattr(node, 'tipo', 'Registro'))
                    node.delete()
                    registrar_log(request.user, "Excluiu", solicitacao.entidade,
                                  f"Excluiu {nome_registro} após aprovar solicitação")

                elif solicitacao.tipo_acao == 'Editar':
                    novos_dados = json.loads(solicitacao.dados_novos)
                    if solicitacao.entidade == 'Pessoa':
                        node.nomeCompleto = novos_dados.get(
                            'nomeCompleto', node.nomeCompleto)
                        node.apelido = novos_dados.get('apelido', node.apelido)
                    else:
                        node.tipo = novos_dados.get('tipo', node.tipo)
                        node.local = novos_dados.get('local', node.local)
                        node.descricao = novos_dados.get(
                            'descricao', node.descricao)
                    node.save()
                    registrar_log(request.user, "Editou", solicitacao.entidade,
                                  f"Editou registro após aprovar solicitação")

                # 3. Atualiza o status
                solicitacao.status = 'APROVADA'
                solicitacao.save()
                return JsonResponse({'message': 'Solicitação aprovada e aplicada ao grafo.'})

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao processar: {str(e)}")
