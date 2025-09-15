from .models import POI, DaggerwalkLog, Quest, Region, ChatCommandLog, TwitchUserProfile
from django.contrib.admin.views.decorators import staff_member_required
from rest_framework.decorators import api_view, permission_classes
from apps.daggerwalk.tasks import update_all_daggerwalk_caches
from django.views.decorators.cache import cache_control
from apps.daggerwalk.utils import get_latest_log_data
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import cache_page
from django.template.loader import render_to_string
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.api.views import BaseListAPIView
from rest_framework.views import APIView
from django.utils.text import slugify
from django.shortcuts import redirect
from django.http import JsonResponse
from django.shortcuts import render
from django.contrib import messages
from django.core.cache import cache
from django.db import transaction
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


@method_decorator(cache_page(60 * 60 * 24 * 30), name="dispatch")  # 30 days
class DaggerwalkHomeView(APIView):
    """Home view for the Daggerwalk app"""
    permission_classes = [AllowAny]
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        return render(request, self.template_path, {})
    

class DaggerwalkHomeDataView(APIView):
    """View to fetch fresh cache data for the Daggerwalk home view"""
    permission_classes = [AllowAny]
    
    @method_decorator(cache_control(no_cache=True, no_store=True, must_revalidate=True))
    def get(self, request):
        data = {
            "region_data": cache.get("daggerwalk_region_data") or [],
            "map_data": cache.get("daggerwalk_map_data") or {},
            "latest_log_data": cache.get("daggerwalk_latest_log_data") or {},
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
        messages.success(request, "Daggerwalk caches built successfully.")
    return redirect("admin:daggerwalk_daggerwalklog_changelist")


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def complete_quest(request):
    API_KEY = getattr(settings, "DAGGERWALK_API_KEY", None)
    auth_header = request.headers.get("Authorization")
    if not API_KEY or auth_header != f"Bearer {API_KEY}":
        return Response({"status": "error", "message": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    poi_name = request.data.get("poi_name")
    viewers = request.data.get("twitch_viewers", [])

    if not isinstance(poi_name, str) or not poi_name.strip():
        return Response({"status": "error", "message": "poi_name is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Accept comma-separated string or list; keep usernames EXACT (trim only).
    if isinstance(viewers, str):
        viewers = [v.strip() for v in viewers.split(",")]
    elif isinstance(viewers, list):
        viewers = [v.strip() for v in viewers if isinstance(v, str)]
    else:
        return Response({"status": "error", "message": "twitch_viewers must be a list or comma-separated string"},
                        status=status.HTTP_400_BAD_REQUEST)

    # De-duplicate while preserving order
    seen = set()
    viewers = [v for v in viewers if v and not (v in seen or seen.add(v))]

    # Single in-progress quest (take the first())
    quest = (
        Quest.objects
        .filter(status="in_progress", poi__isnull=False)
        .select_related("poi", "poi__region")
        .order_by("-created_at")
        .first()
    )
    if not quest:
        return Response({"status": "error", "message": "No in-progress quest found"}, status=status.HTTP_404_NOT_FOUND)

    # Exact POI match (trim only)
    if poi_name.strip() != quest.poi.name.strip():
        return Response({
            "status": "mismatch",
            "message": "POI name does not match the active quest.",
            "expected_poi": quest.poi.name,
            "received_poi": poi_name,
            "quest_id": quest.id,
        }, status=status.HTTP_409_CONFLICT)

    with transaction.atomic():
        # 1) Complete the current quest (model handles completed_at)
        if quest.status != "completed":
            quest.status = "completed"
            quest.save(update_fields=["status", "completed_at"])

        # 2) Ensure viewer profiles exist; then attach quest completion
        if viewers:
            existing = set(
                TwitchUserProfile.objects
                .filter(twitch_username__in=viewers)
                .values_list("twitch_username", flat=True)
            )
            to_create = [u for u in viewers if u not in existing]
            if to_create:
                now = timezone.now()
                TwitchUserProfile.objects.bulk_create(
                    [TwitchUserProfile(twitch_username=u, created_at=now) for u in to_create],
                    ignore_conflicts=True
                )

            profile_ids = list(
                TwitchUserProfile.objects
                .filter(twitch_username__in=viewers)
                .values_list("id", flat=True)
            )
            through = TwitchUserProfile.completed_quests.through
            rows = [through(twitchuserprofile_id=pid, quest_id=quest.id) for pid in profile_ids]
            if rows:
                through.objects.bulk_create(rows, ignore_conflicts=True)

        # 3) Create the next quest and start it immediately
        new_quest = Quest(status="in_progress")
        new_quest.save()  # model auto-picks POI/xp/description/name
        # Fetch relateds for response
        new_quest.refresh_from_db()
        if new_quest.poi_id:
            new_quest = (
                Quest.objects.select_related("poi", "poi__region")
                .only("id", "status", "xp", "description", "quest_giver_name",
                      "quest_giver_img_number", "poi__name", "poi__region__name")
                .get(pk=new_quest.pk)
            )

    return Response({
        "status": "success",
        "completed": {
            "id": quest.id,
            "poi_name": quest.poi.name,
            "region_name": quest.poi.region.name if quest.poi and quest.poi.region_id else None,
            "status": quest.status,
        },
        "next": {
            "id": new_quest.id,
            "status": new_quest.status,
            "xp": new_quest.xp,
            "poi_name": new_quest.poi.name if new_quest.poi_id else None,
            "region_name": new_quest.poi.region.name if new_quest.poi_id and new_quest.poi.region_id else None,
            "description": new_quest.description,
            "quest_giver_name": new_quest.quest_giver_name,
            "quest_giver_img_url": new_quest.quest_giver_img_url,
        },
    }, status=status.HTTP_200_OK)
