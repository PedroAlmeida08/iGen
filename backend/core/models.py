from django.db import models
# NOVO: Sistema de usuários do Django
from django.contrib.auth.models import User
from neomodel import (
    StructuredNode,
    StringProperty,
    DateProperty,
    UniqueIdProperty,
    Relationship,
    RelationshipTo,
    RelationshipFrom,
    IntegerProperty
)

# ==============================================================================
# 1. MODELOS RELACIONAIS (DJANGO) - CONTROLO DE ACESSO E WORKSPACES
# ==============================================================================


class FamiliaWorkspace(models.Model):
    """
    Representa o ambiente privado de uma família. 
    O uuid_referencia serve de ponte para o nó 'FamiliaNode' no Neo4j.
    """
    nome = models.CharField(max_length=150)
    criado_em = models.DateTimeField(auto_now_add=True)
    uuid_referencia = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nome


class MembroFamilia(models.Model):
    """
    Gere as permissões de acesso de um usuário a um Workspace.
    """
    FUNCOES = [
        ('ADMIN', 'Administrador'),
        ('COLABORADOR', 'Colaborador'),
        ('LEITOR', 'Leitor')
    ]

    usuario = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='familias')
    familia = models.ForeignKey(
        FamiliaWorkspace, on_delete=models.CASCADE, related_name='membros')
    funcao = models.CharField(max_length=20, choices=FUNCOES, default='LEITOR')
    aderiu_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Garante que um usuário não é duplicado na mesma família
        unique_together = ('usuario', 'familia')

    def __str__(self):
        return f"{self.usuario.username} - {self.familia.nome} ({self.funcao})"


class RegistroAtividade(models.Model):
    # Alterado para ForeignKey apontando para o Usuário real e a Família isolada
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    familia = models.ForeignKey(
        FamiliaWorkspace, on_delete=models.CASCADE, null=True)
    acao = models.CharField(max_length=50)
    entidade = models.CharField(max_length=50)
    detalhes = models.TextField()
    data_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_hora']


class Solicitacao(models.Model):
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('APROVADA', 'Aprovada'),
        ('NEGADA', 'Negada')
    ]

    # Alterado para associar a solicitação a uma Família específica
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    familia = models.ForeignKey(
        FamiliaWorkspace, on_delete=models.CASCADE, null=True)
    tipo_acao = models.CharField(max_length=50)
    entidade = models.CharField(max_length=50)
    uuid_entidade = models.CharField(max_length=100)
    motivo = models.TextField()
    dados_novos = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    data_solicitacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_solicitacao']


# ==============================================================================
# 2. MODELOS DE GRAFOS (NEOMODEL) - DADOS DA ÁRVORE GENEALÓGICA
# ==============================================================================

class FamiliaNode(StructuredNode):
    """
    Nó raiz da família no Neo4j. Todos os dados privados pertencem a este nó.
    """
    uuid = UniqueIdProperty()
    nome = StringProperty(required=True)


class Evento(StructuredNode):
    uuid = UniqueIdProperty()
    tipo = StringProperty(required=True)
    data = DateProperty()
    local = StringProperty()
    descricao = StringProperty()

    # NOVO: Obrigatório estar ligado a uma família
    pertence_a = RelationshipTo('FamiliaNode', 'PERTENCE_A')


class Pessoa(StructuredNode):
    uuid = UniqueIdProperty()
    nomeCompleto = StringProperty(required=True)
    apelido = StringProperty()
    dataNascimento = DateProperty()

    criado_por_id = IntegerProperty()
    criado_por_nome = StringProperty()
    criado_em = StringProperty()

    pai_de = RelationshipTo('Pessoa', 'PAI')
    mae_de = RelationshipTo('Pessoa', 'MAE')
    irmao_de = Relationship('Pessoa', 'IRMAO')
    casado_com = RelationshipTo('Pessoa', 'CASADO')
    participou = RelationshipTo('Evento', 'FOI')
    comentarios = RelationshipFrom('Comentario', 'SOBRE')

    # NOVO: Obrigatório estar ligado a uma família
    pertence_a = RelationshipTo('FamiliaNode', 'PERTENCE_A')


class Comentario(StructuredNode):
    uuid = UniqueIdProperty()
    texto = StringProperty(required=True)
    autor = StringProperty()
    data = StringProperty()

    sobre = RelationshipTo('Pessoa', 'SOBRE')

    # NOVO: Obrigatório estar ligado a uma família
    pertence_a = RelationshipTo('FamiliaNode', 'PERTENCE_A')
