from apps.ai_quiz.models import AiQuiz
from django import forms


TEMP_RANGES =[(num, num) for num in [i/10 for i in range(0, 11, 2)]]

class AiQuizForm(forms.ModelForm):
    num_questions = forms.ChoiceField(choices=AiQuiz.NUM_QUESTION_CHOICES,
                                      label='Questions',
                                      widget=forms.Select(attrs={
                                          'title': 'Select a number of questions for your quiz'
                                      }))

    subject = forms.CharField(max_length=50, required=True)

    temperature = forms.ChoiceField(choices=TEMP_RANGES,
                                    widget=forms.Select(attrs={
                                        'title': 'Temperature is a parameter for how "creative" the AI '
                                                 'should be in coming up with its content'
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


class AiQuizSearchForm(forms.ModelForm):
    num_questions_with_any = [('any', 'Any')] + AiQuiz.NUM_QUESTION_CHOICES
    num_questions_filter = forms.ChoiceField(choices=num_questions_with_any,
                                             label='Filter by Questions',
                                             widget=forms.Select(attrs={
                                                 'title': 'Filter quizzes by number of questions'
                                             }))

    subject_query = forms.CharField(max_length=50,
                                    required=False,
                                    widget=forms.TextInput(attrs={
                                        'title': 'Filter quizzes by subject',
                                        'placeholder': 'Search for a quiz subject'
                                    }))

    temp_ranges_with_any = [('any', 'Any')] + TEMP_RANGES
    temperature_filter = forms.ChoiceField(choices=temp_ranges_with_any,
                                           label='Filter by Temperature',
                                           widget=forms.Select(attrs={
                                               'title': 'Filter quizzes by temperature of the AI response'
                                           }))

    class Meta:
        model = AiQuiz
        fields = ['num_questions_filter', 'subject_query', 'temperature_filter']
