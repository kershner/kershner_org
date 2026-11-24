from django.shortcuts import render
from django.views.decorators.cache import cache_page


# Add or edit each channel's social links here: (label, URL).
CHANNELS = [
    {'id': 'daggerwalk', 'name': 'Daggerwalk', 'links': [
        ('Bluesky', 'https://bsky.app/profile/daggerwalk.bsky.social'),
        ('Threads', 'https://www.threads.com/@daggerwalk'),
        ('GitHub', 'https://github.com/kershner/daggerwalk'),
    ]},
    {'id': 'nomanswalk', 'name': "No Man's Walk", 'links': [
        ('Bluesky', 'https://bsky.app/profile/nomanswalk.bsky.social'),
        ('Threads', 'https://www.threads.com/@nomanswalk'),
        ('GitHub', 'https://github.com/kershner/nomanswalk'),
    ]},
    {'id': 'grandtheftwalk', 'name': 'Grand Theft Walk', 'links': []},
]


@cache_page(60 * 60 * 24 * 30)  # 30 days
def gamewalkin(request):
    return render(request, 'gamewalkin/index.html', {'channels': CHANNELS})
