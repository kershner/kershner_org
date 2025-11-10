from apps.daggerwalk.models import DaggerwalkLog, ChatCommandLog, Quest, TwitchUserProfile
from apps.daggerwalk.serializers import DaggerwalkLogSerializer
from django.db.models import Min, Max, Count, Sum
from datetime import timedelta, datetime
from django.utils import timezone
import pytz
import json
import math

EST_TIMEZONE = pytz.timezone('US/Eastern')

def get_latest_log_data():
    # Get the absolute latest log regardless of region
    actual_latest_log = DaggerwalkLog.objects.select_related('region_fk', 'poi', 'last_known_region').latest('created_at')
    in_ocean = actual_latest_log.region == "Ocean"
    
    if in_ocean:
        # Get the latest non-ocean log for location data
        latest_non_ocean_log = DaggerwalkLog.objects.exclude(region="Ocean").latest('created_at')
        # Serialize the non-ocean log first
        log_data = DaggerwalkLogSerializer(latest_non_ocean_log).data
        
        # Then override with environmental data from the ocean log
        ocean_log_data = DaggerwalkLogSerializer(actual_latest_log).data
        # Update only the environmental fields
        log_data.update({
            'date': ocean_log_data['date'],
            'weather': ocean_log_data['weather'],
            'season': ocean_log_data['season'],
            'current_song': ocean_log_data['current_song'],
            # Add last_known_region if available
            'last_known_region': actual_latest_log.last_known_region.name if actual_latest_log.last_known_region else None
        })
    else:
        # If latest log is not from ocean, use it directly
        log_data = DaggerwalkLogSerializer(actual_latest_log).data
    
    return {
        'log': json.dumps(log_data, default=str),
        'in_ocean': 'true' if in_ocean else 'false'
    }


def get_stats_date_ranges():
    now_est = timezone.now().astimezone(EST_TIMEZONE).date()

    return {
        'today': (now_est, now_est),
        'yesterday': (now_est - timedelta(days=1), now_est - timedelta(days=1)),
        'last_7_days': (now_est - timedelta(days=6), now_est),
        'this_month': (now_est.replace(day=1), now_est),
    }


def format_minutes(total_minutes):
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours and minutes:
        return f"{hours} hour{'s' if hours != 1 else ''} {minutes} minute{'s' if minutes != 1 else ''}"
    elif hours:
        return f"{hours} hour{'s' if hours != 1 else ''}"
    else:
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    

def format_distance(km):
    return f"{km:.2f}" if km < 1 else f"{km:.0f}"

def extract_date_key(date_str):
    if not date_str:
        return None
    parts = date_str.split(',')
    if len(parts) >= 3:
        return f"{parts[1].strip()}, {parts[2].strip()}"  # e.g., "12 Hearthfire, 3E 407"
    return date_str.strip()

def get_top_values_by_time_counts(value_counts, attr, top_n=10):
    results = []
    for value_data in value_counts[:top_n]:
        value = value_data[attr]
        count = value_data['count']
        entry = {
            'name': value,
            'time': format_minutes(count * 5)
        }
        if attr == 'weather':
            entry['emoji'] = DaggerwalkLog.get_weather_emoji(value)
        results.append(entry)
    return results

