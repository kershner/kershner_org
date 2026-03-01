import apps.whoosh.views as whoosh_views
from django.urls import path

whoosh_patterns = [
    path('', whoosh_views.WhooshHomeView.as_view(), name='whoosh'),
    path('view/', whoosh_views.WhooshViewer.as_view(), name='view-whoosh'),
    path('upload-url/', whoosh_views.get_upload_url, name='whoosh-upload-url'),
    path('view/<whoosh_id>/', whoosh_views.WhooshViewer.as_view(), name='view-whoosh'),
    path('view/<whoosh_id>', whoosh_views.WhooshViewer.as_view(), name='view-whoosh'),
    path('doppelganger/<whoosh_id>/', whoosh_views.DoppelgangerSubmit.as_view(), name='create-doppelganger'),
    path('reprocess/<whoosh_id>/', whoosh_views.reprocess_whoosh, name='reprocess-whoosh'),
    path('save/<whoosh_id>/', whoosh_views.save_whoosh, name='save-whoosh'),
]
