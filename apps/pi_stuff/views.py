from apps.pi_stuff.consts import LATEST_PLAY_TTL, TOKEN_TTL, YOUTUBE_BASE_API_URL
from django.views.decorators.http import require_POST, require_http_methods
from apps.pi_stuff.utils import extract_youtube_id, get_or_create_qr_code
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView
from .serializers import CategorySerializer
from django.core.cache import cache
from django.shortcuts import render
from django.conf import settings
from django.urls import reverse
from .models import Category
from html import unescape
import requests
import time
import json


class PiStuffHomeView(TemplateView):
    template_name = "pi_stuff/home.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        categories = Category.objects.prefetch_related("playlists").all()
        device_id = self.request.GET.get("device_id", "")
        
        qr_code_b64 = get_or_create_qr_code(self.request, device_id)

        ctx = {
            "categories": categories,
            "categories_json": json.dumps(CategorySerializer(categories, many=True).data),
            "qr_code_b64": qr_code_b64,
            "api_play_url": reverse("api_play"),
            "latest_url": reverse("latest"),
            "regenerate_qr_url": reverse("regenerate_qr"),
        }
        return ctx


def submit_form(request):
    """Display the submit form page."""

    return render(request, "pi_stuff/submit.html", {
        "token": request.GET.get("token", ""),
        "device_id": request.GET.get("device_id", ""),
        "api_play_url": reverse("api_play"),
        "youtube_search_url": reverse("youtube_search"),
    })


@require_POST
@csrf_exempt
def api_play(request):
    """Handle video/playlist play requests with token validation."""
    token = request.POST.get("token")
    device_id = request.POST.get("device_id")
    url = request.POST.get("url", "").strip()

    # Validate required fields
    if not token:
        return JsonResponse(
            {"error": "missing_token", "message": "No token provided"}, 
            status=400
        )
    
    if not device_id:
        return JsonResponse(
            {"error": "missing_device", "message": "No device ID provided"}, 
            status=400
        )
    
    # Check token validity
    token_key = f"pi_token:{token}:{device_id}"
    if not cache.get(token_key):
        return JsonResponse(
            {"error": "invalid_or_expired", "message": "Invalid or expired QR code"}, 
            status=400
        )

    # Validate YouTube URL
    result = extract_youtube_id(url)
    if not result:
        return JsonResponse(
            {"error": "not_youtube", "message": "Please provide a valid YouTube URL"}, 
            status=400
        )
    
    content_type, content_id = result

    # Store the play request
    cache.set(
        f"pi_latest_play:{device_id}", 
        {
            "type": content_type,
            "youtube_id": content_id, 
            "ts": time.time()
        }, 
        timeout=LATEST_PLAY_TTL
    )
    
    return JsonResponse({"ok": True})


def latest(request):
    """Get the latest video play request for a device."""
    device_id = request.GET.get("device")
    
    if not device_id:
        return JsonResponse({"error": "missing_device"}, status=400)
    
    latest_play = cache.get(f"pi_latest_play:{device_id}")
    if not latest_play or not latest_play.get("youtube_id"):
        return HttpResponse(status=204)
    
    return JsonResponse(latest_play)


@require_POST
def regenerate_qr(request):
    """Generate a new QR code with a fresh token."""
    device_id = request.POST.get("device_id", "")
    
    if not device_id:
        return JsonResponse(
            {"error": "missing_device", "message": "No device ID provided"}, 
            status=400
        )
    
    qr_cache_key = f"pi_qr:{device_id}"
    cached_data = cache.get(qr_cache_key)
    was_cached = cached_data is not None
    
    qr_code_b64 = get_or_create_qr_code(request, device_id)
    
    return JsonResponse({
        "qr_code_b64": qr_code_b64,
        "expires_in": cache.ttl(qr_cache_key) or TOKEN_TTL,
        "regenerated": not was_cached
    })


