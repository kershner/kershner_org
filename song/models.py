from django.contrib import admin
from django.db import models
import os


def song_upload(instance, filename):
    path = 'music/'
    return os.path.join(path, filename)


def song_thumbnail_upload(instance, filename):
    path = 'music/thumbnails/'
    return os.path.join(path, '{}_thumbnail.png'.format(instance.title))


class Song(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    updated_at = models.DateTimeField(auto_now=True, editable=False)
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, default='Tyler Kershner')
    file = models.FileField(upload_to=song_upload)
    thumbnail = models.ImageField(upload_to=song_thumbnail_upload)
    # (actual DB value, human-readable name)
    TYPE_CHOICES = (
        ('SO', 'Song'),
        ('LO', 'Loop')
    )
    type = models.CharField(max_length=2, choices=TYPE_CHOICES, default='LO')
    duration = models.CharField(max_length=20)
    plays = models.IntegerField(default=0)
    notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return 'ID: %d | %s' % (self.id, self.title)


# Admin config for this model
# https://docs.djangoproject.com/en/2.0/ref/contrib/admin/#django.contrib.admin.ModelAdmin
@admin.register(Song)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'duration')
    list_filter = ('type', 'created_at', 'duration')
    search_fields = ['name', 'id']
    show_full_result_count = True
