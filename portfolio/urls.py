from apps.whoosh import views as whoosh_views
from . import views as portfolio_views
from django.contrib import admin
from django.urls import path
from . import admin_views

urlpatterns = [
    path('', portfolio_views.home, name='home'),
    path('music/', portfolio_views.music, name='music'),
    path('admin/', admin.site.urls),

    # Bacon redirect
    path('bacon/', portfolio_views.bacon_redirect),
    path('bacon', portfolio_views.bacon_redirect),

    # Philomania
    path('phil/', portfolio_views.philomania),
    path('phil', portfolio_views.philomania),

    # Ominous Whoosh-er
    path('whoosh/', whoosh_views.WhooshHomeView.as_view(), name='whoosh'),
    path('whoosh', whoosh_views.WhooshHomeView.as_view(), name='whoosh'),
    path('whoosh/view/', whoosh_views.WhooshViewer.as_view(), name='view-whoosh'),
    path('whoosh/view/<whoosh_id>/', whoosh_views.WhooshViewer.as_view(), name='view-whoosh'),
    path('whoosh/view/<whoosh_id>', whoosh_views.WhooshViewer.as_view(), name='view-whoosh'),
    path('whoosh/doppelganger/<whoosh_id>/', whoosh_views.DoppelgangerSubmit.as_view(), name='create-doppelganger'),
    path('whoosh/about', whoosh_views.AboutWhoosh.as_view(), name='about-whoosh'),
    path('whoosh/about/', whoosh_views.AboutWhoosh.as_view(), name='about-whoosh'),
    path('whoosh/reprocess/<whoosh_id>', whoosh_views.reprocess_whoosh, name='reprocess-whoosh'),

    # Admin Stuff
    path('admin/move-project-position/<project_id>/<direction>',
         admin_views.MoveProjectPositionView.as_view(),
         name='move_project_position')
]
