from rest_framework import serializers
from .models import Pessoa


class PessoaSerializer(serializers.Serializer):
    uuid = serializers.CharField(read_only=True)
    nomeCompleto = serializers.CharField(required=True, max_length=100)
    sexo = serializers.CharField(
        required=False, allow_blank=True, max_length=20)
    dataNascimento = serializers.DateField(required=False, allow_null=True)

    def create(self, validated_data):
        # Cria e salva a instância do modelo Pessoa
        return Pessoa(**validated_data).save()

    def update(self, instance, validated_data):
        # Atualiza os campos da instância existente
        instance.nomeCompleto = validated_data.get(
            'nomeCompleto', instance.nomeCompleto)
        instance.sexo = validated_data.get('sexo', instance.sexo)
        instance.dataNascimento = validated_data.get(
            'dataNascimento', instance.dataNascimento)
        # Salva as alterações
        return instance.save()
