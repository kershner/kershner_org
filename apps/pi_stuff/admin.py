from kershner.mixins.admin_advanced_filter import AdminAdvancedFilterMixin
from .models import Category, Playlist, VideoPlay
from django.utils.html import format_html
from django.contrib import admin
from django.utils import timezone
from datetime import timedelta


class PlaylistInline(admin.TabularInline):
    model = Playlist
    extra = 0
    fields = ("name", "youtube_playlist_id")
    ordering = ("name",)
    show_change_link = True


@admin.register(Category)
class CategoryAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ['name']
    ordering = ['name']
    search_fields = ['name']
    inlines = (PlaylistInline,)


@admin.register(Playlist)
class PlaylistAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ['name', 'category', 'youtube_playlist_id']
    list_filter = ['category']
    search_fields = ['name', 'youtube_playlist_id']
    autocomplete_fields = ['category']
    ordering = ['category', 'name']


@admin.register(VideoPlay)
class VideoPlayAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'youtube', 'playlist', 'started', 'ended', 'video_duration'
    ]
    list_filter = ['completed', 'category', 'playlist_name', 'device_id', 'started_at']
    search_fields = ['title', 'youtube_id', 'device_id']
    ordering = ['-started_at']
    readonly_fields = [field.name for field in VideoPlay._meta.fields]

    @admin.display(description='YouTube')
    def youtube(self, obj):
        return format_html(
            '<a href="https://youtu.be/{}" target="_blank">'
            '<img src="https://i.ytimg.com/vi/{}/mqdefault.jpg" width="120">'
            '</a>',
            obj.youtube_id,
            obj.youtube_id,
        )

    @admin.display(description='Playlist')
    def playlist(self, obj):
        return f'{obj.category} • {obj.playlist_name}'

    @admin.display(description='Started', ordering='started_at')
    def started(self, obj):
        return timezone.localtime(obj.started_at).strftime('%I:%M:%S %p')

    @admin.display(description='Ended', ordering='ended_at')
    def ended(self, obj):
        if obj.ended_at:
            return timezone.localtime(obj.ended_at).strftime('%I:%M:%S %p')

        ends_at = obj.started_at + timedelta(seconds=obj.duration)
        remaining = max(
            0,
            int((ends_at - timezone.now()).total_seconds())
        )

        return (
            f'{self._format_duration(remaining)} remaining'
        )

    @admin.display(description='Watched')
    def watched(self, obj):
        return self._format_duration(obj.watched_seconds)

    @admin.display(description='Duration')
    def video_duration(self, obj):
        return self._format_duration(obj.duration)

    @staticmethod
    def _format_duration(seconds):
        return f'{seconds // 3600:02}:{seconds % 3600 // 60:02}:{seconds % 60:02}'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False