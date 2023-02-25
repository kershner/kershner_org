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
# See https://docs.djangoproject.com/en/2.1/howto/deployment/checklist/
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = PARAMETERS['csrf_secret_key']

# Application definition
INSTALLED_APPS = [
    'apps.song',
    'apps.project',
    'apps.whoosh',
    'apps.ai_quiz',
    'storages',
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

TEMPLATE_PATH = os.path.join(BASE_DIR, 'templates')
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [TEMPLATE_PATH],
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
# https://docs.djangoproject.com/en/2.1/ref/settings/#databases
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'kershner.db'),
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'django_cache',
    }
}

# Password validation
# https://docs.djangoproject.com/en/2.1/ref/settings/#auth-password-validators
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
# https://docs.djangoproject.com/en/2.1/topics/i18n/
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/New_York'
USE_I18N = True
USE_L10N = True
USE_TZ = True
TIME_INPUT_FORMATS = ['%I:%M %p']

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/2.0/howto/static-files/
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

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
PROJECTS_PER_PAGE = 3
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
QUIZ_LIMIT_PER_HOUR = 3
