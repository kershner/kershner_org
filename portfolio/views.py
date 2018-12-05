from django.shortcuts import render
from django.conf import settings


def home(request):
    template_vars = {
        'title': 'Tyler Kershner'
    }
    return render(request, 'home.html', template_vars)


def music(request):
    base_s3_url = 'https://{}/static/music'.format(settings.AWS_S3_CUSTOM_DOMAIN)
    template_vars = {
        'title': 'Tyler Kershner - Music',
        'base_s3_url': base_s3_url
    }
    return render(request, 'music.html', template_vars)
