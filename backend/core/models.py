from neomodel import (
    StructuredNode,
    StringProperty,
    DateProperty,
    UniqueIdProperty,
    RelationshipTo,
    IntegerProperty,
    RelationshipFrom
)


class Evento(StructuredNode):
    """
    Representa um evento histórico (Casamento, Nascimento, Batizado, etc.)
    """
    uuid = UniqueIdProperty()
    tipo = StringProperty(required=True)  # Ex: "Casamento", "Formatura"
    data = DateProperty()                 # YYYY-MM-DD
    local = StringProperty()
    descricao = StringProperty()


class Pessoa(StructuredNode):
    uuid = UniqueIdProperty()
    nomeCompleto = StringProperty(required=True)
    apelido = StringProperty()
    dataNascimento = DateProperty()  # <--- O vilão pode ser aqui se receber ""

    # --- VOCÊ ADICIONOU ISSO? ---
    criado_por_id = IntegerProperty()
    criado_por_nome = StringProperty()
    criado_em = StringProperty()
    # ----------------------------

    pai_de = RelationshipTo('Pessoa', 'PAI')
    mae_de = RelationshipTo('Pessoa', 'MAE')
    casado_com = RelationshipTo('Pessoa', 'CASADO')
    participou = RelationshipTo('Evento', 'FOI')
    comentarios = RelationshipFrom('Comentario', 'SOBRE')


class Comentario(StructuredNode):
    """
    Permite que usuários deixem notas em perfis que não podem editar.
    """
    uuid = UniqueIdProperty()
    texto = StringProperty(required=True)
    autor = StringProperty()  # Nome do usuário que comentou
    data = StringProperty()  # Data do comentário

    # Define que este comentário é sobre uma Pessoa
    sobre = RelationshipTo('Pessoa', 'SOBRE')
