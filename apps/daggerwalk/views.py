from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.forms.models import model_to_dict
from django.views.generic import View
from django.http import JsonResponse
from django.contrib import messages
from django.shortcuts import render
from .models import DaggerwalkLog
from django.db.models import Max
from django.conf import settings
import json


class DaggerwalkHomeView(View):
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        # Get distinct regions with their most recent data
        region_data = (
            DaggerwalkLog.objects
            .exclude(region="Ocean")
            .values('region')
            .annotate(
                latest_date=Max('created_at'),
                latest_location=Max('location'),
                latest_weather=Max('weather'),
                latest_current_song=Max('current_song')
            )
            .order_by('-latest_date')
            .values(
                'region',
                'latest_date',
                'latest_location',
                'latest_weather',
                'latest_current_song'
            )
            .distinct()[:50]
        )

        latest_log = DaggerwalkLog.objects.latest('created_at')
        
        ctx = {
            'region_data': json.dumps(list(region_data), default=str),
            'latest_log': json.dumps(latest_log.__dict__, default=str)
        }
        
        return render(request, self.template_path, ctx)

class DaggerwalkLogsView(View):
    use_sampling = True
    step = 5

    def get(self, request):
        region = request.GET.get('region')

        if not region:
            return JsonResponse({'error': 'Region parameter is required'}, status=400)

        queryset = list(DaggerwalkLog.objects.filter(region=region).order_by('created_at'))

        if self.use_sampling:
            total_logs = len(queryset)
            if total_logs == 0:
                return JsonResponse([], safe=False)

            # Select every nth row and ensure the last row is included
            sampled_logs = queryset[::self.step]
            if queryset[-1] not in sampled_logs:
                sampled_logs.append(queryset[-1])

            logs = sampled_logs
        else:
            logs = queryset

        logs = [dict(model_to_dict(log), created_at=log.created_at) for log in logs]
        return JsonResponse(logs, safe=False)
    
@csrf_exempt
@require_http_methods(["POST"])
def create_daggerwalk_log(request):
    API_KEY = getattr(settings, "DAGGERWALK_API_KEY", None)
    auth_header = request.headers.get("Authorization")

    if not API_KEY or auth_header != f"Bearer {API_KEY}":
        return JsonResponse({"status": "error", "message": "Unauthorized"}, status=401)
    
    try:
        data = json.loads(request.body)
        
        log_entry = DaggerwalkLog.objects.create(
            world_x=data['worldX'],
            world_z=data['worldZ'],
            map_pixel_x=data['mapPixelX'],
            map_pixel_y=data['mapPixelY'],
            region=data['region'],
            location=data['location'],
            location_type=data['locationType'],
            player_x=data['playerX'],
            player_y=data['playerY'],
            player_z=data['playerZ'],
            date=data['date'],
            weather=data['weather'],
            current_song=data.get('currentSong'),
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Log entry created successfully',
            'id': log_entry.id
        }, status=201)
        
    except KeyError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Missing required field: {str(e)}'
        }, status=400)
        
    except ValueError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Invalid data format: {str(e)}'
        }, status=400)
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'An error occurred: {str(e)}'
        }, status=500) 

@staff_member_required
def delete_previous_logs(request, log_id):
   if request.method == 'POST':
       deleted, details = DaggerwalkLog.objects.filter(id__lt=log_id).delete()
       messages.success(request, f'{deleted} logs deleted')
       return JsonResponse({'status': 'ok'})

def latest_log(request):
    log = DaggerwalkLog.objects.latest('created_at')
    return JsonResponse(dict(model_to_dict(log), created_at=log.created_at))
