from apps.daggerwalk.serializers import DaggerwalkLogSerializer, POISerializer, QuestSerializer, TwitchUserProfileSerializer
from apps.daggerwalk.utils import calculate_daggerwalk_stats, get_map_data, get_latest_log_data
from apps.daggerwalk.models import POI, DaggerwalkLog, ProvinceShape, Quest, Region, TwitchUserProfile
from django.db.models import Sum, Count, IntegerField, Max, Q, Max
from django.db.models.functions import Coalesce
from playwright.sync_api import sync_playwright
from datetime import datetime, timedelta
from django.utils.text import slugify
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from celery import shared_task
from atproto import Client
from io import BytesIO
import tempfile
import requests
import logging
import random
import yt_dlp
import httpx
import time
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


BASE_URL = 'https://kershner.org'
API_BASE_URL = f'{BASE_URL}/api/daggerwalk'
TWITCH_CLIP_URL = 'https://api.twitch.tv/helix/clips'


def get_valid_access_token():
    """
    Get a valid Twitch access token, refreshing it if necessary.
    Returns the access token string.
    """
    logger.info("Getting valid Twitch access token")
    
    refresh_token = settings.DAGGERWALK_TWITCH_REFRESH_TOKEN
    client_id = settings.DAGGERWALK_TWITCH_CLIENT_ID
    client_secret = settings.DAGGERWALK_TWITCH_SECRET
    
    # Check if we have a cached valid token
    cached_token = cache.get('twitch_access_token')
    if cached_token:
        # Verify the token is still valid
        headers = {'Authorization': f'Bearer {cached_token}', 'Client-Id': client_id}
        validation_response = requests.get('https://id.twitch.tv/oauth2/validate', headers=headers)
        
        if validation_response.status_code == 200:
            logger.info("Using cached valid access token")
            return cached_token
        else:
            logger.info("Cached token expired or invalid, refreshing...")
    
    # Refresh the token
    logger.info("Refreshing Twitch access token")
    
    refresh_data = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    refresh_response = requests.post('https://id.twitch.tv/oauth2/token', data=refresh_data)
    
    if refresh_response.status_code != 200:
        logger.error(f"Failed to refresh token: {refresh_response.status_code} - {refresh_response.text}")
        raise Exception(f"Failed to refresh Twitch token: {refresh_response.status_code}")
    
    token_data = refresh_response.json()
    new_access_token = token_data['access_token']
    expires_in = token_data.get('expires_in', 14400)  # Default to 4 hours if not provided
    
    # Cache the token for slightly less than its expiration time to be safe
    cache_timeout = expires_in - 300  # 5 minutes before expiration
    cache.set('twitch_access_token', new_access_token, timeout=cache_timeout)
    
    logger.info(f"New access token cached for {cache_timeout} seconds")
    return new_access_token


def create_and_wait_for_clip():
    logger.info("Starting Twitch clip creation process")
    
    token = get_valid_access_token()
    client_id = settings.DAGGERWALK_TWITCH_CLIENT_ID
    broadcaster_id = settings.DAGGERWALK_TWITCH_BROADCASTER_ID
    
    headers = {'Authorization': f'Bearer {token}', 'Client-Id': client_id}
    r = requests.post(TWITCH_CLIP_URL, headers=headers, params={
        'broadcaster_id': broadcaster_id
    })
    
    # 202 Accepted is the correct response for clip creation
    if r.status_code not in [200, 202]:
        logger.error(f"Failed to create clip: {r.status_code} - {r.text}")
        raise Exception(f"Failed to create clip: {r.status_code}")
    
    clip_id = r.json()['data'][0]['id']
    logger.info(f"Clip created with ID: {clip_id}")
    
    logger.info("Waiting for clip URL to become available")
    for attempt in range(10):
        r = requests.get(TWITCH_CLIP_URL, headers=headers, params={'id': clip_id})
        data = r.json().get('data')
        if data and data[0].get('url'):
            logger.info(f"Clip URL ready: https://clips.twitch.tv/{clip_id}")
            return clip_id, data[0]
        time.sleep(3)

    logger.error("Clip URL never became available after 30 seconds")
    raise Exception("Clip URL never became available")


