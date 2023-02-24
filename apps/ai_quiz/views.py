from django.core.paginator import Paginator, PageNotAnInteger
from django.template.response import TemplateResponse
from django.views.generic.base import ContextMixin
from django.http import JsonResponse, HttpResponse
from apps.ai_quiz.tasks import process_quiz
from apps.ai_quiz.forms import AiQuizForm
from apps.ai_quiz.models import AiQuiz
from django.views.generic import View
from django.shortcuts import redirect
from utility import util
import csv


class AiQuizContentMixin(ContextMixin):
    title = 'AI Generated Quizzes!'
    form = AiQuizForm()
    quiz_limit = 20

    def get_context_data(self, **kwargs):
        ctx = super(AiQuizContentMixin, self).get_context_data(**kwargs)
        ctx['form'] = self.form
        ctx['title'] = self.title
        ctx['recent_quizzes'] = self.get_recent_quizzes()
        return ctx

    def get_recent_quizzes(self):
        unique_subjects = AiQuiz.objects.values('subject').distinct()
        qs = AiQuiz.objects.filter(processed__isnull=False, subject__in=unique_subjects)

        ids_to_query = {}
        for quiz in qs:
            if quiz.subject not in ids_to_query:
                ids_to_query[quiz.subject] = quiz.id
        ids_to_query = list(ids_to_query.values())

        return AiQuiz.objects.filter(processed__isnull=False, id__in=ids_to_query).order_by('-id').all()[:self.quiz_limit]


class BaseAiQuizView(View, AiQuizContentMixin):
    not_found_template = 'ai_quiz/404.html'

    def get_context_data(self, **kwargs):
        ctx = super(BaseAiQuizView, self).get_context_data(**kwargs)
        ctx['form'] = self.form
        ctx['title'] = self.title
        return ctx


class AiQuizHomeView(BaseAiQuizView):
    template = 'ai_quiz/home.html'

    def get(self, request):
        return TemplateResponse(request, self.template, self.get_context_data())

    def post(self, request):
        self.form = AiQuizForm(request.POST)

        if self.form.is_valid():
            # Check if a quiz already exists with these settings
            new_quiz = AiQuiz(**self.form.cleaned_data)
            existing_quiz = AiQuiz.objects.filter(settings_hash=new_quiz.openai_settings_hash).first()

            if not existing_quiz:
                new_quiz.ip = util.get_client_ip(request)
                new_quiz.save()

                process_quiz.delay(new_quiz.id)
                return redirect('view-ai-quiz', quiz_id=new_quiz.uniq_id)

            return redirect('view-ai-quiz', quiz_id=existing_quiz.uniq_id)

        return TemplateResponse(request, self.template, self.get_context_data())


class AiQuizViewer(BaseAiQuizView):
    template = 'ai_quiz/viewer.html'

    def get(self, request, quiz_id=None):
        quiz = AiQuiz.objects.filter(uniq_id=quiz_id).first()
        if not quiz:
            return TemplateResponse(request, self.not_found_template, self.get_context_data())

        self.form = None
        if quiz.processed:
            self.form = AiQuizForm()

        ctx = self.get_context_data()
        ctx['quiz'] = quiz
        ctx['title'] = quiz.title
        return TemplateResponse(request, self.template, ctx)

    @staticmethod
    def post(request, quiz_id):
        quiz = AiQuiz.objects.filter(uniq_id=quiz_id).first()
        ctx = {
            'error': quiz.error,
            'processed': quiz.processed,
        }
        return JsonResponse(ctx)


class AiQuizListView(BaseAiQuizView):
    model = AiQuiz
    template = 'ai_quiz/list.html'
    title = 'All Quizzes'

    def get(self, request):
        all_quizzes = AiQuiz.objects.order_by('-id').all()
        per_page = 20
        paginator = Paginator(all_quizzes, per_page)
        page = request.GET.get('page', 1)

        try:
            paginated_objects = paginator.page(page)
        except PageNotAnInteger:
            paginated_objects = paginator.page(1)

        ctx = self.get_context_data()
        ctx['quizzes'] = paginated_objects
        return TemplateResponse(request, self.template, ctx)


class AiQuizExport(BaseAiQuizView):
    def get(self, request, quiz_id=None):
        quiz = AiQuiz.objects.filter(uniq_id=quiz_id).first()
        if not quiz:
            return TemplateResponse(request, self.not_found_template, self.get_context_data())

        header_row = ['Question', 'Answer', 'Subject']
        data = []
        for question in quiz.get_questions():
            data.append([question.text, question.get_answer().text, quiz.subject])

        # Create a CSV response
        filename = f"{quiz}.csv"
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename={filename}'

        # Write the data to the CSV response
        writer = csv.writer(response)
        writer.writerow(header_row)
        for row in data:
            writer.writerow(row)

        return response
