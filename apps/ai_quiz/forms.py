from apps.ai_quiz.models import AiQuiz
from django import forms


class AiQuizForm(forms.ModelForm):
    num_questions = forms.ChoiceField(choices=AiQuiz.NUM_QUESTION_CHOICES, label="Questions")
    subject = forms.CharField(max_length=50, required=True, widget=forms.TextInput(attrs={'autofocus': 'autofocus'}))
    temperature = forms.ChoiceField(choices=[(num, num) for num in [i/10 for i in range(0, 11, 2)]])

    class Meta:
        model = AiQuiz
        fields = ['num_questions', 'subject', 'user_agent', 'temperature']

    def clean(self):
        cleaned_data = super().clean()

        # TODO - super sanitize this input
        subject = self.cleaned_data['subject']

        return cleaned_data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
