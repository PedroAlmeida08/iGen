from django.shortcuts import render, redirect
from django.contrib import messages
from .models import Pessoa, Evento
from .forms import PessoaForm, EventoForm
import json
from django.http import JsonResponse

# --- DASHBOARD E LISTAGENS ---


def index(request):
    total_pessoas = len(Pessoa.nodes.all())
    total_eventos = len(Evento.nodes.all())
    eventos_recentes = Evento.nodes.order_by('-data')[:5]
    pessoas_recentes = Pessoa.nodes.all()[:5]
    return render(request, 'core/dashboard.html', {
        'total_pessoas': total_pessoas,
        'total_eventos': total_eventos,
        'eventos_recentes': eventos_recentes,
        'pessoas_recentes': pessoas_recentes,
    })


def listar_pessoas(request):
    pessoas = Pessoa.nodes.all()
    return render(request, 'core/listar_pessoas.html', {'pessoas': pessoas})


def listar_eventos(request):
    eventos = Evento.nodes.all()
    return render(request, 'core/listar_eventos.html', {'eventos': eventos})

# --- PERFIL DETALHADO ---


def detalhar_pessoa(request, uuid):
    pessoa = Pessoa.nodes.get(uuid=uuid)
    todas_pessoas = Pessoa.nodes.exclude(uuid=uuid)
    todos_eventos = Evento.nodes.all()
    return render(request, 'core/detalhar_pessoa.html', {
        'pessoa': pessoa,
        'todas_pessoas': todas_pessoas,
        'todos_eventos': todos_eventos
    })

# --- CADASTROS ---


def cadastrar_pessoa(request):
    if request.method == "POST":
        form = PessoaForm(request.POST)
        if form.is_valid():
            Pessoa(
                nomeCompleto=form.cleaned_data['nome_completo'],
                apelido=form.cleaned_data['apelido'],
                sexo=form.cleaned_data['sexo'],
                dataNascimento=form.cleaned_data['data_nascimento']
            ).save()
            messages.success(request, "Pessoa cadastrada com sucesso!")
            return redirect('listar_pessoas')
    return render(request, 'core/cadastrar_pessoa.html', {'form': PessoaForm()})


def cadastrar_evento(request):
    if request.method == "POST":
        form = EventoForm(request.POST)
        if form.is_valid():
            Evento(
                tipo=form.cleaned_data['tipo'],
                data=form.cleaned_data['data'],
                local=form.cleaned_data['local'],
                descricao=form.cleaned_data['descricao']
            ).save()
            messages.success(request, "Evento cadastrado com sucesso!")
            return redirect('listar_eventos')
    return render(request, 'core/cadastrar_evento.html', {'form': EventoForm()})

# --- GESTÃO DE RELACIONAMENTOS (Neo4j) ---


def conectar_parentesco(request, uuid):
    if request.method == "POST":
        pessoa_a = Pessoa.nodes.get(uuid=uuid)
        pessoa_b = Pessoa.nodes.get(uuid=request.POST.get('pessoa_b'))
        tipo = request.POST.get('tipo_relacao')

        if tipo == 'pai_de':
            pessoa_a.pai_de.connect(pessoa_b)
        elif tipo == 'mae_de':
            pessoa_a.mae_de.connect(pessoa_b)
        elif tipo == 'filho_de_pai':
            pessoa_b.pai_de.connect(pessoa_a)
        elif tipo == 'filho_de_mae':
            pessoa_b.mae_de.connect(pessoa_a)
        elif tipo == 'casado_com':
            pessoa_a.casado_com.connect(pessoa_b)

        messages.success(request, "Parentesco conectado com sucesso!")
    return redirect('detalhar_pessoa', uuid=uuid)


def conectar_evento_pessoa(request, uuid):
    if request.method == "POST":
        pessoa = Pessoa.nodes.get(uuid=uuid)
        evento = Evento.nodes.get(uuid=request.POST.get('evento_uuid'))
        pessoa.participou.connect(evento)
        messages.success(
            request, f"Participação em '{evento.tipo}' registrada!")
    return redirect('detalhar_pessoa', uuid=uuid)


def remover_conexao(request, uuid_a, uuid_b, tipo_rel):
    pessoa_a = Pessoa.nodes.get(uuid=uuid_a)
    if tipo_rel == 'participou':
        target = Evento.nodes.get(uuid=uuid_b)
        pessoa_a.participou.disconnect(target)
    else:
        target = Pessoa.nodes.get(uuid=uuid_b)
        if tipo_rel == 'pai_de':
            pessoa_a.pai_de.disconnect(target)
        elif tipo_rel == 'mae_de':
            pessoa_a.mae_de.disconnect(target)
        elif tipo_rel == 'filho_de_pai':
            target.pai_de.disconnect(pessoa_a)
        elif tipo_rel == 'filho_de_mae':
            target.mae_de.disconnect(pessoa_a)
        elif tipo_rel == 'casado_com':
            pessoa_a.casado_com.disconnect(target)

    messages.info(request, "Conexão removida.")
    return redirect('detalhar_pessoa', uuid=uuid_a)

# --- EXCLUSÃO FÍSICA ---


def excluir_pessoa(request, uuid):
    pessoa = Pessoa.nodes.get(uuid=uuid)
    pessoa.delete()
    messages.error(request, "Pessoa removida do sistema.")
    return redirect('listar_pessoas')


def excluir_evento(request, uuid):
    evento = Evento.nodes.get(uuid=uuid)
    evento.delete()
    messages.error(request, "Evento removido do sistema.")
    return redirect('listar_eventos')


def visualizar_grafo(request):
    # Busca todas as pessoas e eventos
    pessoas = Pessoa.nodes.all()
    eventos = Evento.nodes.all()

    nodes = []
    edges = []

    # Criar Nós de Pessoas
    for p in pessoas:
        nodes.append({
            'id': p.uuid,
            'label': p.nomeCompleto,
            'group': 'pessoa',
            'title': f"Apelido: {p.apelido or 'N/A'}"
        })

    # Criar Nós de Eventos
    for e in eventos:
        nodes.append({
            'id': e.uuid,
            'label': e.tipo,
            'group': 'evento',
            'shape': 'box',
            'color': '#e67e22'
        })

    # Criar Conexões (Arestas)
    for p in pessoas:
        # Relacionamentos de Parentesco
        for filho in p.pai_de.all():
            edges.append({'from': p.uuid, 'to': filho.uuid,
                         'label': 'PAI_DE', 'arrows': 'to'})
        for filho in p.mae_de.all():
            edges.append({'from': p.uuid, 'to': filho.uuid,
                         'label': 'MAE_DE', 'arrows': 'to'})
        for conjuge in p.casado_com.all():
            edges.append(
                {'from': p.uuid, 'to': conjuge.uuid, 'label': 'CASADO_COM'})

        # Participação em Eventos
        for evento in p.participou.all():
            edges.append({'from': p.uuid, 'to': evento.uuid,
                         'label': 'PARTICIPOU', 'dashes': True})

    return render(request, 'core/visualizar_grafo.html', {
        'nodes_json': json.dumps(nodes),
        'edges_json': json.dumps(edges)
    })
