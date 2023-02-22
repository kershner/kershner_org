from apps.ai_quiz.models import AiQuiz
from django import forms


class AiQuizForm(forms.ModelForm):
    num_questions = forms.ChoiceField(choices=AiQuiz.NUM_QUESTION_CHOICES, label="Questions",
                                      widget=forms.Select(attrs={'title': 'Select a number of questions for your quiz'}))
    subject = forms.CharField(max_length=50, required=True)

    temp_ranges =[(num, num) for num in [i/10 for i in range(0, 11, 2)]]
    temperature = forms.ChoiceField(choices=temp_ranges, widget=forms.Select(attrs={
        'title': 'Temperature is a parameter for how "creative" the AI should be in coming up with its content'
    }))

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
