from .models import POI, DaggerwalkLog, Quest, Region, ChatCommandLog, TwitchUserProfile, Monument, ProgressionEvent
from django.contrib.admin.views.decorators import staff_member_required
from rest_framework.decorators import api_view, permission_classes
from apps.daggerwalk.quest_gen import complete_and_rotate_quest, ensure_active_quests
from apps.daggerwalk.tasks import update_all_daggerwalk_caches
from django.views.decorators.cache import cache_control
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.template.loader import render_to_string
from django.utils.dateparse import parse_datetime
from rest_framework.renderers import JSONRenderer
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models.functions import Coalesce
from django.db.models import Count, IntegerField, Sum, Max, Q
from django.core.paginator import Paginator
from apps.api.views import BaseListAPIView
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.core.cache import cache
from django.shortcuts import render
from django.http import HttpResponse
from urllib.parse import urlencode
from rest_framework import status
from django.utils import timezone
from django.urls import reverse
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
from .cache_keys import (
    DAGGERWALK_HOME_HTML_CACHE_KEY,
    GUILD_HALL_HTML_CACHE_KEY,
    LEADERBOARD_CACHE_KEY,
    PROGRESSION_CACHE_KEYS,
    PROGRESSION_HOME_CACHE_KEY,
    completed_quest_html_cache_key,
)
from .journeys import completed_quest_detail_context
from .progression import GUILDS, MONUMENT_TYPES, cached_progression_snapshot, change_guild, exclude_publicly_unlisted, guild_hall_page_payload, is_publicly_unlisted, monument_display_rows, place_monument, profile_payload, progression_event_description, progression_home_payload, resolve_profile


logger = logging.getLogger(__name__)


def _bot_authorized(request):
    api_key = getattr(settings, "DAGGERWALK_API_KEY", None)
    return bool(api_key and request.headers.get("Authorization") == f"Bearer {api_key}")


def _invalidate_progression_caches(keys=PROGRESSION_CACHE_KEYS):
    try:
        cache.delete_many(keys)
    except Exception:
        logger.exception("Could not invalidate Daggerwalk progression caches")


def _queue_cache_rebuild():
    try:
        update_all_daggerwalk_caches.delay()
    except Exception:
        # Database mutations have already committed; a cache outage must not turn
        # a successful guild, monument, or quest action into a false API failure.
        logger.exception("Could not queue Daggerwalk cache rebuild")


# @method_decorator(cache_page(60 * 60 * 24 * 30), name="dispatch")  # 30 days
class DaggerwalkHomeView(APIView):
    """Home view for the Daggerwalk app"""
    permission_classes = [AllowAny]
    template_path = 'daggerwalk/index.html'

    def get(self, request):
        html = cache.get(DAGGERWALK_HOME_HTML_CACHE_KEY)
        if html is not None:
            return HttpResponse(html)

        logger.warning('Daggerwalk home HTML cache miss')
        active_quests = cache.get("daggerwalk_active_quests") or []
        if len(active_quests) != 3:
            active_quests = ensure_active_quests()
            cache.set("daggerwalk_active_quests", active_quests, timeout=None)
        quest = active_quests[0] if active_quests else None
        cache.set("daggerwalk_current_quest", quest, timeout=None)
        previous_quests = cache.get("daggerwalk_previous_quests")
        if previous_quests is None:
            previous_quests = (
                Quest.objects
                .filter(status="completed")
                .select_related("poi", "poi__region")
                .order_by("-completed_at")[:10]
            )
            cache.set("daggerwalk_previous_quests", previous_quests, timeout=None)
        leaderboard = cache.get(LEADERBOARD_CACHE_KEY)
        if leaderboard is None:
            leaderboard = list(cached_progression_snapshot()["profiles"].values())[:100]
            cache.set(LEADERBOARD_CACHE_KEY, leaderboard, timeout=None)
        quest_data = QuestSerializer(active_quests, many=True).data
        context = {
            "active_quests": active_quests,
            "current_quest": quest,
            "previous_quests": previous_quests,
            "active_quests_json": JSONRenderer().render(quest_data).decode("utf-8"),
            "leaderboard": leaderboard,
            "logs_json": cache.get("daggerwalk_map_logs") or [],
            "poi_json": cache.get("daggerwalk_map_pois") or [],
            "monuments_json": cache.get("daggerwalk_map_monuments") or [],
            "quest_json": cache.get("daggerwalk_map_quest") or [],
            "shape_data": cache.get("daggerwalk_map_shape_data") or [],
        }
        progression_home = cache.get(PROGRESSION_HOME_CACHE_KEY)
        if progression_home is None:
            progression_home = progression_home_payload()
            cache.set(PROGRESSION_HOME_CACHE_KEY, progression_home, timeout=None)
        context.update(progression_home)
        return render(request, self.template_path, context)


