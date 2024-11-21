from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.decorators import login_required
from rest_framework.response import Response
from .serializers import ProjectSerializer
from rest_framework.views import APIView
from apps.project.models import Project
from django.shortcuts import redirect
from django.contrib import messages
from django.views import View


class MoveProjectPositionView(View):
    @staticmethod
    @login_required()
    @user_passes_test(lambda u: u.is_superuser)
    def get(request, project_id, direction):
        try:
            project = Project.objects.get(id=project_id)
            project.move_position(direction)
            message = '{} has had its position moved {}.'.format(project, direction)
        except Project.DoesNotExist:
            message = 'Project not found!'

        messages.add_message(request, messages.INFO, message)
        return redirect('/admin/project/project')


class ProjectListAPIView(APIView):
    def get_queryset(self):
        return Project.objects.prefetch_related('tags').select_related()

    def get(self, request):
        projects = self.get_queryset()
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)
