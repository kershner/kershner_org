from django.template.response import TemplateResponse
from portfolio.tasks import create_whoosh
from apps.whoosh.forms import WhooshForm
from django.views.generic import View
from apps.whoosh.models import Whoosh
from django.shortcuts import redirect
from django.http import JsonResponse
from django.utils import timezone
import datetime


class WhooshHomeView(View):
    template = "whoosh/home.html"
    form = WhooshForm()

    def get(self, request):
        ctx = {
            'form': self.form,
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)

    def post(self, request):
        self.form = WhooshForm(request.POST, request.FILES)

        if self.form.is_valid():
            self.form.save()
            create_whoosh.delay(self.form.instance.id)
            return redirect('view-whoosh', whoosh_id=self.form.instance.id)

        ctx = {
            'form': self.form,
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)


class WhooshViewer(View):
    template = 'whoosh/viewer.html'

    def get(self, request, whoosh_id):
        ctx = {
            'selected_whoosh': Whoosh.objects.filter(id=whoosh_id).first(),
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)

    @staticmethod
    def post(request, whoosh_id):
        whoosh = Whoosh.objects.filter(id=whoosh_id).first()
        ctx = {
            'processed': whoosh.processed,
        }
        return JsonResponse(ctx)


def get_recent_whooshes():
    one_day_ago = timezone.now() - datetime.timedelta(days=1)
    whoosh_limit = 60
    return Whoosh.objects.filter(processed__gte=one_day_ago).order_by('-id').all()[:whoosh_limit]
