from rest_framework import serializers
from .models import Category, Playlist


class PlaylistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playlist
        fields = ['youtube_playlist_id', 'name']


class CategorySerializer(serializers.ModelSerializer):
    playlists = PlaylistSerializer(many=True, read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'playlists']