from django.contrib import admin
from .models import Category, Playlist


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name']
    ordering = ['name']
    search_fields = ['name']


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'youtube_playlist_id']
    list_filter = ['category']
    search_fields = ['name', 'youtube_playlist_id']
    autocomplete_fields = ['category']
    ordering = ['category', 'name']