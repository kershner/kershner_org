from django.utils.html import format_html
from apps.whoosh.models import Whoosh
from django.contrib import admin
from django.urls import reverse


@admin.register(Whoosh)
class WhooshAdmin(admin.ModelAdmin):
    save_on_top = True
    list_display = ['id', 'created', 'viewer', 'credit_text', 'mute_original', 'processed']
    # readonly_fields = [field.name for field in Whoosh._meta.fields]

    @staticmethod
    def viewer(obj):
        return format_html('<a href="{}">View</a>'.format(reverse('view-whoosh', kwargs={'whoosh_id': obj.id})))


