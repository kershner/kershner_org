from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.forms.models import model_to_dict
from django.views.generic import View
from django.http import JsonResponse
from django.shortcuts import render
from .models import DaggerwalkLog
from django.db.models import Max
import json


class DaggerwalkHomeView(View):
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        # Get distinct regions with their most recent timestamps
        region_markers = (
            DaggerwalkLog.objects
            .values('region')
            .annotate(latest_date=Max('created_at'))
            .order_by('-latest_date')
            .values_list('region', flat=True)
            .distinct()[:10]
        )

        ctx = {
            'region_markers': json.dumps(list(region_markers))
        }
        print(ctx)
        return render(request, self.template_path, ctx)

class DaggerwalkLogsView(View):
    def get(self, request):
        region = request.GET.get('region')
        if not region:
            return JsonResponse({'error': 'Region parameter is required'}, status=400)

        # Get all logs ordered by most recent first
        logs = DaggerwalkLog.objects.order_by('-created_at')
        
        # Find the first log with matching region
        first_matching_log = logs.filter(region=region).first()
        if not first_matching_log:
            return JsonResponse([], safe=False)
            
        # Get the created_at timestamp of the first matching log
        target_timestamp = first_matching_log.created_at
        
        # Get all consecutive logs with the same region up until we hit a different region
        matching_logs = []
        for log in logs.filter(created_at__lte=target_timestamp):
            if log.region == region:
                matching_logs.append(log)
            else:
                break
                
        data = [model_to_dict(log) for log in matching_logs]
        return JsonResponse(data, safe=False)
    
@csrf_exempt
@require_http_methods(["POST"])
def create_daggerwalk_log(request):
    # TODO - add auth
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
            current_song=data.get('currentSong')
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