from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PessoaViewSet

# Cria um roteador
router = DefaultRouter()
# Registra nosso ViewSet com o roteador
router.register(r'pessoas', PessoaViewSet, basename='pessoa')

# As URLs da API são agora determinadas automaticamente pelo roteador
urlpatterns = [
    path('', include(router.urls)),
]
