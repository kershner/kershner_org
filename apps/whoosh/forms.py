from django.forms import ModelForm, FileInput
from utility.util import file_size_validation
from apps.whoosh.models import Whoosh


class WhooshForm(ModelForm):
    class Meta:
        model = Whoosh
        widgets = {'source_video': FileInput(attrs={'accept': 'video/mp4,video/quicktime'})}
        fields = ['source_video', 'whoosh_type', 'credit_text', 'mute_original', 'black_and_white', 'portrait',
                  'slow_motion', 'slow_zoom', 'start_time', 'user_agent']

    def clean_source_video(self):
        cleaned_data = self.clean()
        source_video = cleaned_data.get('source_video')

        if not file_size_validation(source_video.size):
            self.add_error('source_video', 'File too big! 15MB limit.')

        return source_video
