from django.template.loader import get_template
from django.views.generic import View
from django.shortcuts import render

class PublicApiExplorerHomeView(View):
    template_path = 'react-apps/public-api-explorer/dist/index.html'

    def get(self, request):
        ctx = {}
        return render(request, self.template_path, ctx)
