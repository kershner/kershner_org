from django.template.loader import render_to_string
from apps.project.models import Project
from django.http import JsonResponse
from django.shortcuts import render
from apps.song.models import Song
from django.conf import settings
import time
import json



def home(request):
    projects = Project.objects.order_by('position').all()
    projects_html = [
        render_to_string('portfolio/project.html', context={'project': project})
        for project in projects
    ]

    if 'theme' not in request.session:
        request.session['theme'] = 'dark-mode'

    template_vars = {
        'projects_per_page': settings.PROJECTS_PER_PAGE,
        'projects_html': projects_html
    }
    return render(request, 'portfolio/home.html', template_vars)


def music(request):
    template_vars = {
        'title': 'Music'
    }
    return render(request, 'portfolio/music.html', template_vars)


def get_songs_data(request):
    songs = Song.objects.all().order_by('-position')
    serialized_songs = [song.serialize() for song in songs]
    return JsonResponse(serialized_songs, safe=False)


def custom_error_view(request, exception=None):
    return render(request, 'error/generic_error_page.html', {})
