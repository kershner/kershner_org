from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.core import serializers
from django.shortcuts import render
from django.conf import settings
from project.models import Project
from song.models import Song
import json


def home(request):
    projects = Project.objects.all().order_by('-position')[:2]
    base_s3_url = 'https://{}/{}'.format(settings.AWS_S3_CUSTOM_DOMAIN, settings.AWS_LOCATION)
    template_vars = {
        'base_s3_url': base_s3_url,
        'projects': projects,
        'projects_per_page': settings.PROJECTS_PER_PAGE
    }
    return render(request, 'home.html', template_vars)


@csrf_exempt
def get_projects(request):
    if request.method == 'POST':
        last_project_id = request.POST.get('last_project_id', '')
        projects = Project.objects.filter(id__lt=last_project_id).order_by('-position')[:settings.PROJECTS_PER_PAGE]
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
            'duration': song.duration
        }
        songs_json.append(tmp)

    template_vars = {
        'title': 'Music',
        'songs_json': json.dumps(songs_json)
    }
    return render(request, 'music.html', template_vars)
