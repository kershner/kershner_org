from .base import *

ALLOWED_HOSTS = [
    'www.kershner.org',
    'kershner.org'
]

DEBUG = False
STATIC_URL = 'https://%s/%s/static/' % (AWS_S3_CUSTOM_DOMAIN, AWS_LOCATION)
STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
