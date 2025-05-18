from __future__ import absolute_import
from celery.schedules import crontab
from django.conf import settings
from celery import Celery
import os


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'site_config.settings.prod')
os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')
app = Celery('kershner')
app.config_from_object('django.conf:settings')
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)


app.conf.beat_schedule = {
    'post-to-bluesky-morning': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
        'schedule': crontab(minute=53, hour=15),  # 11:53 AM Eastern
    },
    # 'post-to-bluesky-evening': {
    #     'task': 'apps.daggerwalk.tasks.post_to_bluesky',
    #     'schedule': crontab(minute=30, hour=21),  # 9:30 PM Eastern
    # },
}

app.conf.timezone = 'UTC'
app.conf.enable_utc = True
