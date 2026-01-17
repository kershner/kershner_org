import time
import secrets
import base64
from io import BytesIO
from urllib.parse import urlparse, parse_qs

import qrcode
import json

from django.views.generic import TemplateView
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from django.urls import reverse

from .models import Category
from .serializers import CategorySerializer


TOKEN_TTL = 120  # seconds
LATEST_PLAY_TTL = 60 * 60 * 24 * 7  # 7 days


def extract_youtube_id(url):
    try:
        u = urlparse(url)
    except Exception:
        return None

    host = (u.netloc or "").lower()

    if host.endswith("youtu.be"):
        return u.path.lstrip("/") or None

    if "youtube.com" in host:
        qs = parse_qs(u.query)
        return qs.get("v", [None])[0]

    return None


class PiStuffHomeView(TemplateView):
    template_name = "pi_stuff/home.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        categories = Category.objects.prefetch_related("playlists").all()
        serializer = CategorySerializer(categories, many=True)

        ctx["categories"] = categories
        ctx["categories_json"] = json.dumps(serializer.data)

        # Get device_id from query param (will be set by JavaScript)
        device_id = self.request.GET.get("device_id", "")
        
        # Generate token and store in cache with device_id
        token = secrets.token_urlsafe(12)
        cache.set(f"pi_token:{token}:{device_id}", True, timeout=TOKEN_TTL)

        # Use reverse() to build URL properly, include device_id in QR code
        submit_path = reverse("submit")
        submit_url = self.request.build_absolute_uri(
            f"{submit_path}?token={token}&device_id={device_id}"
        )

        qr = qrcode.make(submit_url)
        buf = BytesIO()
        qr.save(buf, format="PNG")

        ctx["qr_code_b64"] = base64.b64encode(buf.getvalue()).decode()
        
        # Pass API URLs to JavaScript
        ctx["api_play_url"] = reverse("api_play")
        ctx["latest_url"] = reverse("latest")
        
        return ctx


def submit_form(request):
    token = request.GET.get("token", "")
    device_id = request.GET.get("device_id", "")
    api_play_url = reverse("api_play")
    return render(request, "pi_stuff/submit.html", {
        "token": token,
        "device_id": device_id,
        "api_play_url": api_play_url
    })


@require_POST
@csrf_exempt
def api_play(request):
    token = request.POST.get("token")
    device_id = request.POST.get("device_id")
    url = request.POST.get("url", "").strip()

    # Check if token and device_id exist
    if not token:
        return JsonResponse({"error": "missing_token", "message": "No token provided"}, status=400)
    
    if not device_id:
        return JsonResponse({"error": "missing_device", "message": "No device ID provided"}, status=400)
    
    token_key = f"pi_token:{token}:{device_id}"
    token_exists = cache.get(token_key)
    
    if token_exists is None:
        # Token doesn't exist - could be invalid or expired
        # Check if it was already used
        used_key = f"pi_token_used:{token}"
        if cache.get(used_key):
            return JsonResponse({"error": "already_used", "message": "This QR code has already been used"}, status=400)
        else:
            return JsonResponse({"error": "invalid_or_expired", "message": "Invalid or expired QR code"}, status=400)

    # Mark token as used and delete from valid tokens
    cache.delete(token_key)
    cache.set(f"pi_token_used:{token}", True, timeout=300)  # Remember it was used for 5 minutes

    # Validate YouTube URL
    vid = extract_youtube_id(url)
    if not vid:
        return JsonResponse({"error": "not_youtube", "message": "Please provide a valid YouTube URL"}, status=400)

    # Store the latest play in cache for this specific device (7 day TTL)
    ts = time.time()
    cache.set(
        f"pi_latest_play:{device_id}", 
        {"youtube_id": vid, "ts": ts}, 
        timeout=LATEST_PLAY_TTL
    )
    
    return JsonResponse({"ok": True})


def latest(request):
    device_id = request.GET.get("device")
    
    if not device_id:
        return JsonResponse({"error": "missing_device"}, status=400)
    
    latest_play = cache.get(f"pi_latest_play:{device_id}")
    if not latest_play or not latest_play.get("youtube_id"):
        return HttpResponse(status=204)
    return JsonResponse(latest_play)