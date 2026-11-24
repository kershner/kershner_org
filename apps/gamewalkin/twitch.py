"""Simple Twitch API client."""

import requests
from django.conf import settings
from django.core.cache import cache


TOKEN_KEY = 'gamewalkin:twitch_app_token'


def _headers():
    token = cache.get(TOKEN_KEY)
    if not token:
        response = requests.post(
            'https://id.twitch.tv/oauth2/token',
            data={
                'client_id': settings.DAGGERWALK_TWITCH_CLIENT_ID,
                'client_secret': settings.DAGGERWALK_TWITCH_SECRET,
                'grant_type': 'client_credentials',
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        token = payload['access_token']
        cache.set(TOKEN_KEY, token, timeout=max(1, payload['expires_in'] - 60))
    return {'Client-Id': settings.DAGGERWALK_TWITCH_CLIENT_ID,
            'Authorization': f'Bearer {token}'}


def _get(resource, params):
    for attempt in range(2):
        response = requests.get(
            f'https://api.twitch.tv/helix/{resource}',
            headers=_headers(), params=params, timeout=10,
        )
        if response.status_code == 401 and attempt == 0:
            cache.delete(TOKEN_KEY)
            continue
        response.raise_for_status()
        return response.json()['data']


def first_vod(channel):
    key = f'gamewalkin:vod:{channel}'
    cached = cache.get(key)
    if cached is not None:
        return cached or None
    user_key = f'gamewalkin:twitch_user:{channel}'
    user_id = cache.get(user_key)
    if not user_id:
        users = _get('users', {'login': channel})
        if not users:
            return None
        user_id = users[0]['id']
        cache.set(user_key, user_id, timeout=86400)
    videos = _get('videos', {
        'user_id': user_id, 'type': 'archive', 'sort': 'time', 'first': 1,
    })
    video_id = videos[0]['id'] if videos else None
    cache.set(key, video_id or '', timeout=300 if video_id else 60)
    return video_id
