from __future__ import absolute_import
from celery.schedules import crontab
from django.conf import settings
from celery import Celery
import os

CELERY_TIMEZONE = 'UTC'

CELERY_BEAT_SCHEDULE = {
    'daggerwalk-post-to-bluesky-morning': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
         'schedule': crontab(minute=10, hour=15),  # 11:10 AM EDT
    },
    'daggerwalk-post-to-bluesky-evening': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
        'schedule': crontab(minute=55, hour=23),  # 7:55 PM EDT
    },
}

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'site_config.settings.prod')
os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')
app = Celery('kershner')
app.config_from_object('django.conf:settings')
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)
