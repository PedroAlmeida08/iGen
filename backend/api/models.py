# api/models.py
from neomodel import StructuredNode, StringProperty, UniqueIdProperty, DateProperty


class Pessoa(StructuredNode):
    uuid = UniqueIdProperty()  # neomodel vai gerar um ID único para nós
    nomeCompleto = StringProperty(required=True)
    sexo = StringProperty()
    dataNascimento = DateProperty()
    # Adicionaremos mais campos e relacionamentos aqui no futuro
