from django import forms


class PessoaForm(forms.Form):
    nome_completo = forms.CharField(label="Nome Completo", max_length=200)
    apelido = forms.CharField(label="Apelido", max_length=100, required=False)
    sexo = forms.ChoiceField(label="Sexo", choices=[(
        'M', 'Masculino'), ('F', 'Feminino'), ('O', 'Outro')])
    data_nascimento = forms.DateField(
        label="Data de Nascimento", widget=forms.DateInput(attrs={'type': 'date'}))


class EventoForm(forms.Form):
    tipo = forms.CharField(
        label="Tipo do Evento (Ex: Nascimento, Casamento)", max_length=100)
    data = forms.DateField(label="Data do Evento",
                           widget=forms.DateInput(attrs={'type': 'date'}))
    local = forms.CharField(label="Local", max_length=200, required=False)
    descricao = forms.CharField(
        label="Descrição", widget=forms.Textarea, required=False)
