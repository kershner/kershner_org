from django.urls import path
from . import views

pi_stuff_patterns = [
    path('', views.PiStuffHomeView.as_view(), name='home'),
    path('submit/', views.submit_form, name='submit'),
    path('latest/', views.latest, name='latest'),
    path('regenerate-qr/', views.regenerate_qr, name='regenerate_qr'),
    path('api/youtube-search/', views.youtube_search, name='youtube_search'),
    path('api/play/', views.api_play, name='api_play'),
]