from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers import GappedSquareModuleDrawer
from qrcode.image.styledpil import StyledPilImage
from urllib.parse import urlparse, parse_qs
from apps.pi_stuff.consts import TOKEN_TTL
from django.core.cache import cache
from django.urls import reverse
from io import BytesIO
import secrets
import base64
import qrcode


def get_or_create_qr_code(request, device_id):
    """Get cached QR code or create a new one with a fresh token."""
    qr_cache_key = f"pi_qr:{device_id}"
    cached_data = cache.get(qr_cache_key)
    
    if cached_data:
        return cached_data["qr_code_b64"]
    
    # Generate new token
    token = secrets.token_urlsafe(12)
    cache.set(f"pi_token:{token}:{device_id}", True, timeout=TOKEN_TTL)
    
    # Build submit URL
    submit_url = request.build_absolute_uri(
        f"{reverse('submit')}?token={token}&device_id={device_id}"
    )
    
    # Generate QR code
    qr_code_b64 = generate_qr_code(submit_url)
    
    # Cache the QR code with the token data
    cache.set(qr_cache_key, {
        "qr_code_b64": qr_code_b64,
        "token": token
    }, timeout=TOKEN_TTL)
    
    return qr_code_b64


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
