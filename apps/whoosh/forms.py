from utility.util import file_size_validation
from django.forms import ModelForm, FileInput
from apps.whoosh.models import Whoosh


class WhooshForm(ModelForm):
    def clean_source_video(self):
        cleaned_data = self.clean()
        source_video = cleaned_data.get('source_video')

        if not file_size_validation(source_video.size):
            self.add_error('source_video', 'File too big! 15MB limit.')

        return source_video

    class Meta:
        model = Whoosh
        widgets = {'source_video': FileInput(attrs={'accept': 'video/mp4,video/quicktime'})}
        fields = ['source_video', 'credit_text', 'mute_original', 'user_agent']
