from __future__ import absolute_import
from celery.schedules import crontab
from django.conf import settings
from celery import Celery
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'site_config.settings.prod')
os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')

app = Celery('kershner')

app.config_from_object('django.conf:settings')
app.conf.worker_cancel_long_running_tasks_on_connection_loss = True  # Prevents stuck tasks if Redis disconnects

app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

app.conf.beat_schedule = {
    'update_daggerwalk_stats_every_5_minutes': {
        'task': 'apps.daggerwalk.tasks.update_daggerwalk_stats_cache',
        'schedule': crontab(minute='*/5'),
    },
    'update_current_region_logs_cache_every_5_minutes': {
        'task': 'apps.daggerwalk.tasks.update_daggerwalk_current_region_logs_cache',
        'schedule': crontab(minute='*/5'),
    },
    'daggerwalk-post-to-bluesky-morning': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
        'schedule': crontab(minute=10, hour=11),  # 11:10 AM Eastern
    },
    'daggerwalk-post-to-bluesky-evening': {
        'task': 'apps.daggerwalk.tasks.post_to_bluesky',
        'schedule': crontab(minute=27, hour=19),  # 7:27 PM Eastern
    },
}
