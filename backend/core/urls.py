from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('cadastrar-pessoa/', views.cadastrar_pessoa, name='cadastrar_pessoa'),
    path('cadastrar-evento/', views.cadastrar_evento, name='cadastrar_evento'),
    path('pessoas/', views.listar_pessoas, name='listar_pessoas'),
    path('eventos/', views.listar_eventos, name='listar_eventos'),
    path('pessoa/<str:uuid>/', views.detalhar_pessoa, name='detalhar_pessoa'),
    path('pessoa/<str:uuid>/conectar-parentesco/',
         views.conectar_parentesco, name='conectar_parentesco'),
    path('pessoa/<str:uuid>/conectar-evento/',
         views.conectar_evento_pessoa, name='conectar_evento_pessoa'),
    path('pessoa/<str:uuid_a>/remover/<str:uuid_b>/<str:tipo_rel>/',
         views.remover_conexao, name='remover_conexao'),
    path('pessoa/<str:uuid>/excluir/',
         views.excluir_pessoa, name='excluir_pessoa'),
    path('evento/<str:uuid>/excluir/',
         views.excluir_evento, name='excluir_evento'),
    path('grafo/', views.visualizar_grafo, name='visualizar_grafo'),
]
