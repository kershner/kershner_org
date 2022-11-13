from apps.screenbloom.views import screenbloom_landing
from apps.whoosh.urls import whoosh_patterns
from . import views as kersh_views
from django.urls import include, path
from apps.bacon.views import bacon
from django.contrib import admin
from . import admin_views

handler404 = 'kershner.views.custom_error_view'
handler500 = 'kershner.views.custom_error_view'
handler403 = 'kershner.views.custom_error_view'
handler400 = 'kershner.views.custom_error_view'

urlpatterns = [
    path('', kersh_views.home, name='home'),
    path('music/', kersh_views.music, name='music'),
    path('admin/', admin.site.urls),

    # Philomania
    path('phil/', kersh_views.philomania),

    # [ominous whoosh-er]
    path('whoosh/', include(whoosh_patterns)),

    # ScreenBloom landing page
    path('screenbloom/', screenbloom_landing),

    # Page for Bacon
    path('bacon/', bacon),

    # Admin Stuff
    path('admin/move-project-position/<project_id>/<direction>',
         admin_views.MoveProjectPositionView.as_view(),
         name='move_project_position')
]
