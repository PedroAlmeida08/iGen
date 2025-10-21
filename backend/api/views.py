# api/views.py
from rest_framework import viewsets
from django.http import Http404  # Importe o Http404 do Django
from .models import Pessoa
from .serializers import PessoaSerializer


class PessoaViewSet(viewsets.ModelViewSet):
    serializer_class = PessoaSerializer
    lookup_field = 'uuid'

    def get_queryset(self):
        """
        Garante que a lista de pessoas esteja sempre atualizada.
        """
        return Pessoa.nodes.all()

    def get_object(self):
        """
        Assume o controle da busca por um único objeto.
        """
        # Pega o valor do lookup_field (o uuid) da URL
        lookup_value = self.kwargs[self.lookup_field]

        try:
            # Tenta buscar a pessoa usando o método do neomodel
            obj = Pessoa.nodes.get(uuid=lookup_value)
        except Pessoa.DoesNotExist:
            # Se neomodel não encontrar, levanta o erro 404
            raise Http404

        return obj
