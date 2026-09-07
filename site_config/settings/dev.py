from .base import *


DEBUG = True
STATIC_URL = '/static/'
ALLOWED_HOSTS = [
    '*'
]
BASE_S3_URL = '/static'

# Keep development jobs and their results on the local Redis instance even if
# shared parameter values point elsewhere.
BROKER_URL = 'redis://127.0.0.1:6379'
CELERY_RESULT_BACKEND = 'redis://127.0.0.1:6379'
