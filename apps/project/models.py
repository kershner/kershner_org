from django.db import models
from uuid import uuid4
import os


def rename_upload(instance, filename):
    path = 'project_images/'
    ext = filename.split('.')[-1]
    new_filename = '{}.{}'.format(uuid4().hex, ext)
    return os.path.join(path, new_filename)


class ProjectTag(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    name = models.CharField(max_length=255, unique=True, null=False, blank=False)
    
    def serialize(self):
        return {
            'id': self.id,
            'created_at': str(self.created_at),
            'project': self.project.title,
            'title': self.title,
            'link': self.link
        }

    def __str__(self):
        return self.name


class ProjectTechnology(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    project = models.ForeignKey('project.Project', on_delete=models.CASCADE)
    title = models.CharField(max_length=255, null=False, blank=False)
    link = models.URLField(null=True, blank=True)
    def serialize(self):
        return {
            'id': self.id,
            'created_at': str(self.created_at),
            'project': self.project.title,
            'title': self.title,
            'link': self.link
        }

    def __str__(self):
        return self.title


class Project(models.Model):
    IMAGE_ORIENTATION_CHOICES = (
        ('landscape', 'Landscape'),
        ('portrait', 'Portrait')
    )

    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    updated_at = models.DateTimeField(auto_now=True, editable=False)
    title = models.CharField(max_length=255)
    blurb = models.TextField()
    extra_notes = models.TextField(blank=True)
    icon = models.ImageField(upload_to=rename_upload)
    image_orientation = models.CharField(max_length=9, choices=IMAGE_ORIENTATION_CHOICES, default='Portrait')
    image_1 = models.ImageField(upload_to=rename_upload)
    image_2 = models.ImageField(upload_to=rename_upload, blank=True)
    image_3 = models.ImageField(upload_to=rename_upload, blank=True)
    drop_shadow = models.BooleanField(default=False, help_text='Apply drop shadow to images.')
    site_url = models.CharField(max_length=255, null=True, blank=True)
    position = models.IntegerField(default=0)
    tags = models.ManyToManyField(ProjectTag)

    def __init__(self, *args, **kwargs):
        super(Project, self).__init__(*args, **kwargs)
        self.__original_position = self.position

    def __str__(self):
        return 'ID: %d | %s' % (self.id, self.title)
    
    def serialize(self):
        return {
            'id': self.id,
            'created_at': str(self.created_at),
            'title': self.title,
            'blurb': self.blurb,
            'extra_notes': self.extra_notes,
            'icon': self.icon.url,
            'image_orientation': self.image_orientation,
            'image_1': self.image_1.url if self.image_1 else '',
            'image_2': self.image_2.url if self.image_2 else '',
            'image_3': self.image_3.url if self.image_3 else '',
            'drop_shadow': self.drop_shadow,
            'site_url': self.site_url,
            'position': self.position,
            'technologies': [tech.serialize() for tech in self.project_technologies],
            'tags': [tag.serialize() for tag in self.tags],
        }

    @property
    def project_technologies(self):
        return ProjectTechnology.objects.filter(project=self).order_by('id').all()

    @property
    def tech_has_links(self):
        for tech in self.project_technologies:
            if tech.link:
                return True
        return False

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
