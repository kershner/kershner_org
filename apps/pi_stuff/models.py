from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Playlist(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='playlists'
    )
    name = models.CharField(max_length=200)
    youtube_playlist_id = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.category.name} - {self.name}"


class VideoPlay(models.Model):
    event_id = models.UUIDField(unique=True)
    youtube_id = models.CharField(max_length=20)
    title = models.CharField(max_length=500)
    device_id = models.CharField(max_length=100)

    playlist_id = models.CharField(max_length=100, blank=True)
    playlist_name = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=100, blank=True)

    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.PositiveIntegerField(default=0)
    watched_seconds = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ("-started_at",)

    def __str__(self):
        return self.title
