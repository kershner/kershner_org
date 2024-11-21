from apps.project.views import ProjectListAPIView
from apps.ai_quiz.views import AiQuizListAPIView
from apps.whoosh.views import WhooshListAPIView
from rest_framework.response import Response
from apps.song.views import SongListAPIView
from rest_framework.views import APIView
from django.urls import path

ENDPOINTS = [
    ('projects', ProjectListAPIView, 'projects'),
    ('songs', SongListAPIView, 'songs'),
    ('whooshes', WhooshListAPIView, 'whooshes'),
    ('ai_quizzes', AiQuizListAPIView, 'ai_quizzes'),
]

class APIRootView(APIView):
    permission_classes = []

    def get_view_name(self):
        return 'kershner.org API'

    def get(self, request):
        return Response({
            name: request.build_absolute_uri(f'{endpoint}/') for endpoint, _, name in ENDPOINTS
        })

api_patterns = [
    path('/', APIRootView.as_view(), name='api-root'),
]

for endpoint, view, name in ENDPOINTS:
    api_patterns.append(path(f'{endpoint}/', view.as_view(), name=name))
