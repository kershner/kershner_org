from uuid import uuid4
import json
import os


def get_parameters():
    # Load params from JSON file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = os.path.join(base_dir) + '/site_config'
    with open(config_path + '/parameters.json') as f:
        params = json.load(f)
        return params


def get_random_s3_key_for_upload(path, filename):
    ext = filename.split('.')[-1]
    new_filename = '{}.{}'.format(uuid4().hex, ext)
    s3_key = os.path.join(path, new_filename)
    return s3_key
