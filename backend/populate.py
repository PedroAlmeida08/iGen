from neomodel import db
from core.models import Pessoa, Evento
import os
import django
from datetime import date

# Configura o ambiente do Django para que o script reconheça os modelos
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


def popular_banco():
    print("🧹 Limpando o banco de dados para um teste limpo...")
    db.cypher_query("MATCH (n) DETACH DELETE n")

    print("🌳 Criando árvore genealógica de exemplo...")

    # --- GERAÇÃO 1: Avós ---
    joaquim = Pessoa(nomeCompleto="Joaquim Silva", sexo="M",
                     dataNascimento=date(1950, 5, 10)).save()
    maria = Pessoa(nomeCompleto="Maria Silva", sexo="F",
                   dataNascimento=date(1953, 3, 15)).save()
    joaquim.casado_com.connect(maria)

    # --- GERAÇÃO 2: Pais ---
    # Gilberto é filho de Joaquim e Maria
    gilberto = Pessoa(nomeCompleto="Gilberto Silva", sexo="M",
                      dataNascimento=date(1981, 9, 27)).save()
    joaquim.pai_de.connect(gilberto)
    maria.mae_de.connect(gilberto)

    # Fran (esposa do Gilberto)
    fran = Pessoa(nomeCompleto="Fran Silva", sexo="F",
                  dataNascimento=date(1982, 8, 24)).save()
    gilberto.casado_com.connect(fran)

    # --- GERAÇÃO 3: Filhos ---
    # João e Julia são filhos de Gilberto e Fran
    joao = Pessoa(nomeCompleto="João Silva", apelido="jp",
                  sexo="M", dataNascimento=date(1999, 8, 2)).save()
    julia = Pessoa(nomeCompleto="Julia de Almeida dos Santos",
                   apelido="Ju", sexo="F", dataNascimento=date(2010, 6, 11)).save()

    gilberto.pai_de.connect(joao)
    gilberto.pai_de.connect(julia)
    fran.mae_de.connect(joao)
    fran.mae_de.connect(julia)

    # --- EVENTO ---
    natal = Evento(tipo="Natal em Família", data=date(
        2025, 12, 25), local="Casa do Joaquim").save()
    joao.participou.connect(natal)
    julia.participou.connect(natal)
    gilberto.participou.connect(natal)

    print("\n✅ Sucesso! Família criada:")
    print(f"- Joaquim & Maria (Avós)")
    print(f"- Gilberto & Fran (Pais)")
    print(f"- João & Julia (Filhos)")


if __name__ == "__main__":
    popular_banco()
