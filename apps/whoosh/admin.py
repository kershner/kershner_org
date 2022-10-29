from django.utils.html import format_html
from apps.whoosh.models import Whoosh
from django.contrib import admin
from django.urls import reverse


@admin.register(Whoosh)
class WhooshAdmin(admin.ModelAdmin):
    change_form_template = 'admin/whoosh/change_form.html'
    save_on_top = True
    list_display = ['id', 'created', 'thumbnail_preview', 'credit_text', 'processed']
    readonly_fields = ['uniq_id']

    @staticmethod
    def thumbnail_preview(obj):
        change_link = reverse('admin:{}_{}_change'.format(obj._meta.app_label, obj._meta.model_name), args=(obj.id,))
        html = '<a class="admin-img" href="{}"><img src={}></a>'.format(change_link, obj.cloudfront_thumbnail_url)
        return format_html(html)
