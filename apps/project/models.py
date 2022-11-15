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

    def move_position(self, direction):
        all_projects = list(Project.objects.order_by('position').all())
        current_index = all_projects.index(self)
        new_index = current_index

        if direction == 'up':
            new_index -= 1
        elif direction == 'down':
            new_index += 1

        if new_index == len(all_projects):
            new_index = 0

        all_projects.insert(new_index, all_projects.pop(current_index))
        proj_to_update = []
        for index, proj in enumerate(all_projects):
            proj.position = index
            proj_to_update.append(proj)

        Project.objects.bulk_update(proj_to_update, ['position'])


    def __str__(self):
        return 'ID: %d | %s' % (self.id, self.title)