def download_twitch_clip(clip_url):
    """Download Twitch clip to temporary file and return path"""
    logger.info(f"Downloading video from: {clip_url}")
    
    temp_dir = tempfile.mkdtemp()
    
    ydl_opts = {
        'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
        'format': 'best[ext=mp4]',  # Prefer mp4 format for Bluesky compatibility
        'quiet': True,  # Suppress yt-dlp output
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clip_url, download=True)
            filename = ydl.prepare_filename(info)
            
            # Handle potential filename changes during download
            if not os.path.exists(filename):
                files = os.listdir(temp_dir)
                if files:
                    filename = os.path.join(temp_dir, files[0])
                else:
                    raise Exception("Downloaded file not found")
            
            # Get file info
            file_size = os.path.getsize(filename) / 1024 / 1024  # MB
            logger.info(f"Video downloaded: {file_size:.2f} MB")
            
            return filename
            
    except Exception as e:
        logger.error(f"Failed to download video: {str(e)}")
        raise


def upload_video_as_blob(client: Client, video_path: str):
    logger.info("Uploading video to Bluesky")

    with open(video_path, 'rb') as f:
        video_data = f.read()

    file_size = len(video_data)
    file_size_mb = file_size / 1024 / 1024

    if file_size > 50 * 1024 * 1024:
        logger.error(f"Video file too large: {file_size_mb:.2f} MB (limit: 50 MB)")
        raise Exception("Video file too large for Bluesky (>50MB)")

    try:
        blob = client.com.atproto.repo.upload_blob(BytesIO(video_data))
        logger.info("Video uploaded successfully")
        return blob.blob
    except Exception as e:
        logger.error(f"Failed to upload video: {str(e)}")
        raise


def generate_bluesky_caption(log_data, stats_data):
    def get_qualified_season(date_str):
        season_map = [
            ("Winter", ["eveningstar", "morningstar", "sunsdawn",]),
            ("Spring", ["firstseed", "rainshand", "secondseed"]),
            ("Summer", ["midyear", "sunsheight", "lastseed"]),
            ("Autumn", ["hearthfire", "frostfall", "sunsdusk"]),
        ]

        try:
            month = date_str.split(',')[1].strip().split(' ', 1)[1]
            key = month.lower().replace("'", "").replace(" ", "")
            for season, months in season_map:
                if key in months:
                    pos = ["early", "mid", "late"][months.index(key)]
                    return f"{pos} {season}"
        except:
            pass
        return "unknown season"
    
    def get_time_of_day(date_str):
        # Extract the time portion at the end (e.g., "22:52:08")
        try:
            time_part = date_str.strip().split(",")[-1].strip()
            t = datetime.strptime(time_part, "%H:%M:%S").time()
            
            # Define time ranges for different periods of the day
            # 6:00 AM - 11:59 AM: Morning
            # 12:00 PM - 5:59 PM: Afternoon
            # 6:00 PM - 9:59 PM: Evening
            # 10:00 PM - 5:59 AM: Night
            morning_start = datetime.strptime("06:00:00", "%H:%M:%S").time()
            afternoon_start = datetime.strptime("12:00:00", "%H:%M:%S").time()
            evening_start = datetime.strptime("18:00:00", "%H:%M:%S").time()
            night_start = datetime.strptime("22:00:00", "%H:%M:%S").time()
            
            if morning_start <= t < afternoon_start:
                return "Morning"
            elif afternoon_start <= t < evening_start:
                return "Afternoon"
            elif evening_start <= t < night_start:
                return "Evening"
            else:
                return "Night"
        except Exception as e:
            # Default to unknown if there's an error parsing the time
            print(f"Error parsing time: {e}")
            return "Unknown"

    stats_data = stats_data["stats"]
    time_of_day = get_time_of_day(log_data['date']).lower()
    date_without_time = log_data['date'].rsplit(',', 1)[0]
    region_data = log_data['region_fk']

    region_name = region_data['name']
    region_province = region_data['province']
    region_emoji = region_data['emoji']
    
    climate = region_data["climate"].lower()
    if climate == "woodlands":
        climate = "woodland"

    weather = log_data['weather'].lower()
    weather_emoji = DaggerwalkLog.get_weather_emoji(log_data['weather'])
    poi_data = log_data['poi']

    if region_name.lower() == "ocean":
        try:
            last_known_region = Region.objects.get(id=log_data['last_known_region'])
            region_string = f"Walking through the ocean near {last_known_region.name} in {last_known_region.province}"
        except Region.DoesNotExist:
            region_string = "Walking through the Ocean."
    else:
        region_string = f"Walking through the {climate} wilderness of {region_name} in {region_province}"

    season_qualifier = get_qualified_season(log_data['date'])
    weather_string = f"It's a {weather} {time_of_day} in {season_qualifier}"
    traveled_string = f"The Walker has traveled {stats_data['totalDistanceKm']}km in {stats_data['formattedPlaytime']} so far today."
    poi_string = ""
    if poi_data:
        poi_name = poi_data['name']
        poi_emoji = poi_data['emoji']
        poi_string = f" {poi_name} is nearby."
        traveled_string = ""  # Don't include travel string if POI is present to preserve characters

    text = f"{date_without_time}. {region_string}.{poi_string} {weather_string}. {traveled_string}"
    return text


