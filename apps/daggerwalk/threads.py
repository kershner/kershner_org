"""Threads authorization and publishing for Daggerwalk's daily video."""
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
import json
import secrets
import time

import requests
from django.conf import settings


TOKENS_FILE = Path(__file__).resolve().parent / "data" / "threads_tokens.json"
REDIRECT_URI = "https://localhost:8787/threads/callback"
GRAPH_API = "https://graph.threads.com/v1.0"
TOKEN_API = "https://graph.threads.com"
SCOPES = "threads_basic,threads_content_publish,threads_manage_replies"
REQUEST_TIMEOUT = 30
PROCESSING_TIMEOUT = 180
PROCESSING_POLL_SECONDS = 3
REFRESH_EARLY_SECONDS = 14 * 24 * 60 * 60
MAX_TEXT_BYTES = 500


class ThreadsError(RuntimeError):
    pass


def _read_tokens():
    if not TOKENS_FILE.exists():
        return {}
    with TOKENS_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data if isinstance(data, dict) else {}


def _write_tokens(data):
    TOKENS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_path = TOKENS_FILE.with_suffix(".json.tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, sort_keys=True)
    temp_path.replace(TOKENS_FILE)


def _credentials():
    app_id = str(settings.PARAMETERS.get("daggerwalk_threads_app_id") or "").strip()
    app_secret = str(
        settings.PARAMETERS.get("daggerwalk_threads_app_secret") or ""
    ).strip()
    if not app_id or not app_secret:
        raise ThreadsError(
            "daggerwalk_threads_app_id and daggerwalk_threads_app_secret "
            "are required in parameters.json"
        )
    return app_id, app_secret


def _request(method, url, operation, **kwargs):
    response = requests.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if response.ok and isinstance(payload, dict):
        return payload
    error = payload.get("error", {}) if isinstance(payload, dict) else {}
    if isinstance(error, dict):
        message = error.get("message") or error.get("error_user_msg")
    else:
        message = str(error)
    message = message or response.text[:500] or f"HTTP {response.status_code}"
    raise ThreadsError(f"{operation} failed: {message}")


def is_configured():
    tokens = _read_tokens()
    return bool(tokens.get("access_token") and tokens.get("user_id"))


def authorization_url():
    app_id, _ = _credentials()
    state = secrets.token_urlsafe(24)
    query = urlencode({
        "client_id": app_id,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "response_type": "code",
        "state": state,
    })
    return f"https://threads.com/oauth/authorize?{query}", state


def _save_token(payload, user_id=None):
    access_token = str(payload.get("access_token") or "").strip()
    user_id = str(user_id or payload.get("user_id") or "").strip()
    expires_in = int(payload.get("expires_in") or 0)
    if not access_token or not user_id or not expires_in:
        raise ThreadsError("Threads returned an incomplete token response")
    now = int(time.time())
    saved = {
        "access_token": access_token,
        "expires_at": now + expires_in,
        "issued_at": now,
        "user_id": user_id,
    }
    _write_tokens(saved)
    return saved


def authorize(redirected_url, expected_state):
    app_id, app_secret = _credentials()
    params = parse_qs(urlparse(redirected_url).query)
    if (params.get("state") or [""])[0] != expected_state:
        raise ThreadsError("OAuth state did not match; authorization was not accepted")
    code = (params.get("code") or [""])[0]
    if not code:
        detail = (params.get("error_description") or params.get("error") or [""])[0]
        raise ThreadsError(
            f"No authorization code was returned{': ' + detail if detail else ''}"
        )

    short_lived = _request(
        "POST",
        f"{TOKEN_API}/oauth/access_token",
        "Threads authorization-code exchange",
        data={
            "client_id": app_id,
            "client_secret": app_secret,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
            "code": code,
        },
    )
    long_lived = _request(
        "GET",
        f"{TOKEN_API}/access_token",
        "Threads long-lived token exchange",
        params={
            "grant_type": "th_exchange_token",
            "client_secret": app_secret,
            "access_token": short_lived["access_token"],
        },
    )
    return _save_token(long_lived, short_lived.get("user_id"))


def _fresh_tokens():
    tokens = _read_tokens()
    access_token = str(tokens.get("access_token") or "").strip()
    user_id = str(tokens.get("user_id") or "").strip()
    if not access_token or not user_id:
        raise ThreadsError("Threads is not authorized")

    now = int(time.time())
    expires_at = int(tokens.get("expires_at") or 0)
    issued_at = int(tokens.get("issued_at") or 0)
    if not expires_at or expires_at <= now:
        raise ThreadsError("Threads token expired; authorize again")
    if expires_at - now > REFRESH_EARLY_SECONDS or now - issued_at < 24 * 60 * 60:
        return tokens

    refreshed = _request(
        "GET",
        f"{TOKEN_API}/refresh_access_token",
        "Threads token refresh",
        params={"grant_type": "th_refresh_token", "access_token": access_token},
    )
    return _save_token(refreshed, user_id)


def _clamp_text(text):
    text = (text or "").strip()
    if len(text.encode("utf-8")) <= MAX_TEXT_BYTES:
        return text
    suffix = "…"
    encoded = text.encode("utf-8")[: MAX_TEXT_BYTES - len(suffix.encode("utf-8"))]
    while True:
        try:
            return encoded.decode("utf-8").rstrip() + suffix
        except UnicodeDecodeError:
            encoded = encoded[:-1]


def _wait_until_ready(container_id, access_token):
    deadline = time.monotonic() + PROCESSING_TIMEOUT
    while time.monotonic() < deadline:
        payload = _request(
            "GET",
            f"{GRAPH_API}/{container_id}",
            "Threads media-status check",
            params={"fields": "status,error_message", "access_token": access_token},
        )
        status = str(payload.get("status") or "").upper()
        if status in {"FINISHED", "PUBLISHED"}:
            return
        if status in {"ERROR", "EXPIRED"}:
            detail = payload.get("error_message") or status
            raise ThreadsError(f"Threads could not process the video: {detail}")
        time.sleep(PROCESSING_POLL_SECONDS)
    raise ThreadsError("Threads video processing timed out")


def post_video(video_url, text, topic_tag="Daggerfall"):
    if not str(video_url or "").startswith("https://"):
        raise ValueError("Threads video URL must use HTTPS")

    tokens = _fresh_tokens()
    access_token = tokens["access_token"]
    user_id = tokens["user_id"]
    data = {
        "media_type": "VIDEO",
        "video_url": video_url,
        "text": _clamp_text(text),
        "access_token": access_token,
    }
    if topic_tag:
        data["topic_tag"] = topic_tag[:50]
    container = _request(
        "POST",
        f"{GRAPH_API}/{user_id}/threads",
        "Threads video-container creation",
        data=data,
    )
    container_id = str(container.get("id") or "")
    if not container_id:
        raise ThreadsError("Threads did not return a video-container ID")

    _wait_until_ready(container_id, access_token)
    published = _request(
        "POST",
        f"{GRAPH_API}/{user_id}/threads_publish",
        "Threads publishing",
        data={"creation_id": container_id, "access_token": access_token},
    )
    media_id = str(published.get("id") or "")
    if not media_id:
        raise ThreadsError("Threads did not return a published media ID")

    details = _request(
        "GET",
        f"{GRAPH_API}/{media_id}",
        "Threads permalink lookup",
        params={"fields": "id,permalink", "access_token": access_token},
    )
    return media_id, str(details.get("permalink") or media_id)


def post_image_reply(parent_id, image_urls, text, alt_texts=None):
    """Reply with a carousel of public images."""
    if len(image_urls) < 2:
        raise ValueError("Threads carousel replies require at least two images")

    tokens = _fresh_tokens()
    access_token = tokens["access_token"]
    user_id = tokens["user_id"]
    alt_texts = alt_texts or []
    child_ids = []

    for index, image_url in enumerate(image_urls):
        if not str(image_url or "").startswith("https://"):
            raise ValueError("Threads image URLs must use HTTPS")
        data = {
            "media_type": "IMAGE",
            "image_url": image_url,
            "is_carousel_item": "true",
            "access_token": access_token,
        }
        if index < len(alt_texts) and alt_texts[index]:
            data["alt_text"] = alt_texts[index]
        child = _request(
            "POST",
            f"{GRAPH_API}/{user_id}/threads",
            "Threads image-container creation",
            data=data,
        )
        child_id = str(child.get("id") or "")
        if not child_id:
            raise ThreadsError("Threads did not return an image-container ID")
        _wait_until_ready(child_id, access_token)
        child_ids.append(child_id)

    container = _request(
        "POST",
        f"{GRAPH_API}/{user_id}/threads",
        "Threads reply-container creation",
        data={
            "media_type": "CAROUSEL",
            "children": ",".join(child_ids),
            "text": _clamp_text(text),
            "reply_to_id": parent_id,
            "access_token": access_token,
        },
    )
    container_id = str(container.get("id") or "")
    if not container_id:
        raise ThreadsError("Threads did not return a reply-container ID")

    _wait_until_ready(container_id, access_token)
    published = _request(
        "POST",
        f"{GRAPH_API}/{user_id}/threads_publish",
        "Threads reply publishing",
        data={"creation_id": container_id, "access_token": access_token},
    )
    media_id = str(published.get("id") or "")
    if not media_id:
        raise ThreadsError("Threads did not return a published reply ID")

    details = _request(
        "GET",
        f"{GRAPH_API}/{media_id}",
        "Threads reply permalink lookup",
        params={"fields": "id,permalink", "access_token": access_token},
    )
    return str(details.get("permalink") or media_id)


def token_status():
    tokens = _read_tokens()
    if not tokens.get("access_token") or not tokens.get("user_id"):
        return None
    return {
        "user_id": tokens["user_id"],
        "expires_at": int(tokens.get("expires_at") or 0),
    }
