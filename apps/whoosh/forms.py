from django.forms import ModelForm, FileInput, CharField, TextInput
from utility.util import file_size_validation
from apps.whoosh.models import Whoosh
from django.conf import settings
import re


hh_mm_ss_pattern = re.compile('^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$')
two_digit_followed_by_colon_pattern = '\d{2}:\d{2}'


class WhooshForm(ModelForm):
    start_time = CharField(max_length=8, widget=TextInput(attrs={
        'pattern': two_digit_followed_by_colon_pattern,
        'placeholder': 'HH:MM:SS',
        'value': '00:00:00'
    }))

    class Meta:
        model = Whoosh
        widgets = {'source_video': FileInput(attrs={'accept': 'video/mp4,video/quicktime'})}
        fields = ['source_video', 'whoosh_type', 'credit_text', 'mute_source', 'black_and_white', 'portrait',
                  'slow_motion', 'slow_zoom', 'start_time', 'user_agent']

    def clean_source_video(self):
        cleaned_data = self.clean()
        source_video = cleaned_data.get('source_video')

        if not file_size_validation(source_video.size):
            self.add_error('source_video', 'File too big! {}MB limit.'.format(settings.FILE_UPLOAD_LIMIT_MB))

        return source_video

    def clean_start_time(self):
        cleaned_data = self.clean()
        start_time = cleaned_data.get('start_time')

        if not re.match(hh_mm_ss_pattern, start_time):
            self.add_error('start_time', 'Invalid format.  Must be HH:MM:SS.')

        return start_time
