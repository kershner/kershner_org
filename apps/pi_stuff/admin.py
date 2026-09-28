from kershner.mixins.admin_advanced_filter import AdminAdvancedFilterMixin
from .models import Category, Playlist, VideoPlay
from django.contrib import admin


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
        'title', 'device_id', 'started_at',
        'watched_seconds', 'duration', 'completed'
    ]
    list_filter = ['completed', 'category']
    search_fields = ['title', 'youtube_id', 'device_id']
    ordering = ['-started_at']