def calculate_daggerwalk_stats(range_keyword):
    def format_last_seen(dt):
        if not isinstance(dt, datetime):
            return None
        dt_local = dt.astimezone(EST_TIMEZONE)
        try:
            return dt_local.strftime('%B %-d, %-I:%M %p')
        except ValueError:
            return dt_local.strftime('%B %d, %I:%M %p')

    if range_keyword not in (ranges := get_stats_date_ranges()) and range_keyword != 'all':
        raise ValueError(f'Invalid range: {range_keyword}. Must be one of: {", ".join(list(ranges) + ["all"])}')

    if range_keyword == 'all':
        dates = DaggerwalkLog.objects.aggregate(start=Min('created_at'), end=Max('created_at'))
        if not dates['start'] or not dates['end']:
            raise ValueError('No logs available.')
        start_date, end_date = dates['start'].date(), dates['end'].date()
        queryset = DaggerwalkLog.objects.all()
    else:
        start_date, end_date = ranges[range_keyword]
        queryset = DaggerwalkLog.objects.filter(created_at__date__range=(start_date, end_date))

    # --- Command stats: compute once from one queryset ---
    chat_qs = ChatCommandLog.objects.filter(
        request_log__created_at__date__range=(start_date, end_date)
    )

    total_cmds = chat_qs.count()
    walker_count = chat_qs.values("user").distinct().count()
    most_common_cmd = (
        chat_qs.values("command")
        .annotate(count=Count("id"))
        .order_by("-count")
        .first()
    )

    command_summary = {
        "totalCommands": total_cmds,
        "mostCommonCommand": most_common_cmd["command"] if most_common_cmd else None,
        "numWalkers": walker_count,
        "avgCommandsPerWalker": round(total_cmds / walker_count, 2) if walker_count else 0,
    }

    # Build the detailed chatCommandStats from the same chat_qs
    top_cmds = chat_qs.values('command').annotate(count=Count('id')).order_by('-count')[:10]
    top_users = chat_qs.values('user').annotate(count=Count('id')).order_by('-count')[:10]
    last_100 = chat_qs.order_by('-timestamp')[:100]
    chat_command_stats = {
        "total": total_cmds,
        "top_commands": [{"command": c['command'], "count": c['count']} for c in top_cmds],
        "top_users": [{"user": u['user'], "count": u['count']} for u in top_users],
        "last_100": [
            {
                "timestamp": timezone.localtime(c.timestamp, EST_TIMEZONE),
                "user": c.user,
                "command": c.command,
                "args": c.args,
                "raw": c.raw,
            }
            for c in last_100
        ],
    }

    total_logs = queryset.count()
    if total_logs == 0:
        return {
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat(),
            'totalLogs': 0,
            'totalPlaytimeMinutes': 0,
            'formattedPlaytime': 0,
            'totalDistanceKm': 0,
            'mostVisitedRegions': [],
            'mostCommonWeather': None,
            'topPOIsVisited': [],
            'mostCommonSong': None,
            'totalSongsHeard': 0,
            'topSongs': [],
            'topWeather': [],
        }

    total_minutes = total_logs * 5

    # --- Stream distance calc (no full materialization) ---
    # Only fetch the numeric coords + created_at
    coords_iter = queryset.order_by('created_at').values_list('player_x', 'player_z', 'created_at').iterator(chunk_size=5000)
    total_distance_km = 0.0
    prev_x = prev_z = None
    for x, z, created in coords_iter:
        fx, fz = float(x), float(z)
        if prev_x is not None and prev_z is not None:
            dx = fx - prev_x
            dz = fz - prev_z
            total_distance_km += math.sqrt(dx * dx + dz * dz) / 1000.0
        prev_x, prev_z = fx, fz

    # --- Quest Stats (after distance computed) ---
    completed_qs = Quest.objects.filter(
        status="completed",
        completed_at__date__range=(start_date, end_date),
    )
    quest_count = completed_qs.count()
    quest_stats = {
        "completedQuests": quest_count,
        "avgQuestTime": None,
        "totalXpAwarded": 0,
        "walkersWithXp": 0,
        "avgDistanceTraveled": None,
    }
    if quest_count > 0:
        durations = completed_qs.values_list('created_at', 'completed_at')
        dur_minutes = [
            int((completed_at - created_at).total_seconds() / 60)
            for created_at, completed_at in durations
            if created_at and completed_at
        ]
        avg_duration = (sum(dur_minutes) / len(dur_minutes)) if dur_minutes else 0

        total_xp = completed_qs.aggregate(total=Sum("xp"))["total"] or 0
        walkers_with_xp = (
            TwitchUserProfile.objects.filter(
                completed_quests__status="completed",
                completed_quests__completed_at__date__range=(start_date, end_date),
            )
            .values("id")
            .distinct()
            .count()
        )
        avg_distance_traveled = float(total_distance_km) / quest_count if quest_count else 0.0

        quest_stats.update({
            "avgQuestTime": format_minutes(int(avg_duration)),
            "totalXpAwarded": total_xp,
            "walkersWithXp": walkers_with_xp,
            "avgDistanceTraveled": format_distance(avg_distance_traveled),
        })

    # --- Region frequency + last seen in one pass, then sort by last seen ---
    region_stats = list(
        queryset.values('region')
        .annotate(count=Count('id'), last_seen=Max('created_at'))
        .order_by('-count')[:10]
    )
    mostVisitedRegions = sorted(
        [
            {
                'region': r['region'],
                'lastSeen': format_last_seen(r['last_seen']),
            }
            for r in region_stats
        ],
        key=lambda r: (r['lastSeen'] is not None, r['lastSeen']),
        reverse=True
    )

    # --- POIs ---
    top_pois = queryset.exclude(poi__isnull=True).values(
        'poi__name', 'poi__emoji', 'region_fk__name'
    ).annotate(log_count=Count('id')).order_by('-log_count')[:10]
    topPOIsVisited = [
        {
            'poi': p['poi__name'],
            'region': p['region_fk__name'],
            'emoji': p['poi__emoji'],
            'timeSpentMinutes': p['log_count'] * 5
        }
        for p in top_pois
    ]

    # --- Songs ---
    song_counts = queryset.exclude(current_song__isnull=True).values('current_song') \
        .annotate(count=Count('id')).order_by('-count')
    most_common_song = song_counts.first()
    total_songs_heard = song_counts.count()

    # --- Weather ---
    weather_counts = queryset.values('weather').annotate(count=Count('id')).order_by('-count')
    most_common_weather = weather_counts.first()

    # --- In-game time range + unique days (stream dates only) ---
    first_entry = queryset.order_by('created_at').only('date', 'season').first()
    last_entry = queryset.order_by('-created_at').only('date', 'season').first()

    unique_days = set()
    for d in queryset.values_list('date', flat=True).iterator(chunk_size=5000):
        if d:
            unique_days.add(extract_date_key(d))

    return {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'totalLogs': total_logs,
        'totalPlaytimeMinutes': total_minutes,
        'formattedPlaytime': format_minutes(total_minutes),
        'totalDistanceKm': format_distance(total_distance_km),
        'mostVisitedRegions': mostVisitedRegions,
        'mostCommonWeather': most_common_weather['weather'] if most_common_weather else None,
        'topPOIsVisited': topPOIsVisited,
        'mostCommonSong': most_common_song['current_song'] if most_common_song else None,
        'totalSongsHeard': total_songs_heard,
        'topSongs': get_top_values_by_time_counts(song_counts, 'current_song'),
        'topWeather': get_top_values_by_time_counts(weather_counts, 'weather'),
        'inGameTimeRange': {
            "startDate": extract_date_key(first_entry.date) if first_entry else None,
            "endDate": extract_date_key(last_entry.date) if last_entry else None,
            "startSeason": first_entry.season if first_entry else None,
            "endSeason": last_entry.season if last_entry else None,
            "uniqueDays": len(unique_days),
        },
        'chatCommandStats': chat_command_stats,
        'commandSummary': command_summary,
        'questStats': quest_stats,
    }
