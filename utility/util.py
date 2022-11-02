from django.conf import settings
from uuid import uuid4
import logging
import hashlib
import boto3
import json
import os


def get_parameters():
    # Load params from JSON file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = os.path.join(base_dir) + '/site_config'
    with open(config_path + '/parameters.json') as f:
        params = json.load(f)
        return params


def get_s3_client():
    params = get_parameters()
    return boto3.client(
        's3',
        aws_access_key_id=params['aws_key'],
        aws_secret_access_key=params['aws_secret'],
    )


def remove_key_from_s3(s3_key):
    logging.info('About to delete S3 Key: {}...'.format(s3_key))
    params = get_parameters()
    s3 = get_s3_client()
    response = s3.delete_object(
        Bucket=params['s3_bucket'],
        Key=s3_key
    )
    logging.info(response)


def get_random_s3_key_for_upload(path, filename, uniq_id=None):
    ext = filename.split('.')[-1]
    name = uniq_id if uniq_id else uuid4().hex
    new_filename = '{}.{}'.format(name, ext)
    s3_key = os.path.join(path, new_filename)
    return s3_key


def file_size_validation(value):
    limit = settings.FILE_UPLOAD_LIMIT_MB * 1024 * 1024  # 20 MB
    return value < limit


def hash_data_structure(data):
    return hashlib.md5(json.dumps(data, sort_keys=True).encode('utf-8')).hexdigest()