def completed_quest_detail(request, quest_id):
    """Show one completed quest and the walkers who earned its XP."""
    cache_key = completed_quest_html_cache_key(quest_id)
    html = cache.get(cache_key)
    if html is not None:
        return HttpResponse(html)

    quest = get_object_or_404(
        Quest.objects.select_related("poi", "poi__region"),
        pk=quest_id,
        status="completed",
    )
    html = render_to_string(
        "daggerwalk/completed_quest.html",
        completed_quest_detail_context(quest),
    )
    cache.set(cache_key, html, timeout=None)
    return HttpResponse(html)


def walker_chronicle(request, username):
    profile = TwitchUserProfile.objects.filter(twitch_username__iexact=username).first()
    if not profile:
        return HttpResponse(status=404)
    snapshot = cached_progression_snapshot()
    summary = snapshot["profiles"].get(profile.twitch_username.casefold())
    if summary is None:
        snapshot = cached_progression_snapshot(refresh=True)
        summary = snapshot["profiles"].get(profile.twitch_username.casefold())
    if summary is None and is_publicly_unlisted(profile.twitch_username):
        summary = profile_payload(profile)
    if summary is None:
        return HttpResponse(status=404)
    if username != profile.twitch_username:
        return redirect("daggerwalk_walker", username=profile.twitch_username, permanent=True)
    guild_credits = profile.progression_events.filter(event_type="quest").exclude(
        payload__guild=""
    ).values("payload__guild").annotate(
        total=Coalesce(Sum("quest__xp"), 0, output_field=IntegerField())
    )
    profile._guild_xp_by_key = {row["payload__guild"]: row["total"] for row in guild_credits}
    command_log = profile.chat_commands.order_by("-timestamp")
    qualifying = command_log.filter(command__in=settings.DAGGERWALK_QUALIFYING_COMMANDS)
    command_rows = list(qualifying.values("command").annotate(count=Count("id")).order_by("-count", "command"))
    guild_history = [
        {"guild": info, "xp": profile._guild_xp_by_key[key]}
        for key, info in GUILDS.items() if key in profile._guild_xp_by_key
    ]
    quests = profile.completed_quests.select_related("poi", "poi__region").order_by("-completed_at")
    quest_page = Paginator(quests, 15).get_page(request.GET.get("page"))
    monuments = list(profile.monuments.select_related("poi", "poi__region").annotate(
        visit_count=Count("progression_events", filter=Q(progression_events__event_type="monument_visit")),
        latest_visit=Max("progression_events__created_at", filter=Q(progression_events__event_type="monument_visit")),
    ))
    events = list(profile.progression_events.select_related("quest", "monument", "monument__poi").order_by("-created_at")[:10])
    for event in events:
        event.description = progression_event_description(event)
    return render(request, "daggerwalk/chronicle.html", {
        "profile": profile, "summary": summary, "commands": command_rows,
        "command_count": sum(row["count"] for row in command_rows), "guild_history": guild_history,
        "command_log": command_log[:25],
        "monuments": monuments,
        "events": events,
        "quests": quest_page, "unique_regions": quests.values("poi__region_id").distinct().count(),
        "unique_pois": quests.values("poi_id").distinct().count(),
    })


def guild_hall(request):
    html = cache.get(GUILD_HALL_HTML_CACHE_KEY)
    if html is None:
        html = render_to_string(
            "daggerwalk/guild_hall.html",
            {"guilds": guild_hall_page_payload(), "active_nav": "guild_hall"},
            request=request,
        )
        cache.set(GUILD_HALL_HTML_CACHE_KEY, html, timeout=None)
    return HttpResponse(html)


def monument_registry(request):
    monuments = Monument.objects.select_related("poi", "poi__region", "owner").annotate(
        latest_visit=Max("progression_events__created_at", filter=Q(progression_events__event_type="monument_visit")),
    ).order_by("-created_at")
    filters = {key: request.GET.get(key, "").strip() for key in ("owner", "guild", "type", "region")}
    if filters["owner"]:
        monuments = monuments.filter(owner__twitch_username__iexact=filters["owner"])
    if filters["guild"]:
        monuments = monuments.filter(guild_at_placement=filters["guild"])
    if filters["type"]:
        monuments = monuments.filter(monument_type=filters["type"])
    if filters["region"]:
        monuments = monuments.filter(poi__region__name__iexact=filters["region"])
    monuments = monument_display_rows(list(monuments[:250]))
    return render(request, "daggerwalk/monument_registry.html", {
        "monuments": monuments, "filters": filters, "guilds": GUILDS,
        "monument_types": MONUMENT_TYPES,
    })
    

