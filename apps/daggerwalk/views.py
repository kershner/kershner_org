from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from .models import DaggerwalkLog
from datetime import datetime
import json


class DaggerwalkHomeView(View):
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        ctx = {}
        return render(request, self.template_path, ctx)
    

import pytz
from django.utils import timezone

@csrf_exempt
@require_http_methods(["POST"])
def create_daggerwalk_log(request):
    try:
        data = json.loads(request.body)
        
        real_time_utc = datetime.strptime(data['realTimeUtc'], '%Y-%m-%d %H:%M:%S UTC')
        real_time_utc = timezone.make_aware(real_time_utc, pytz.UTC)
        
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
            real_time_utc=real_time_utc,
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