import apps.daggerwalk.views as daggerwalk_views
from django.urls import path

daggerwalk_patterns = [
    path('', daggerwalk_views.DaggerwalkHomeView.as_view(), name='daggerwalk'),
    path('data/', daggerwalk_views.DaggerwalkHomeDataView.as_view(), name='daggerwalk_data'),
    path('logs/', daggerwalk_views.DaggerwalkLogsView.as_view(), name='daggerwalk_logs'),
    path('logs/<int:log_id>/delete-previous/', daggerwalk_views.delete_previous_logs, name='delete_previous_logs'),
    path('logs/latest/', daggerwalk_views.latest_log, name='daggerwalk_latest_log'),
    path('log/', daggerwalk_views.create_daggerwalk_log, name='daggerwalk_log'),
    path("admin/build-daggerwalk-caches/", daggerwalk_views.build_daggerwalk_caches, name="admin-build-daggerwalk-caches"),
]