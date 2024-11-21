from django.urls import path, re_path
import apps.public_api_explorer.views as public_api_explorer_views

public_api_explorer_patterns = [
    path('', public_api_explorer_views.PublicApiExplorerHomeView.as_view(), name='public_api_explorer'),
    re_path(r'^view/?$', public_api_explorer_views.PublicApiExplorerHomeView.as_view(), name='public_api_explorer_view'),
]