from django.contrib.admin.views.decorators import staff_member_required
from .models import POI, DaggerwalkLog, Quest, Region, ChatCommandLog
from rest_framework.decorators import api_view, permission_classes
from apps.daggerwalk.quest_gen import complete_and_rotate_quest
from apps.daggerwalk.tasks import update_all_daggerwalk_caches
from django.views.decorators.cache import cache_control
from apps.daggerwalk.utils import get_latest_log_data
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import cache_page
from django.template.loader import render_to_string
from django.utils.dateparse import parse_datetime
from apps.daggerwalk.models import ChatCommandLog
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.api.views import BaseListAPIView
from rest_framework.views import APIView
from django.utils.text import slugify
from django.shortcuts import redirect
from django.shortcuts import render
from django.contrib import messages
from django.core.cache import cache
from rest_framework import status
from django.utils import timezone
from .utils import EST_TIMEZONE
from django.conf import settings
from .serializers import (
    ChatCommandLogSerializer,
    DaggerwalkLogSerializer, 
    POISerializer,
    RegionSerializer,
)
import logging


logger = logging.getLogger(__name__)


# @method_decorator(cache_page(60 * 60 * 24 * 30), name="dispatch")  # 30 days
class DaggerwalkHomeView(APIView):
    """Home view for the Daggerwalk app"""
    permission_classes = [AllowAny]
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        return render(request, self.template_path, {
            "current_quest": cache.get("daggerwalk_current_quest") or None,
            "leaderboard_top10": cache.get("daggerwalk_leaderboard_top10") or []
        })
    

class DaggerwalkHomeDataView(APIView):
    """View to fetch fresh cache data for the Daggerwalk home view"""
    permission_classes = [AllowAny]
    
    @method_decorator(cache_control(no_cache=True, no_store=True, must_revalidate=True))
    def get(self, request):
        data = {
            "region_data": cache.get("daggerwalk_region_data") or [],
            "map_data": cache.get("daggerwalk_map_data") or {},
            "latest_log_data": cache.get("daggerwalk_latest_log_data") or {}
        }
        return Response(data)


class DaggerwalkLogsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        region = request.query_params.get("region")
        if not region:
            return Response({"error": "Region parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"daggerwalk_region_logs:{slugify(region)}"
        data = cache.get(cache_key)
        if data is None:
            return Response({"error": "No cached data available"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"logs": data})


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def create_daggerwalk_log(request):
    API_KEY = getattr(settings, "DAGGERWALK_API_KEY", None)
    auth_header = request.headers.get("Authorization")
    if not API_KEY or auth_header != f"Bearer {API_KEY}":
        return Response({"status": "error", "message": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        # Create the log (DaggerwalkLog.save links POI/Region if applicable)
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

        # Create chat logs
        raw_chat_logs = request.data.get("chat_logs") or []
        if isinstance(raw_chat_logs, str):
            raw_chat_logs = raw_chat_logs.strip().splitlines()

        chat_logs_to_create = []
        for ln in raw_chat_logs:
            parts = [p.strip() for p in ln.split("|")]
            if len(parts) >= 3:
                ts = parse_datetime(parts[0])
                if ts:
                    chat_logs_to_create.append(ChatCommandLog(
                        request_log=log_entry,
                        timestamp=ts,
                        user=parts[1],
                        command=parts[2],
                        args=" ".join(parts[3:]) if len(parts) > 3 else "",
                        raw=ln,
                    ))
        if chat_logs_to_create:
            ChatCommandLog.objects.bulk_create(chat_logs_to_create)

        # Quest flow
        quest_completed = False
        completed_quest_meta = None

        active_quest = (
            Quest.objects
            .filter(status="in_progress", poi__isnull=False)
            .select_related("poi", "poi__region")
            .order_by("-created_at")
            .first()
        )

        # Complete if the log's resolved POI matches the active quest's POI
        if active_quest and log_entry.poi_id and active_quest.poi_id == log_entry.poi_id:
            # Pass the completing request_log id so the helper can extend the window to the
            # latest chat timestamp attached to THIS log (fixes “late chat excluded” edge case).
            completed_quest_meta, active_quest = complete_and_rotate_quest(
                active_quest,
                completed_at=log_entry.created_at,
                completion_request_log_id=log_entry.id,
            )
            quest_completed = True

        current_quest_payload = None
        if active_quest:
            current_quest_payload = {
                "id": active_quest.id,
                "status": active_quest.status,
                "xp": getattr(active_quest, "xp", None),
                "poi_name": getattr(getattr(active_quest, "poi", None), "name", None),
                "region_name": getattr(getattr(getattr(active_quest, "poi", None), "region", None), "name", None),
                "description": getattr(active_quest, "description", None),
                "quest_giver_name": getattr(active_quest, "quest_giver_name", None),
                "quest_giver_img_url": getattr(active_quest, "quest_giver_img_url", None),
                "quest_giver_img_number": getattr(active_quest, "quest_giver_img_number", None),
            }

        return Response({
            "status": "success",
            "message": "Log entry created",
            "id": log_entry.id,
            "log_data": get_latest_log_data(),
            "quest_completed": quest_completed,
            "completed_quest": completed_quest_meta,  # null if not completed
            "current_quest": current_quest_payload,   # may be null
        }, status=status.HTTP_201_CREATED)

    except KeyError as e:
        return Response({"status": "error", "message": f"Missing required field: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"status": "error", "message": f"An error occurred: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    

@api_view(["GET"])
@permission_classes([AllowAny])
def latest_log(request):
    return Response(cache.get("daggerwalk_latest_log_data"))
    

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


@staff_member_required
def build_daggerwalk_caches(request):
    if request.method == "POST":
        update_all_daggerwalk_caches.delay()
        # update_all_daggerwalk_caches()
        messages.success(request, "Daggerwalk caches built successfully.")
    return redirect("admin:daggerwalk_daggerwalklog_changelist")
