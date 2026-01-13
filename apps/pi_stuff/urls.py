import apps.pi_stuff.views as pi_stuff_views
from django.urls import path

pi_stuff_patterns = [
    path('', pi_stuff_views.PiStuffHomeView.as_view(), name='pi_stuff_home'),
]