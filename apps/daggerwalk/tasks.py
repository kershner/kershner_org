from apps.daggerwalk.models import DaggerwalkLog
from django.conf import settings
from celery import shared_task
from datetime import datetime
from atproto import Client
from io import BytesIO
import tempfile
import requests
import logging
import random
import yt_dlp
import openai
import time
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


API_BASE_URL = 'https://kershner.org/api/daggerwalk'
TWITCH_CLIP_URL = 'https://api.twitch.tv/helix/clips'


def create_and_wait_for_clip():
    logger.info("Starting Twitch clip creation process")
    
    token = settings.DAGGERWALK_TWITCH_REFRESH_TOKEN
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

    region_string = f"Walking through the {climate} wilderness of {region_name} in {region_province}"
    weather_string = f"It's a {weather} {time_of_day} in {log_data['season']}"
    traveled_string = f"The Walker has traveled {stats_data['totalDistanceKm']}km in {stats_data['formattedPlaytime']} so far today"
    poi_string = ""
    if poi_data:
        poi_name = poi_data['name']
        poi_emoji = poi_data['emoji']
        poi_string = f" {poi_name} is nearby."

    # TODO - handle "Ocean" region
    text = f"{date_without_time}. {region_string}.{poi_string} {weather_string}. {traveled_string}."
    return text


def suggest_discoverability_hashtags() -> list[str]:
    prompt = """
You are assisting with a Bluesky post for a Twitch clip featuring retro gameplay from The Elder Scrolls II: Daggerfall.
Suggest 5 popular, high-discoverability hashtags that are widely used across gaming and streaming communities. Focus on tags relevant to retro games, Twitch culture, and Elder Scrolls fandom.
Do not include the following hashtags: daggerfall, elderscrolls, twitch. Avoid niche, game-specific, or low-traffic tags. Do not include the '#' symbol. Return only the hashtags, separated by commas.
"""
    openai.api_key = settings.OPENAI_API_KEY
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=30,
            temperature=0.7,
        )
        tag_text = response['choices'][0]['message']['content']
        return [tag.strip() for tag in tag_text.split(",") if tag.strip()]
    except Exception as e:
        logger.warning(f"Hashtag suggestion failed: {e}")
        return []


def post_video_to_bluesky(caption, video_blob, client: Client):
    logger.info("Preparing Bluesky post")

    base_tags = ["daggerfall", "elderscrolls", "twitch"]
    extra_tags = suggest_discoverability_hashtags()
    extra_tags = [tag for tag in extra_tags if tag not in base_tags]
    random_extra_tags = random.sample(extra_tags, min(2, len(extra_tags)))
    hashtag_strings = base_tags + random_extra_tags
    hashtags_text = " ".join([f"#{tag}" for tag in hashtag_strings])

    max_text_len = 300 - len(hashtags_text) - 2  # For spacing/newlines
    if len(caption) > max_text_len:
        caption = caption[:max_text_len - 1].rstrip() + "…"

    text = f"{caption}\n\n{hashtags_text}"

    facets = []
    for tag in hashtag_strings:
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

    except Exception as e:
        logger.error(f"Video embed failed: {str(e)}")
        raise


@shared_task
def post_to_bluesky():
    logger.info("Starting Bluesky post process")
    
    # Initialize Bluesky client
    client = Client()
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
        post_video_to_bluesky(caption, video_blob, client)
        
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