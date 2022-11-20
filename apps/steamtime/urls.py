import apps.steamtime.views as views
from django.urls import path


steamtime_patterns = [
    path('', views.steamtime, name='steamtime'),
    path('results/', views.results, name='steamtime-results')
]
