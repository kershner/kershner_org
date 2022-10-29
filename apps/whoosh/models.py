from django.db.models.signals import pre_delete, post_save
from django.core.validators import FileExtensionValidator
from portfolio.tasks import delete_whoosh_media
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from django.db import models
from utility import util
from uuid import uuid4
import json


def whoosh_upload(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_upload_path, filename)


def whoosh_processed(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_processed_path, filename)


class Whoosh(models.Model):
    uniq_id = models.CharField(null=True, max_length=100)
    created = models.DateTimeField(default=timezone.now)
    source_video = models.FileField(upload_to=whoosh_upload,
                                    validators=[FileExtensionValidator(allowed_extensions=['mp4', 'mov'])])
    WHOOSH_TYPE_CHOICES = (
        ('om', 'Ominous'),
        ('et', 'Ethereal'),
    )
    whoosh_type = models.CharField(max_length=2, choices=WHOOSH_TYPE_CHOICES, default='om', help_text='Poop')
    credit_text = models.CharField(null=True, blank=True, max_length=50, help_text='Poop')
    mute_original = models.BooleanField(default=False, help_text='Poop')
    black_and_white = models.BooleanField(default=False, help_text='Poop')
    portrait = models.BooleanField(default=False, help_text='Poop')
    slow_motion = models.BooleanField(default=False, help_text='Poop')
    slow_zoom = models.BooleanField(default=False, help_text='Poop')
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
            return self.video_dimensions()['height']

    @property
    def video_width(self):
        if self.video_dimensions:
            return self.video_dimensions()['width']

    @property
    def can_be_cropped(self):
        return self.video_width and self.video_height and self.video_width > self.video_height

    @property
    def video_framerate(self):
        framerate = 24
        if self.video_stream_data:
            fps = self.video_stream_data['r_frame_rate'].split('/')
            framerate = float(fps[0]) / float(fps[1])
        return framerate

    def video_dimensions(self):
        video_size = None
        if self.video_stream_data:
            video_size = {
                'height': self.video_stream_data['height'],
                'width': self.video_stream_data['width'],
            }
        return video_size

    @property
    def video_stream_data(self):
        video_stream = None
        if self.video_data:
            streams = json.loads(self.video_data)['streams']
            for stream in streams:
                if stream['codec_type'] == 'video':
                    video_stream = stream
                    break

        return video_stream

    def get_admin_url(self):
        return reverse('admin:{}_{}_change'.format(self._meta.app_label, self._meta.model_name), args=(self.pk,))

    class Meta:
        verbose_name_plural = 'Whooshes'

    def __str__(self):
        return 'Whoosh ID: {}, created {}'.format(self.id, self.created)


@receiver(post_save, sender=Whoosh)
def generate_uniq_id(sender, instance, created, **kwargs):
    if instance.id and not instance.uniq_id:
        instance.uniq_id = uuid4().hex
        instance.save()


@receiver(pre_delete, sender=Whoosh)
def remove_s3_files(sender, instance, **kwargs):
    delete_whoosh_media.delay(instance.uploaded_video_s3_key, instance.processed_video_s3_key, instance.thumbnail_s3_key)
