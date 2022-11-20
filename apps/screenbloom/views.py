from django.template import Context, Template
from django.http import HttpResponse
from django.conf import settings
import requests


def screenbloom_landing(request):
    base_s3_url = 'https://kershner-misc.s3.us-west-2.amazonaws.com/screenbloom_com'
    ctx = {'base_s3_url': base_s3_url}

    template_url = f'{settings.BASE_CLOUDFRONT_URL}screenbloom/landing.html'
    template_response = requests.get(template_url)
    template = Template(template_response.text)
    context = Context(ctx)
    return HttpResponse(template.render(context))