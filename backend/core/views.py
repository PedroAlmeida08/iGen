import json
import uuid as uuid_lib
from datetime import datetime
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden, HttpResponseNotFound
from neomodel import db

# Importação dos modelos originais e dos novos modelos de Família
from .models import (
    Pessoa, Evento, Comentario, RegistroAtividade, Solicitacao,
    FamiliaWorkspace, MembroFamilia, FamiliaNode
)

# ==========================================
# FUNÇÕES AUXILIARES (Autenticação e Logs)
# ==========================================


def obter_contexto_familia(request):
    """
    Valida a sessão e verifica se o usuário tem acesso à família especificada.
    Retorna: FamiliaWorkspace (DB Relacional), FamiliaNode (Grafo), MembroFamilia, Erro
    """
    if not request.user.is_authenticated:
        return None, None, None, HttpResponseForbidden("Login necessário.")

    familia_uuid = request.headers.get('X-Familia-UUID')
    if not familia_uuid:
        return None, None, None, HttpResponseBadRequest("Cabeçalho X-Familia-UUID é obrigatório.")

    try:
        familia_ws = FamiliaWorkspace.objects.get(uuid_referencia=familia_uuid)
        membro = MembroFamilia.objects.get(
            usuario=request.user, familia=familia_ws)
        familia_node = FamiliaNode.nodes.get(uuid=familia_uuid)
        return familia_ws, familia_node, membro, None
    except (FamiliaWorkspace.DoesNotExist, MembroFamilia.DoesNotExist, FamiliaNode.DoesNotExist):
        return None, None, None, HttpResponseForbidden("Acesso negado a este ambiente familiar.")


