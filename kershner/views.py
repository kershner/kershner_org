from apps.project.serializers import ProjectSerializer
from django.views.decorators.cache import cache_page
from apps.project.models import Project, ProjectTag
from django.template.loader import render_to_string
from apps.song.serializers import SongSerializer
from django.shortcuts import render
from apps.song.models import Song
from django.conf import settings
import json


@cache_page(60 * 15)  # 15 minutes
def home(request):
    projects = Project.objects.order_by('position').all()
    projects_serializer = ProjectSerializer(projects, many=True)
    projects_html = [
        render_to_string('portfolio/project.html', context={'project': project})
        for project in projects_serializer.data
    ]

    tags = list(ProjectTag.objects.values_list('name', flat=True).order_by('name').distinct())

    if 'theme' not in request.session:
        request.session['theme'] = 'dark-mode'

    template_vars = {
        'projects_per_page': settings.PROJECTS_PER_PAGE,
        'projects_html': projects_html,
        'tags': tags
    }
    return render(request, 'portfolio/home.html', template_vars)

def music(request):
    songs = Song.objects.all().order_by('-position')
    songs_serializer = SongSerializer(songs, many=True)
    template_vars = {
        'title': 'Music',
        'songs': json.dumps(songs_serializer.data)
    }
    return render(request, 'portfolio/music.html', template_vars)


def custom_error_view(request, exception=None):
    return render(request, 'error/generic_error_page.html', {})


def custom_error_view_404(request, exception=None):
    return render(request, 'error/404.html', {})
