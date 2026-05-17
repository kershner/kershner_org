from . import views as kersh_views
from django.urls import path

urlpatterns = [
    path('', kersh_views.subdomain_home, name='subdomain_home'),
]