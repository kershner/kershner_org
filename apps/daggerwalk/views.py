from django.views.generic import View
from django.shortcuts import render, HttpResponse

class DaggerwalkHomeView(View):
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        ctx = {}
        return render(request, self.template_path, ctx)
