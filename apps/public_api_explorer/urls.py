import apps.public_api_explorer.views as public_api_explorer_views
from django.urls import path


public_api_explorer_patterns = [
    path('', public_api_explorer_views.PublicApiExplorerHomeView.as_view(), name='public_api_explorer'),
    path('view/', public_api_explorer_views.PublicApiExplorerHomeView.as_view(), name='public_api_explorer_view'),
]