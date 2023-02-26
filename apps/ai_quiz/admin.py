from apps.ai_quiz.models import AiQuiz, AiQuizQuestion, AiQuizAnswer
from django.utils.safestring import mark_safe
from django.contrib import admin
from django.urls import reverse


class AiQuizQuestionInline(admin.TabularInline):
    @staticmethod
    def question_text(obj):
        question_admin_link = reverse('admin:ai_quiz_aiquizquestion_change', args=[obj.pk])
        question_text = obj.text
        return mark_safe(f'<a href="{question_admin_link}">{question_text}</a>')

    @staticmethod
    def answer(obj):
        answer_admin_link = reverse('admin:ai_quiz_aiquizanswer_change', args=[obj.get_answer().pk])
        answer_text = obj.get_answer().text
        return mark_safe(f'<a href="{answer_admin_link}">{answer_text}</a>')

    @staticmethod
    def source(obj):
        return obj.get_answer().get_source_html()

    fields = ['id', 'created', 'quiz', 'question_text', 'answer', 'source']
    model = AiQuizQuestion
    extra = 0
    readonly_fields = ('question_text', 'answer', 'source')


class AiQuizAnswerInline(admin.TabularInline):
    @staticmethod
    def answer_text(obj):
        answer_admin_link = reverse('admin:ai_quiz_aiquizanswer_change', args=[obj.pk])
        answer_text = obj.text
        return mark_safe(f'<a href="{answer_admin_link}">{answer_text}</a>')

    @staticmethod
    def source_link(obj):
        return obj.get_source_html()

    fields = ['created', 'answer_text', 'source_link']
    model = AiQuizAnswer
    extra = 0
    readonly_fields = ('answer_text', 'source_link')


class GenericQuizAdminMixin(admin.ModelAdmin):
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AiQuiz)
class AiQuizAdmin(GenericQuizAdminMixin):
    list_display = ['id', 'created', 'num_questions', 'subject', 'processed']
    inlines = [AiQuizQuestionInline]
    list_filter = ['created', 'subject', 'num_questions', 'processed']
    search_fields = ['subject']


@admin.register(AiQuizQuestion)
class AiQuizQuestionAdmin(GenericQuizAdminMixin):
    list_display = ['id', 'created', 'quiz', 'text']
    inlines = [AiQuizAnswerInline]
    list_filter = ['created', 'quiz']
    search_fields = ['text']


@admin.register(AiQuizAnswer)
class AiQuizAnswerAdmin(GenericQuizAdminMixin):
    list_display = ['id', 'created', 'question', 'text', 'source', 'question']
    list_filter = ['created']
    search_fields = ['text']
