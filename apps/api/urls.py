from apps.daggerwalk.views import DaggerwalkLogListAPIView, POIListAPIView, RegionListAPIView
from apps.project.views import ProjectListAPIView
from apps.ai_quiz.views import AiQuizListAPIView
from apps.whoosh.views import WhooshListAPIView
from apps.song.views import SongListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from django.urls import path, include

# Structure: Regular endpoints that appear at the root level
ROOT_ENDPOINTS = [
    ('projects', ProjectListAPIView, 'projects'),
    ('songs', SongListAPIView, 'songs'),
    ('whooshes', WhooshListAPIView, 'whooshes'),
    ('ai_quizzes', AiQuizListAPIView, 'ai_quizzes'),
]

# Structure: Grouped endpoints under namespaces
# Format: (namespace, [(endpoint, view, name), ...])
GROUPED_ENDPOINTS = [
    ('daggerwalk', [
        ('logs', DaggerwalkLogListAPIView, 'daggerwalk_logs'),
        ('regions', RegionListAPIView, 'daggerwalk_regions'),
        ('pois', POIListAPIView, 'daggerwalk_pois'),
    ]),
    # Add more namespaces as needed
]

# Generic namespace index view
def create_namespace_view(namespace, endpoints):
    class NamespaceView(APIView):
        permission_classes = []
        
        def get_view_name(self):
            return f'{namespace.title()} API'
            
        def get(self, request):
            return Response({
                name.replace(f'{namespace}_', ''): request.build_absolute_uri(f'{endpoint}/')
                for endpoint, _, name in endpoints
            })
    
    return NamespaceView

class APIRootView(APIView):
    permission_classes = []

    def get_view_name(self):
        return 'kershner.org API'

    def get(self, request):
        # Build regular endpoints
        response_data = {
            name: request.build_absolute_uri(f'{endpoint}/') 
            for endpoint, _, name in ROOT_ENDPOINTS
        }
        
        # Add namespace roots
        for namespace, _ in GROUPED_ENDPOINTS:
            response_data[namespace] = request.build_absolute_uri(f'{namespace}/')
        
        return Response(response_data)

# Main API patterns
api_patterns = [
    path('', APIRootView.as_view(), name='api-root'),
]

# Add regular endpoints
for endpoint, view, name in ROOT_ENDPOINTS:
    api_patterns.append(path(f'{endpoint}/', view.as_view(), name=name))

# Add grouped endpoints
for namespace, endpoints in GROUPED_ENDPOINTS:
    namespace_patterns = [
        # Add index view for the namespace
        path('', create_namespace_view(namespace, endpoints).as_view(), name=f'{namespace}-root'),
    ]
    
    # Add each endpoint under the namespace
    for endpoint, view, name in endpoints:
        namespace_patterns.append(path(f'{endpoint}/', view.as_view(), name=name))
    
    api_patterns.append(path(f'{namespace}/', include(namespace_patterns)))