from django.template.response import TemplateResponse
from apps.whoosh.forms import WhooshForm
from django.core.files.base import File
from django.views.generic import View
from apps.whoosh.models import Whoosh
from django.shortcuts import redirect
from django.utils import timezone
from . import whoosh_ffmpeg
from utility import util
import tempfile
import os


class WhooshHomeView(View):
    template = "whoosh/home.html"
    form = WhooshForm()

    def get(self, request):
        ctx = {
            'form': self.form
        }
        return TemplateResponse(request, self.template, ctx)

    def post(self, request):
        self.form = WhooshForm(request.POST, request.FILES)
        if self.form.is_valid():
            self.form.save()
            return redirect('process-whoosh', whoosh_id=self.form.instance.id)

        ctx = {'form': self.form}
        return TemplateResponse(request, self.template, ctx)


class ProcessWhooshView(View):
    @staticmethod
    def get(request, whoosh_id):
        # TODO - convert this to a Celery task
        whoosh = Whoosh.objects.filter(id=whoosh_id).first()

        s3 = util.get_s3_client()
        params = util.get_parameters()
        with tempfile.NamedTemporaryFile(delete=False) as f:
            s3.download_fileobj(params['s3_bucket'], whoosh.uploaded_s3_key, f)
            output_filename = '{}.mp4'.format(f.name)

            # Get video details with FFProbe
            ffprobe_result = whoosh_ffmpeg.ffprobe(f.name)
            whoosh.video_data = ffprobe_result['json']
            whoosh.save()

            # Process video with FFMPEG
            whoosh_ffmpeg.run_whoosh_ffmpeg(whoosh, f.name, output_filename)

            # Save processed video to model and upload to S3
            whoosh.processed_video.save(output_filename, File(open(output_filename, 'rb')))
            whoosh.processed = timezone.now()
            whoosh.save()

            # Cleanup local files
            f.close()
            os.unlink(f.name)
            os.unlink(output_filename)

            # Delete original uploaded file from S3
            util.remove_key_from_s3(whoosh.uploaded_s3_key)

            return redirect('view-whoosh', whoosh_id=whoosh.id)


class WhooshViewer(View):
    template = 'whoosh/viewer.html'

    def get(self, request, whoosh_id):
        ctx = {'whoosh': Whoosh.objects.filter(id=whoosh_id).first()}
        return TemplateResponse(request, self.template, ctx)
