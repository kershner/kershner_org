from django.contrib.auth.decorators import user_passes_test
from django.template.response import TemplateResponse
from portfolio.tasks import create_whoosh
from apps.whoosh.forms import WhooshForm
from django.views.generic import View
from apps.whoosh.models import Whoosh
from django.shortcuts import redirect
from django.http import JsonResponse
from django.contrib import messages
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
            return redirect('view-whoosh', whoosh_id=self.form.instance.uniq_id)

        ctx = {
            'form': self.form,
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)


class WhooshViewer(View):
    template = 'whoosh/viewer.html'

    def get(self, request, whoosh_id=None):
        whoosh = Whoosh.objects.filter(uniq_id=whoosh_id).first()
        if not whoosh:
            ctx = {'recent_whooshes': get_recent_whooshes()}
            return TemplateResponse(request, 'whoosh/404.html', ctx)

        ctx = {
            'selected_whoosh': whoosh,
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)

    @staticmethod
    def post(request, whoosh_id):
        whoosh = Whoosh.objects.filter(uniq_id=whoosh_id).first()
        ctx = {
            'processed': whoosh.processed,
        }
        return JsonResponse(ctx)


class AboutWhoosh(View):
    template = 'whoosh/about.html'

    def get(self, request):
        ctx = {
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)


@user_passes_test(lambda u: u.is_superuser)
def reprocess_whoosh(request, whoosh_id):
    whoosh = Whoosh.objects.filter(id=whoosh_id).first()
    create_whoosh.delay(whoosh.id)
    messages.success(request, 'Whoosh id: {} is being reprocessed...'.format(whoosh.id))
    return redirect(whoosh.get_admin_url())


def get_recent_whooshes():
    one_day_ago = timezone.now() - datetime.timedelta(days=1)
    whoosh_limit = 60
    return Whoosh.objects.filter(processed__gte=one_day_ago).order_by('-id').all()[:whoosh_limit]
