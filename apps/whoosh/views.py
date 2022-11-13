from django.contrib.auth.decorators import user_passes_test
from apps.whoosh.forms import WhooshForm, DoppelgangerForm
from django.template.response import TemplateResponse
from django.views.generic.base import ContextMixin
from apps.whoosh.tasks import process_whoosh
from django.views.generic import View
from apps.whoosh.models import Whoosh
from django.shortcuts import redirect
from django.http import JsonResponse
from django.contrib import messages
from django.utils import timezone
from django.conf import settings
from utility import util
import datetime


class WhooshContentMixin(ContextMixin):
    whoosh_limit = 60

    def get_context_data(self, **kwargs):
        ctx = super(WhooshContentMixin, self).get_context_data(**kwargs)
        ctx['recent_whooshes'] = self.get_recent_whooshes()
        ctx['saved_whooshes'] = self.get_saved_whooshes()
        return ctx

    def get_recent_whooshes(self):
        expiration = timezone.now() - datetime.timedelta(days=settings.WHOOSH_EXPIRATION_DAYS)
        return Whoosh.objects.filter(processed__gte=expiration, saved=False).order_by('-id').all()[:self.whoosh_limit]


    def get_saved_whooshes(self):
        return Whoosh.objects.filter(saved=True, processed__isnull=False).order_by('-id').all()[:self.whoosh_limit]


class WhooshesRemainingMixin(ContextMixin):
    def get_context_data(self, **kwargs):
        ctx = super(WhooshesRemainingMixin, self).get_context_data(**kwargs)

        one_hour_ago = timezone.now() - datetime.timedelta(hours=1)
        user_ip = util.get_client_ip(self.request)
        whooshes_by_user = Whoosh.objects.filter(ip=user_ip, created__gte=one_hour_ago).count()

        whooshes_remaining = 0
        if whooshes_by_user < settings.WHOOSH_LIMIT_PER_HOUR:
            whooshes_remaining = settings.WHOOSH_LIMIT_PER_HOUR - whooshes_by_user

        ctx['whooshes_per_hour'] = settings.WHOOSH_LIMIT_PER_HOUR
        ctx['whooshes_remaining'] = whooshes_remaining
        return ctx

class BaseWhooshView(WhooshesRemainingMixin, WhooshContentMixin, View):
    not_found_template = 'whoosh/404.html'
    form = WhooshForm()

    def get_context_data(self, **kwargs):
        ctx = super(BaseWhooshView, self).get_context_data(**kwargs)
        ctx['form'] = self.form
        return ctx


class WhooshHomeView(BaseWhooshView):
    template = 'whoosh/home.html'
    form = WhooshForm()

    def get(self, request):
        return TemplateResponse(request, self.template, self.get_context_data())

    def post(self, request):
        self.form = WhooshForm(request.POST, request.FILES)

        if self.form.is_valid():
            new_whoosh = self.form.save(commit=False)
            new_whoosh.ip = util.get_client_ip(request)
            new_whoosh.save()

            process_whoosh.delay(new_whoosh.id)
            return redirect('view-whoosh', whoosh_id=new_whoosh.uniq_id)

        return TemplateResponse(request, self.template, self.get_context_data())


class WhooshViewer(BaseWhooshView):
    template = 'whoosh/viewer.html'
    form = DoppelgangerForm()

    def get(self, request, whoosh_id=None):
        whoosh = Whoosh.objects.filter(uniq_id=whoosh_id).first()
        if not whoosh:
            return TemplateResponse(request, self.not_found_template, self.get_context_data())

        self.form = DoppelgangerForm(instance=whoosh)
        earliest_doppel = whoosh.get_doppelgangers().last()
        if earliest_doppel.expired:
            self.form = None

        whoosh_expiration = whoosh.created + datetime.timedelta(days=settings.WHOOSH_EXPIRATION_DAYS)
        expiration_days = abs((timezone.now() - whoosh_expiration).days)

        ctx = self.get_context_data()
        ctx['selected_whoosh'] = whoosh
        ctx['expiration_days'] = expiration_days
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
    form = DoppelgangerForm()

    def post(self, request, whoosh_id=None):
        whoosh = Whoosh.objects.filter(uniq_id=whoosh_id).first()
        self.form = DoppelgangerForm(request.POST)

        if self.form.is_valid():
            parent_doppelganger = whoosh.doppelganger if whoosh.doppelganger else whoosh

            # Check if a doppelganger already exists with these settings
            new_doppelganger = Whoosh(**self.form.cleaned_data)
            new_doppelganger.doppelganger = parent_doppelganger
            existing_doppelganger = Whoosh.objects.filter(settings_hash=new_doppelganger.doppleganger_settings_hash).first()

            if not existing_doppelganger:
                new_doppelganger.source_video.name = whoosh.source_video.name
                new_doppelganger.doppelganger = whoosh.doppelganger if whoosh.doppelganger else whoosh
                new_doppelganger.ip = util.get_client_ip(request)
                new_doppelganger.save()

                process_whoosh.delay(new_doppelganger.id)
                return redirect('view-whoosh', whoosh_id=new_doppelganger.uniq_id)

            return redirect('view-whoosh', whoosh_id=existing_doppelganger.uniq_id)

        return redirect('view-whoosh', whoosh_id=whoosh.uniq_id)


@user_passes_test(lambda u: u.is_superuser)
def reprocess_whoosh(request, whoosh_id):
    whoosh = Whoosh.objects.filter(id=whoosh_id).first()
    process_whoosh.delay(whoosh.id)
    messages.success(request, 'Whoosh id: {} is being reprocessed...'.format(whoosh.id))
    return redirect(whoosh.get_admin_url())


@user_passes_test(lambda u: u.is_superuser)
def save_whoosh(request, whoosh_id):
    whoosh = Whoosh.objects.filter(id=whoosh_id).first()
    whoosh.saved = True
    whoosh.save()
    messages.success(request, 'Whoosh id: {} has been saved.'.format(whoosh.id))
    return redirect(reprocess_whoosh, whoosh_id=whoosh_id)