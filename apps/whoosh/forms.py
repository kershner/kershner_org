from django.forms import ModelForm, FileInput, CharField, TextInput
from utility.util import file_size_validation
from apps.whoosh.models import Whoosh
from django.conf import settings
import re


hh_mm_ss_pattern = re.compile('^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$')
two_digit_followed_by_colon_pattern = '\d{2}:\d{2}:\d{2}'


class WhooshForm(ModelForm):
    start_time = CharField(max_length=8, widget=TextInput(attrs={
        'pattern': two_digit_followed_by_colon_pattern,
        'placeholder': 'HH:MM:SS',
        'value': '00:00:00'
    }))

    class Meta:
        model = Whoosh
        fields = ['source_video', 'whoosh_type', 'credit_text', 'mute_source', 'black_and_white', 'portrait',
                  'slow_motion', 'slow_zoom', 'reverse', 'start_time', 'user_agent', 'hidden']

        widgets = {'source_video': FileInput(attrs={'accept': 'video/mp4,video/quicktime', 'required': 'required'})}

    def clean_source_video(self):
        source_video = self.cleaned_data.get('source_video')

        if not file_size_validation(source_video.size):
            self.add_error('source_video', 'File too big! {}MB limit.'.format(settings.FILE_UPLOAD_LIMIT_MB))

        return source_video

    def clean_start_time(self):
        start_time = self.cleaned_data.get('start_time')

        if not re.match(hh_mm_ss_pattern, start_time):
            self.add_error('start_time', 'Invalid format.  Must be HH:MM:SS.')

        return start_time

    def clean_hidden(self):
        hidden = self.cleaned_data.get('hidden')
        if hidden:
            self.add_error('hidden', 'Humans only!')

        return hidden

    def clean(self):
        cleaned_data = super().clean()

        # Enable mute_source anytime slow motion is enabled
        if cleaned_data.get('slow_motion') and not cleaned_data.get('mute_source'):
            self.cleaned_data['mute_source'] = True

        return cleaned_data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)



class DoppelgangerForm(WhooshForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        del self.fields['source_video']
