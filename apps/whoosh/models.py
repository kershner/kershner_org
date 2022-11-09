from django.core.validators import FileExtensionValidator
from apps.whoosh.tasks import delete_whoosh_media
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from django.db.models import Q
from django.db import models
from utility import util
from uuid import uuid4
import json


def whoosh_upload(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_upload_path, filename, instance.uniq_id)


def whoosh_processed(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_processed_path, filename, instance.uniq_id)


def whoosh_saved(instance, filename):
    return util.get_random_s3_key_for_upload(instance.s3_saved_path, filename, instance.uniq_id)


class Whoosh(models.Model):
    uniq_id = models.CharField(null=True, max_length=100)
    created = models.DateTimeField(default=timezone.now)
    source_video = models.FileField(upload_to=whoosh_upload, null=True, blank=True, validators=[
        FileExtensionValidator(allowed_extensions=['mp4', 'mov'])
    ])
    WHOOSH_TYPE_CHOICES = (
        ('om', 'Ominous'),
        ('et', 'Ethereal'),
    )
    whoosh_type = models.CharField(max_length=2, choices=WHOOSH_TYPE_CHOICES, default='om')
    credit_text = models.CharField(null=True, blank=True, max_length=50)
    mute_source = models.BooleanField(default=False)
    black_and_white = models.BooleanField(default=False)
    portrait = models.BooleanField(default=False)
    slow_motion = models.BooleanField(default=False)
    slow_zoom = models.BooleanField(default=False)
    start_time = models.CharField(null=True, blank=True, max_length=8, default='00:00:00')
    processed = models.DateTimeField(null=True, blank=True)
    processed_video = models.FileField(null=True, blank=True, upload_to=whoosh_processed)
    thumbnail = models.FileField(null=True, blank=True, upload_to=whoosh_processed)
    user_agent = models.TextField(null=True, blank=True)
    video_data = models.TextField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    doppelganger = models.ForeignKey('whoosh.Whoosh', null=True, blank=True, on_delete=models.SET_NULL)
    settings_hash = models.CharField(max_length=200, null=True, blank=True)
    saved = models.BooleanField(default=False)
    saved_video = models.FileField(null=True, blank=True, upload_to=whoosh_saved)
    saved_thumbnail = models.FileField(null=True, blank=True, upload_to=whoosh_saved)

    def save(self, *args, **kwargs):
        if not self.uniq_id:
            self.uniq_id = uuid4().hex
        super().save(*args, **kwargs)

    @property
    def expired(self):
        if self.processed:
            time_since_processed = timezone.now() - self.processed
            return time_since_processed.days == settings.WHOOSH_EXPIRATION_DAYS
        return False

    @property
    def uploaded_video_s3_key(self):
        return 'static/{}'.format(str(self.source_video))

    @property
    def processed_video_s3_key(self):
        return 'static/{}'.format(str(self.processed_video))

    @property
    def saved_video_s3_key(self):
        return 'static/{}'.format(str(self.saved_video))

    @property
    def thumbnail_s3_key(self):
        return 'static/{}'.format(str(self.thumbnail))

    @property
    def saved_thumbnail_s3_key(self):
        return 'static/{}'.format(str(self.saved_thumbnail))

    @property
    def s3_upload_path(self):
        return 'whoosh/expiring/uploads/'

    @property
    def s3_processed_path(self):
        return 'whoosh/expiring/processed/'

    @property
    def s3_saved_path(self):
        return 'whoosh/saved/'

    @property
    def cloudfront_video_url(self):
        s3_key = self.processed_video_s3_key
        if self.saved:
            s3_key = self.saved_video_s3_key
        return 'https://{}/{}'.format(settings.CLOUDFRONT_DOMAIN, s3_key)

    @property
    def cloudfront_thumbnail_url(self):
        s3_key = self.thumbnail_s3_key
        if self.saved:
            s3_key = self.saved_thumbnail_s3_key
        return 'https://{}/{}'.format(settings.CLOUDFRONT_DOMAIN, s3_key)

    @property
    def video_height(self):
        if self.video_dimensions():
            return self.video_dimensions()['height']

    @property
    def video_width(self):
        if self.video_dimensions():
            return self.video_dimensions()['width']

    @property
    def can_be_cropped(self):
        return self.video_width and self.video_height and self.video_width > self.video_height

    @property
    def video_framerate(self):
        framerate = 24
        if self.video_stream_data:
            fps = self.video_stream_data['r_frame_rate'].split('/')
            framerate = int(float(fps[0]) / float(fps[1]))
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
        if self.video_data and 'streams' in self.video_data:
            streams = json.loads(self.video_data)['streams']
            for stream in streams:
                if stream['codec_type'] == 'video':
                    video_stream = stream
                    break

        return video_stream

    # Maintain a dict of the editable settings here, so Whooshes can be queried by them
    def doppelganger_settings(self):
        doppel_settings = {
            'uniq_id': self.uniq_id,
            'whoosh_type': self.whoosh_type,
            'credit_text': self.credit_text,
            'mute_source': self.mute_source,
            'black_and_white': self.black_and_white,
            'portrait': self.portrait,
            'slow_motion': self.slow_motion,
            'slow_zoom': self.slow_zoom
        }
        if self.doppelganger:
            doppel_settings['uniq_id'] = self.doppelganger.uniq_id

        return doppel_settings

    @property
    def doppleganger_settings_hash(self):
        return util.hash_data_structure(self.doppelganger_settings())

    def get_doppelgangers(self):
        if not self.doppelganger:
            doppel_children = Whoosh.objects.filter(doppelganger_id=self.id)
            doppelgangers = doppel_children
        else:
            q_filters = Q(doppelganger_id=self.doppelganger_id) | Q(id=self.doppelganger_id)
            doppelgangers = Whoosh.objects.filter(q_filters).exclude(doppelganger_id=None)
            doppelgangers = doppelgangers | Whoosh.objects.filter(id=self.doppelganger_id)

        return doppelgangers.filter(processed__isnull=False).exclude(id=self.id).all().order_by('-id')

    def get_admin_url(self):
        return reverse('admin:{}_{}_change'.format(self._meta.app_label, self._meta.model_name), args=(self.pk,))

    class Meta:
        verbose_name_plural = 'Whooshes'

    def __str__(self):
        return 'Whoosh ID: {}, created {}'.format(self.id, self.created)


@receiver(pre_delete, sender=Whoosh)
def remove_s3_files(sender, instance, **kwargs):
    delete_whoosh_media.delay(instance.uploaded_video_s3_key, instance.processed_video_s3_key,
                              instance.thumbnail_s3_key)
    if instance.saved:
        delete_whoosh_media.delay(instance.saved_video_s3_key, instance.processed_video_s3_key,
                                  instance.saved_thumbnail_s3_key)
