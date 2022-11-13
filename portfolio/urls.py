from apps.screenbloom.views import screenbloom_landing
from apps.whoosh.urls import whoosh_patterns
from . import views as portfolio_views
from django.urls import include, path
from apps.bacon.views import bacon
from django.contrib import admin
from . import admin_views

handler404 = 'portfolio.views.custom_page_not_found_view'
handler500 = 'portfolio.views.custom_error_view'
handler403 = 'portfolio.views.custom_permission_denied_view'
handler400 = 'portfolio.views.custom_bad_request_view'

urlpatterns = [
    path('', portfolio_views.home, name='home'),
    path('music/', portfolio_views.music, name='music'),
    path('admin/', admin.site.urls),

    # Philomania
    path('phil/', portfolio_views.philomania),

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
