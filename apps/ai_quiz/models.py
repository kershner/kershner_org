from django.core.validators import MaxValueValidator, MinValueValidator
from django.db.models import GenericIPAddressField
from django.db.models import CheckConstraint, Q
from django.utils.safestring import mark_safe
from django.utils import timezone
from django.urls import reverse
from django.db import models
from utility import util
from uuid import uuid4
import string
import re


class AiQuiz(models.Model):
    uniq_id = models.CharField(null=True, max_length=100)
    created = models.DateTimeField(default=timezone.now)

    NUM_QUESTION_CHOICES = [
        ('3', '3'),
        ('5', '5'),
        ('10', '10'),
        ('20', '20'),
    ]
    num_questions = models.CharField(max_length=2, choices=NUM_QUESTION_CHOICES, default='3')
    subject = models.CharField(max_length=50)

    processed = models.DateTimeField(null=True, blank=True)

    MODEL_ENGINE_CHOICES = (
        ('text-davinci-003', 'Davinci'),
        ('curie', 'Curie'),
        ('babbage', 'Babbage'),
        ('ada', 'Ada')
    )
    model_engine = models.CharField(max_length=20, choices=MODEL_ENGINE_CHOICES, default='text-davinci-003')
    temperature = models.FloatField(default=0.0, validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])

    ip = GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    settings_hash = models.CharField(max_length=200, null=True, blank=True)
    openai_response = models.TextField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.uniq_id:
            self.uniq_id = uuid4().hex
        super().save(*args, **kwargs)

    # Maintain a dict of the editable settings here, so quizzes can be queried by them
    def openai_settings(self):
        return {
            'model': self.model_engine,
            'temperature': str(self.temperature),
            'subject': self.subject.lower(),
            'num_questions': self.num_questions,
        }

    @property
    def openai_settings_hash(self):
        return util.hash_data_structure(self.openai_settings())

    @property
    def num_questions_real(self):
        return len(self.get_questions())

    @property
    def title(self):
        num_questions = self.num_questions_real if self.processed else self.num_questions
        plural = "s" if int(num_questions) > 1 else ""
        return f'{num_questions} question{plural} about {string.capwords(self.subject)}'

    def get_admin_url(self):
        return reverse('admin:{}_{}_change'.format(self._meta.app_label, self._meta.model_name), args=(self.pk,))

    def get_questions(self):
        return AiQuizQuestion.objects.filter(quiz_id=self.id).all()

    def get_variations(self):
        variations = AiQuiz.objects.filter(subject=self.subject).exclude(id=self.id)
        return variations.all().order_by('-id')

    class Meta:
        verbose_name = 'Quiz'
        verbose_name_plural = 'Quizzes'

        # Add min/max range as an actual SQL constraint, not just in the HTML forms
        constraints = (
            CheckConstraint(
                check=Q(temperature__gte=0.0) & Q(temperature__lte=1.0),
                name='ai_temperature_range'),
            )

    def __str__(self):
        return self.title


class AiQuizQuestion(models.Model):
    created = models.DateTimeField(default=timezone.now)
    quiz = models.ForeignKey('ai_quiz.AiQuiz', null=True, blank=True, on_delete=models.CASCADE)
    text = models.CharField(max_length=255)

    def get_answer(self):
        return AiQuizAnswer.objects.filter(question_id=self.id).first()

    class Meta:
        verbose_name = 'Question'

    def __str__(self):
        return f'Question about {self.quiz.subject}'


class AiQuizAnswer(models.Model):
    created = models.DateTimeField(default=timezone.now)
    question = models.ForeignKey('ai_quiz.AiQuizQuestion', null=True, blank=True, on_delete=models.CASCADE)
    text = models.CharField(max_length=255)

    ANSWER_TYPES = (
        ('text', 'text'),
        ('number', 'number')
    )
    answer_type = models.CharField(max_length=20, choices=ANSWER_TYPES, default='text')
    source = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        verbose_name = 'Answer'

    def __str__(self):
        return f'Answer for question about {self.question.quiz.subject}'

    def get_source_html(self):
        if 'http' in self.source:
            # Use regex to find the URL in the string and wrap it in an <a> tag
            pattern = re.compile(r'https?://\S+[a-zA-Z0-9/]')
            match = re.sub(pattern, lambda m: f'<a target="_blank" href="{m.group(0)}">{m.group(0)}</a>', self.source)
            return mark_safe(match)

        return self.source
