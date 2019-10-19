from django.core.serializers.json import DjangoJSONEncoder
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.core import serializers
from project.models import Project
from django.conf import settings
from song.models import Song
import time
import json


def home(request):
    base_s3_url = 'https://{}/{}'.format(settings.AWS_S3_CUSTOM_DOMAIN, settings.AWS_LOCATION)
    projects = Project.objects.order_by('position').all()
    projects_json = serializers.serialize('json', projects)

    template_vars = {
        'base_s3_url': base_s3_url,
        'projects_per_page': settings.PROJECTS_PER_PAGE,
        'timestamp': time.time(),
        'projects_json': projects_json
    }
    return render(request, 'home.html', template_vars)


def music(request):
    songs = Song.objects.all().order_by('-position')
    songs_json = []
    for song in songs:
        tmp = {
            'name': song.title,
            'artist': song.artist,
            'year': song.year,
            'type': song.type,
            'url': song.file.url,
            'cover_art_url': song.thumbnail.url,
            'youtube_url': song.youtube_link,
            'duration': song.duration,
            'timestamp': time.time()
        }
        songs_json.append(tmp)

    template_vars = {
        'title': 'Music',
        'songs_json': json.dumps(songs_json)
    }
    return render(request, 'music.html', template_vars)


def bacon_redirect(request):
    return redirect('http://old.kershner.org/bacon')
