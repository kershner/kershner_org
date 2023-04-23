import apps.color_doodle.views as doodle_views
from django.urls import path

doodle_patterns = [
    path('', doodle_views.DoodleHomeView.as_view(), name='doodle'),
]
