from django.urls import path
from . import views

urlpatterns = [
    # --- 1. AUTENTICAÇÃO ---
    path('api/auth/register/', views.api_registrar_usuario, name='auth_register'),
    path('api/auth/login/', views.api_login, name='auth_login'),
    path('api/auth/logout/', views.api_logout, name='auth_logout'),
    path('api/auth/check/', views.api_check_auth, name='auth_check'),

    # --- 2. GRAFO (Visualização) ---
    path('api/grafo/', views.api_grafo, name='api_grafo'),

    # --- 3. PESSOAS (CRUD + Comentários) ---
    path('api/pessoas/', views.api_listar_pessoas, name='api_listar_pessoas'),
    path('api/pessoas/<str:uuid>/', views.api_detalhe_pessoa,
         name='api_detalhe_pessoa'),
    path('api/pessoas/<str:uuid>/comentar/',
         views.api_adicionar_comentario, name='api_adicionar_comentario'),

    # --- 4. EVENTOS ---
    path('api/eventos/', views.api_listar_eventos, name='api_listar_eventos'),
    path('api/eventos/<str:uuid>/', views.api_detalhe_evento,
         name='api_detalhe_evento'),

    # --- 5. RELACIONAMENTOS ---
    path('api/relacionar/', views.api_criar_relacionamento,
         name='api_criar_relacionamento'),
]