def post_video_to_bluesky(caption, video_blob, client: Client):
    logger.info("Preparing Bluesky post")

    random_tags = [
        "streaming", "obs", "twitch", "gaming", "gamedev",
        "webdev", "javascript", "python", "coding", "programming", "django",
        "bethesda", "elderscrolls", "fantasy", "retrogaming", "retro",
        "pcgaming", "pcgames", "rpg", "dos", "msdos", "90s",
    ]
    tags = ["daggerfall"] + random.sample(random_tags, 5)
    hashtags_text = " ".join([f"#{tag}" for tag in tags])

    text = f"{caption}\n\n{hashtags_text}"

    facets = []
    for tag in tags:
        hashtag = f"#{tag}"
        start = text.find(hashtag)
        if start != -1:
            end = start + len(hashtag)
            facets.append({
                "index": {
                    "byteStart": start,
                    "byteEnd": end
                },
                "features": [{
                    "$type": "app.bsky.richtext.facet#tag",
                    "tag": tag
                }]
            })

    try:
        logger.info("Attempting to post with app.bsky.embed.video format")

        record = {
            "text": text,
            "createdAt": client.get_current_time_iso(),
            "embed": {
                "$type": "app.bsky.embed.video",
                "video": video_blob,
                "alt": "Daggerwalk gameplay clip",
                "aspectRatio": {
                    "width": 16,
                    "height": 9
                }
            }
        }

        if facets:
            record["facets"] = facets

        response = client.com.atproto.repo.create_record(
            data={
                "repo": client.me.did,
                "collection": "app.bsky.feed.post",
                "record": record
            }
        )
        logger.info("Post created successfully")
        return response["uri"], response["cid"]
    
    except Exception as e:
        logger.error(f"Video embed failed: {str(e)}")
        raise


