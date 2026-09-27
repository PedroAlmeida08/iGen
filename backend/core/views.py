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
    if not familia_uuid or familia_uuid in ['undefined', 'null', '']:
        return None, None, None, HttpResponseBadRequest("Cabeçalho X-Familia-UUID é obrigatório.")

    try:
        familia_ws = FamiliaWorkspace.objects.get(uuid_referencia=familia_uuid)
        familia_node = FamiliaNode.nodes.get(uuid=familia_uuid)

        if request.user.is_superuser:
            try:
                membro = MembroFamilia.objects.get(usuario=request.user, familia=familia_ws)
            except MembroFamilia.DoesNotExist:
                membro = MembroFamilia(usuario=request.user, familia=familia_ws, funcao='ADMIN')
            return familia_ws, familia_node, membro, None

        membro = MembroFamilia.objects.get(
            usuario=request.user, familia=familia_ws)
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
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'is_superuser': user.is_superuser,
                    'is_staff': user.is_staff
                }
            })
        else:
            return JsonResponse({'message': 'Usuário ou senha incorretos.'}, status=401)


@csrf_exempt
def api_logout(request):
    logout(request)
    return JsonResponse({'message': 'Logout realizado'})


def api_check_auth(request):
    """Verifica a sessão e devolve a lista de famílias a que o usuário tem acesso e todas as famílias disponíveis"""
    if request.user.is_authenticated:
        todas_familias_objs = FamiliaWorkspace.objects.all().order_by('nome')
        todas_familias = [{
            'nome': f.nome,
            'uuid': f.uuid_referencia
        } for f in todas_familias_objs]

        if request.user.is_superuser:
            membros_map = {m.familia_id: m.funcao for m in MembroFamilia.objects.filter(usuario=request.user)}
            lista_familias = [{
                'nome': f.nome,
                'uuid': f.uuid_referencia,
                'funcao': membros_map.get(f.id, 'ADMIN')
            } for f in todas_familias_objs]
        else:
            familias = MembroFamilia.objects.filter(
                usuario=request.user).select_related('familia')
            lista_familias = [{
                'nome': f.familia.nome,
                'uuid': f.familia.uuid_referencia,
                'funcao': f.funcao
            } for f in familias]

        solicitacao_familia_pendente = Solicitacao.objects.filter(
            usuario=request.user, entidade='Familia', status='PENDENTE'
        ).exists()

        ultima_solicitacao_obj = Solicitacao.objects.filter(
            usuario=request.user, entidade='Familia'
        ).order_by('-data_solicitacao').first()

        ultima_solicitacao = None
        if ultima_solicitacao_obj:
            dados_parsed = {}
            if ultima_solicitacao_obj.dados_novos:
                try:
                    dados_parsed = json.loads(ultima_solicitacao_obj.dados_novos) if isinstance(
                        ultima_solicitacao_obj.dados_novos, str) else ultima_solicitacao_obj.dados_novos
                except Exception:
                    dados_parsed = {}
            ultima_solicitacao = {
                'id': ultima_solicitacao_obj.id,
                'status': ultima_solicitacao_obj.status,
                'motivo': ultima_solicitacao_obj.motivo,
                'dados_novos': dados_parsed,
                'data': ultima_solicitacao_obj.data_solicitacao.strftime("%d/%m/%Y %H:%M")
            }

        return JsonResponse({
            'is_logged_in': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'is_superuser': request.user.is_superuser,
                'is_staff': request.user.is_staff
            },
            'familias': lista_familias,
            'todas_familias': todas_familias,
            'solicitacao_familia_pendente': solicitacao_familia_pendente,
            'ultima_solicitacao': ultima_solicitacao
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
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores podem cadastrar pessoas diretamente. Usuários comuns devem enviar uma solicitação.")

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

        query_comentarios = "MATCH (c:Comentario)-[:SOBRE]->(p:Pessoa {uuid: $uuid}) RETURN c ORDER BY c.data_hora DESC"
        res_com, _ = db.cypher_query(query_comentarios, {'uuid': uuid})
        comentarios = [{'uuid': row[0].get('uuid'), 'texto': row[0].get('texto'), 'autor': row[0].get(
            'autor'), 'data_hora': row[0].get('data_hora')} for row in res_com]

        return JsonResponse({
            'uuid': pessoa.uuid,
            'nome': pessoa.nomeCompleto,
            'apelido': pessoa.apelido,
            'data_nascimento': str(pessoa.dataNascimento) if pessoa.dataNascimento else None,
            'data_obito': getattr(pessoa, 'dataObito', None),
            'criado_por_nome': getattr(pessoa, 'criado_por_nome', 'Sistema'),
            'criado_por_id': getattr(pessoa, 'criado_por_id', None),
            'eventos': eventos_participados,
            'comentarios': comentarios
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

        if 'pai_uuid' in dados:
            db.cypher_query(
                "MATCH (pai:Pessoa)-[r:PAI_DE]->(filho:Pessoa {uuid: $uuid}) DELETE r", {'uuid': uuid})
            if dados['pai_uuid']:
                db.cypher_query("MATCH (pai:Pessoa {uuid: $pai_uuid}), (filho:Pessoa {uuid: $uuid}) MERGE (pai)-[:PAI_DE]->(filho)", {
                                'pai_uuid': dados['pai_uuid'], 'uuid': uuid})

        if 'mae_uuid' in dados:
            db.cypher_query(
                "MATCH (mae:Pessoa)-[r:MAE_DE]->(filho:Pessoa {uuid: $uuid}) DELETE r", {'uuid': uuid})
            if dados['mae_uuid']:
                db.cypher_query("MATCH (mae:Pessoa {uuid: $mae_uuid}), (filho:Pessoa {uuid: $uuid}) MERGE (mae)-[:MAE_DE]->(filho)", {
                                'mae_uuid': dados['mae_uuid'], 'uuid': uuid})

        if 'conjuge_uuid' in dados:
            db.cypher_query(
                "MATCH (p:Pessoa {uuid: $uuid})-[r:CASADO_COM]-(c:Pessoa) DELETE r", {'uuid': uuid})
            if dados['conjuge_uuid']:
                db.cypher_query("MATCH (p1:Pessoa {uuid: $uuid}), (p2:Pessoa {uuid: $conjuge_uuid}) MERGE (p1)-[:CASADO_COM]-(p2)", {
                                'uuid': uuid, 'conjuge_uuid': dados['conjuge_uuid']})

        registrar_log(request.user, familia_ws, "Editou",
                      "Pessoa", f"Alterou dados de: {nome_antigo}")
        return JsonResponse({'message': 'Dados atualizados com sucesso!'})
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

        # Resgata comentários da pessoa
        query_comentarios = "MATCH (c:Comentario)-[:SOBRE]->(p:Pessoa {uuid: $uuid}) RETURN c ORDER BY c.data_hora DESC"
        res_com, _ = db.cypher_query(query_comentarios, {'uuid': uuid})
        comentarios = [{'uuid': row[0].get('uuid'), 'texto': row[0].get('texto'), 'autor': row[0].get(
            'autor'), 'data_hora': row[0].get('data_hora')} for row in res_com]

        return JsonResponse({
            'uuid': pessoa.uuid,
            'nome': pessoa.nomeCompleto,
            'apelido': pessoa.apelido,
            'data_nascimento': str(pessoa.dataNascimento) if pessoa.dataNascimento else None,
            'data_obito': getattr(pessoa, 'dataObito', None),
            'foto_url': getattr(pessoa, 'foto_url', None),
            'criado_por_nome': getattr(pessoa, 'criado_por_nome', 'Sistema'),
            'criado_por_id': getattr(pessoa, 'criado_por_id', None),
            'eventos': eventos_participados,
            'comentarios': comentarios
        })

    elif request.method == 'DELETE':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem excluir registros.")

        nome_pessoa = pessoa.nomeCompleto
        pessoa.delete()
        registrar_log(request.user, familia_ws, "Excluiu",
                      "Pessoa", f"Apagou permanentemente: {nome_pessoa}")
        return JsonResponse({'message': 'Registro excluído com sucesso.'})

    # Usamos PUT ou POST para aceitar FormData com envio de fotos
    elif request.method in ['PUT', 'POST']:
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem editar registros.")

        # Identifica se é JSON ou envio de formulário com foto
        if request.content_type.startswith('multipart/form-data'):
            dados = request.POST
            foto = request.FILES.get('foto')
        else:
            dados = json.loads(request.body)
            foto = None

        nome_antigo = pessoa.nomeCompleto

        # Atualiza campos escalares
        pessoa.nomeCompleto = dados.get('nomeCompleto', pessoa.nomeCompleto)
        pessoa.apelido = dados.get('apelido', pessoa.apelido)

        # Salvamento de Foto
        if foto:
            fs = FileSystemStorage()
            filename = fs.save(foto.name, foto)
            pessoa.foto_url = request.build_absolute_uri(fs.url(filename))

        pessoa.save()

        # Atualização de Relacionamentos via Cypher
        if 'pai_uuid' in dados:
            db.cypher_query(
                "MATCH (pai:Pessoa)-[r:PAI_DE]->(filho:Pessoa {uuid: $uuid}) DELETE r", {'uuid': uuid})
            if dados['pai_uuid']:
                db.cypher_query("MATCH (pai:Pessoa {uuid: $pai_uuid}), (filho:Pessoa {uuid: $uuid}) MERGE (pai)-[:PAI_DE]->(filho)", {
                                'pai_uuid': dados['pai_uuid'], 'uuid': uuid})

        if 'mae_uuid' in dados:
            db.cypher_query(
                "MATCH (mae:Pessoa)-[r:MAE_DE]->(filho:Pessoa {uuid: $uuid}) DELETE r", {'uuid': uuid})
            if dados['mae_uuid']:
                db.cypher_query("MATCH (mae:Pessoa {uuid: $mae_uuid}), (filho:Pessoa {uuid: $uuid}) MERGE (mae)-[:MAE_DE]->(filho)", {
                                'mae_uuid': dados['mae_uuid'], 'uuid': uuid})

        if 'conjuge_uuid' in dados:
            db.cypher_query(
                "MATCH (p:Pessoa {uuid: $uuid})-[r:CASADO_COM]-(c:Pessoa) DELETE r", {'uuid': uuid})
            if dados['conjuge_uuid']:
                db.cypher_query("MATCH (p1:Pessoa {uuid: $uuid}), (p2:Pessoa {uuid: $conjuge_uuid}) MERGE (p1)-[:CASADO_COM]-(p2)", {
                                'uuid': uuid, 'conjuge_uuid': dados['conjuge_uuid']})

        registrar_log(request.user, familia_ws, "Editou",
                      "Pessoa", f"Alterou dados de: {nome_antigo}")
        return JsonResponse({'message': 'Dados e foto atualizados com sucesso!'})

# ==========================================
# 4. API DE COMENTÁRIOS
# ==========================================


@csrf_exempt
def api_comentarios(request, uuid_alvo):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'POST':
        try:
            dados = json.loads(request.body)
            texto = dados.get('texto')

            if not texto:
                return HttpResponseBadRequest("O texto do comentário não pode estar vazio.")

            # Gera um UUID para o comentário
            comentario_uuid = str(uuid_lib.uuid4())
            data_hora_atual = datetime.now().isoformat()
            autor = request.user.username

            # Query Cypher para criar o Comentário e ligar ao alvo (Pessoa ou Evento) e à Família
            query = """
            MATCH (alvo {uuid: $uuid_alvo})-[:PERTENCE_A]->(f:FamiliaNode {uuid: $familia_uuid})
            CREATE (c:Comentario {
                uuid: $comentario_uuid, 
                texto: $texto, 
                autor: $autor, 
                data_hora: $data_hora
            })
            CREATE (c)-[:SOBRE]->(alvo)
            CREATE (c)-[:PERTENCE_A]->(f)
            RETURN c.uuid
            """
            parametros = {
                'uuid_alvo': uuid_alvo,
                'familia_uuid': familia_node.uuid,
                'comentario_uuid': comentario_uuid,
                'texto': texto,
                'autor': autor,
                'data_hora': data_hora_atual
            }

            resultados, _ = db.cypher_query(query, parametros)

            if not resultados:
                return HttpResponseBadRequest("Alvo não encontrado ou não pertence a esta família.")

            return JsonResponse({'message': 'Comentário adicionado com sucesso!'}, status=201)

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao salvar comentário: {str(e)}")

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
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores podem registrar eventos diretamente. Usuários comuns devem enviar uma solicitação.")

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

        query_comentarios = "MATCH (c:Comentario)-[:SOBRE]->(e:Evento {uuid: $uuid}) RETURN c ORDER BY c.data_hora DESC"
        res_com, _ = db.cypher_query(query_comentarios, {'uuid': uuid})
        comentarios = [{'uuid': row[0].get('uuid'), 'texto': row[0].get('texto'), 'autor': row[0].get(
            'autor'), 'data_hora': row[0].get('data_hora')} for row in res_com]

        return JsonResponse({
            'uuid': evento.uuid,
            'tipo': evento.tipo,
            'data': str(evento.data) if evento.data else "Data desc.",
            'local': getattr(evento, 'local', 'Local não informado'),
            'descricao': getattr(evento, 'descricao', ''),
            'participantes': participantes,
            'comentarios': comentarios
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

        participantes_json = dados.get('participantes')
        if participantes_json is not None:
            lista_uuids = json.loads(participantes_json) if isinstance(
                participantes_json, str) else participantes_json
            db.cypher_query(
                "MATCH (p:Pessoa)-[r:PARTICIPOU]->(e:Evento {uuid: $uuid}) DELETE r", {'uuid': uuid})
            for p_uuid in lista_uuids:
                db.cypher_query("MATCH (p:Pessoa {uuid: $p_uuid}), (e:Evento {uuid: $e_uuid}) MERGE (p)-[:PARTICIPOU]->(e)", {
                                'p_uuid': p_uuid, 'e_uuid': uuid})

        registrar_log(request.user, familia_ws, "Editou", "Evento",
                      f"Alterou dados do evento: {tipo_antigo}")
        return JsonResponse({'message': 'Evento atualizado com sucesso!'})
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

        # Resgata comentários do evento
        query_comentarios = "MATCH (c:Comentario)-[:SOBRE]->(e:Evento {uuid: $uuid}) RETURN c ORDER BY c.data_hora DESC"
        res_com, _ = db.cypher_query(query_comentarios, {'uuid': uuid})
        comentarios = [{'uuid': row[0].get('uuid'), 'texto': row[0].get('texto'), 'autor': row[0].get(
            'autor'), 'data_hora': row[0].get('data_hora')} for row in res_com]

        return JsonResponse({
            'uuid': evento.uuid,
            'tipo': evento.tipo,
            'data': str(evento.data) if evento.data else "Data desc.",
            'local': getattr(evento, 'local', 'Local não informado'),
            'descricao': getattr(evento, 'descricao', ''),
            'foto_url': getattr(evento, 'foto_url', None),
            'participantes': participantes,
            'comentarios': comentarios
        })

    elif request.method == 'DELETE':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem excluir eventos.")

        tipo_evento = evento.tipo
        evento.delete()
        registrar_log(request.user, familia_ws, "Excluiu", "Evento",
                      f"Apagou permanentemente o evento: {tipo_evento}")
        return JsonResponse({'message': 'Evento excluído com sucesso.'})

    elif request.method in ['PUT', 'POST']:
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores da família podem editar eventos.")

        if request.content_type.startswith('multipart/form-data'):
            dados = request.POST
            foto = request.FILES.get('foto')
        else:
            dados = json.loads(request.body)
            foto = None

        tipo_antigo = evento.tipo
        evento.tipo = dados.get('tipo', evento.tipo)
        evento.local = dados.get('local', evento.local)
        evento.descricao = dados.get('descricao', evento.descricao)

        if foto:
            fs = FileSystemStorage()
            filename = fs.save(foto.name, foto)
            evento.foto_url = request.build_absolute_uri(fs.url(filename))

        evento.save()

        # Atualização dos Participantes
        participantes_json = dados.get('participantes')
        if participantes_json is not None:
            lista_uuids = json.loads(participantes_json) if isinstance(
                participantes_json, str) else participantes_json

            # Remove as arestas de todos os participantes antigos
            db.cypher_query(
                "MATCH (p:Pessoa)-[r:PARTICIPOU]->(e:Evento {uuid: $uuid}) DELETE r", {'uuid': uuid})

            # Cria as arestas para os novos selecionados
            for p_uuid in lista_uuids:
                db.cypher_query("MATCH (p:Pessoa {uuid: $p_uuid}), (e:Evento {uuid: $e_uuid}) MERGE (p)-[:PARTICIPOU]->(e)", {
                                'p_uuid': p_uuid, 'e_uuid': uuid})

        registrar_log(request.user, familia_ws, "Editou", "Evento",
                      f"Alterou dados do evento: {tipo_antigo}")
        return JsonResponse({'message': 'Evento e foto atualizados com sucesso!'})

# ==========================================
# 6. API DE RELACIONAMENTOS
# ==========================================


@csrf_exempt
def api_criar_relacionamento(request):
    familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
    if erro:
        return erro

    if request.method == 'POST':
        if membro.funcao != 'ADMIN':
            return HttpResponseForbidden("Apenas administradores podem criar relacionamentos diretamente. Usuários comuns devem enviar uma solicitação.")

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
    familia_uuid = request.headers.get('X-Familia-UUID')
    if request.user.is_authenticated and request.user.is_superuser and (not familia_uuid or familia_uuid in ['undefined', 'null', '']):
        logs = RegistroAtividade.objects.all().order_by('-data_hora')[:100]
    else:
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

def obter_dados_atuais(solicitacao):
    """Resgata os valores atuais no Neo4j para comparação na tela de moderação."""
    if not solicitacao.uuid_entidade:
        return None
    try:
        if solicitacao.entidade == 'Pessoa':
            try:
                p = Pessoa.nodes.get(uuid=solicitacao.uuid_entidade)
            except Pessoa.DoesNotExist:
                return {'erro': 'Registro não encontrado'}

            q = """
            MATCH (p:Pessoa {uuid: $uuid})
            OPTIONAL MATCH (pai:Pessoa)-[:PAI_DE]->(p)
            OPTIONAL MATCH (mae:Pessoa)-[:MAE_DE]->(p)
            OPTIONAL MATCH (p)-[:CASADO_COM]-(c:Pessoa)
            RETURN pai.uuid as pai_uuid, pai.nomeCompleto as pai_nome,
                   mae.uuid as mae_uuid, mae.nomeCompleto as mae_nome,
                   c.uuid as conjuge_uuid, c.nomeCompleto as conjuge_nome
            """
            res, _ = db.cypher_query(q, {'uuid': solicitacao.uuid_entidade})
            pai_uuid, pai_nome, mae_uuid, mae_nome, conjuge_uuid, conjuge_nome = None, None, None, None, None, None
            if res and len(res) > 0:
                pai_uuid, pai_nome, mae_uuid, mae_nome, conjuge_uuid, conjuge_nome = res[0]

            return {
                'uuid': p.uuid,
                'nomeCompleto': p.nomeCompleto,
                'apelido': p.apelido or '',
                'dataNascimento': str(p.dataNascimento) if p.dataNascimento else '',
                'dataObito': str(p.dataObito) if getattr(p, 'dataObito', None) else '',
                'pai_uuid': pai_uuid or '',
                'pai_nome': pai_nome or 'Nenhum',
                'mae_uuid': mae_uuid or '',
                'mae_nome': mae_nome or 'Nenhum',
                'conjuge_uuid': conjuge_uuid or '',
                'conjuge_nome': conjuge_nome or 'Nenhum',
            }

        elif solicitacao.entidade == 'Evento':
            try:
                e = Evento.nodes.get(uuid=solicitacao.uuid_entidade)
            except Evento.DoesNotExist:
                return {'erro': 'Registro não encontrado'}

            q = """
            MATCH (e:Evento {uuid: $uuid})
            OPTIONAL MATCH (p:Pessoa)-[:PARTICIPOU]->(e)
            RETURN collect(p.nomeCompleto) as participantes_nomes, collect(p.uuid) as participantes_uuids
            """
            res, _ = db.cypher_query(q, {'uuid': solicitacao.uuid_entidade})
            part_nomes, part_uuids = [], []
            if res and len(res) > 0:
                part_nomes, part_uuids = res[0]

            return {
                'uuid': e.uuid,
                'tipo': e.tipo,
                'data': str(e.data) if e.data else '',
                'local': e.local or '',
                'descricao': e.descricao or '',
                'participantes_nomes': part_nomes or [],
                'participantes_uuids': part_uuids or []
            }
    except Exception as err:
        return {'erro': str(err)}
    return None


def enriquecer_dados_novos(dados_novos, entidade):
    """Enriquece UUIDs com nomes legíveis para exibição clara na moderação."""
    if not isinstance(dados_novos, dict):
        return dados_novos

    enriquecido = dict(dados_novos)

    try:
        if entidade == 'Pessoa':
            for campo, nome_campo in [('pai_uuid', 'pai_nome'), ('mae_uuid', 'mae_nome'), ('conjuge_uuid', 'conjuge_nome')]:
                u = enriquecido.get(campo)
                if u:
                    try:
                        p = Pessoa.nodes.get(uuid=u)
                        enriquecido[nome_campo] = p.nomeCompleto
                    except Exception:
                        enriquecido[nome_campo] = u
                elif campo in enriquecido:
                    enriquecido[nome_campo] = 'Nenhum'

        elif entidade == 'Relacionamento':
            origem_u = enriquecido.get('origem_uuid')
            destino_u = enriquecido.get('destino_uuid')
            tipo = enriquecido.get('tipo')
            if origem_u:
                try:
                    p = Pessoa.nodes.get(uuid=origem_u)
                    enriquecido['origem_nome'] = p.nomeCompleto
                except Exception:
                    enriquecido['origem_nome'] = origem_u
            if destino_u:
                try:
                    if tipo == 'FOI':
                        e = Evento.nodes.get(uuid=destino_u)
                        enriquecido['destino_nome'] = f"{e.data} - {e.tipo}"
                    else:
                        p = Pessoa.nodes.get(uuid=destino_u)
                        enriquecido['destino_nome'] = p.nomeCompleto
                except Exception:
                    enriquecido['destino_nome'] = destino_u

        elif entidade == 'Familia':
            f_code = enriquecido.get('funcao', 'ADMIN')
            f_map = {
                'ADMIN': 'Administrador',
                'COLABORADOR': 'Editor',
                'EDITOR': 'Editor',
                'LEITOR': 'Leitor'
            }
            enriquecido['funcao_display'] = f_map.get(f_code, f_code)
    except Exception:
        pass

    return enriquecido


@csrf_exempt
def api_solicitacoes(request):
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Login necessário.")

    familia_uuid = request.headers.get('X-Familia-UUID')

    if request.method == 'GET':
        if request.user.is_superuser:
            if familia_uuid and familia_uuid not in ['undefined', 'null', '']:
                solicitacoes = Solicitacao.objects.filter(
                    familia__uuid_referencia=familia_uuid, status='PENDENTE')
            else:
                # Superusuário sem família especificada: vê todas as solicitações pendentes (incluindo criação de famílias)
                solicitacoes = Solicitacao.objects.filter(status='PENDENTE')
        else:
            familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
            if erro:
                return erro

            if membro.funcao != 'ADMIN':
                return HttpResponseForbidden("Apenas administradores podem gerir as solicitações da família.")

            solicitacoes = Solicitacao.objects.filter(
                familia=familia_ws, status='PENDENTE')

        def parse_dados_novos(val):
            if not val:
                return {}
            try:
                return json.loads(val)
            except Exception:
                return val

        data = [{
            'id': s.id,
            'usuario': s.usuario.username,
            'tipo_acao': s.tipo_acao,
            'entidade': s.entidade,
            'uuid_entidade': s.uuid_entidade,
            'motivo': s.motivo,
            'familia_nome': s.familia.nome if s.familia else 'Nova Família (Geral)',
            'dados_novos': enriquecer_dados_novos(parse_dados_novos(s.dados_novos), s.entidade),
            'dados_atuais': obter_dados_atuais(s),
            'data_solicitacao': s.data_solicitacao.strftime("%d/%m/%Y - %H:%M")
        } for s in solicitacoes]

        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
        if erro:
            return erro

        try:
            dados = json.loads(request.body)

            dados_novos_raw = dados.get('dados_novos', {})
            dados_novos_str = dados_novos_raw if isinstance(
                dados_novos_raw, str) else json.dumps(dados_novos_raw)

            Solicitacao.objects.create(
                usuario=request.user,
                familia=familia_ws,
                tipo_acao=dados['tipo_acao'],
                entidade=dados['entidade'],
                uuid_entidade=dados.get('uuid_entidade', ''),
                motivo=dados.get('motivo', ''),
                dados_novos=dados_novos_str
            )

            registrar_log(request.user, familia_ws, "Solicitou",
                          dados['entidade'], f"Pediu para {dados['tipo_acao']} - Motivo: {dados.get('motivo', '')}")
            return JsonResponse({'message': 'Solicitação enviada aos administradores da família!'})
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao solicitar: {str(e)}")

    return HttpResponseBadRequest("Método não permitido.")


@csrf_exempt
def api_processar_solicitacao(request, id):
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Login necessário.")

    if request.method != 'PUT':
        return HttpResponseBadRequest("Método não permitido.")

    try:
        solicitacao = Solicitacao.objects.get(id=id)
    except Solicitacao.DoesNotExist:
        return HttpResponseNotFound("Solicitação não encontrada.")

    # Se a solicitação for de criação de família ou sem família vinculada
    if solicitacao.entidade == 'Familia' or solicitacao.familia is None:
        if not request.user.is_superuser:
            return HttpResponseForbidden("Apenas administradores gerais podem aprovar a criação de novas famílias.")
        familia_ws = None
        familia_node = None
        membro = None
    else:
        # Se for superusuário, pode aprovar diretamente
        if request.user.is_superuser:
            familia_ws = solicitacao.familia
            try:
                familia_node = FamiliaNode.nodes.get(uuid=familia_ws.uuid_referencia)
            except FamiliaNode.DoesNotExist:
                familia_node = None
            membro = None
        else:
            familia_ws, familia_node, membro, erro = obter_contexto_familia(request)
            if erro:
                return erro
            if membro.funcao != 'ADMIN':
                return HttpResponseForbidden("Apenas administradores podem aprovar solicitações.")
            if solicitacao.familia != familia_ws:
                return HttpResponseForbidden("Esta solicitação não pertence à família selecionada.")

    try:
        dados = json.loads(request.body)
        acao_admin = dados.get('acao')

        if acao_admin == 'NEGAR':
            solicitacao.status = 'NEGADA'
            solicitacao.save()
            if familia_ws:
                registrar_log(request.user, familia_ws, "Negou", "Solicitação",
                              f"Negou pedido de {solicitacao.usuario.username}")
            return JsonResponse({'message': 'Solicitação negada.'})

        elif acao_admin == 'APROVAR':
            if solicitacao.entidade == 'Familia':
                novos_dados = json.loads(solicitacao.dados_novos) if isinstance(
                    solicitacao.dados_novos, str) else solicitacao.dados_novos
                nome_familia = novos_dados.get('nome')
                novo_uuid = str(uuid_lib.uuid4())

                # 1. Cria workspace relacional
                nova_familia = FamiliaWorkspace.objects.create(
                    nome=nome_familia,
                    uuid_referencia=novo_uuid
                )

                # 2. Cria nó da família no Neo4j
                FamiliaNode(
                    uuid=novo_uuid,
                    nome=nome_familia
                ).save()

                funcao_desejada = novos_dados.get('funcao', 'ADMIN').upper()
                if funcao_desejada == 'EDITOR':
                    funcao_desejada = 'COLABORADOR'
                if funcao_desejada not in ['ADMIN', 'COLABORADOR', 'LEITOR']:
                    funcao_desejada = 'ADMIN'

                # 3. Associa o solicitante com a função escolhida na nova família
                MembroFamilia.objects.create(
                    usuario=solicitacao.usuario,
                    familia=nova_familia,
                    funcao=funcao_desejada
                )

                solicitacao.familia = nova_familia
                solicitacao.uuid_entidade = novo_uuid
                solicitacao.status = 'APROVADA'
                solicitacao.save()

                registrar_log(request.user, nova_familia, "Criou",
                              "Workspace", f"Aprovou criação da família: {nome_familia} solicitada por {solicitacao.usuario.username}")

                return JsonResponse({'message': f"Família '{nome_familia}' aprovada e criada com sucesso!"})

            elif solicitacao.tipo_acao == 'Excluir':
                if solicitacao.entidade == 'Pessoa':
                    node = Pessoa.nodes.get(uuid=solicitacao.uuid_entidade)
                else:
                    node = Evento.nodes.get(uuid=solicitacao.uuid_entidade)

                nome_registro = getattr(
                    node, 'nomeCompleto', getattr(node, 'tipo', 'Registro'))
                node.delete()
                registrar_log(request.user, familia_ws, "Excluiu",
                              solicitacao.entidade, f"Excluiu {nome_registro} após aprovação")

            elif solicitacao.tipo_acao == 'Editar':
                if solicitacao.entidade == 'Pessoa':
                    node = Pessoa.nodes.get(uuid=solicitacao.uuid_entidade)
                else:
                    node = Evento.nodes.get(uuid=solicitacao.uuid_entidade)

                novos_dados = json.loads(solicitacao.dados_novos) if isinstance(
                    solicitacao.dados_novos, str) else solicitacao.dados_novos
                uuid = node.uuid

                if solicitacao.entidade == 'Pessoa':
                    # 1. Atualiza Dados Textuais
                    node.nomeCompleto = novos_dados.get(
                        'nomeCompleto', node.nomeCompleto)
                    node.apelido = novos_dados.get('apelido', node.apelido)
                    node.save()

                    # 2. Atualiza Laços Familiares no Grafo
                    if 'pai_uuid' in novos_dados:
                        db.cypher_query(
                            "MATCH (pai:Pessoa)-[r:PAI_DE]->(filho:Pessoa {uuid: $uuid}) DELETE r", {'uuid': uuid})
                        if novos_dados['pai_uuid']:
                            db.cypher_query("MATCH (pai:Pessoa {uuid: $pai_uuid}), (filho:Pessoa {uuid: $uuid}) MERGE (pai)-[:PAI_DE]->(filho)", {
                                            'pai_uuid': novos_dados['pai_uuid'], 'uuid': uuid})

                    if 'mae_uuid' in novos_dados:
                        db.cypher_query(
                            "MATCH (mae:Pessoa)-[r:MAE_DE]->(filho:Pessoa {uuid: $uuid}) DELETE r", {'uuid': uuid})
                        if novos_dados['mae_uuid']:
                            db.cypher_query("MATCH (mae:Pessoa {uuid: $mae_uuid}), (filho:Pessoa {uuid: $uuid}) MERGE (mae)-[:MAE_DE]->(filho)", {
                                            'mae_uuid': novos_dados['mae_uuid'], 'uuid': uuid})

                    if 'conjuge_uuid' in novos_dados:
                        db.cypher_query(
                            "MATCH (p:Pessoa {uuid: $uuid})-[r:CASADO_COM]-(c:Pessoa) DELETE r", {'uuid': uuid})
                        if novos_dados['conjuge_uuid']:
                            db.cypher_query("MATCH (p1:Pessoa {uuid: $uuid}), (p2:Pessoa {uuid: $conjuge_uuid}) MERGE (p1)-[:CASADO_COM]-(p2)", {
                                            'uuid': uuid, 'conjuge_uuid': novos_dados['conjuge_uuid']})

                else:
                    # 1. Atualiza Dados Textuais do Evento
                    node.tipo = novos_dados.get('tipo', node.tipo)
                    node.local = novos_dados.get('local', node.local)
                    node.descricao = novos_dados.get(
                        'descricao', node.descricao)
                    node.save()

                    # 2. Atualiza Participantes no Grafo
                    participantes_json = novos_dados.get('participantes')
                    if participantes_json is not None:
                        lista_uuids = json.loads(participantes_json) if isinstance(
                            participantes_json, str) else participantes_json
                        db.cypher_query(
                            "MATCH (p:Pessoa)-[r:PARTICIPOU]->(e:Evento {uuid: $uuid}) DELETE r", {'uuid': uuid})
                        for p_uuid in lista_uuids:
                            db.cypher_query("MATCH (p:Pessoa {uuid: $p_uuid}), (e:Evento {uuid: $e_uuid}) MERGE (p)-[:PARTICIPOU]->(e)", {
                                            'p_uuid': p_uuid, 'e_uuid': uuid})

                registrar_log(request.user, familia_ws, "Editou",
                              solicitacao.entidade, "Editou registro após aprovação")

            elif solicitacao.tipo_acao == 'Criar':
                novos_dados = json.loads(solicitacao.dados_novos) if isinstance(
                    solicitacao.dados_novos, str) else solicitacao.dados_novos

                if solicitacao.entidade == 'Pessoa':
                    data_str = novos_dados.get('dataNascimento')
                    data_nasc_obj = None
                    if data_str:
                        try:
                            data_nasc_obj = datetime.strptime(data_str, '%Y-%m-%d').date()
                        except ValueError:
                            pass

                    data_obito_str = novos_dados.get('dataObito')
                    data_obito_obj = None
                    if data_obito_str:
                        try:
                            data_obito_obj = datetime.strptime(data_obito_str, '%Y-%m-%d').date()
                        except ValueError:
                            pass

                    nova_pessoa = Pessoa(
                        nomeCompleto=novos_dados.get('nomeCompleto'),
                        apelido=novos_dados.get('apelido'),
                        dataNascimento=data_nasc_obj,
                        criado_por_id=solicitacao.usuario.id,
                        criado_por_nome=solicitacao.usuario.username,
                        criado_em=datetime.now().isoformat()
                    ).save()
                    nova_pessoa.pertence_a.connect(familia_node)

                    if data_nasc_obj:
                        evento_nasc = Evento(
                            tipo='Nascimento',
                            data=data_nasc_obj,
                            descricao=f"Nascimento de {nova_pessoa.nomeCompleto}",
                            local="Local de Nascimento"
                        ).save()
                        evento_nasc.pertence_a.connect(familia_node)
                        nova_pessoa.participou.connect(evento_nasc)

                    if data_obito_obj:
                        evento_obito = Evento(
                            tipo='Óbito',
                            data=data_obito_obj,
                            descricao=f"Falecimento de {nova_pessoa.nomeCompleto}",
                            local="Não informado"
                        ).save()
                        evento_obito.pertence_a.connect(familia_node)
                        nova_pessoa.participou.connect(evento_obito)

                    uuid_pai = novos_dados.get('pai_uuid')
                    if uuid_pai:
                        try:
                            pai = Pessoa.nodes.get(uuid=uuid_pai)
                            if pai.pertence_a.is_connected(familia_node):
                                pai.pai_de.connect(nova_pessoa)
                        except Pessoa.DoesNotExist:
                            pass

                    uuid_mae = novos_dados.get('mae_uuid')
                    if uuid_mae:
                        try:
                            mae = Pessoa.nodes.get(uuid=uuid_mae)
                            if mae.pertence_a.is_connected(familia_node):
                                mae.mae_de.connect(nova_pessoa)
                        except Pessoa.DoesNotExist:
                            pass

                    uuid_conjuge = novos_dados.get('conjuge_uuid')
                    if uuid_conjuge:
                        try:
                            conjuge = Pessoa.nodes.get(uuid=uuid_conjuge)
                            if conjuge.pertence_a.is_connected(familia_node):
                                nova_pessoa.casado_com.connect(conjuge)

                                dt_cas_str = novos_dados.get('dataCasamento')
                                if dt_cas_str:
                                    try:
                                        dt_cas = datetime.strptime(dt_cas_str, '%Y-%m-%d').date()
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

                    solicitacao.uuid_entidade = nova_pessoa.uuid
                    registrar_log(request.user, familia_ws, "Criou",
                                  "Pessoa", f"Cadastrou: {nova_pessoa.nomeCompleto} após aprovação da solicitação de {solicitacao.usuario.username}")

                elif solicitacao.entidade == 'Evento':
                    data_str = novos_dados.get('data')
                    data_formatada = None
                    if data_str:
                        try:
                            data_formatada = datetime.strptime(data_str, '%Y-%m-%d').date()
                        except ValueError:
                            pass

                    novo_evento = Evento(
                        tipo=novos_dados.get('tipo'),
                        data=data_formatada,
                        local=novos_dados.get('local'),
                        descricao=novos_dados.get('descricao')
                    ).save()
                    novo_evento.pertence_a.connect(familia_node)
                    solicitacao.uuid_entidade = novo_evento.uuid
                    registrar_log(request.user, familia_ws, "Criou",
                                  "Evento", f"Registrou o evento: {novo_evento.tipo} após aprovação da solicitação de {solicitacao.usuario.username}")

                elif solicitacao.entidade == 'Relacionamento':
                    origem = Pessoa.nodes.get(uuid=novos_dados['origem_uuid'])
                    tipo = novos_dados['tipo']

                    if tipo == 'FOI':
                        destino = Evento.nodes.get(uuid=novos_dados['destino_uuid'])
                        if not destino.pertence_a.is_connected(familia_node):
                            return HttpResponseForbidden("O evento não pertence à sua família.")
                        origem.participou.connect(destino)
                        registrar_log(request.user, familia_ws, "Criou Laço", "Relacionamento",
                                      f"Conectou {origem.nomeCompleto} ao evento {destino.tipo} após aprovação da solicitação de {solicitacao.usuario.username}")
                    else:
                        destino = Pessoa.nodes.get(uuid=novos_dados['destino_uuid'])
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

                        registrar_log(request.user, familia_ws, "Criou Laço", "Relacionamento",
                                      f"Conectou {origem.nomeCompleto} como {tipo} de {destino.nomeCompleto} após aprovação da solicitação de {solicitacao.usuario.username}")

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
    """Cria um novo Workspace ou submete solicitação para aprovação se não for superusuário."""
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Login necessário para criar uma família.")

        try:
            dados = json.loads(request.body)
            nome_familia = dados.get('nome')
            motivo = dados.get('motivo', '')
            funcao = dados.get('funcao', 'ADMIN').upper()
            if funcao == 'EDITOR':
                funcao = 'COLABORADOR'
            if funcao not in ['ADMIN', 'COLABORADOR', 'LEITOR']:
                funcao = 'ADMIN'

            if not nome_familia:
                return HttpResponseBadRequest("O nome da família é obrigatório.")

            # Superusuário: cria diretamente
            if request.user.is_superuser:
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

                # 3. Associa o usuário com a função escolhida na nova família
                MembroFamilia.objects.create(
                    usuario=request.user,
                    familia=familia_ws,
                    funcao=funcao
                )

                registrar_log(request.user, familia_ws, "Criou",
                              "Workspace", f"Fundou a família: {nome_familia} com função {funcao}")

                return JsonResponse({
                    'message': 'Família criada com sucesso!',
                    'uuid': novo_uuid,
                    'nome': nome_familia,
                    'funcao': funcao,
                    'pendente': False
                }, status=201)

            else:
                # Usuário comum: submete solicitação para aprovação
                solicitacao = Solicitacao.objects.create(
                    usuario=request.user,
                    familia=None,
                    tipo_acao='Criar',
                    entidade='Familia',
                    uuid_entidade='',
                    motivo=motivo or f"Solicitação para criação da família '{nome_familia}'",
                    dados_novos=json.dumps({'nome': nome_familia, 'funcao': funcao})
                )

                return JsonResponse({
                    'message': 'Solicitação de criação de família enviada para aprovação do administrador!',
                    'pendente': True,
                    'id': solicitacao.id
                }, status=202)

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao criar família: {str(e)}")

    return HttpResponseBadRequest("Método não permitido.")


@csrf_exempt
def api_entrar_familia(request):
    """
    Permite a um usuário entrar em uma família informando a função que deseja exercer
    (Leitor, Editor/Colaborador ou Administrador).
    """
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Login necessário.")

    if request.method == 'POST':
        try:
            dados = json.loads(request.body)
            uuid_familia = dados.get('familia_uuid')
            funcao = dados.get('funcao', 'LEITOR').upper()
            if funcao == 'EDITOR':
                funcao = 'COLABORADOR'
            if funcao not in ['ADMIN', 'COLABORADOR', 'LEITOR']:
                return HttpResponseBadRequest("Função inválida. Escolha entre Leitor, Editor ou Administrador.")

            if not uuid_familia:
                return HttpResponseBadRequest("Identificador da família é obrigatório.")

            try:
                familia_ws = FamiliaWorkspace.objects.get(uuid_referencia=uuid_familia)
            except FamiliaWorkspace.DoesNotExist:
                return HttpResponseNotFound("Família não encontrada.")

            # Registra ou atualiza o vínculo do usuário com a família na função informada
            membro, criado = MembroFamilia.objects.get_or_create(
                usuario=request.user,
                familia=familia_ws,
                defaults={'funcao': funcao}
            )
            if not criado and membro.funcao != funcao:
                membro.funcao = funcao
                membro.save()

            registrar_log(request.user, familia_ws, "Entrou", "Workspace",
                          f"Entrou na família com a função: {membro.get_funcao_display()}")

            return JsonResponse({
                'message': f"Você entrou na família '{familia_ws.nome}' como {membro.get_funcao_display()}.",
                'uuid': familia_ws.uuid_referencia,
                'nome': familia_ws.nome,
                'funcao': membro.funcao,
                'funcao_display': membro.get_funcao_display()
            })
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao entrar na família: {str(e)}")

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


@csrf_exempt
def api_excluir_familia(request, uuid):
    """
    Exclui permanentemente uma família e todos os dados associados a ela
    (Workspace, Membros, Solicitações, Logs no SQLite, e Nós de Pessoas/Eventos/Comentários no Neo4j).
    Apenas superusuários têm permissão para executar esta ação.
    """
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Login necessário.")

    if not request.user.is_superuser:
        return HttpResponseForbidden("Apenas superusuários podem excluir famílias.")

    if request.method == 'DELETE':
        try:
            familia_ws = FamiliaWorkspace.objects.get(uuid_referencia=uuid)
        except FamiliaWorkspace.DoesNotExist:
            return HttpResponseNotFound("Família não encontrada.")

        nome_familia = familia_ws.nome

        try:
            # 1. Remove os nós de Pessoas, Eventos e Comentários associados no Neo4j
            query_delete_nodes = """
            MATCH (n)-[:PERTENCE_A]->(f:FamiliaNode {uuid: $uuid})
            OPTIONAL MATCH (c:Comentario)-[:SOBRE]->(n)
            DETACH DELETE c, n
            """
            db.cypher_query(query_delete_nodes, {'uuid': uuid})

            # 2. Remove o nó da Família no Neo4j
            query_delete_familia = """
            MATCH (f:FamiliaNode {uuid: $uuid})
            DETACH DELETE f
            """
            db.cypher_query(query_delete_familia, {'uuid': uuid})

            # 3. Exclui o workspace no SQLite (cascateia MembroFamilia, Solicitacao, RegistroAtividade)
            familia_ws.delete()

            return JsonResponse({'message': f"Família '{nome_familia}' excluída permanentemente com sucesso!"})
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao excluir família: {str(e)}")

    return HttpResponseBadRequest("Método não permitido.")


@csrf_exempt
def api_listar_membros_familia(request, uuid=None):
    """
    Lista os usuários cadastrados em uma determinada família.
    Superusuários podem consultar qualquer família informada por parâmetro ou cabeçalho.
    Usuários comuns só podem consultar membros das suas próprias famílias.
    """
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Login necessário.")

    target_uuid = uuid or request.headers.get('X-Familia-UUID')
    if not target_uuid or target_uuid in ['undefined', 'null', '']:
        return HttpResponseBadRequest("Cabeçalho X-Familia-UUID ou parâmetro uuid é obrigatório.")

    try:
        familia_ws = FamiliaWorkspace.objects.get(uuid_referencia=target_uuid)
    except FamiliaWorkspace.DoesNotExist:
        return HttpResponseNotFound("Família não encontrada.")

    if not request.user.is_superuser:
        if not MembroFamilia.objects.filter(usuario=request.user, familia=familia_ws).exists():
            return HttpResponseForbidden("Acesso não autorizado para esta família.")

    membros = MembroFamilia.objects.filter(familia=familia_ws).select_related('usuario').order_by('funcao', 'usuario__username')
    data = [{
        'id': m.id,
        'usuario_id': m.usuario.id,
        'username': m.usuario.username,
        'email': m.usuario.email or '',
        'funcao': m.funcao,
        'funcao_display': m.get_funcao_display(),
        'is_superuser': m.usuario.is_superuser,
        'aderiu_em': m.aderiu_em.strftime("%d/%m/%Y %H:%M") if m.aderiu_em else ''
    } for m in membros]

    return JsonResponse(data, safe=False)


@csrf_exempt
def api_alterar_funcao_membro(request, membro_id):
    """
    Altera a função de um membro na família (Leitor, Colaborador/Editor ou Administrador).
    Permitido apenas para administradores da família ou superusuários.
    """
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Login necessário.")

    if request.method == 'PUT':
        try:
            try:
                membro = MembroFamilia.objects.select_related('familia', 'usuario').get(id=membro_id)
            except MembroFamilia.DoesNotExist:
                return HttpResponseNotFound("Membro não encontrado.")

            familia_ws = membro.familia

            # Permissão: superuser ou Membro com funcao='ADMIN' nesta família
            tem_permissao = False
            if request.user.is_superuser:
                tem_permissao = True
            else:
                tem_permissao = MembroFamilia.objects.filter(
                    usuario=request.user,
                    familia=familia_ws,
                    funcao='ADMIN'
                ).exists()

            if not tem_permissao:
                return HttpResponseForbidden("Apenas administradores da família podem alterar funções dos membros.")

            dados = json.loads(request.body)
            nova_funcao = dados.get('funcao', '').upper()
            if nova_funcao == 'EDITOR':
                nova_funcao = 'COLABORADOR'

            if nova_funcao not in ['ADMIN', 'COLABORADOR', 'LEITOR']:
                return HttpResponseBadRequest("Função inválida. Escolha entre LEITOR, EDITOR ou ADMIN.")

            funcao_antiga = membro.get_funcao_display()
            membro.funcao = nova_funcao
            membro.save()

            registrar_log(
                request.user,
                familia_ws,
                "Alterou",
                "Membro",
                f"Alterou a função de {membro.usuario.username} de {funcao_antiga} para {membro.get_funcao_display()}"
            )

            return JsonResponse({
                'message': f"Função de {membro.usuario.username} atualizada para {membro.get_funcao_display()}.",
                'membro': {
                    'id': membro.id,
                    'usuario_id': membro.usuario.id,
                    'username': membro.usuario.username,
                    'email': membro.usuario.email or '',
                    'funcao': membro.funcao,
                    'funcao_display': membro.get_funcao_display(),
                    'is_superuser': membro.usuario.is_superuser,
                    'aderiu_em': membro.aderiu_em.strftime("%d/%m/%Y %H:%M") if membro.aderiu_em else ''
                }
            })
        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao alterar função: {str(e)}")

    return HttpResponseBadRequest("Método não permitido.")