@api_view(["GET"])
@permission_classes([AllowAny])
@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def daggerwalk_refresh_data(request):
    """Fetch latest map data without reloading the page."""
    data = {
        "logs": cache.get("daggerwalk_map_logs") or [],
        "pois": cache.get("daggerwalk_map_pois") or [],
        "monuments": cache.get("daggerwalk_map_monuments") or [],
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
            "latest_log_data": cache.get("daggerwalk_latest_log_data") or {}
        }
        return Response(data)
    

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def create_daggerwalk_log(request):
    """API endpoint to create a new Daggerwalk log entry along with associated chat logs and quest handling"""
    if not _bot_authorized(request):
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
            profile_map = {uname.casefold(): resolve_profile(uname).id for uname in usernames}
            
            # Assign profile IDs to chat logs
            for obj in chat_logs_to_create:
                pid = profile_map.get(obj.user.casefold())
                if pid:
                    obj.profile_id = pid
                    
            ChatCommandLog.objects.bulk_create(chat_logs_to_create)

        # Quest flow
        active_quests = ensure_active_quests()
        completed_quests = []

        for active_quest in active_quests:
            ordinary_arrival = log_entry.poi_id and active_quest.poi_id == log_entry.poi_id
            monument_arrival = (
                hasattr(active_quest.poi, "monument")
                and active_quest.poi.region_id == log_entry.region_fk_id
                and active_quest.poi.map_pixel_x == log_entry.map_pixel_x
                and active_quest.poi.map_pixel_y == log_entry.map_pixel_y
            )
            if ordinary_arrival or monument_arrival:
                complete_and_rotate_quest(
                    active_quest,
                    completed_at=log_entry.created_at,
                    completion_request_log_id=log_entry.id,
                )
                completed_quests.append(active_quest)
                if hasattr(active_quest.poi, "monument"):
                    monument = active_quest.poi.monument
                    ProgressionEvent.objects.create(
                        profile=monument.owner, event_type="monument_visit",
                        quest=active_quest, monument=monument,
                        payload={"name": active_quest.poi.name},
                    )

        active_quests = ensure_active_quests()

        # Serialize responses
        log_payload = DaggerwalkLogSerializer(log_entry).data
        active_quest_payloads = QuestSerializer(active_quests, many=True).data
        completed_quest_payloads = QuestSerializer(completed_quests, many=True).data
        current_quest_payload = active_quest_payloads[0] if active_quest_payloads else None
        completed_quest_payload = completed_quest_payloads[0] if completed_quest_payloads else None

        progression = cached_progression_snapshot(refresh=bool(completed_quests))
        if completed_quests:
            _invalidate_progression_caches([
                DAGGERWALK_HOME_HTML_CACHE_KEY,
                PROGRESSION_HOME_CACHE_KEY,
                GUILD_HALL_HTML_CACHE_KEY,
                LEADERBOARD_CACHE_KEY,
            ])
        _queue_cache_rebuild()

        return Response({
            "status": "success",
            "message": "Log entry created",
            "id": log_entry.id,
            "log": log_payload,                          # serialized DaggerwalkLog (nested region_fk, poi)
            "quest_completed": bool(completed_quests),   # legacy bool
            "completed_quest": completed_quest_payload,  # serialized Quest or null
            "current_quest": current_quest_payload,      # serialized Quest or null
            "completed_quests": completed_quest_payloads,
            "active_quests": active_quest_payloads,
            "progression": progression,
        }, status=status.HTTP_201_CREATED)

    except KeyError as e:
        return Response({"status": "error", "message": f"Missing required field: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"status": "error", "message": f"An error occurred: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def bot_progression_snapshot(request):
    if not _bot_authorized(request):
        return Response({"status": "error", "message": "Unauthorized"}, status=401)
    return Response(cached_progression_snapshot())


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_exempt
def bot_guild_action(request):
    if not _bot_authorized(request):
        return Response({"status": "error", "message": "Unauthorized"}, status=401)
    try:
        profile = resolve_profile(request.data["username"], request.data.get("twitch_user_id", ""))
        payload = change_guild(profile, request.data.get("guild", ""))
        _invalidate_progression_caches()
        _queue_cache_rebuild()
        return Response({"status": "success", "profile": payload})
    except (KeyError, ValueError) as exc:
        return Response({"status": "error", "message": str(exc)}, status=400)


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_exempt
def bot_monument_action(request):
    if not _bot_authorized(request):
        return Response({"status": "error", "message": "Unauthorized"}, status=401)
    try:
        profile = resolve_profile(request.data["username"], request.data.get("twitch_user_id", ""))
        monument = place_monument(profile, request.data["monument_type"], request.data["state"])
        _invalidate_progression_caches()
        _queue_cache_rebuild()
        return Response({"status": "success", "profile": profile_payload(profile), "monument": {
            "id": monument.id, "name": monument.poi.name, "description": monument.poi.description,
            "region": monument.poi.region.name, "map_pixel_x": monument.poi.map_pixel_x,
            "map_pixel_y": monument.poi.map_pixel_y,
        }}, status=201)
    except (KeyError, ValueError) as exc:
        return Response({"status": "error", "message": str(exc)}, status=400)


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

    def get_queryset(self):
        return exclude_publicly_unlisted(super().get_queryset(), "profile__twitch_username")


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
        "map_focus_x": poi.map_pixel_x,
        "map_focus_y": poi.map_pixel_y,
    }
    return redirect(f"{base}?{urlencode({k: v for k, v in params.items() if v is not None})}")
