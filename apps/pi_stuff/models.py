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
    