"""
For more information on this file, see
https://docs.djangoproject.com/en/2.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/2.1/ref/settings/
"""
from utility import util
import os

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PARAMETERS = util.get_parameters()
MAIN_APP_NAME = 'kershner'

# Quick-start development settings - unsuitable for production
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = PARAMETERS['csrf_secret_key']

# Application definition
INSTALLED_APPS = [
    'apps.song',
    'apps.project',
    'apps.whoosh',
    'apps.ai_quiz',
    'apps.color_doodle',
    'apps.daggerwalk',
    'storages',
    'django_filters',
    'rest_framework',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles'
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'kershner.urls'

DJANGO_TEMPLATE_PATH = os.path.join(BASE_DIR, 'templates')
STATIC_DIR_PATH = os.path.join(BASE_DIR, 'static')
TEMPLATE_DIRS = [DJANGO_TEMPLATE_PATH, STATIC_DIR_PATH]
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': TEMPLATE_DIRS,
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
            'libraries': {
                'kershner_tags': 'kershner.templatetags'
            }
        },
    },
]

WSGI_APPLICATION = 'kershner.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'kershner.db'),
    }
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/New_York'
USE_I18N = True
USE_L10N = True
USE_TZ = True
TIME_INPUT_FORMATS = ['%I:%M %p']

# Static files (CSS, JavaScript, Images)
STATICFILES_DIRS = [
    STATIC_DIR_PATH
]
STATIC_ROOT = os.path.join(BASE_DIR, 'static/collectstaticfiles')

# AWS Config
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}
AWS_STORAGE_BUCKET_NAME = PARAMETERS['s3_bucket']
AWS_ACCESS_KEY_ID = PARAMETERS['aws_key']
AWS_SECRET_ACCESS_KEY = PARAMETERS['aws_secret']
AWS_REGION = PARAMETERS['aws_region']
AWS_S3_CUSTOM_DOMAIN = '{}/{}'.format(AWS_REGION, AWS_STORAGE_BUCKET_NAME)
AWS_LOCATION = 'static'
AWS_DEFAULT_ACL = 'public-read'
CLOUDFRONT_DOMAIN = PARAMETERS['cloudfront_domain']
MEDIAFILES_LOCATION = MAIN_APP_NAME
MEDIA_URL = 'https://%s/%s/' % (AWS_S3_CUSTOM_DOMAIN, MEDIAFILES_LOCATION)
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
BASE_S3_URL = 'https://{}/{}'.format(CLOUDFRONT_DOMAIN, AWS_LOCATION)
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.TemporaryFileUploadHandler']
BASE_CLOUDFRONT_URL = f'https://{CLOUDFRONT_DOMAIN}/{AWS_LOCATION}/'

# Misc site stuff
PROJECTS_PER_PAGE = 100
FILE_UPLOAD_LIMIT_MB = 20
EC2_IPS = PARAMETERS['ec2_ips'].split(',')
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# Unsplash stuff
UNSPLASH_ACCESS_KEY = PARAMETERS['unsplash_access_key']
UNSPLASH_SECRET_KEY = PARAMETERS['unsplash_secret_key']
UNSPLASH_API_URL = 'https://api.unsplash.com/'
PHILOMANIA_BACKGROUNDS_COLLECTION_ID = 827743

# Redis config
REDIS_HOST = PARAMETERS['redis_host']
REDIS_PORT = PARAMETERS['redis_port']

# Celery config
CELERY_TIMEZONE = 'America/New_York'
CELERY_ENABLE_UTC = False
BROKER_URL = 'redis://{}:{}'.format(PARAMETERS['redis_host'], PARAMETERS['redis_port'])
CELERY_RESULT_BACKEND = 'redis://{}:{}'.format(PARAMETERS['redis_host'], PARAMETERS['redis_port'])
BROKER_TRANSPORT = 'redis'

# [ominous whoosher]
WHOOSH_LIMIT_PER_HOUR = 5

# Steam
STEAM_API_KEY = PARAMETERS['steam_api_key']

# OpenAI
OPENAI_API_KEY = PARAMETERS['openai_api_key']

# AI Quizzes
QUIZ_LIMIT_PER_DAY = 10

REST_FRAMEWORK = {
    # Use Django's standard `django.contrib.auth` permissions,
    # or allow read-only access for unauthenticated users.
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly'
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# Google reCaptcha
CAPTCHA_V2_SITE_KEY = PARAMETERS['captcha_v2_site_key']
CAPTCHA_V2_SECRET_KEY = PARAMETERS['captcha_v2_secret_key']

# Daggerwalk
DAGGERWALK_API_KEY = PARAMETERS['daggerwalk_api_key']
DAGGERWALK_BLUESKY_HANDLE = PARAMETERS['daggerwalk_bluesky_handle']
DAGGERWALK_BLUESKY_APP_PASSWORD = PARAMETERS['daggerwalk_bluesky_app_password']
DAGGERWALK_TWITCH_CLIENT_ID = PARAMETERS['daggerwalk_twitch_client_id']
DAGGERWALK_TWITCH_SECRET = PARAMETERS['daggerwalk_twitch_secret']
DAGGERWALK_TWITCH_BROADCASTER_ID = PARAMETERS['daggerwalk_twitch_broadcaster_id']
DAGGERWALK_TWITCH_REFRESH_TOKEN = PARAMETERS['daggerwalk_twitch_refresh_token']
