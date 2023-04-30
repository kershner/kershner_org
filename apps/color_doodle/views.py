from django.template.response import TemplateResponse
from django.views.generic.base import ContextMixin
from django.views.generic import View


class BaseDoodleView(ContextMixin):
    def get_context_data(self, **kwargs):
        ctx = super(BaseDoodleView, self).get_context_data(**kwargs)
        return ctx


class DoodleHomeView(BaseDoodleView, View):
    template = 'color_doodle_dist/color_doodle_index.html'

    def get(self, request):
        return TemplateResponse(request, self.template, self.get_context_data())
