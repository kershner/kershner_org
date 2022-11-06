from django.core.management.base import BaseCommand
from apps.whoosh.models import Whoosh
from apps.whoosh import whoosh_ffmpeg
from utility import util
import tempfile
import os


class Command(BaseCommand):
    def handle(self, *args, **options):
        s3 = util.get_s3_client()
        params = util.get_parameters()
        # whoosh = Whoosh.objects.filter(id=312).first()
        whoosh = Whoosh.objects.filter(id=426).first()
        desktop_dir = os.path.expanduser("~\Desktop")
        output_filename = '{}\out.mp4'.format(desktop_dir)

        w = 1920
        h = 1080
        ratio = 4/3
        new_w = h * ratio
        new_h = w * ratio

        print('new_w: {}, new_h: {}'.format(new_w, new_h))

        with tempfile.NamedTemporaryFile(delete=False) as f:
            s3.download_fileobj(params['s3_bucket'], whoosh.uploaded_video_s3_key, f)
            whoosh_ffmpeg.run_whoosh_ffmpeg(whoosh, f.name, output_filename)

            f.close()
            os.unlink(f.name)
            # os.unlink(output_filename)


