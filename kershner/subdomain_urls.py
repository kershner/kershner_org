from . import subdomain_views
from django.urls import path

urlpatterns = [
    path('', subdomain_views.subdomain_home, name='subdomain_home'),
]