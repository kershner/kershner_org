from django.contrib.admin.views.decorators import staff_member_required
from apps.daggerwalk.utils import get_map_data, get_latest_log_data
from rest_framework.decorators import api_view, permission_classes
from .models import POI, DaggerwalkLog, Region, ChatCommandLog
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import cache_page
from django.template.loader import render_to_string
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.api.views import BaseListAPIView
from rest_framework.views import APIView
from django.http import JsonResponse
from django.shortcuts import render
from django.contrib import messages
from django.core.cache import cache
from rest_framework import status
from django.utils import timezone
from django.db.models import Max
from .utils import EST_TIMEZONE
from django.conf import settings
from datetime import timedelta
from django.db.models import Q
from .serializers import (
    ChatCommandLogSerializer,
    DaggerwalkLogSerializer, 
    POISerializer,
    RegionSerializer,
)
import logging
import json

logger = logging.getLogger(__name__)


@method_decorator(cache_page(60 * 5), name="dispatch")
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
            'region_data': json.dumps(list(region_data), default=str)
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

        try:
            # Get region object and related POIs
            region_obj = Region.objects.get(name=region)
            pois = region_obj.points_of_interest.all()

            two_weeks_ago = timezone.now() - timedelta(weeks=2)

            # Get logs using region_fk instead of raw string
            queryset = DaggerwalkLog.objects.filter(
                Q(region_fk=region_obj) | Q(last_known_region=region_obj),
                created_at__gte=two_weeks_ago
            ).select_related('region_fk', 'poi', 'last_known_region').order_by('created_at')

        except Region.DoesNotExist:
            # Fallback if region FK doesn't exist
            queryset = DaggerwalkLog.objects.filter(
                region=region
            ).select_related('region_fk', 'poi', 'last_known_region').order_by('created_at')
            pois = []

        if self.use_sampling and queryset.exists():
            all_logs = list(queryset)
            logs = all_logs[::self.step]
            if all_logs and all_logs[-1] not in logs:
                logs.append(all_logs[-1])
        else:
            logs = list(queryset)

        # Serialize and return combined logs and POIs
        serialized_logs = DaggerwalkLogSerializer(logs, many=True).data
        serialized_pois = POISerializer(pois, many=True).data
        return Response({'logs': serialized_pois + serialized_logs})


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def create_daggerwalk_log(request):
    from django.utils.dateparse import parse_datetime
    from apps.daggerwalk.models import ChatCommandLog

    API_KEY = getattr(settings, "DAGGERWALK_API_KEY", None)
    auth_header = request.headers.get("Authorization")

    if not API_KEY or auth_header != f"Bearer {API_KEY}":
        return Response({"status": "error", "message": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        raw_chat_logs = request.data.get("chat_logs") or []
        if isinstance(raw_chat_logs, str):
            raw_chat_logs = raw_chat_logs.strip().splitlines()

        parsed_chat_logs = []
        for ln in raw_chat_logs:
            parts = [p.strip() for p in ln.split("|")]
            if len(parts) >= 3:
                parsed_chat_logs.append({
                    "timestamp": parts[0],
                    "user": parts[1],
                    "command": parts[2],
                    "args": " ".join(parts[3:]) if len(parts) > 3 else ""
                })

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

        chat_command_objects = []
        for chat_log in parsed_chat_logs:
            parsed_timestamp = parse_datetime(chat_log['timestamp'])
            if not parsed_timestamp:
                continue

            chat_command_objects.append(
                ChatCommandLog(
                    request_log=log_entry,
                    timestamp=parsed_timestamp,
                    user=chat_log['user'],
                    command=chat_log['command'],
                    args=chat_log.get('args', ''),
                    raw=" | ".join(filter(None, [
                        chat_log['timestamp'],
                        chat_log['user'],
                        chat_log['command'],
                        chat_log.get('args', '')
                    ]))
                )
            )

        try:
            if chat_command_objects:
                ChatCommandLog.objects.bulk_create(chat_command_objects)
        except Exception as e:
            logger.error(f"Failed to save ChatCommandLog objects: {str(e)}")

        return Response({
            'status': 'success',
            'message': 'Log entry created successfully',
            'id': log_entry.id,
            'log_data': get_latest_log_data()
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
    
    
# API Views
class RegionListAPIView(BaseListAPIView):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer


class POIListAPIView(BaseListAPIView):
    queryset = POI.objects.all()
    serializer_class = POISerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        region_id = self.request.query_params.get('region_id')
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        return queryset


class DaggerwalkLogListAPIView(BaseListAPIView):
    queryset = DaggerwalkLog.objects.all()
    serializer_class = DaggerwalkLogSerializer
    ordering = ("-id",)

    # build filterset_fields dynamically
    @property
    def filterset_fields(self):
        exclude = {"poi"}
        model = self.get_queryset().model
        return [
            f.name
            for f in model._meta.get_fields()
            if getattr(f, "concrete", False) and f.name not in exclude
        ]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        region_id = self.request.query_params.get('region_id')
        if region_id:
            queryset = queryset.filter(region_fk_id=region_id)
            
        poi_id = self.request.query_params.get('poi_id')
        if poi_id:
            queryset = queryset.filter(poi_id=poi_id)
            
        return queryset
    

class DaggerwalkStatsView(APIView):
    template = 'daggerwalk/stats.html'
    permission_classes = [AllowAny]

    def get(self, request):
        keyword = request.query_params.get('range', 'all')
        stats = cache.get(f'daggerwalk_stats:{keyword}')

        if stats is None:
            return Response({'error': 'Stats are currently unavailable.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        data = {
            'stats': stats,
            'html': render_to_string(self.template, {
                'stats': stats, 
                "today": timezone.localtime(timezone.now(), EST_TIMEZONE).date()
            }),
        }
        return Response(data)


class ChatCommandLogListAPIView(BaseListAPIView):
    queryset = ChatCommandLog.objects.order_by('-id')
    serializer_class = ChatCommandLogSerializer
    filterset_fields = ('user', 'command')
    ordering = ("-id",)