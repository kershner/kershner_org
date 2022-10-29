from django.forms import ModelForm, FileInput
from utility.util import file_size_validation
from apps.whoosh.models import Whoosh
from django.conf import settings


class WhooshForm(ModelForm):
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
