from django.conf import settings
from django import template

register = template.Library()


@register.simple_tag
def settings_value(name):
    return getattr(settings, name, '')


@register.simple_tag(takes_context=True)
def is_mobile(context):
    request = context['request']
    if not hasattr(request, '_is_mobile'):
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        mobile_keywords = {'iphone', 'android', 'ipad', 'mobile', 'windows phone', 'opera mini', 'blackberry'}
        for keyword in mobile_keywords:
            if keyword in user_agent:
                request._is_mobile = True
                break
        else:
            request._is_mobile = False

    return request._is_mobile

