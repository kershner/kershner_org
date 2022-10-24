from django.template.response import TemplateResponse
from portfolio.tasks import create_whoosh
from apps.whoosh.forms import WhooshForm
from django.views.generic import View
from apps.whoosh.models import Whoosh
from django.shortcuts import redirect
from django.utils import timezone
import datetime


class WhooshHomeView(View):
    template = "whoosh/home.html"
    form = WhooshForm()

    def get(self, request):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        recent_whooshes = Whoosh.objects.filter(processed__gte=one_day_ago).order_by('-processed').all()
        ctx = {
            'form': self.form,
            'recent_whooshes': recent_whooshes
        }
        return TemplateResponse(request, self.template, ctx)

    def post(self, request):
        self.form = WhooshForm(request.POST, request.FILES)
        if self.form.is_valid():
            self.form.save()
            create_whoosh.delay(self.form.instance.id)
            return redirect('view-whoosh', whoosh_id=self.form.instance.id)

        ctx = {'form': self.form}
        return TemplateResponse(request, self.template, ctx)


class WhooshViewer(View):
    template = 'whoosh/viewer.html'

    def get(self, request, whoosh_id):
        ctx = {'whoosh': Whoosh.objects.filter(id=whoosh_id).first()}
        return TemplateResponse(request, self.template, ctx)
