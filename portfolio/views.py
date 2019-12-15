from django.shortcuts import render, redirect
from django.core import serializers
from project.models import Project
from django.conf import settings
from song.models import Song
import requests
import random
import math
import time
import json


def home(request):
    projects = Project.objects.order_by('position').all()
    projects_json = serializers.serialize('json', projects)

    template_vars = {
        'base_s3_url': settings.BASE_S3_URL,
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


def philomania(request):
    base_s3_url = '{}/img/philomania'.format(settings.BASE_S3_URL)
    page_size = 30

    # Make request to Unsplash API for random photos from collection
    random_photos_url = '{}photos/random?client_id={}&collections={}&count={}'.format(settings.UNSPLASH_API_URL,
                                                                                      settings.UNSPLASH_ACCESS_KEY,
                                                                                      settings.PHILOMANIA_BACKGROUNDS_COLLECTION_ID,
                                                                                      page_size)

    unsplash_photo_urls = []
    try:
        random_photos_response = requests.get(random_photos_url).json()
        # Loop through photos, get reference to url
        for entry in random_photos_response:
            unsplash_photo_urls.append(entry['urls']['regular'])
    except Exception as e:
        print(e)

    template_vars = {
        'base_s3_url': base_s3_url,
        'timestamp': time.time(),
        'unsplash_photo_urls': unsplash_photo_urls
    }
    return render(request, 'philomania.html', template_vars)
