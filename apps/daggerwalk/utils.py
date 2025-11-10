from apps.daggerwalk.models import DaggerwalkLog, ChatCommandLog, Quest, TwitchUserProfile
from apps.daggerwalk.serializers import DaggerwalkLogSerializer
from django.db.models import Min, Max, Count, Sum, F, Window
from django.db.models.functions import Lag
from datetime import timedelta, datetime
from django.utils import timezone
import pytz
import json

EST_TIMEZONE = pytz.timezone('US/Eastern')


def get_latest_log_data():
    actual_latest_log = DaggerwalkLog.objects.select_related('region_fk', 'poi', 'last_known_region').latest('created_at')
    in_ocean = actual_latest_log.region == "Ocean"
    
    if in_ocean:
        latest_non_ocean_log = DaggerwalkLog.objects.exclude(region="Ocean").latest('created_at')
        log_data = DaggerwalkLogSerializer(latest_non_ocean_log).data
        ocean_log_data = DaggerwalkLogSerializer(actual_latest_log).data
        log_data.update({
            'date': ocean_log_data['date'],
            'weather': ocean_log_data['weather'],
            'season': ocean_log_data['season'],
            'current_song': ocean_log_data['current_song'],
            'last_known_region': actual_latest_log.last_known_region.name if actual_latest_log.last_known_region else None
        })
    else:
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
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


def format_distance(km):
    return f"{km:.2f}" if km < 1 else f"{km:.0f}"


def extract_date_key(date_str):
    if not date_str:
        return None
    parts = date_str.split(',')
    if len(parts) >= 3:
        return f"{parts[1].strip()}, {parts[2].strip()}"
    return date_str.strip()


def format_last_seen(dt):
    if not isinstance(dt, datetime):
        return None
    dt_local = dt.astimezone(EST_TIMEZONE)
    try:
        return dt_local.strftime('%B %-d, %-I:%M %p')
    except ValueError:
        return dt_local.strftime('%B %d, %I:%M %p')


def get_top_values_by_time_counts(value_counts, attr, top_n=10):
    results = []
    for value_data in value_counts[:top_n]:
        value = value_data[attr]
        count = value_data['count']
        entry = {'name': value, 'time': format_minutes(count * 5)}
        if attr == 'weather':
            entry['emoji'] = DaggerwalkLog.get_weather_emoji(value)
        results.append(entry)
    return results


def calculate_daggerwalk_stats(range_keyword):
    ranges = get_stats_date_ranges()
    if range_keyword not in ranges and range_keyword != 'all':
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

    distance_qs = queryset.annotate(
        prev_x=Window(expression=Lag('player_x'), order_by=F('created_at').asc()),
        prev_z=Window(expression=Lag('player_z'), order_by=F('created_at').asc())
    ).exclude(prev_x__isnull=True).aggregate(
        total_distance=Sum(((F('player_x') - F('prev_x')) ** 2 + (F('player_z') - F('prev_z')) ** 2) ** 0.5)
    )
    
    total_distance_km = (distance_qs['total_distance'] or 0) / 1000.0

    chat_qs = ChatCommandLog.objects.filter(request_log__created_at__date__range=(start_date, end_date))
    chat_stats = chat_qs.aggregate(total_cmds=Count('id'), walker_count=Count('user', distinct=True))
    most_common_cmd = chat_qs.values("command").annotate(count=Count("id")).order_by("-count").first()

    command_summary = {
        "totalCommands": chat_stats['total_cmds'],
        "mostCommonCommand": most_common_cmd["command"] if most_common_cmd else None,
        "numWalkers": chat_stats['walker_count'],
        "avgCommandsPerWalker": round(chat_stats['total_cmds'] / chat_stats['walker_count'], 2) if chat_stats['walker_count'] else 0,
    }

    top_cmds = list(chat_qs.values('command').annotate(count=Count('id')).order_by('-count')[:10])
    top_users = list(chat_qs.values('user').annotate(count=Count('id')).order_by('-count')[:10])
    last_100 = chat_qs.order_by('-timestamp')[:100]
    
    chat_command_stats = {
        "total": chat_stats['total_cmds'],
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

    completed_qs = Quest.objects.filter(status="completed", completed_at__date__range=(start_date, end_date))
    quest_agg = completed_qs.aggregate(quest_count=Count('id'), total_xp=Sum('xp'))
    quest_count = quest_agg['quest_count'] or 0
    
    quest_stats = {
        "completedQuests": quest_count,
        "avgQuestTime": None,
        "totalXpAwarded": quest_agg['total_xp'] or 0,
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

        walkers_with_xp = (
            TwitchUserProfile.objects.filter(
                completed_quests__status="completed",
                completed_quests__completed_at__date__range=(start_date, end_date),
            )
            .values("id")
            .distinct()
            .count()
        )
        
        quest_stats.update({
            "avgQuestTime": format_minutes(int(avg_duration)),
            "walkersWithXp": walkers_with_xp,
            "avgDistanceTraveled": format_distance(float(total_distance_km) / quest_count),
        })

    region_stats = list(
        queryset.values('region')
        .annotate(count=Count('id'), last_seen=Max('created_at'))
        .order_by('-count')[:10]
    )
    mostVisitedRegions = sorted(
        [{'region': r['region'], 'lastSeen': format_last_seen(r['last_seen'])} for r in region_stats],
        key=lambda r: (r['lastSeen'] is not None, r['lastSeen']),
        reverse=True
    )

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

    song_counts = list(
        queryset.exclude(current_song__isnull=True)
        .values('current_song')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    most_common_song = song_counts[0] if song_counts else None
    total_songs_heard = len(song_counts)

    weather_counts = list(queryset.values('weather').annotate(count=Count('id')).order_by('-count'))
    most_common_weather = weather_counts[0] if weather_counts else None

    time_range_data = queryset.aggregate(
        first_date=Min('date'),
        last_date=Max('date'),
        first_season=Min('season'),
        last_season=Max('season'),
    )

    unique_date_strings = queryset.values_list('date', flat=True).distinct()
    unique_days = {extract_date_key(d) for d in unique_date_strings if d}

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
            "startDate": extract_date_key(time_range_data['first_date']),
            "endDate": extract_date_key(time_range_data['last_date']),
            "startSeason": time_range_data['first_season'],
            "endSeason": time_range_data['last_season'],
            "uniqueDays": len(unique_days),
        },
        'chatCommandStats': chat_command_stats,
        'commandSummary': command_summary,
        'questStats': quest_stats,
    }