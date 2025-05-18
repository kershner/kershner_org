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

    def is_night_time(date_str):
        # Extract the time portion at the end (e.g., "22:52:08")
        try:
            time_part = date_str.strip().split(",")[-1].strip()
            t = datetime.strptime(time_part, "%H:%M:%S").time()
            return t >= datetime.strptime("18:00:00", "%H:%M:%S").time() or t < datetime.strptime("06:00:00", "%H:%M:%S").time()
        except Exception:
            return False

    system_prompt = (
        "You are a fantasy chronicler documenting moments from the journey of a figure known only as The Walker. "
        "Given structured log data from his travels, write a concise 1–2 sentence description of what The Walker is doing or experiencing. "
        "Use clear, objective language — avoid flowery or poetic phrasing. "
        "Do not include hashtags or commentary. "
        "Always refer to the character as 'The Walker' with the pronoun 'they/them'. "
        "If the 'Night' field is 'Yes', describe the setting as taking place at night."
    )

    user_prompt = (
        f"Region: {log_data['region']}\n"
        f"Location: {log_data['location']}\n"
        f"Province: {log_data['region_fk']['province']}\n"
        f"Climate: {log_data['region_fk']['climate']}\n"
        f"Weather: {log_data['weather']}\n"
        f"Season: {log_data['season']}\n"
        f"Date and Time: {log_data['date']}\n"
        f"Song: {log_data['current_song']}\n"
        f"Night: {'Yes' if is_night_time(log_data['date']) else 'No'}"
    )

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=1.0,
        max_tokens=60,
    )

    return response['choices'][0]['message']['content'].strip()


def post_clip_to_bluesky(caption, clip_url, thumb_blob, client: Client):
    hashtags = "#daggerfall #elderscrolls"
    max_text_len = 300 - len(hashtags) - 2
    if len(caption) > max_text_len:
        caption = caption[:max_text_len - 1].rstrip() + "…"
    text = f"{caption}\n\n{hashtags}"

    client.com.atproto.repo.create_record(
        data={
            "repo": client.me.did,
            "collection": "app.bsky.feed.post",
            "record": {
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
