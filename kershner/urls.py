from apps.screenbloom.views import screenbloom_landing
from apps.steamtime.urls import steamtime_patterns
from apps.project import views as project_views
from apps.ai_quiz.urls import ai_quiz_patterns
from apps.whoosh.urls import whoosh_patterns
import apps.philomania.views as phil_views
from . import views as kersh_views
from django.urls import include, path
from apps.bacon.views import bacon
from django.contrib import admin

handler404 = 'kershner.views.custom_error_view'
handler500 = 'kershner.views.custom_error_view'
handler403 = 'kershner.views.custom_error_view'
handler400 = 'kershner.views.custom_error_view'

urlpatterns = [
    path('', kersh_views.home, name='home'),
    path('update-theme/', kersh_views.update_theme, name='update-theme'),
    path('music/', kersh_views.music, name='music'),

    # Philomania
    path('phil/', phil_views.philomania),

    # [ominous whoosher]
    path('whoosh/', include(whoosh_patterns)),

    # AI Quiz
    path('quiz/', include(ai_quiz_patterns)),

    # ScreenBloom landing page
    path('screenbloom/', screenbloom_landing),

    # Page for Bacon
    path('bacon/', bacon),

    # SteamTime
    path('steamtime/', include(steamtime_patterns)),

    # Admin Stuff
    path('kersh-zone/move-project-position/<project_id>/<direction>', project_views.MoveProjectPositionView.as_view(),
         name='move_project_position'),
    path('kersh-zone/', admin.site.urls),
]
