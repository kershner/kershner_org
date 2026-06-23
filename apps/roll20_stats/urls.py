from django.urls import path
from . import views

dnd_patterns = [
    path('', views.DnDHome.as_view(), name='dnd_home'),
]