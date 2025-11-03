from .models import POI, DaggerwalkLog, Quest, Region, ChatCommandLog, TwitchUserProfile
from django.contrib.admin.views.decorators import staff_member_required
from rest_framework.decorators import api_view, permission_classes
from apps.daggerwalk.quest_gen import complete_and_rotate_quest
from apps.daggerwalk.tasks import update_all_daggerwalk_caches
from django.views.decorators.cache import cache_control
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.template.loader import render_to_string
from django.utils.dateparse import parse_datetime
from rest_framework.renderers import JSONRenderer
from apps.daggerwalk.models import ChatCommandLog
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models.functions import Lower
from apps.api.views import BaseListAPIView
from rest_framework.views import APIView
from django.utils.text import slugify
from django.shortcuts import redirect
from django.contrib import messages
from django.core.cache import cache
from django.shortcuts import render
from urllib.parse import urlencode
from rest_framework import status
from django.utils import timezone
from .models import ProvinceShape
from django.urls import reverse
from datetime import timedelta
from .utils import EST_TIMEZONE
from django.conf import settings
from .serializers import (
    ChatCommandLogSerializer,
    DaggerwalkLogSerializer, 
    POISerializer,
    QuestSerializer,
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
        quest = cache.get("daggerwalk_current_quest")
        previous_quests = cache.get("daggerwalk_previous_quests") or []
        quest_data = QuestSerializer(quest).data if quest else None
        return render(request, self.template_path, {
            "current_quest": quest,
            "previous_quests": previous_quests,
            "current_quest_json": JSONRenderer().render(quest_data).decode("utf-8"),
            "leaderboard": cache.get("daggerwalk_leaderboard") or [],
            "logs_json": cache.get("daggerwalk_map_logs") or [],
            "poi_json": cache.get("daggerwalk_map_pois") or [],
            "quest_json": cache.get("daggerwalk_map_quest") or [],
            "shape_data": cache.get("daggerwalk_map_shape_data" or []),
        })
    

@api_view(["GET"])
@permission_classes([AllowAny])
@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def daggerwalk_refresh_data(request):
    """Fetch latest map data without reloading the page."""
    data = {
        "logs": cache.get("daggerwalk_map_logs") or [],
        "pois": cache.get("daggerwalk_map_pois") or [],
        "quests": cache.get("daggerwalk_map_quest") or [],
        "shapes": cache.get("daggerwalk_map_shape_data") or [],
    }
    return Response(data)
    

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
    

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def create_daggerwalk_log(request):
    """API endpoint to create a new Daggerwalk log entry along with associated chat logs and quest handling"""
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
        usernames = set()

        for ln in raw_chat_logs:
            parts = [p.strip() for p in ln.split("|")]
            if len(parts) >= 3:
                ts = parse_datetime(parts[0])
                if ts:
                    user = parts[1]
                    usernames.add(user)
                    chat_logs_to_create.append(ChatCommandLog(
                        request_log=log_entry,
                        timestamp=ts,
                        user=user,
                        command=parts[2],
                        args=" ".join(parts[3:]) if len(parts) > 3 else "",
                        raw=ln,
                    ))

        if chat_logs_to_create:
            # Case-insensitive map: username_lower -> profile_id
            uname_lowers = [u.lower() for u in usernames]
            prof_map = dict(
                TwitchUserProfile.objects
                    .annotate(uname_lower=Lower('twitch_username'))
                    .filter(uname_lower__in=uname_lowers)
                    .values_list('uname_lower', 'id')
            )
            for obj in chat_logs_to_create:
                pid = prof_map.get(obj.user.lower())
                if pid:
                    obj.profile_id = pid
            ChatCommandLog.objects.bulk_create(chat_logs_to_create)

        # Quest flow
        quest_completed = False
        completed_quest_payload = None

        active_quest = (
            Quest.objects
            .filter(status="in_progress", poi__isnull=False)
            .select_related("poi", "poi__region")
            .order_by("-created_at")
            .first()
        )

        # Complete if the log's resolved POI matches the active quest's POI
        if active_quest and log_entry.poi_id and active_quest.poi_id == log_entry.poi_id:
            completed_meta, active_quest = complete_and_rotate_quest(
                active_quest,
                completed_at=log_entry.created_at,
                completion_request_log_id=log_entry.id,
            )
            quest_completed = True

            # Resolve completed quest by id from meta and serialize it
            completed_id = (completed_meta or {}).get("id")
            if completed_id:
                completed_quest_obj = (
                    Quest.objects
                    .select_related("poi", "poi__region")
                    .filter(pk=completed_id)
                    .first()
                )
                if completed_quest_obj:
                    completed_quest_payload = QuestSerializer(completed_quest_obj).data

        # Serialize responses
        log_payload = DaggerwalkLogSerializer(log_entry).data
        current_quest_payload = QuestSerializer(active_quest).data if active_quest else None

        update_all_daggerwalk_caches.delay()

        return Response({
            "status": "success",
            "message": "Log entry created",
            "id": log_entry.id,
            "log": log_payload,                          # serialized DaggerwalkLog (nested region_fk, poi)
            "quest_completed": quest_completed,          # bool
            "completed_quest": completed_quest_payload,  # serialized Quest or null
            "current_quest": current_quest_payload,      # serialized Quest or null
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
    """API endpoint to fetch the latest cached Daggerwalk log data"""
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


class QuestListAPIView(BaseListAPIView):
    queryset = (Quest.objects
                .select_related('poi', 'poi__region')
                .order_by('-id'))
    serializer_class = QuestSerializer
    filterset_fields = ('status', 'poi')
    ordering_fields = ('id', 'created_at', 'completed_at', 'xp')
    ordering = ('-id',)
    search_fields = ('description', 'quest_giver_name', 'poi__name')


@staff_member_required
def build_daggerwalk_caches(request):
    if request.method == "POST":
        update_all_daggerwalk_caches.delay()
        # update_all_daggerwalk_caches()
        messages.success(request, "Daggerwalk caches built successfully.")
    return redirect("admin:daggerwalk_daggerwalklog_changelist")


def quest_redirect_view(request):
    """
    Redirect to the Daggerwalk home view with query parameters for the current quest's POI
    """
    q = cache.get("daggerwalk_current_quest")
    base = reverse("daggerwalk")
    if not q or not getattr(q, "poi", None) or not getattr(q.poi, "region", None):
        return redirect(base)

    poi = q.poi
    params = {
        "region": poi.region.name,
        "x": poi.map_pixel_x,
        "y": poi.map_pixel_y,
        "emoji": poi.emoji,
        "poi": poi.name,
    }
    return redirect(f"{base}?{urlencode({k: v for k, v in params.items() if v is not None})}")