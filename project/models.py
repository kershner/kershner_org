from django.contrib import admin
from django.db import models
from uuid import uuid4
import os


def rename_upload(instance, filename):
    path = 'project_images/'
    ext = filename.split('.')[-1]
    new_filename = '{}.{}'.format(uuid4().hex, ext)
    return os.path.join(path, new_filename)


class Project(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    updated_at = models.DateTimeField(auto_now=True, editable=False)
    title = models.CharField(max_length=255)
    blurb = models.TextField()
    technologies = models.CharField(max_length=255)
    extra_notes = models.TextField()
    icon = models.ImageField(upload_to=rename_upload)
    image_1 = models.ImageField(upload_to=rename_upload)
    image_2 = models.ImageField(upload_to=rename_upload)
    image_3 = models.ImageField(upload_to=rename_upload)
    site_url = models.CharField(max_length=255)
    position = models.IntegerField(default=0)
    __original_position = None

    def __init__(self, *args, **kwargs):
        super(Project, self).__init__(*args, **kwargs)
        self.__original_position = self.position

    def save(self, force_insert=False, force_update=False, *args, **kwargs):
        if self.position != self.__original_position:
            # Position has changed
            old_project_with_position = Project.objects.filter(position=self.position)
            if old_project_with_position:
                old_project_with_position.update(position=self.__original_position)

        super(Project, self).save(force_insert, force_update, *args, **kwargs)
        self.__original_position = self.position

    def __str__(self):
        return 'ID: %d | %s' % (self.id, self.title)


# Admin config for this model
# https://docs.djangoproject.com/en/2.0/ref/contrib/admin/#django.contrib.admin.ModelAdmin
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'position')
    list_filter = ('created_at',)
    search_fields = ['name', 'id']
    show_full_result_count = True
