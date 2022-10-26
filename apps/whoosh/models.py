from django.core.validators import FileExtensionValidator
from portfolio.tasks import delete_whoosh_media
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
from django.db import models
from utility import util
import json


def whoosh_upload(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_upload_path, filename)


def whoosh_processed(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_processed_path, filename)


class Whoosh(models.Model):
    created = models.DateTimeField(default=timezone.now)
    source_video = models.FileField(upload_to=whoosh_upload,
                                    validators=[FileExtensionValidator(allowed_extensions=['mp4', 'mov'])])
    credit_text = models.CharField(null=True, blank=True, max_length=50)
    mute_original = models.BooleanField(default=False)
    black_and_white = models.BooleanField(default=False)
    start_time = models.CharField(null=True, blank=True, max_length=8, default='00:00:00')
    processed = models.DateTimeField(null=True, blank=True)
    processed_video = models.FileField(null=True, blank=True, upload_to=whoosh_processed)
    thumbnail = models.FileField(null=True, blank=True, upload_to=whoosh_processed)
    user_agent = models.TextField(null=True, blank=True)
    video_data = models.TextField(null=True, blank=True)

    @property
    def expired(self):
        if self.processed:
            time_since_processed = timezone.now() - self.processed
            return time_since_processed.days == 1
        return False

    @property
    def uploaded_video_s3_key(self):
        return 'static/{}'.format(str(self.source_video))

    @property
    def processed_video_s3_key(self):
        return 'static/{}'.format(str(self.processed_video))

    @property
    def thumbnail_s3_key(self):
        return 'static/{}'.format(str(self.thumbnail))

    @property
    def s3_upload_path(self):
        return 'whoosh/uploads/'

    @property
    def s3_processed_path(self):
        return 'whoosh/processed/'

    @property
    def cloudfront_video_url(self):
        return 'https://{}/{}'.format(settings.CLOUDFRONT_DOMAIN, self.processed_video_s3_key)

    @property
    def cloudfront_thumbnail_url(self):
        return 'https://{}/{}'.format(settings.CLOUDFRONT_DOMAIN, self.thumbnail_s3_key)

    @property
    def video_height(self):
        if self.video_dimensions:
            return self.video_dimensions['height']

    @property
    def video_width(self):
        if self.video_dimensions:
            return self.video_dimensions['width']

    @property
    def video_dimensions(self):
        if self.video_data:
            streams = json.loads(self.video_data)['streams']
            video_stream = None
            for stream in streams:
                if stream['codec_type'] == 'video':
                    video_stream = stream
                    break

            video_size = {
                'height': video_stream['height'],
                'width': video_stream['width'],
            }
            return video_size
        return None

    class Meta:
        verbose_name_plural = 'Whooshes'

    def __str__(self):
        return 'Whoosh ID: {}, created {}'.format(self.id, self.created)


@receiver(pre_delete, sender=Whoosh)
def remove_s3_files(sender, instance, **kwargs):
    delete_whoosh_media.delay(instance.uploaded_video_s3_key, instance.processed_video_s3_key, instance.thumbnail_s3_key)
