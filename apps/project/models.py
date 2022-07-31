from django.template.loader import render_to_string
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
    extra_notes = models.TextField(blank=True)
    icon = models.ImageField(upload_to=rename_upload)
    # (actual DB value, human-readable name)
    IMAGE_ORIENTATION_CHOICES = (
        ('landscape', 'Landscape'),
        ('portrait', 'Portrait')
    )
    image_orientation = models.CharField(max_length=9, choices=IMAGE_ORIENTATION_CHOICES, default='Portrait')
    image_1 = models.ImageField(upload_to=rename_upload)
    image_2 = models.ImageField(upload_to=rename_upload, blank=True)
    image_3 = models.ImageField(upload_to=rename_upload, blank=True)
    drop_shadow = models.BooleanField(default=False, help_text='Apply drop shadow to images.')
    site_url = models.CharField(max_length=255)
    position = models.IntegerField(default=0)

    def __init__(self, *args, **kwargs):
        super(Project, self).__init__(*args, **kwargs)
        self.__original_position = self.position

    @staticmethod
    def get_new_position(total_projects, old_position, direction):
        max_position = total_projects - 1
        new_position = old_position
        if direction == 'up':
            new_position -= 1
        elif direction == 'down':
            new_position += 1

        if new_position > max_position:
            new_position = max_position
        if new_position < 0:
            new_position = 0

        return new_position

    def move_position(self, direction):
        all_projects = Project.objects.all()
        total_projects = all_projects.count()
        new_position = self.get_new_position(total_projects, self.position, direction)
        project_at_position = Project.objects.filter(position=new_position).first()

        # Swap positions with existing project at new_position
        project_at_position.position = self.position
        self.position = new_position

        # Save both project objects
        project_at_position.save()
        self.save()

    def __str__(self):
        return 'ID: %d | %s' % (self.id, self.title)


# Admin config for this model
# https://docs.djangoproject.com/en/2.0/ref/contrib/admin/#django.contrib.admin.ModelAdmin
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'id', 'created_at', 'position', 'change_position')
    list_filter = ('created_at',)
    search_fields = ['name', 'id']
    show_full_result_count = True
    readonly_fields = ['position']

    @staticmethod
    def change_position(obj):
        ctx = {'project': obj}
        return render_to_string('admin/project_position_controls.html', context=ctx)
