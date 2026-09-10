import math

from apps.daggerwalk.models import DaggerwalkLog
from apps.daggerwalk.progression import is_publicly_unlisted


JOURNEY_LOG_FIELDS = (
    "id",
    "created_at",
    "world_x",
    "world_z",
    "region",
    "location",
    "poi_id",
    "poi__name",
    "weather",
)


def _ordered_unique(values):
    seen = set()
    result = []
    for value in values:
        if not value:
            continue
        key = str(value).casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def _location_label(log):
    if not log:
        return "Unknown"
    location = (log.get("location") or "").strip()
    region = (log.get("region") or "").strip()
    if location and region and location.casefold() != region.casefold():
        return f"{location}, {region}"
    return location or region or "Unknown"


def _format_duration(start, end):
    total_minutes = max(0, int((end - start).total_seconds() / 60))
    hours, minutes = divmod(total_minutes, 60)
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def _quest_route_logs(quest):
    start_time = quest.start_time
    start_log = (
        DaggerwalkLog.objects
        .filter(created_at__lte=start_time)
        .order_by("-created_at")
        .values(*JOURNEY_LOG_FIELDS)
        .first()
    )
    journey_logs = list(
        DaggerwalkLog.objects
        .filter(created_at__gt=start_time, created_at__lte=quest.completed_at)
        .order_by("created_at")
        .values(*JOURNEY_LOG_FIELDS)
    )
    return ([start_log] if start_log else []) + journey_logs


def completed_quest_detail_context(quest, route_logs=None, participants=None):
    if participants is None:
        participants = list(quest.completed_by.all())
    participants = [
        profile for profile in participants
        if not is_publicly_unlisted(profile.twitch_username)
    ]
    participants.sort(key=lambda profile: profile.twitch_username.casefold())
    if route_logs is None:
        route_logs = _quest_route_logs(quest)

    distance_km = 0.0
    for previous, current in zip(route_logs, route_logs[1:]):
        distance_km += math.hypot(
            current["world_x"] - previous["world_x"],
            current["world_z"] - previous["world_z"],
        ) / 1000.0

    regions = _ordered_unique(log["region"] for log in route_logs)
    pois = _ordered_unique(log["poi__name"] for log in route_logs)
    weather = _ordered_unique(log["weather"] for log in route_logs)
    start_log = route_logs[0] if route_logs else None
    end_log = route_logs[-1] if route_logs else None
    end_label = _location_label(end_log)
    if end_label == "Unknown" and quest.poi:
        end_label = f"{quest.poi.name}, {quest.poi.region.name}"

    return {
        "quest": quest,
        "participants": participants,
        "journey": {
            "distance_km": f"{distance_km:.2f}" if distance_km < 1 else f"{distance_km:.0f}",
            "duration": _format_duration(quest.start_time, quest.completed_at),
            "start": _location_label(start_log),
            "end": end_label,
            "regions": regions,
            "region_route": " → ".join(regions) or "Unknown",
            "pois": pois,
            "poi_names": ", ".join(pois) or "None",
            "weather": weather,
            "weather_summary": " · ".join(weather) or "Unknown",
        },
    }
