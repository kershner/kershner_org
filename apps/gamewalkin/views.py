from django.shortcuts import render
from django.views.decorators.cache import cache_page
from django.http import JsonResponse
from django.views.decorators.http import require_GET
import requests

from .twitch import first_vod


TWITCH_ICON_BASE_URL = 'https://static-cdn.jtvnw.net/jtv_user_pictures/'
CHANNELS = [
    {'id': 'daggerwalk', 'name': 'Daggerwalk',
     'icon': f'{TWITCH_ICON_BASE_URL}1bdb5dc1-3895-4ce5-bb73-cc891d4128ad-profile_image-300x300.png',
     'links': [
        ('Bluesky', 'https://bsky.app/profile/daggerwalk.bsky.social'),
        ('Threads', 'https://www.threads.com/@daggerwalk'),
        ('GitHub', 'https://github.com/kershner/daggerwalk'),
    ]},
    {'id': 'nomanswalk', 'name': "No Man's Walk",
     'icon': f'{TWITCH_ICON_BASE_URL}1890a11d-0707-431b-8c91-f740c8f92dae-profile_image-300x300.png',
     'links': [
        ('Bluesky', 'https://bsky.app/profile/nomanswalk.bsky.social'),
        ('Threads', 'https://www.threads.com/@nomanswalk'),
        ('GitHub', 'https://github.com/kershner/nomanswalk'),
    ]},
    {'id': 'grandtheftwalk', 'name': 'Grand Theft Walk',
     'icon': f'{TWITCH_ICON_BASE_URL}adffb316-c2a1-4495-996b-96e38c28ff9f-profile_image-300x300.png',
     'links': []},
]


@cache_page(60 * 60 * 24 * 30)  # 30 days
def gamewalkin(request):
    return render(request, 'gamewalkin/index.html', {'channels': CHANNELS})


@require_GET
def channel_vod(request, channel):
    if channel not in {item['id'] for item in CHANNELS}:
        return JsonResponse({'error': 'Unknown channel'}, status=404)
    try:
        video_id = first_vod(channel)
    except (requests.RequestException, KeyError, ValueError):
        return JsonResponse({'error': 'VOD lookup unavailable'}, status=503)
    return JsonResponse({'video': video_id})
