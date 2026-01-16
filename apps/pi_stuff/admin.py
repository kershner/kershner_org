from django.contrib import admin
from .models import Category, Playlist


class PlaylistInline(admin.TabularInline):
    model = Playlist
    extra = 0
    fields = ("name", "youtube_playlist_id")
    ordering = ("name",)
    show_change_link = True


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name']
    ordering = ['name']
    search_fields = ['name']
    inlines = (PlaylistInline,)


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'youtube_playlist_id']
    list_filter = ['category']
    search_fields = ['name', 'youtube_playlist_id']
    autocomplete_fields = ['category']
    ordering = ['category', 'name']