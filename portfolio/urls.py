from apps.whoosh.urls import whoosh_patterns
from . import views as portfolio_views
from django.urls import include, path
from django.contrib import admin
from . import admin_views

urlpatterns = [
    path('', portfolio_views.home, name='home'),
    path('music/', portfolio_views.music, name='music'),
    path('admin/', admin.site.urls),

    # Bacon redirect
    path('bacon/', portfolio_views.bacon_redirect),

    # Philomania
    path('phil/', portfolio_views.philomania),

    # [ominous whoosh-er]
    path('whoosh/', include(whoosh_patterns)),

    # Admin Stuff
    path('admin/move-project-position/<project_id>/<direction>',
         admin_views.MoveProjectPositionView.as_view(),
         name='move_project_position')
]
