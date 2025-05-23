from __future__ import absolute_import
from celery.schedules import crontab
from django.conf import settings
from celery import Celery
import os

CELERY_TIMEZONE = 'UTC'

CELERY_BEAT_SCHEDULE = {
    'daggerwalk-post-to-bluesky-morning': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
        'schedule': crontab(minute=0, hour=15),  # 10:00 AM EST == 15:00 UTC
    },
    'daggerwalk-post-to-bluesky-evening': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
        'schedule': crontab(minute=48, hour=0),  # 7:48 PM EST == 00:48 UTC
    },
}

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'site_config.settings.prod')
os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')
app = Celery('kershner')
app.config_from_object('django.conf:settings')
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)
