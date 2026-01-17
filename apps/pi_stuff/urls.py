from django.urls import path
from . import views

pi_stuff_patterns  = [
    path("", views.PiStuffHomeView.as_view(), name="pi_home"),
    path("submit/", views.submit_form, name="submit"),
    path("play/", views.api_play, name="api_play"),
    path("latest/", views.latest, name="latest"),
]
