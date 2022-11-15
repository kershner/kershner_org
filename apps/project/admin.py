from django.template.loader import render_to_string
from apps.project.models import Project
from django.contrib import admin



# Admin config for this model
# https://docs.djangoproject.com/en/2.0/ref/contrib/admin/#django.contrib.admin.ModelAdmin
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'position', 'change_position')
    list_filter = ('created_at',)
    search_fields = ['name', 'id']
    show_full_result_count = True
    readonly_fields = ['position']
    ordering  = ('position',)

    @staticmethod
    def change_position(obj):
        ctx = {'project': obj}
        return render_to_string('admin/project_position_controls.html', context=ctx)
