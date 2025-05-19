from django.conf import settings
from datetime import datetime
from atproto import Client
from io import BytesIO
import requests
import openai
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


def generate_bluesky_caption(log_data):
    openai.api_key = settings.OPENAI_API_KEY

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
        
    max_tokens = 80
    system_prompt = (
        "You are a fantasy chronicler documenting moments from the journey of a figure known as The Walker. "
        "Write a concise 1-2 sentence description of what The Walker is experiencing based on the log data. "
        "Use clear, direct language while varying sentence structure across entries. "
        "Always use the present tense. "
        "Avoid flowery language and unnecessary embellishments. "
        "Always refer to the character as 'The Walker' using they/them pronouns. "
        "Incorporate these elements to enhance your entries: "
        "- Subtly reflect the time of day in your descriptions "
        "- Note small observed details that bring The Walker's world alive "
        "- Vary the emotional tone based on weather, season, and surroundings "
        "- Don't discuss the Walker's motivation or purpose "
        f"Keep entries complete and under the {max_tokens - 10} token limit. No hashtags or meta-commentary."
    )

    user_prompt = (
        f"Region: {log_data['region']}\n"
        f"Location: {log_data['location']}\n"
        f"Province: {log_data['region_fk']['province']}\n"
        f"Climate: {log_data['region_fk']['climate']}\n"
        f"Weather: {log_data['weather']}\n"
        f"Season: {log_data['season']}\n"
        f"Date and Time: {log_data['date']}\n"
        f"Time of Day: {get_time_of_day(log_data['date'])}"
    )

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=1.0,
        max_tokens=max_tokens,
    )

    return response['choices'][0]['message']['content'].strip()


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

    log_data = requests.get(f"{API_BASE_URL}/logs/?ordering=-id&limit=1").json()['results'][0]

    clip_id, clip_data = create_and_wait_for_clip()
    clip_url = f"https://clips.twitch.tv/{clip_id}"
    thumbnail_url = clip_data['thumbnail_url']
    thumb_blob = upload_thumbnail_as_blob(client, thumbnail_url)

    caption = generate_bluesky_caption(log_data)
    post_clip_to_bluesky(caption, clip_url, thumb_blob, client)
