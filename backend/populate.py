import os
import django
from datetime import date

# 1. SETUP INICIAL DO DJANGO
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


def popular_banco():
    from core.models import Pessoa, Evento

    print("Iniciando atualizações no banco de dados...")

    # ==========================================
    # BUSCANDO OU CRIANDO OS PERSONAGENS
    # (Usando get_or_none para evitar erros caso não existam)
    # ==========================================
    gui = Pessoa.nodes.get_or_none(nomeCompleto="William Arthur Weasley")
    carlinhos = Pessoa.nodes.get_or_none(nomeCompleto="Charles Weasley")
    percy = Pessoa.nodes.get_or_none(nomeCompleto="Percy Ignatius Weasley")
    harry = Pessoa.nodes.get_or_none(nomeCompleto="Harry James Potter")
    arthur = Pessoa.nodes.get_or_none(nomeCompleto="Arthur Weasley")
    molly = Pessoa.nodes.get_or_none(nomeCompleto="Molly Weasley")

    fleur = Pessoa.nodes.get_or_none(nomeCompleto="Fleur Isabelle Delacour")
    if not fleur:
        fleur = Pessoa(nomeCompleto="Fleur Isabelle Delacour", apelido="Fleur",
                       dataNascimento=date(1977, 10, 30), criado_por_nome="admin").save()

    gabrielle = Pessoa.nodes.get_or_none(nomeCompleto="Gabrielle Delacour")
    if not gabrielle:
        gabrielle = Pessoa(nomeCompleto="Gabrielle Delacour", apelido="Gabrielle",
                           dataNascimento=date(1986, 1, 1), criado_por_nome="admin").save()

    # Conecta as irmãs Delacour
    if fleur and gabrielle and not fleur.irmao_de.is_connected(gabrielle):
        fleur.irmao_de.connect(gabrielle)
        gabrielle.irmao_de.connect(fleur)

    # ==========================================
    # REGISTRANDO O CASAMENTO (GUI E FLEUR)
    # ==========================================
    if gui and fleur and not gui.casado_com.is_connected(fleur):
        gui.casado_com.connect(fleur)
        print("💍 Casamento entre Gui e Fleur registrado com sucesso!")

    # ==========================================
    # ADICIONANDO E CONECTANDO OS EVENTOS
    # ==========================================
    # Torneio Tribruxo
    tribruxo = Evento.nodes.get_or_none(tipo="Torneio Tribruxo")
    if not tribruxo:
        tribruxo = Evento(tipo="Torneio Tribruxo", data=date(1994, 10, 31), local="Castelo de Hogwarts",
                          descricao="Competição mágica lendária entre três escolas.").save()

    for p in [fleur, harry, gabrielle]:
        if p and not p.participou.is_connected(tribruxo):
            p.participou.connect(tribruxo)

    # O Evento do Casamento na Toca
    casamento_evento = Evento.nodes.get_or_none(
        tipo="Casamento de Gui e Fleur")
    if not casamento_evento:
        casamento_evento = Evento(tipo="Casamento de Gui e Fleur", data=date(
            1997, 8, 1), local="A Toca", descricao="Cerimônia interrompida pela queda do Ministério da Magia.").save()

    participantes_casamento = [gui, fleur, gabrielle,
                               arthur, molly, carlinhos, percy, harry]
    for p in participantes_casamento:
        if p and not p.participou.is_connected(casamento_evento):
            p.participou.connect(casamento_evento)

    # ==========================================
    # CONECTANDO A EVENTOS ANTIGOS
    # ==========================================
    batalha_hogwarts = Evento.nodes.get_or_none(tipo="A Batalha de Hogwarts")
    if batalha_hogwarts:
        for p in [gui, fleur, percy]:
            if p and not p.participou.is_connected(batalha_hogwarts):
                p.participou.connect(batalha_hogwarts)

    batalha_7_potter = Evento.nodes.get_or_none(tipo="A Batalha dos 7 Potter")
    if batalha_7_potter:
        for p in [gui, fleur]:
            if p and not p.participou.is_connected(batalha_7_potter):
                p.participou.connect(batalha_7_potter)

    print("✅ Script executado com sucesso! Todos os eventos e laços foram atualizados no banco de dados.")


if __name__ == '__main__':
    popular_banco()
