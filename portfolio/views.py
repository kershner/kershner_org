from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.core import serializers
from django.shortcuts import render
from django.conf import settings
from project.models import Project
from song.models import Song
import time
import json


def home(request):
    base_s3_url = 'https://{}/{}'.format(settings.AWS_S3_CUSTOM_DOMAIN, settings.AWS_LOCATION)
    template_vars = {
        'base_s3_url': base_s3_url,
        'projects_per_page': settings.PROJECTS_PER_PAGE,
        'timestamp': time.time()
    }
    return render(request, 'home.html', template_vars)


@csrf_exempt
def get_projects(request):
    if request.method == 'GET':
        projects = Project.objects.all().order_by('position')
        projects_json = serializers.serialize('json', projects)
        return HttpResponse(projects_json, content_type='application/json')


def music(request):
    songs = Song.objects.all().order_by('-position')
    songs_json = []
    for song in songs:
        tmp = {
            'name': song.title,
            'artist': song.artist,
            'type': song.type,
            'url': song.file.url,
            'cover_art_url': song.thumbnail.url,
            'duration': song.duration,
            'timestamp': time.time()
        }
        songs_json.append(tmp)

    template_vars = {
        'title': 'Music',
        'songs_json': json.dumps(songs_json)
    }
    return render(request, 'music.html', template_vars)
