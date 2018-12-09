from django.shortcuts import render
from project.models import Project
from song.models import Song
import json


def home(request):
    projects = Project.objects.all().order_by('-id')
    template_vars = {
        'projects': projects
    }
    return render(request, 'home.html', template_vars)


def music(request):
    songs = Song.objects.all().order_by('-id')
    songs_json = []
    for song in songs:
        tmp = {
            'name': song.title,
            'artist': song.artist,
            'type': song.type,
            'url': song.file.url,
            'cover_art_url': song.thumbnail.url,
            'duration': song.duration
        }
        songs_json.append(tmp)

    template_vars = {
        'title': 'Music',
        'songs_json': json.dumps(songs_json)
    }
    return render(request, 'music.html', template_vars)
