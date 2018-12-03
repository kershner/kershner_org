from django.shortcuts import render


def home(request):
    template_vars = {
        'title': 'shitter'
    }
    return render(request, 'home.html', template_vars)
