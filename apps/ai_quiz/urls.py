import apps.ai_quiz.views as ai_quiz_views
from django.urls import path

ai_quiz_patterns = [
    path('', ai_quiz_views.AiQuizHomeView.as_view(), name='ai-quiz'),
    path('list', ai_quiz_views.AiQuizListView.as_view(), name='list-ai-quiz'),
    path('view/<quiz_id>', ai_quiz_views.AiQuizViewer.as_view(), name='view-ai-quiz'),
    path('view/<quiz_id>/export', ai_quiz_views.AiQuizExport.as_view(), name='export-ai-quiz'),
    path('random-subjects', ai_quiz_views.RandomQuizSubjectsView.as_view(), name='random-quiz-subjects'),
]
