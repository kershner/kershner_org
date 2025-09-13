from django.http import HttpResponseForbidden, HttpResponseRedirect
from django.views.decorators.http import require_POST
from django.core.cache import cache

@require_POST
def clear_cache_view(request):
    if not request.user.is_superuser:
        return HttpResponseForbidden()
    cache.clear()
    return HttpResponseRedirect(request.META.get("HTTP_REFERER", "/admin/"))
