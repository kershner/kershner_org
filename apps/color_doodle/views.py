from django.template.response import TemplateResponse
from django.views.generic.base import ContextMixin
from django.template.loader import get_template
from django.views.generic import View


class BaseDoodleView(ContextMixin):
    def get_context_data(self, **kwargs):
        ctx = super(BaseDoodleView, self).get_context_data(**kwargs)
        return ctx


class DoodleHomeView(BaseDoodleView, View):
    template_path = 'react-apps/colorDoodle/color_doodle_dist/index.html'
    template = get_template(template_path)

    def get(self, request):
        return TemplateResponse(request, self.template, self.get_context_data())
