import json
import uuid as uuid_lib  # Para gerar IDs únicos manualmente se necessário
from datetime import datetime
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden, HttpResponseNotFound
from neomodel import db
from datetime import datetime
from .models import Pessoa, Evento, Comentario

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
            'title': f"Apelido: {p.apelido or '-'}"
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

    # Nós de Eventos
    for e in eventos:
        nodes.append({'id': e.uuid, 'label': e.tipo, 'group': 'evento'})

    return JsonResponse({'nodes': nodes, 'edges': edges})


# ==========================================
# 3. API DE PESSOAS (CRUD + Auditoria)
# ==========================================

# backend/core/views.py

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

            # 3. AUTOMAÇÃO: EVENTO DE NASCIMENTO
            if data_nasc_obj:
                evento_nasc = Evento(
                    tipo='Nascimento',
                    data=data_nasc_obj,
                    descricao=f"Nascimento de {nova_pessoa.nomeCompleto}",
                    local="Local de Nascimento"  # Você pode adicionar campo para isso no futuro
                ).save()
                # Conecta: Pessoa -> FOI -> Nascimento
                nova_pessoa.participou.connect(evento_nasc)

            # 4. AUTOMAÇÃO: PAIS (Se indicados)
            # Nota: O relacionamento é PAI -> FILHO. Então buscamos o pai e conectamos nele.
            uuid_pai = dados.get('pai_uuid')
            if uuid_pai:
                pai = Pessoa.nodes.get(uuid=uuid_pai)
                pai.pai_de.connect(nova_pessoa)

            uuid_mae = dados.get('mae_uuid')
            if uuid_mae:
                mae = Pessoa.nodes.get(uuid=uuid_mae)
                mae.mae_de.connect(nova_pessoa)

            # 5. AUTOMAÇÃO: CASAMENTO (Se indicado)
            uuid_conjuge = dados.get('conjuge_uuid')
            if uuid_conjuge:
                conjuge = Pessoa.nodes.get(uuid=uuid_conjuge)

                # Conecta Pessoa <-> Cônjuge (Casamento)
                nova_pessoa.casado_com.connect(conjuge)
                # Opcional: Criar bidirecional no Neo4j se quiser, mas uma via basta por enquanto.

                # Cria Evento de Casamento (Se tiver data)
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

                        # Conecta os DOIS ao evento
                        nova_pessoa.participou.connect(evento_casamento)
                        conjuge.participou.connect(evento_casamento)
                    except ValueError:
                        pass  # Se a data for inválida, apenas ignora o evento, mas mantém o laço de casado

            return JsonResponse({'message': 'Pessoa e eventos automáticos criados!', 'uuid': nova_pessoa.uuid}, status=201)

        except Exception as e:
            print(f"ERRO CRITICO: {str(e)}")
            return HttpResponseBadRequest(f"Erro ao processar: {str(e)}")


@csrf_exempt
def api_detalhe_pessoa(request, uuid):
    try:
        pessoa = Pessoa.nodes.get(uuid=uuid)
    except Pessoa.DoesNotExist:
        return HttpResponseNotFound("Pessoa não encontrada")

    if request.method == 'GET':
        # Busca eventos que a pessoa participou
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
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Faça login para excluir.")

        # VERIFICA PERMISSÃO (Dono ou Admin)
        dono_id = getattr(pessoa, 'criado_por_id', None)
        eh_dono = (dono_id == request.user.id)
        eh_admin = request.user.is_superuser

        if eh_dono or eh_admin:
            pessoa.delete()
            return JsonResponse({'message': 'Registro excluído.'})
        else:
            return HttpResponseForbidden("Você não tem permissão para excluir registros de outros usuários.")

    elif request.method == 'PUT':
        # Para simplificar, permitimos editar sem verificar dono por enquanto,
        # mas você pode adicionar a mesma lógica do DELETE aqui.
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Faça login para editar.")

        dados = json.loads(request.body)
        pessoa.nomeCompleto = dados.get('nomeCompleto', pessoa.nomeCompleto)
        pessoa.apelido = dados.get('apelido', pessoa.apelido)
        pessoa.save()
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

            # Cria nó Comentario e liga à Pessoa via Cypher
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

# backend/core/views.py

@csrf_exempt
def api_listar_eventos(request):
    if request.method == 'GET':
        eventos = Evento.nodes.order_by('data')
        data = []
        for e in eventos:
            data.append({
                'uuid': e.uuid,
                'tipo': e.tipo,
                'data': str(e.data) if e.data else "Data desc.",
                'descricao': getattr(e, 'descricao', '')
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Login necessário.")

        try:
            dados = json.loads(request.body)

            # --- CORREÇÃO DE DATA (Igual ao de Pessoas) ---
            data_str = dados.get('data')
            data_formatada = None

            if data_str:
                try:
                    # Converte "2023-12-25" para objeto Data do Python
                    data_formatada = datetime.strptime(
                        data_str, '%Y-%m-%d').date()
                except ValueError:
                    return HttpResponseBadRequest("Data inválida. Use AAAA-MM-DD.")

            novo_evento = Evento(
                tipo=dados.get('tipo'),
                data=data_formatada,  # <--- Agora passamos o objeto certo
                local=dados.get('local'),
                descricao=dados.get('descricao')
            ).save()

            return JsonResponse({'message': 'Evento criado!', 'uuid': novo_evento.uuid}, status=201)

        except Exception as e:
            print(f"ERRO EVENTO: {str(e)}")  # Debug no terminal
            return HttpResponseBadRequest(f"Erro ao criar evento: {str(e)}")


@csrf_exempt
def api_detalhe_evento(request, uuid):
    try:
        evento = Evento.nodes.get(uuid=uuid)
    except Evento.DoesNotExist:
        return HttpResponseNotFound("Evento não encontrado")

    if request.method == 'GET':
        # Busca Participantes usando CYPHER
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

            # Relacionamento Pessoa -> Evento
            if tipo == 'FOI':
                destino = Evento.nodes.get(uuid=dados['destino_uuid'])
                origem.participou.connect(destino)
                return JsonResponse({'message': 'Presença confirmada!'})

            # Relacionamento Pessoa -> Pessoa
            else:
                destino = Pessoa.nodes.get(uuid=dados['destino_uuid'])
                if tipo == 'PAI':
                    origem.pai_de.connect(destino)
                elif tipo == 'MAE':
                    origem.mae_de.connect(destino)
                elif tipo == 'CASADO':
                    origem.casado_com.connect(destino)
                else:
                    return HttpResponseBadRequest("Tipo inválido")
                return JsonResponse({'message': f'Relacionamento {tipo} criado!'})

        except Exception as e:
            return HttpResponseBadRequest(f"Erro ao conectar: {str(e)}")

    return HttpResponseBadRequest("Método não permitido")