def registrar_log(usuario, familia_ws, acao, entidade, detalhes):
    """Guarda uma ação no histórico isolado da família."""
    nome_usuario = usuario.username if hasattr(
        usuario, 'username') else str(usuario)
    RegistroAtividade.objects.create(
        usuario=usuario,
        familia=familia_ws,
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
            return HttpResponseBadRequest(f"Erro ao registar: {str(e)}")


@csrf_exempt
def api_login(request):
    if request.method == 'POST':
        dados = json.loads(request.body)
        username = dados.get('username')
        password = dados.get('password')

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return JsonResponse({
                'message': 'Login realizado com sucesso!',
                'user': {'id': user.id, 'username': user.username}
            })
        else:
            return JsonResponse({'message': 'Usuário ou senha incorretos.'}, status=401)


@csrf_exempt
def api_logout(request):
    logout(request)
    return JsonResponse({'message': 'Logout realizado'})


def api_check_auth(request):
    """Verifica a sessão e devolve a lista de famílias a que o usuário tem acesso"""
    if request.user.is_authenticated:
        familias = MembroFamilia.objects.filter(
            usuario=request.user).select_related('familia')
        lista_familias = [{
            'nome': f.familia.nome,
            'uuid': f.familia.uuid_referencia,
            'funcao': f.funcao
        } for f in familias]

        return JsonResponse({
            'is_logged_in': True,
            'user': {'id': request.user.id, 'username': request.user.username},
            'familias': lista_familias
        })
    return JsonResponse({'is_logged_in': False})


# ==========================================
# 2. API DO GRAFO (Isolada por Família)
# ==========================================

def api_grafo(request):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    nodes = []
    edges = []

    # Busca APENAS Pessoas e Eventos que pertencem a esta Família
    query_pessoas = "MATCH (p:Pessoa)-[:PERTENCE_A]->(f:FamiliaNode {uuid: $uuid}) RETURN p"
    res_pessoas, _ = db.cypher_query(
        query_pessoas, {'uuid': familia_node.uuid})

    query_eventos = "MATCH (e:Evento)-[:PERTENCE_A]->(f:FamiliaNode {uuid: $uuid}) RETURN e"
    res_eventos, _ = db.cypher_query(
        query_eventos, {'uuid': familia_node.uuid})

    for row in res_pessoas:
        p = Pessoa.inflate(row[0])
        nodes.append({
            'id': p.uuid,
            'label': p.nomeCompleto,
            'group': 'pessoa',
            'apelido': p.apelido,
        })

        for filho in p.pai_de.all():
            edges.append({'from': p.uuid, 'to': filho.uuid, 'label': 'PAI'})
        for filho in p.mae_de.all():
            edges.append({'from': p.uuid, 'to': filho.uuid, 'label': 'MAE'})
        for conjuge in p.casado_com.all():
            edges.append(
                {'from': p.uuid, 'to': conjuge.uuid, 'label': 'CASADO'})
        for evento in p.participou.all():
            edges.append({'from': p.uuid, 'to': evento.uuid, 'label': 'FOI'})
        for irmao in p.irmao_de.all():
            if not any(e['from'] == irmao.uuid and e['to'] == p.uuid and e['label'] == 'IRMAO' for e in edges):
                edges.append(
                    {'from': p.uuid, 'to': irmao.uuid, 'label': 'IRMAO'})

    for row in res_eventos:
        e = Evento.inflate(row[0])
        nodes.append({'id': e.uuid, 'label': e.tipo, 'group': 'evento'})

    return JsonResponse({'nodes': nodes, 'edges': edges})


# ==========================================
# 3. API DE PESSOAS (CRUD + Auditoria Isolada)
# ==========================================

@csrf_exempt
def api_listar_pessoas(request):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'GET':
        query = "MATCH (p:Pessoa)-[:PERTENCE_A]->(f:FamiliaNode {uuid: $uuid}) RETURN p"
        resultados, _ = db.cypher_query(query, {'uuid': familia_node.uuid})
        data = [{'uuid': row[0]['uuid'], 'nome': row[0]['nomeCompleto'],
                 'apelido': row[0].get('apelido', '')} for row in resultados]
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if membro.funcao == 'LEITOR':
            return HttpResponseForbidden("Leitores não podem registrar novas pessoas.")

        try:
            dados = json.loads(request.body)

            # Tratamento da Data de Nascimento
            data_str = dados.get('dataNascimento')
            data_nasc_obj = None
            if data_str:
                try:
                    data_nasc_obj = datetime.strptime(
                        data_str, '%Y-%m-%d').date()
                except ValueError:
                    return HttpResponseBadRequest("Data de nascimento inválida.")

            # Tratamento da Data de Óbito (NOVO)
            data_obito_str = dados.get('dataObito')
            data_obito_obj = None
            if data_obito_str:
                try:
                    data_obito_obj = datetime.strptime(
                        data_obito_str, '%Y-%m-%d').date()
                except ValueError:
                    return HttpResponseBadRequest("Data de óbito inválida.")

            # Cria a pessoa
            nova_pessoa = Pessoa(
                nomeCompleto=dados.get('nomeCompleto'),
                apelido=dados.get('apelido'),
                dataNascimento=data_nasc_obj,
                criado_por_id=request.user.id,
                criado_por_nome=request.user.username,
                criado_em=datetime.now().isoformat()
            ).save()

            # VÍNCULO OBRIGATÓRIO DE PRIVACIDADE
            nova_pessoa.pertence_a.connect(familia_node)

            registrar_log(request.user, familia_ws, "Criou",
                          "Pessoa", f"Cadastrou: {nova_pessoa.nomeCompleto}")

            # AUTOMAÇÃO: EVENTO DE NASCIMENTO
            if data_nasc_obj:
                evento_nasc = Evento(
                    tipo='Nascimento',
                    data=data_nasc_obj,
                    descricao=f"Nascimento de {nova_pessoa.nomeCompleto}",
                    local="Local de Nascimento"
                ).save()
                evento_nasc.pertence_a.connect(familia_node)
                nova_pessoa.participou.connect(evento_nasc)

            # AUTOMAÇÃO: EVENTO DE ÓBITO (NOVO)
            if data_obito_obj:
                evento_obito = Evento(
                    tipo='Óbito',
                    data=data_obito_obj,
                    descricao=f"Falecimento de {nova_pessoa.nomeCompleto}",
                    local="Não informado"
                ).save()
                evento_obito.pertence_a.connect(familia_node)
                nova_pessoa.participou.connect(evento_obito)

            # AUTOMAÇÃO: PAIS E CASAMENTOS (Apenas liga se os originais pertencerem à família)
            uuid_pai = dados.get('pai_uuid')
            if uuid_pai:
                try:
                    pai = Pessoa.nodes.get(uuid=uuid_pai)
                    if pai.pertence_a.is_connected(familia_node):
                        pai.pai_de.connect(nova_pessoa)
                except Pessoa.DoesNotExist:
                    pass

            uuid_mae = dados.get('mae_uuid')
            if uuid_mae:
                try:
                    mae = Pessoa.nodes.get(uuid=uuid_mae)
                    if mae.pertence_a.is_connected(familia_node):
                        mae.mae_de.connect(nova_pessoa)
                except Pessoa.DoesNotExist:
                    pass

            uuid_conjuge = dados.get('conjuge_uuid')
            if uuid_conjuge:
                try:
                    conjuge = Pessoa.nodes.get(uuid=uuid_conjuge)
                    if conjuge.pertence_a.is_connected(familia_node):
                        nova_pessoa.casado_com.connect(conjuge)

                        dt_cas_str = dados.get('dataCasamento')
                        if dt_cas_str:
                            try:
                                dt_cas = datetime.strptime(
                                    dt_cas_str, '%Y-%m-%d').date()
                                ev_cas = Evento(
                                    tipo='Casamento', data=dt_cas,
                                    descricao=f"Casamento de {nova_pessoa.nomeCompleto} e {conjuge.nomeCompleto}"
                                ).save()
                                ev_cas.pertence_a.connect(familia_node)
                                nova_pessoa.participou.connect(ev_cas)
                                conjuge.participou.connect(ev_cas)
                            except ValueError:
                                pass
                except Pessoa.DoesNotExist:
                    pass

            return JsonResponse({'message': 'Registro e automações criados com sucesso!', 'uuid': nova_pessoa.uuid}, status=201)
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao processar: {str(e)}")


@csrf_exempt
def api_detalhe_pessoa(request, uuid):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    try:
        pessoa = Pessoa.nodes.get(uuid=uuid)
        if not pessoa.pertence_a.is_connected(familia_node):
            return HttpResponseForbidden("Esta pessoa não pertence à sua família.")
    except Pessoa.DoesNotExist:
        return HttpResponseNotFound("Pessoa não encontrada.")

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
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem excluir registros.")

        nome_pessoa = pessoa.nomeCompleto
        pessoa.delete()
        registrar_log(request.user, familia_ws, "Excluiu",
                      "Pessoa", f"Apagou permanentemente: {nome_pessoa}")
        return JsonResponse({'message': 'Registro excluído com sucesso.'})

    elif request.method == 'PUT':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem editar registros.")

        dados = json.loads(request.body)
        nome_antigo = pessoa.nomeCompleto

        pessoa.nomeCompleto = dados.get('nomeCompleto', pessoa.nomeCompleto)
        pessoa.apelido = dados.get('apelido', pessoa.apelido)
        pessoa.save()

        registrar_log(request.user, familia_ws, "Editou",
                      "Pessoa", f"Alterou dados de: {nome_antigo}")
        return JsonResponse({'message': 'Dados atualizados com sucesso!'})


# ==========================================
# 4. API DE COMENTÁRIOS
# ==========================================

@csrf_exempt
def api_adicionar_comentario(request, uuid):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'POST':
        if membro.funcao == 'LEITOR':
            return HttpResponseForbidden("Leitores não podem efetuar comentários.")

        try:
            dados = json.loads(request.body)
            texto = dados.get('texto')

            # O cypher_query garante que o comentário é criado e ligado tanto à Pessoa quanto à Família
            query = """
            MATCH (p:Pessoa {uuid: $uuid_pessoa})-[:PERTENCE_A]->(f:FamiliaNode {uuid: $uuid_familia})
            CREATE (c:Comentario {
                texto: $texto,
                autor: $autor,
                data: $data,
                uuid: $uuid_comentario
            })
            CREATE (c)-[:SOBRE]->(p)
            CREATE (c)-[:PERTENCE_A]->(f)
            """

            db.cypher_query(query, {
                'uuid_pessoa': uuid,
                'uuid_familia': familia_node.uuid,
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
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'GET':
        query = """
        MATCH (e:Evento)-[:PERTENCE_A]->(f:FamiliaNode {uuid: $uuid_familia})
        OPTIONAL MATCH (p:Pessoa)-[]->(e)
        RETURN e, collect(p) as participantes
        ORDER BY e.data
        """
        results, _ = db.cypher_query(
            query, {'uuid_familia': familia_node.uuid})

        data = []
        for row in results:
            node_evento = row[0]
            participantes_nodes = row[1]

            participantes = []
            for p in participantes_nodes:
                if p:
                    participantes.append({
                        'uuid': p.get('uuid'),
                        'nome': p.get('nomeCompleto'),
                        'apelido': p.get('apelido', '')
                    })

            data.append({
                'uuid': node_evento.get('uuid'),
                'tipo': node_evento.get('tipo'),
                'data': node_evento.get('data') if node_evento.get('data') else "Data desc.",
                'local': node_evento.get('local', ''),
                'descricao': node_evento.get('descricao', ''),
                'participantes': participantes
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if membro.funcao == 'LEITOR':
            return HttpResponseForbidden("Leitores não podem registar novos eventos.")

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

            # VÍNCULO OBRIGATÓRIO DE PRIVACIDADE
            novo_evento.pertence_a.connect(familia_node)

            registrar_log(request.user, familia_ws, "Criou",
                          "Evento", f"Registrou o evento: {novo_evento.tipo}")
            return JsonResponse({'message': 'Evento criado com sucesso!', 'uuid': novo_evento.uuid}, status=201)
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao criar evento: {str(e)}")


@csrf_exempt
def api_detalhe_evento(request, uuid):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    try:
        evento = Evento.nodes.get(uuid=uuid)
        if not evento.pertence_a.is_connected(familia_node):
            return HttpResponseForbidden("Este evento não pertence à sua família.")
    except Evento.DoesNotExist:
        return HttpResponseNotFound("Evento não encontrado.")

    if request.method == 'GET':
        query = "MATCH (p:Pessoa)-[]->(e:Evento {uuid: $uuid}) RETURN p"
        results, _ = db.cypher_query(query, {'uuid': uuid})

        participantes = [{'uuid': row[0].get('uuid'), 'nome': row[0].get(
            'nomeCompleto')} for row in results]

        return JsonResponse({
            'uuid': evento.uuid,
            'tipo': evento.tipo,
            'data': str(evento.data) if evento.data else "Data desc.",
            'local': getattr(evento, 'local', 'Local não informado'),
            'descricao': getattr(evento, 'descricao', ''),
            'participantes': participantes
        })

    elif request.method == 'DELETE':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem excluir eventos.")

        tipo_evento = evento.tipo
        evento.delete()
        registrar_log(request.user, familia_ws, "Excluiu", "Evento",
                      f"Apagou permanentemente o evento: {tipo_evento}")
        return JsonResponse({'message': 'Evento excluído com sucesso.'})

    elif request.method == 'PUT':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem editar eventos.")

        dados = json.loads(request.body)
        tipo_antigo = evento.tipo

        evento.tipo = dados.get('tipo', evento.tipo)
        evento.local = dados.get('local', evento.local)
        evento.descricao = dados.get('descricao', evento.descricao)
        evento.save()

        registrar_log(request.user, familia_ws, "Editou", "Evento",
                      f"Alterou dados do evento: {tipo_antigo}")
        return JsonResponse({'message': 'Evento atualizado com sucesso!'})


# ==========================================
# 6. API DE RELACIONAMENTOS
# ==========================================

@csrf_exempt
def api_criar_relacionamento(request):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'POST':
        if membro.funcao == 'LEITOR':
            return HttpResponseForbidden("Leitores não podem alterar a estrutura da árvore.")

        try:
            dados = json.loads(request.body)
            origem = Pessoa.nodes.get(uuid=dados['origem_uuid'])
            tipo = dados['tipo']

            if not origem.pertence_a.is_connected(familia_node):
                return HttpResponseForbidden("O nó de origem não pertence à sua família.")

            if tipo == 'FOI':
                destino = Evento.nodes.get(uuid=dados['destino_uuid'])
                if not destino.pertence_a.is_connected(familia_node):
                    return HttpResponseForbidden("O evento não pertence à sua família.")

                origem.participou.connect(destino)
                registrar_log(request.user, familia_ws, "Criou Laço", "Relacionamento",
                              f"Conectou {origem.nomeCompleto} ao evento {destino.tipo}")
                return JsonResponse({'message': 'Presença confirmada!'})

            else:
                destino = Pessoa.nodes.get(uuid=dados['destino_uuid'])
                if not destino.pertence_a.is_connected(familia_node):
                    return HttpResponseForbidden("A pessoa de destino não pertence à sua família.")

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
                    return HttpResponseBadRequest("Tipo de relacionamento inválido.")

                registrar_log(request.user, familia_ws, "Criou Laço", "Relacionamento",
                              f"Conectou {origem.nomeCompleto} como {tipo} de {destino.nomeCompleto}")
                return JsonResponse({'message': f'Relacionamento {tipo} criado com sucesso!'})

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao conectar: {str(e)}")

    return HttpResponseBadRequest("Método não permitido.")


# ==========================================
# 7. API DE LOGS (Auditoria)
# ==========================================

@csrf_exempt
def api_listar_logs(request):
    familia_ws, _, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if membro.funcao != 'ADMIN':
        return HttpResponseForbidden("Acesso negado. Apenas administradores da família.")

    logs = RegistroAtividade.objects.filter(
        familia=familia_ws).order_by('-data_hora')[:100]
    data = [{
        'id': log.id,
        'usuario': log.usuario.username if log.usuario else 'Sistema',
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
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'GET':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores podem gerir as solicitações da família.")

        solicitacoes = Solicitacao.objects.filter(
            familia=familia_ws, status='PENDENTE')
        data = [{
            'id': s.id,
            'usuario': s.usuario.username,
            'tipo_acao': s.tipo_acao,
            'entidade': s.entidade,
            'uuid_entidade': s.uuid_entidade,
            'motivo': s.motivo,
            'dados_novos': json.loads(s.dados_novos) if s.dados_novos else {},
            'data_solicitacao': s.data_solicitacao.strftime("%d/%m/%Y - %H:%M")
        } for s in solicitacoes]

        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if membro.funcao == 'ADMIN':
            return HttpResponseBadRequest("Administradores podem alterar os dados diretamente sem solicitar.")

        try:
            dados = json.loads(request.body)
            Solicitacao.objects.create(
                usuario=request.user,
                familia=familia_ws,
                tipo_acao=dados['tipo_acao'],
                entidade=dados['entidade'],
                uuid_entidade=dados['uuid_entidade'],
                motivo=dados['motivo'],
                dados_novos=json.dumps(dados.get('dados_novos', {}))
            )

            registrar_log(request.user, familia_ws, "Solicitou",
                          dados['entidade'], f"Pediu para {dados['tipo_acao']} - Motivo: {dados['motivo']}")
            return JsonResponse({'message': 'Solicitação enviada aos administradores da família!'})
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao solicitar: {str(e)}")


@csrf_exempt
def api_processar_solicitacao(request, id):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'PUT':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores podem aprovar solicitações.")

        try:
            dados = json.loads(request.body)
            acao_admin = dados.get('acao')
            solicitacao = Solicitacao.objects.get(id=id, familia=familia_ws)

            if acao_admin == 'NEGAR':
                solicitacao.status = 'NEGADA'
                solicitacao.save()
                registrar_log(request.user, familia_ws, "Negou", "Solicitação",
                              f"Negou pedido de {solicitacao.usuario.username}")
                return JsonResponse({'message': 'Solicitação negada.'})

            elif acao_admin == 'APROVAR':
                if solicitacao.entidade == 'Pessoa':
                    node = Pessoa.nodes.get(uuid=solicitacao.uuid_entidade)
                else:
                    node = Evento.nodes.get(uuid=solicitacao.uuid_entidade)

                if solicitacao.tipo_acao == 'Excluir':
                    nome_registro = getattr(
                        node, 'nomeCompleto', getattr(node, 'tipo', 'Registro'))
                    node.delete()
                    registrar_log(request.user, familia_ws, "Excluiu",
                                  solicitacao.entidade, f"Excluiu {nome_registro} após aprovação")

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
                    registrar_log(request.user, familia_ws, "Editou",
                                  solicitacao.entidade, "Editou registro após aprovação")

                solicitacao.status = 'APROVADA'
                solicitacao.save()
                return JsonResponse({'message': 'Solicitação aprovada e aplicada à árvore familiar.'})

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao processar a solicitação: {str(e)}")

# ==========================================
# 9. API DE GESTÃO DE FAMÍLIAS (Workspaces)
# ==========================================


@csrf_exempt
def api_criar_familia(request):
    """Cria um novo Workspace e define o criador como Administrador."""
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Login necessário para criar uma família.")

        try:
            dados = json.loads(request.body)
            nome_familia = dados.get('nome')

            if not nome_familia:
                return HttpResponseBadRequest("O nome da família é obrigatório.")

            novo_uuid = str(uuid_lib.uuid4())

            # 1. Cria o ambiente no banco relacional (SQLite)
            familia_ws = FamiliaWorkspace.objects.create(
                nome=nome_familia,
                uuid_referencia=novo_uuid
            )

            # 2. Cria o nó raiz de privacidade no Grafo (Neo4j)
            FamiliaNode(
                uuid=novo_uuid,
                nome=nome_familia
            ).save()

            # 3. Dá poderes de Administrador ao usuário que criou
            MembroFamilia.objects.create(
                usuario=request.user,
                familia=familia_ws,
                funcao='ADMIN'
            )

            registrar_log(request.user, familia_ws, "Criou",
                          "Workspace", f"Fundou a família: {nome_familia}")

            return JsonResponse({
                'message': 'Família criada com sucesso!',
                'uuid': novo_uuid,
                'nome': nome_familia
            }, status=201)

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao criar família: {str(e)}")

    return HttpResponseBadRequest("Método não permitido.")


@csrf_exempt
def api_resgatar_dados_antigos(request):
    """
    Função de manutenção: Puxa todos os nós antigos do Neo4j (que não têm família)
    para dentro da família atualmente selecionada.
    """
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'POST':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores podem importar dados.")

        # Cypher: Procura Pessoas e Eventos que NÃO têm a relação PERTENCE_A e liga-os a esta família
        query = """
        MATCH (n) WHERE (n:Pessoa OR n:Evento) AND NOT (n)-[:PERTENCE_A]->(:FamiliaNode)
        MATCH (f:FamiliaNode {uuid: $uuid})
        CREATE (n)-[:PERTENCE_A]->(f)
        RETURN count(n)
        """
        results, _ = db.cypher_query(query, {'uuid': familia_node.uuid})
        registros_afetados = results[0][0]

        registrar_log(request.user, familia_ws, "Importou", "Manutenção",
                      f"Resgatou {registros_afetados} registros órfãos.")

        return JsonResponse({'message': f'{registros_afetados} registros antigos foram integrados na sua família.'})
