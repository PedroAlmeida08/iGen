from django.db import models

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
    dataNascimento = DateProperty()

    # Campos de Auditoria de Criação
    criado_por_id = IntegerProperty()
    criado_por_nome = StringProperty()
    criado_em = StringProperty()

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


class RegistroAtividade(models.Model):
    usuario = models.CharField(max_length=150)
    acao = models.CharField(max_length=50)       # Ex: Criou, Editou, Excluiu
    entidade = models.CharField(max_length=50)   # Ex: Pessoa, Evento
    detalhes = models.TextField()                # Ex: "João excluiu a pessoa Maria"
    data_hora = models.DateTimeField(auto_now_add=True)  # Preenche automático

    class Meta:
        # Ordena dos mais recentes para os mais antigos
        ordering = ['-data_hora']


class Solicitacao(models.Model):
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('APROVADA', 'Aprovada'),
        ('NEGADA', 'Negada')
    ]

    usuario = models.CharField(max_length=150)
    tipo_acao = models.CharField(max_length=50)   # Ex: 'Editar' ou 'Excluir'
    entidade = models.CharField(max_length=50)    # Ex: 'Pessoa' ou 'Evento'
    uuid_entidade = models.CharField(max_length=100)
    motivo = models.TextField()
    # Guarda o JSON em texto caso seja uma Edição
    dados_novos = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    data_solicitacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_solicitacao']
