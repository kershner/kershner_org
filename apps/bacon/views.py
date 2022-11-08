from django.shortcuts import render
from django.conf import settings
from utility import util
import random


def bacon(request):
    bucket = 'baconthedog'
    base_s3_url = 'https://{}.{}'.format(bucket, settings.AWS_REGION)

    s3_client = util.get_s3_client()
    response = s3_client.list_objects_v2(Bucket='{}'.format(bucket))
    s3_keys = [entry['Key'] for entry in response['Contents']]
    random.shuffle(s3_keys)

    ctx = {'base_s3_url': base_s3_url, 's3_keys': s3_keys}
    return render(request, 'bacon/bacon.html', ctx)
