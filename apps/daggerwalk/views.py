from django.contrib.admin.views.decorators import staff_member_required
from apps.daggerwalk.utils import get_map_data, get_latest_log_data
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import DaggerwalkLog, Region
from rest_framework.views import APIView
from django.http import JsonResponse
from django.shortcuts import render
from django.contrib import messages
from rest_framework import status
from django.db.models import Max
from django.conf import settings
from .serializers import (
    DaggerwalkLogSerializer, 
    POISerializer,
)
import json


class DaggerwalkHomeView(APIView):
    """Home view for the Daggerwalk app"""
    permission_classes = [AllowAny]
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
            .distinct()[:30]
        )

        map_data = get_map_data()
        latest_log_data = get_latest_log_data()
        
        ctx = {
            **map_data,
            **latest_log_data,
            'region_data': json.dumps(list(region_data), default=str),
        }
        
        return render(request, self.template_path, ctx)


class DaggerwalkLogsView(APIView):
    """API view for retrieving logs for a specific region"""
    permission_classes = [AllowAny]
    use_sampling = True
    step = 5

    def get(self, request):
        region = request.query_params.get('region')

        if not region:
            return Response({'error': 'Region parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Use select_related to prefetch related models in a single query
        queryset = DaggerwalkLog.objects.filter(region=region) \
                    .select_related('region_fk', 'poi') \
                    .order_by('created_at')

        if self.use_sampling and queryset.exists():
            # Convert to list and sample
            queryset_list = list(queryset)
            # Select every nth row and ensure the last row is included
            sampled_logs = queryset_list[::self.step]
            if queryset_list[-1] not in sampled_logs:
                sampled_logs.append(queryset_list[-1])
            logs = sampled_logs
        else:
            logs = list(queryset)
        
        # Get all POIs for this region
        try:
            region_obj = Region.objects.get(name=region)
            pois = region_obj.points_of_interest.all()
        except Region.DoesNotExist:
            pois = []

        serialized_logs = DaggerwalkLogSerializer(logs, many=True).data
        serialized_pois = POISerializer(pois, many=True).data
        response_data = {
            'logs': serialized_pois + serialized_logs
        }
        return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def create_daggerwalk_log(request):
    API_KEY = getattr(settings, "DAGGERWALK_API_KEY", None)
    auth_header = request.headers.get("Authorization")

    if not API_KEY or auth_header != f"Bearer {API_KEY}":
        return Response({"status": "error", "message": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        log_entry = DaggerwalkLog.objects.create(
            world_x=request.data['worldX'],
            world_z=request.data['worldZ'],
            map_pixel_x=request.data['mapPixelX'],
            map_pixel_y=request.data['mapPixelY'],
            region=request.data['region'],
            location=request.data['location'],
            player_x=request.data['playerX'],
            player_y=request.data['playerY'],
            player_z=request.data['playerZ'],
            date=request.data['date'],
            weather=request.data['weather'],
            current_song=request.data.get('currentSong'),
        )
        
        return Response({
            'status': 'success',
            'message': 'Log entry created successfully',
            'id': log_entry.id
        }, status=status.HTTP_201_CREATED)
        
    except KeyError as e:
        return Response({
            'status': 'error',
            'message': f'Missing required field: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'status': 'error',
            'message': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@staff_member_required
def delete_previous_logs(request, log_id):
    if request.method == 'POST':
        deleted, details = DaggerwalkLog.objects.filter(id__lt=log_id).delete()
        messages.success(request, f'{deleted} logs deleted')
        return JsonResponse({'status': 'ok'})


@api_view(['GET'])
@permission_classes([AllowAny])
def latest_log(request):
    response_data = get_latest_log_data()
    return Response(response_data)
    
