from apps.project.models import Project, ProjectTechnology, ProjectTag
from django.template.loader import render_to_string
from django.contrib import admin
from django import forms


class ProjectTagInline(admin.TabularInline):
    autocomplete_fields = ['projecttag']
    model = Project.tags.through
    extra = 1
    verbose_name = 'Tag'
    verbose_name_plural = 'Tags'


class ProjectTechnologyInline(admin.TabularInline):
    fields = ['title', 'link']
    model = ProjectTechnology
    extra = 1
    verbose_name = 'Project Technology'
    verbose_name_plural = 'Project Technologies'


@admin.register(ProjectTag)
class ProjectTagAdmin(admin.ModelAdmin):
     search_fields = ['name']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'position', 'change_position')
    list_filter = ('created_at',)
    search_fields = ['name', 'id']
    show_full_result_count = True
    readonly_fields = ['position']
    ordering  = ('position',)
    exclude = ('tags',) 
    inlines = [ProjectTechnologyInline, ProjectTagInline]

    @staticmethod
    def change_position(obj):
        ctx = {'project': obj}
        return render_to_string('admin/project_position_controls.html', context=ctx)
