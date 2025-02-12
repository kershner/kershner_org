import apps.daggerwalk.views as daggerwalk_views
from django.urls import path

daggerwalk_patterns = [
    path('', daggerwalk_views.DaggerwalkHomeView.as_view(), name='daggerwalk'),
]