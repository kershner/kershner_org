from apps.public_api_explorer.urls import public_api_explorer_patterns
from apps.screenbloom.views import screenbloom_landing
from apps.color_doodle.urls import doodle_patterns
from apps.steamtime.urls import steamtime_patterns
from apps.project import views as project_views
from apps.ai_quiz.urls import ai_quiz_patterns
from apps.whoosh.urls import whoosh_patterns
import apps.philomania.views as phil_views
from apps.api.urls import api_patterns
from django.urls import include, path
from . import views as kersh_views
from apps.bacon.views import bacon
from django.contrib import admin

handler404 = 'kershner.views.custom_error_view'
handler500 = 'kershner.views.custom_error_view'
handler403 = 'kershner.views.custom_error_view'
handler400 = 'kershner.views.custom_error_view'

urlpatterns = [
    path('', kersh_views.home, name='home'),
    
    # TODO - replace old serializer routes with new DRF stuff
    path('songs/', kersh_views.get_songs_data),
    path('songs', kersh_views.get_songs_data),

    # Music player
    path('music/', kersh_views.music, name='music'),
    path('music', kersh_views.music, name='music'),

    # Philomania
    path('phil/', phil_views.philomania),
    path('phil', phil_views.philomania),

    # [ominous whoosher]
    path('whoosh/', include(whoosh_patterns)),
    path('whoosh', include(whoosh_patterns)),

    # AI Quiz
    path('quiz/', include(ai_quiz_patterns)),
    path('quiz', include(ai_quiz_patterns)),

    # Color Doodle
    path('doodle/', include(doodle_patterns)),
    path('doodle', include(doodle_patterns)),

    # ScreenBloom landing page
    path('screenbloom/', screenbloom_landing),
    path('screenbloom', screenbloom_landing),

    # Page for Bacon
    path('bacon/', bacon),
    path('bacon', bacon),

    # SteamTime
    path('steamtime/', include(steamtime_patterns)),
    path('steamtime', include(steamtime_patterns)),

    # public-api-explorer
    path('public-api-explorer/', include(public_api_explorer_patterns)),
    path('public-api-explorer', include(public_api_explorer_patterns)),

    # API
    path('api/', include(api_patterns)),

    # Admin Stuff
    path('kersh-zone/move-project-position/<project_id>/<direction>', project_views.MoveProjectPositionView.as_view(),
         name='move_project_position'),
    path('kersh-zone/', admin.site.urls),
]

admin.site.site_header = "kershner.org admin"
admin.site.site_title  =  "kershner.org admin"
admin.site.index_title  =  ""
