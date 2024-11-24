from .models import Project, ProjectTag, ProjectTechnology
from rest_framework import serializers


class ProjectTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTag
        fields = '__all__'


class ProjectTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTechnology
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    tags = ProjectTagSerializer(many=True)
    technologies = ProjectTechnologySerializer(many=True)

    class Meta:
        model = Project
        fields = '__all__'
