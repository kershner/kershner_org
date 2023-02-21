from apps.ai_quiz.models import AiQuiz, AiQuizQuestion, AiQuizAnswer
from django.contrib import admin

class GenericQuizAdminMixin(admin.ModelAdmin):
    list_display_links = ['id', 'created']

    def has_change_permission(self, request, obj=None):
        return False

@admin.register(AiQuiz)
class AiQuizAdmin(GenericQuizAdminMixin):
    list_display = ['id', 'created', 'num_questions', 'subject', 'processed']


@admin.register(AiQuizQuestion)
class AiQuizQuestionAdmin(GenericQuizAdminMixin):
    list_display = ['id', 'created', 'quiz', 'text']


@admin.register(AiQuizAnswer)
class AiQuizAnswerAdmin(GenericQuizAdminMixin):
    list_display = ['id', 'created', 'question', 'text', 'answer_type', 'source']