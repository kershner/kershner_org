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
    year = models.CharField(max_length=40, default='Unknown', blank=True, null=True)
    youtube_link = models.CharField(max_length=255, blank=True, null=True)
    file = models.FileField(upload_to=song_upload)
    thumbnail = models.ImageField(upload_to=song_thumbnail_upload)
    # (actual DB value, human-readable name)
    TYPE_CHOICES = (
        ('SO', 'Song'),
        ('OL', 'Old Song'),
        ('LO', 'Loop')
    )
    type = models.CharField(max_length=2, choices=TYPE_CHOICES, default='SO')
    duration = models.CharField(max_length=20)
    notes = models.TextField(null=True, blank=True)
    position = models.IntegerField(default=0)
    __original_position = None

    def __init__(self, *args, **kwargs):
        super(Song, self).__init__(*args, **kwargs)
        self.__original_position = self.position

    def save(self, force_insert=False, force_update=False, *args, **kwargs):
        if self.position != self.__original_position:
            # Position has changed
            old_song_with_position = Song.objects.filter(type=self.type).filter(position=self.position)
            if old_song_with_position:
                old_song_with_position.update(position=self.__original_position)

        super(Song, self).save(force_insert, force_update, *args, **kwargs)
        self.__original_position = self.position

    def __str__(self):
        return 'ID: %d | %s' % (self.id, self.title)


# Admin config for this model
# https://docs.djangoproject.com/en/2.0/ref/contrib/admin/#django.contrib.admin.ModelAdmin
@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'position', 'duration')
    list_filter = ('type', 'created_at', 'year')
    search_fields = ['name', 'id']
    show_full_result_count = True

    def get_form(self, request, obj=None, **kwargs):
        last_song = Song.objects.latest('position')
        form = super(SongAdmin, self).get_form(request, obj, **kwargs)
        form.base_fields['position'].initial = last_song.position + 1
        return form
