from django.contrib.auth.decorators import login_required
from apps.project.models import Project
from django.shortcuts import redirect
from django.contrib import messages
from django.views import View


class MoveProjectPositionView(View):
    @staticmethod
    @login_required()
    def get(request, project_id, direction):
        try:
            project = Project.objects.get(id=project_id)
            project.move_position(direction)
            message = '{} has had its position moved {}.'.format(project, direction)
        except Project.DoesNotExist:
            message = 'Project not found!'

        messages.add_message(request, messages.INFO, message)
        return redirect('/admin/project/project')
