from neomodel import StructuredNode, StringProperty, DateProperty, RelationshipTo, RelationshipFrom, config
import uuid


class Evento(StructuredNode):
    uuid = StringProperty(unique_index=True, default=lambda: str(uuid.uuid4()))
    tipo = StringProperty(required=True)  # Ex: Nascimento, Casamento, Óbito
    data = DateProperty(required=True)
    local = StringProperty()
    descricao = StringProperty()


class Pessoa(StructuredNode):
    uuid = StringProperty(unique_index=True, default=lambda: str(uuid.uuid4()))
    nomeCompleto = StringProperty(required=True)
    apelido = StringProperty()
    sexo = StringProperty(
        choices={'M': 'Masculino', 'F': 'Feminino', 'O': 'Outro'})
    dataNascimento = DateProperty()

    # --- RELAÇÕES QUE SAEM (Para ver filhos e cônjuges) ---
    pai_de = RelationshipTo('Pessoa', 'PAI_DE')
    mae_de = RelationshipTo('Pessoa', 'MAE_DE')
    casado_com = RelationshipTo('Pessoa', 'CASADO_COM')
    participou = RelationshipTo('Evento', 'PARTICIPOU')

    # --- RELAÇÕES QUE ENTRAM (Para ver pais no perfil do filho) ---
    filho_de_pai = RelationshipFrom('Pessoa', 'PAI_DE')
    filho_de_mae = RelationshipFrom('Pessoa', 'MAE_DE')
