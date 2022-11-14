from django.contrib.admin import SimpleListFilter
from django.utils.html import format_html
from apps.whoosh.models import Whoosh
from django.contrib import admin
from django.urls import reverse


class DoppelgangerFilter(SimpleListFilter):
    title = 'Doppelgänger'
    parameter_name = 'doppel'

    def lookups(self, request, model_admin):
        return (
            (True, 'True'),
            (False, 'False'),
        )

    def queryset(self, request, queryset):
        queryset = Whoosh.objects.all()

        if self.value() == 'False':
            return queryset.filter(doppelganger=None)
        elif self.value() == 'True':
            return queryset.filter(doppelganger__isnull=False)

        return queryset


@admin.register(Whoosh)
class WhooshAdmin(admin.ModelAdmin):
    change_form_template = 'admin/whoosh/change_form.html'
    save_on_top = True
    list_display = ['id', 'created', 'thumbnail_preview', 'credit_text', 'processed']
    readonly_fields = ['ip', 'doppelganger', 'uniq_id', 'user_agent', 'created', 'processed', 'source_video',
                       'processed_video', 'thumbnail', 'saved_video', 'saved_thumbnail', 'settings_hash',
                       'saved', 'hidden']
    list_filter = ['saved', DoppelgangerFilter]

    @staticmethod
    def thumbnail_preview(obj):
        change_link = reverse('admin:{}_{}_change'.format(obj._meta.app_label, obj._meta.model_name), args=(obj.id,))
        html = '<a class="admin-img" href="{}"><img src={}></a>'.format(change_link, obj.cloudfront_thumbnail_url)
        return format_html(html)
