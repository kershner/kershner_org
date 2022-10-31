from django.contrib.auth.decorators import user_passes_test
from apps.whoosh.forms import WhooshForm, DoppelgangerForm
from django.template.response import TemplateResponse
from portfolio.tasks import create_whoosh
from django.views.generic import View
from apps.whoosh.models import Whoosh
from django.shortcuts import redirect
from django.http import JsonResponse
from django.contrib import messages
from django.utils import timezone
from utility import util
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

        doppelganger_form = DoppelgangerForm(instance=whoosh)

        ctx = {
            'doppelganger_form': doppelganger_form,
            'doppelgangers': Whoosh.objects.filter(doppelganger_id=whoosh.id).order_by('-id').all(),
            'selected_whoosh': whoosh,
            'recent_whooshes': get_recent_whooshes()
        }
        return TemplateResponse(request, self.template, ctx)

    @staticmethod
    def post(request, whoosh_id):
        whoosh = Whoosh.objects.filter(uniq_id=whoosh_id).first()
        ctx = {
            'error': whoosh.error,
            'processed': whoosh.processed,
        }
        return JsonResponse(ctx)


class DoppelgangerSubmit(View):
    @staticmethod
    def post(request, whoosh_id=None):
        whoosh = Whoosh.objects.filter(uniq_id=whoosh_id).first()
        doppelganger_form = DoppelgangerForm(request.POST)

        if doppelganger_form.is_valid():
            new_doppleganger_settings = {
                'whoosh_type': doppelganger_form.cleaned_data['whoosh_type'],
                'credit_text': doppelganger_form.cleaned_data['credit_text'],
                'mute_source': doppelganger_form.cleaned_data['mute_source'],
                'black_and_white': doppelganger_form.cleaned_data['black_and_white'],
                'portrait': doppelganger_form.cleaned_data['portrait'],
                'slow_motion': doppelganger_form.cleaned_data['slow_motion'],
                'slow_zoom': doppelganger_form.cleaned_data['slow_zoom']
            }
            new_doppelganger_settings_hash = util.hash_data_structure(new_doppleganger_settings)
            existing_doppelganger = Whoosh.objects.filter(settings_hash=new_doppelganger_settings_hash).first()
            if not existing_doppelganger:
                new_doppelganger = Whoosh(**doppelganger_form.cleaned_data)
                new_doppelganger.source_video.name = whoosh.source_video.name
                new_doppelganger.doppelganger = whoosh
                new_doppelganger.save()

                create_whoosh.delay(new_doppelganger.id)
                return redirect('view-whoosh', whoosh_id=new_doppelganger.uniq_id)

            # flash message that a doppelganger already existed
            return redirect('view-whoosh', whoosh_id=existing_doppelganger.uniq_id)


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
