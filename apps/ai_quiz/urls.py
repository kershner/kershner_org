import apps.ai_quiz.views as ai_quiz_views
from django.urls import path

ai_quiz_patterns = [
    path('', ai_quiz_views.AiQuizHomeView.as_view(), name='ai-quiz'),
    path('view/', ai_quiz_views.AiQuizViewer.as_view(), name='view-ai-quiz'),
    path('view/<quiz_id>/', ai_quiz_views.AiQuizViewer.as_view(), name='view-ai-quiz'),
    path('view/<quiz_id>', ai_quiz_views.AiQuizViewer.as_view(), name='view-ai-quiz'),
]
