import apps.daggerwalk.views as daggerwalk_views
from django.urls import path

daggerwalk_patterns = [
    path('', daggerwalk_views.DaggerwalkHomeView.as_view(), name='daggerwalk'),
    path('refresh-data/', daggerwalk_views.daggerwalk_refresh_data, name='daggerwalk_refresh_data'),
    path('data/', daggerwalk_views.DaggerwalkHomeDataView.as_view(), name='daggerwalk_data'),
    path('logs/latest/', daggerwalk_views.latest_log, name='daggerwalk_latest_log'),
    path('log/', daggerwalk_views.create_daggerwalk_log, name='daggerwalk_log'),
    path('bot/progression/', daggerwalk_views.bot_progression_snapshot, name='daggerwalk_bot_progression'),
    path('bot/guild/', daggerwalk_views.bot_guild_action, name='daggerwalk_bot_guild'),
    path('bot/monument/', daggerwalk_views.bot_monument_action, name='daggerwalk_bot_monument'),
    path("quest/", daggerwalk_views.quest_redirect_view, name="quest"),
    path(
        "quests/<int:quest_id>/",
        daggerwalk_views.completed_quest_detail,
        name="daggerwalk_quest_detail",
    ),
    path("walkers/<str:username>/", daggerwalk_views.walker_chronicle, name="daggerwalk_walker"),
    path("guilds/", daggerwalk_views.guild_hall, name="daggerwalk_guild_hall"),
    path("monuments/", daggerwalk_views.monument_registry, name="daggerwalk_monuments"),
    path("admin/build-daggerwalk-caches/", daggerwalk_views.build_daggerwalk_caches, name="admin-build-daggerwalk-caches"),
]
