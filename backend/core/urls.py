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
    path('api/pessoas/<str:uuid_alvo>/comentar/',
         views.api_comentarios, name='api_comentarios_pessoa'),

    # --- 4. EVENTOS (CRUD + Comentários) ---
    path('api/eventos/', views.api_listar_eventos, name='api_listar_eventos'),
    path('api/eventos/<str:uuid>/', views.api_detalhe_evento,
         name='api_detalhe_evento'),
    path('api/eventos/<str:uuid_alvo>/comentar/',
         views.api_comentarios, name='api_comentarios_evento'),

    # --- 4.1 COMENTÁRIOS (Alvo: Pessoa ou Evento) ---
    path('api/comentarios/<str:uuid_alvo>/',
         views.api_comentarios, name='api_comentarios'),

    # --- 5. RELACIONAMENTOS ---
    path('api/relacionar/', views.api_criar_relacionamento,
         name='api_criar_relacionamento'),

    # --- 6. LOGS (Auditoria) ---
    path('api/logs/', views.api_listar_logs, name='api_listar_logs'),

    # --- 7. SOLICITAÇÕES ---
    path('api/solicitacoes/', views.api_solicitacoes, name='api_solicitacoes'),
    path('api/solicitacoes/<int:id>/', views.api_processar_solicitacao,
         name='api_processar_solicitacao'),

    # --- 8. FAMÍLIAS (Workspaces) ---
    path('api/familias/criar/', views.api_criar_familia, name='api_criar_familia'),
    path('api/familias/entrar/', views.api_entrar_familia, name='api_entrar_familia'),
    path('api/familias/<str:uuid>/', views.api_excluir_familia, name='api_excluir_familia'),
    path('api/familias/<str:uuid>/membros/', views.api_listar_membros_familia, name='api_familias_membros'),
    path('api/membros/', views.api_listar_membros_familia, name='api_listar_membros'),
    path('api/membros/<int:membro_id>/funcao/', views.api_alterar_funcao_membro, name='api_alterar_funcao_membro'),
]