@require_http_methods(["GET"])
def youtube_search(request):
    """Server-side YouTube search API endpoint with caching - supports videos and playlists."""
    
    template = 'pi_stuff/search_results.html'
    query = request.GET.get('q', '').strip()
    youtube_search_url = f"{YOUTUBE_BASE_API_URL}/search"
    youtube_playlists_url = f"{YOUTUBE_BASE_API_URL}/playlists"
    
    # Handle empty or short queries (require at least 3 chars)
    if not query or len(query) < 3:
        return render(request, template, {
            'videos': [],
            'playlists': [],
            'error': None
        })
    
    # Check cache first (5 minute cache to reduce API calls)
    cache_key = f'youtube_search:{query.lower()}'
    cached_results = cache.get(cache_key)
    if cached_results:
        return render(request, template, cached_results)
    
    # Check API key configuration
    youtube_api_key = getattr(settings, 'YOUTUBE_API_KEY', None)
    if not youtube_api_key:
        return render(request, template, {
            'videos': [],
            'playlists': [],
            'error': 'YouTube API key not configured'
        })
    
    try:
        # Call YouTube Data API for videos
        video_response = requests.get(
            youtube_search_url,
            params={
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': 10,
                'key': youtube_api_key,
                'videoEmbeddable': 'true',
                'safeSearch': 'moderate'
            },
            timeout=5
        )
        
        # Call YouTube Data API for playlists
        playlist_response = requests.get(
            youtube_search_url,
            params={
                'part': 'snippet',
                'q': query,
                'type': 'playlist',
                'maxResults': 5,
                'key': youtube_api_key,
                'safeSearch': 'moderate'
            },
            timeout=5
        )
        
        # Handle API errors
        if not video_response.ok:
            error_data = video_response.json()
            error_msg = error_data.get('error', {}).get('message', 'Search failed')
            return render(request, template, {
                'videos': [],
                'playlists': [],
                'error': error_msg
            })
        
        # Transform video results
        video_data = video_response.json()
        videos = [
            {
                'video_id': item['id']['videoId'],
                'title': unescape(item['snippet']['title']),
                'author': unescape(item['snippet']['channelTitle']),
                'thumbnail': item['snippet']['thumbnails']['medium']['url'],
                'published_at': item['snippet'].get('publishedAt', '')[:10],
                'type': 'video'
            }
            for item in video_data.get('items', [])
        ]
        
        # Transform playlist results and get video counts
        playlist_data = playlist_response.json() if playlist_response.ok else {'items': []}
        playlist_ids = [item['id']['playlistId'] for item in playlist_data.get('items', [])]
        
        # Get playlist details including video counts
        playlist_details = {}
        if playlist_ids:
            details_response = requests.get(
                youtube_playlists_url,
                params={
                    'part': 'contentDetails',
                    'id': ','.join(playlist_ids),
                    'key': youtube_api_key
                },
                timeout=5
            )
            if details_response.ok:
                details_data = details_response.json()
                for item in details_data.get('items', []):
                    playlist_details[item['id']] = item.get('contentDetails', {}).get('itemCount', 0)
        
        playlists = [
            {
                'playlist_id': item['id']['playlistId'],
                'title': unescape(item['snippet']['title']),
                'author': unescape(item['snippet']['channelTitle']),
                'thumbnail': item['snippet']['thumbnails']['medium']['url'],
                'published_at': item['snippet'].get('publishedAt', '')[:10],
                'video_count': playlist_details.get(item['id']['playlistId'], 0),
                'type': 'playlist'
            }
            for item in playlist_data.get('items', [])
        ]

        # Cache results for 5 minutes
        result_data = {
            'videos': videos, 
            'playlists': playlists,
            'error': None
        }
        cache.set(cache_key, result_data, timeout=300)

        return render(request, template, result_data)
        
    except requests.Timeout:
        return render(request, template, {
            'videos': [],
            'playlists': [],
            'error': 'Search timed out. Please try again.'
        })
    except Exception as e:
        return render(request, template, {
            'videos': [],
            'playlists': [],
            'error': f'Search failed: {str(e)}'
        })