@shared_task
def post_to_bluesky():
    logger.info("Starting Bluesky post process")
    
    # Initialize Bluesky client
    client = Client()
    client.request._client.timeout = httpx.Timeout(30.0)
    try:
        client.login(settings.DAGGERWALK_BLUESKY_HANDLE, settings.DAGGERWALK_BLUESKY_APP_PASSWORD)
        logger.info(f"Logged in as: {settings.DAGGERWALK_BLUESKY_HANDLE}")
    except Exception as e:
        logger.error(f"Failed to login to Bluesky: {str(e)}")
        raise

    # Fetch API data
    try:
        log_data = requests.get(f"{API_BASE_URL}/logs/?ordering=-id").json()['results'][0]
        stats_data = requests.get(f"{API_BASE_URL}/stats/?range=today").json()
        logger.info("Fetched API data successfully")
    except Exception as e:
        logger.error(f"Failed to fetch API data: {str(e)}")
        raise

    # Create and wait for Twitch clip
    try:
        clip_id, clip_data = create_and_wait_for_clip()
        clip_url = f"https://clips.twitch.tv/{clip_id}"
    except Exception as e:
        logger.error(f"Failed to create Twitch clip: {str(e)}")
        raise
    
    video_path = None
    try:
        # Download the video file
        video_path = download_twitch_clip(clip_url)
        
        # Upload video to Bluesky
        video_blob = upload_video_as_blob(client, video_path)
        
        # Generate text content for the post
        caption = generate_bluesky_caption(log_data, stats_data)
        
        # Post video to Bluesky
        uri, cid = post_video_to_bluesky(caption, video_blob, client)

        # Post screenshots as reply
        post_screenshot_reply_to_video(client, uri, cid, log_data)
        
        logger.info("Process completed successfully")
        
    except Exception as e:
        logger.error(f"Process failed: {str(e)}")
        raise
        
    finally:
        # Clean up: remove downloaded video file
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
                # Also try to remove the temp directory if it's empty
                temp_dir = os.path.dirname(video_path)
                if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                    os.rmdir(temp_dir)
                logger.info("Cleanup completed")
            except OSError as e:
                logger.warning(f"Cleanup warning: {str(e)}")  # Ignore cleanup errors


def post_screenshot_reply_to_video(client: Client, uri: str, cid: str, log_data):
    """
    Captures two map screenshots and posts them as a reply to the specified video post.
    """

    screenshots = {
        "region": "region_map.png",
        "world": "world_map.png",
        "quest": "quest.png"
    }

    try:
        # Step 1: Take screenshots
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path=settings.PLAYWRIGHT_CHROMIUM_PATH
            )
            page = browser.new_page()
            page.goto("https://kershner.org/daggerwalk", wait_until="networkidle")

            # World map ready
            page.locator("#worldMapView").wait_for(state="visible", timeout=30000)
            page.locator("#worldMapView").screenshot(path=screenshots["world"])

            # Go to region map
            page.locator(".world-map-link").click()

            region = page.locator("#regionMapView")
            region.wait_for(state="visible", timeout=30000)

            # Wait until at least one non-hidden marker is visible
            region.locator(".log-marker:not(.hidden)").first.wait_for(state="visible", timeout=30000)

            # Give the browser a frame to flush layout/paint
            page.wait_for_function("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")

            region.screenshot(path=screenshots["region"])

            # Take screenshot of the quest section
            quest_element = page.locator(".quests-wrapper").first
            page.add_style_tag(content=".quests-wrapper .quest-title-wrapper a { display: none !important; }")
            quest_element.wait_for(state="visible", timeout=30000)
            quest_element.screenshot(path=screenshots["quest"])

        # Step 2: Upload screenshots
        uploaded = []
        for label, path in screenshots.items():
            with open(path, "rb") as f:
                blob = client.com.atproto.repo.upload_blob(BytesIO(f.read()))

                region = log_data['region']
                if label == "region":
                    alt = f"Daggerfall region map for {region} with markers showing the Walker's progress so far today."
                elif label == "world":
                    alt = f"Daggerfall world map with markers showing the Walker's recent travels.  The Walker is currently in the {region} region."
                elif label == "quest":
                    alt = f"An image of the Walker's current quest featuring art assets from the original Daggerfall game."

                uploaded.append({
                    "image": blob.blob,
                    "alt": alt
                })

        # Step 3: Post reply
        url = "https://kershner.org/daggerwalk"
        text = f"The Walker's recent travels:\n{url}"

        reply_record = {
            "repo": client.me.did,
            "collection": "app.bsky.feed.post",
            "record": {
                "text": text,
                "createdAt": client.get_current_time_iso(),
                "facets": [{
                    "index": {
                        "byteStart": text.index(url),
                        "byteEnd": text.index(url) + len(url)
                    },
                    "features": [{
                        "$type": "app.bsky.richtext.facet#link",
                        "uri": url
                    }]
                }],
                "reply": {
                    "root": {"uri": uri, "cid": cid},
                    "parent": {"uri": uri, "cid": cid}
                },
                "embed": {
                    "$type": "app.bsky.embed.images",
                    "images": uploaded
                }
            }
        }

        client.com.atproto.repo.create_record(data=reply_record)
        logger.info("Screenshot reply posted successfully.")

    except Exception as e:
        logger.error(f"Failed to post screenshot reply: {str(e)}")
        raise

    finally:
        # Step 4: Clean up
        for path in screenshots.values():
            if os.path.exists(path):
                try:
                    os.remove(path)
                    logger.info(f"Deleted screenshot: {path}")
                except Exception as e:
                    logger.warning(f"Failed to delete screenshot {path}: {str(e)}")

