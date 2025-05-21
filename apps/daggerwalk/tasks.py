from apps.daggerwalk.models import DaggerwalkLog
from django.conf import settings
from datetime import datetime
from atproto import Client
from io import BytesIO
import requests
import time


API_BASE_URL = 'https://kershner.org/api/daggerwalk'
TWITCH_CLIP_URL = 'https://api.twitch.tv/helix/clips'


def create_and_wait_for_clip():
    token = settings.DAGGERWALK_TWITCH_REFRESH_TOKEN
    client_id = settings.DAGGERWALK_TWITCH_CLIENT_ID
    broadcaster_id = settings.DAGGERWALK_TWITCH_BROADCASTER_ID
    

    headers = {'Authorization': f'Bearer {token}', 'Client-Id': client_id}
    r = requests.post(TWITCH_CLIP_URL, headers=headers, params={
        'broadcaster_id': broadcaster_id
    })
    clip_id = r.json()['data'][0]['id']

    for _ in range(10):
        r = requests.get(TWITCH_CLIP_URL, headers=headers, params={'id': clip_id})
        data = r.json().get('data')
        if data and data[0].get('url'):
            return clip_id, data[0]
        time.sleep(3)

    raise Exception("Clip URL never became available")


def upload_thumbnail_as_blob(client: Client, image_url: str):
    r = requests.get(image_url)
    r.raise_for_status()
    upload_response = client.com.atproto.repo.upload_blob(BytesIO(r.content))
    return upload_response.blob


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


def post_clip_to_bluesky(caption, clip_url, thumb_blob, client: Client):
    # Define hashtags
    hashtag_strings = ["daggerfall", "elderscrolls", "twitch"]
    hashtags_text = " ".join([f"#{tag}" for tag in hashtag_strings])
    
    # Calculate max text length
    max_text_len = 300 - len(hashtags_text) - 2
    if len(caption) > max_text_len:
        caption = caption[:max_text_len - 1].rstrip() + "…"
    
    # Create the full text with hashtags
    text = f"{caption}\n\n{hashtags_text}"
    
    # Create facets for clickable hashtags
    facets = []
    
    # Find positions of hashtags and add them to facets
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
    
    # Create the post record
    record = {
        "text": text,
        "createdAt": client.get_current_time_iso(),
        "embed": {
            "$type": "app.bsky.embed.external",
            "external": {
                "uri": clip_url,
                "title": "Daggerwalk - endlessly walking through Daggerfall",
                "description": caption,
                "thumb": thumb_blob,
            }
        }
    }
    
    # Add facets to the record if there are any
    if facets:
        record["facets"] = facets
    
    # Post to Bluesky
    client.com.atproto.repo.create_record(
        data={
            "repo": client.me.did,
            "collection": "app.bsky.feed.post",
            "record": record
        }
    )


def post_to_bluesky():
    client = Client()
    client.login(settings.DAGGERWALK_BLUESKY_HANDLE, settings.DAGGERWALK_BLUESKY_APP_PASSWORD)

    log_data = requests.get(f"{API_BASE_URL}/logs/?ordering=-id").json()['results'][0]
    stats_data = requests.get(f"{API_BASE_URL}/stats/?range=today").json()

    # Create and wait for Twitch clip
    clip_id, clip_data = create_and_wait_for_clip()
    clip_url = f"https://clips.twitch.tv/{clip_id}"
    thumbnail_url = clip_data['thumbnail_url']
    thumb_blob = upload_thumbnail_as_blob(client, thumbnail_url)

    # Generate text content for the post
    caption = generate_bluesky_caption(log_data, stats_data)
    
    # Post to Bluesky
    post_clip_to_bluesky(caption, clip_url, thumb_blob, client)
