import time
import secrets
import base64
from io import BytesIO
from urllib.parse import urlparse, parse_qs
from html import unescape

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import GappedSquareModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
import json
import requests

from django.views.generic import TemplateView
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from django.urls import reverse
from django.conf import settings

from .models import Category
from .serializers import CategorySerializer


TOKEN_TTL = 60 * 20  # 20 minutes (1200 seconds)
LATEST_PLAY_TTL = 60 * 60 * 24 * 7  # 7 days
YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search'


def extract_youtube_id(url):
    """Extract video ID from various YouTube URL formats."""
    try:
        u = urlparse(url)
        host = (u.netloc or "").lower()

        if host.endswith("youtu.be"):
            return u.path.lstrip("/") or None

        if "youtube.com" in host:
            qs = parse_qs(u.query)
            return qs.get("v", [None])[0]

        return None
    except Exception:
        return None
    

def generate_qr_code(data):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=GappedSquareModuleDrawer(),
        color_mask=SolidFillColorMask(
            front_color=(255, 255, 255),
            back_color=(26, 26, 26),
        ),
    ).convert("RGBA")

    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class PiStuffHomeView(TemplateView):
    template_name = "pi_stuff/home.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        categories = Category.objects.prefetch_related("playlists").all()
        
        # Generate QR code with token and device_id
        device_id = self.request.GET.get("device_id", "")
        token = secrets.token_urlsafe(12)
        cache.set(f"pi_token:{token}:{device_id}", True, timeout=TOKEN_TTL)

        submit_url = self.request.build_absolute_uri(
            f"{reverse('submit')}?token={token}&device_id={device_id}"
        )

        ctx = {
            "categories": categories,
            "categories_json": json.dumps(CategorySerializer(categories, many=True).data),
            "qr_code_b64": generate_qr_code(submit_url),
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
    """Handle video play requests with token validation."""
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
    video_id = extract_youtube_id(url)
    if not video_id:
        return JsonResponse(
            {"error": "not_youtube", "message": "Please provide a valid YouTube URL"}, 
            status=400
        )

    # Store the play request
    cache.set(
        f"pi_latest_play:{device_id}", 
        {"youtube_id": video_id, "ts": time.time()}, 
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
    
    # Generate new token
    token = secrets.token_urlsafe(12)
    cache.set(f"pi_token:{token}:{device_id}", True, timeout=TOKEN_TTL)
    
    # Build submit URL
    submit_url = request.build_absolute_uri(
        f"{reverse('submit')}?token={token}&device_id={device_id}"
    )
    
    # Generate QR code
    qr_code_b64 = generate_qr_code(submit_url)
    
    return JsonResponse({
        "qr_code_b64": qr_code_b64,
        "expires_in": TOKEN_TTL
    })


@require_http_methods(["GET"])
def youtube_search(request):
    """Server-side YouTube search API endpoint with caching."""
    
    template = 'pi_stuff/_search_results.html'
    query = request.GET.get('q', '').strip()
    
    # Handle empty or short queries (require at least 3 chars)
    if not query or len(query) < 3:
        return render(request, template, {
            'videos': [],
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
            'error': 'YouTube API key not configured'
        })
    
    try:
        # Call YouTube Data API
        response = requests.get(
            YOUTUBE_API_URL,
            params={
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': 5,
                'key': youtube_api_key,
                'videoEmbeddable': 'true',
                'safeSearch': 'moderate'
            },
            timeout=5
        )
        
        # Handle API errors
        if not response.ok:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', 'Search failed')
            return render(request, template, {
                'videos': [],
                'error': error_msg
            })
        
        # Transform results
        data = response.json()
        videos = [
            {
                'video_id': item['id']['videoId'],
                'title': unescape(item['snippet']['title']),
                'author': unescape(item['snippet']['channelTitle']),
                'thumbnail': item['snippet']['thumbnails']['medium']['url'],
                'published_at': item['snippet'].get('publishedAt', '')[:10],
            }
            for item in data.get('items', [])
        ]

        # Cache results for 5 minutes
        result_data = {'videos': videos, 'error': None}
        cache.set(cache_key, result_data, timeout=300)

        return render(request, template, result_data)
        
    except requests.Timeout:
        return render(request, template, {
            'videos': [],
            'error': 'Search timed out. Please try again.'
        })
    except Exception as e:
        return render(request, template, {
            'videos': [],
            'error': f'Search failed: {str(e)}'
        })