@shared_task
def update_all_daggerwalk_caches():
    # Global datasets
    region_data = (
        DaggerwalkLog.objects
        .exclude(region="Ocean")
        .values("region", "region_fk__province")
        .annotate(
            latest_date=Max("created_at"),
            latest_location=Max("location"),
            latest_weather=Max("weather"),
            latest_current_song=Max("current_song"),
        )
        .order_by("-latest_date")
    )
    cache.set("daggerwalk_region_data", list(region_data), timeout=None)

    map_data = get_map_data()
    cache.set("daggerwalk_map_data", map_data, timeout=None)

    latest_log_data = get_latest_log_data()
    cache.set("daggerwalk_latest_log_data", latest_log_data, timeout=None)

    # Stats slices
    for keyword in ['all', 'today', 'yesterday', 'last_7_days', 'this_month']:
        try:
            stats = calculate_daggerwalk_stats(keyword)
            cache.set(f"daggerwalk_stats:{keyword}", stats, timeout=None)
        except Exception:
            pass  # optional: log

    # Current quest (single in_progress)
    current_quest = (
        Quest.objects
        .filter(status="in_progress")
        .select_related("poi", "poi__region")
        .order_by("-created_at")
        .first()
    )
    cache.set("daggerwalk_current_quest", current_quest, timeout=None)

    previous_quests = (
        Quest.objects
        .filter(status="completed")
        .select_related("poi", "poi__region")
        .order_by("-created_at")[:10]
    )
    cache.set("daggerwalk_previous_quests", previous_quests, timeout=None)

    # Leaderboard
    total_leaderboard_rows = 100
    excluded_usernames = ["billcrystals", "daggerwalk", "daggerwalk_bot"]
    leaders_qs = (
        TwitchUserProfile.objects
        .annotate(
            total_xp_value=Coalesce(
                Sum("completed_quests__xp"),
                0,
                output_field=IntegerField()
            ),
            completed_quests_count=Count("completed_quests", distinct=True),
        )
        .filter(total_xp_value__gt=0)
        .exclude(twitch_username__in=excluded_usernames)
        .order_by("-total_xp_value", "twitch_username")[:total_leaderboard_rows]
    )

    leaderboard_data = TwitchUserProfileSerializer(leaders_qs, many=True).data
    cache.set("daggerwalk_leaderboard", leaderboard_data, timeout=None)

    # New map data
    two_weeks_ago = timezone.now() - timedelta(weeks=2)
    logs_qs = DaggerwalkLog.objects.filter(created_at__gte=two_weeks_ago).order_by('-id')
    logs_json = DaggerwalkLogSerializer(logs_qs, many=True).data
    cache.set("daggerwalk_map_logs", logs_json, timeout=None)

    pois_qs = POI.objects.all()
    poi_json = POISerializer(pois_qs, many=True).data
    cache.set("daggerwalk_map_pois", poi_json, timeout=None)
    
    quest_qs = Quest.objects.filter(status="in_progress").select_related("poi", "poi__region")
    quest_json = QuestSerializer(quest_qs, many=True).data
    cache.set("daggerwalk_map_quest", quest_json, timeout=None)

    shape_data = []
    for shape in ProvinceShape.objects.select_related("region"):
        shape_data.append({
            "name": shape.region.name,
            "province": shape.region.province,
            "coordinates": shape.coordinates,
        })
    cache.set("daggerwalk_map_shape_data", shape_data, timeout=None)