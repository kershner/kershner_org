from django.shortcuts import render
from django.conf import settings
import requests
import time



def philomania(request):
    base_s3_url = '{}/philomania'.format(settings.BASE_S3_URL)
    page_size = 30

    # Make request to Unsplash API for random photos from collection
    random_photos_url = '{}photos/random?client_id={}&collections={}&count={}'.format(settings.UNSPLASH_API_URL,
                                                                                      settings.UNSPLASH_ACCESS_KEY,
                                                                                      settings.PHILOMANIA_BACKGROUNDS_COLLECTION_ID,
                                                                                      page_size)

    unsplash_photo_urls = []
    try:
        random_photos_response = requests.get(random_photos_url).json()
        for entry in random_photos_response:
            unsplash_photo_urls.append(entry['urls']['regular'])
    except Exception as e:
        print(e)

    template_vars = {
        'base_s3_url': base_s3_url,
        'timestamp': time.time(),
        'unsplash_photo_urls': unsplash_photo_urls
    }
    return render(request, 'philomania/philomania.html', template_vars)