from apps.project.models import Project, ProjectTechnology
from django.template.loader import render_to_string
from django.contrib import admin


class ProjectTechnologyInline(admin.TabularInline):
    fields = ['title', 'link']
    model = ProjectTechnology
    extra = 1
    verbose_name = 'Project Technology'
    verbose_name_plural = 'Project Technologies'



# Admin config for this model
# https://docs.djangoproject.com/en/4.1/ref/contrib/admin/#django.contrib.admin.ModelAdmin
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'position', 'change_position')
    list_filter = ('created_at',)
    search_fields = ['name', 'id']
    show_full_result_count = True
    readonly_fields = ['position']
    ordering  = ('position',)
    inlines = [ProjectTechnologyInline]

    @staticmethod
    def change_position(obj):
        ctx = {'project': obj}
        return render_to_string('admin/project_position_controls.html', context=ctx)
