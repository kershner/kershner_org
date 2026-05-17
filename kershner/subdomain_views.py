from django.http import Http404, HttpResponse
from django.shortcuts import redirect


def tyler_home(request):
    return redirect('home')


def tod_home(request):
    redirect_url = 'https://www.wargamevault.com/en/publisher/7444/tod-kershner-s-games'
    return redirect(redirect_url)


def another_home(request):
    return HttpResponse("Another subdomain homepage")


SUBDOMAIN_VIEWS = {
    "tyler": tyler_home,
    "tod": tod_home,
}


def subdomain_home(request):
    view_func = SUBDOMAIN_VIEWS.get(request.subdomain)

    if not view_func:
        raise Http404

    return view_func(request)