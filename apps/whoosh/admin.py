from django.utils.html import format_html
from apps.whoosh.models import Whoosh
from django.contrib import admin
from django.urls import reverse


@admin.register(Whoosh)
class WhooshAdmin(admin.ModelAdmin):
    change_form_template = 'admin/whoosh/change_form.html'
    save_on_top = True
    list_display = ['id', 'created', 'viewer', 'credit_text', 'mute_original', 'processed']
    readonly_fields = ['uniq_id']

    @staticmethod
    def viewer(obj):
        return format_html('<a href="{}">View</a>'.format(reverse('view-whoosh', kwargs={'whoosh_id': obj.uniq_id})))
