from apps.daggerwalk.models import DaggerwalkLog, Region, ChatCommandLog
from apps.daggerwalk.serializers import DaggerwalkLogSerializer
from django.db.models import Min, Max, Count
from datetime import timedelta, datetime
from django.utils import timezone
from collections import Counter
import pytz
import json
import math

EST_TIMEZONE = pytz.timezone('US/Eastern')

def get_map_data():
    """Fetch and structure region data for provinceShapes, regionMap, and regionData."""
    
    # Prefetch related objects for efficiency
    regions = Region.objects.prefetch_related(
        'map_parts', 
        'points_of_interest'
    ).select_related(
        'shape'
    ).exclude(name='Ocean')

    province_shapes = {}
    region_map = {}
    region_data = []

    for region in regions:
        # provinceShapes - Store polygon coordinates for each region
        if region.shape:
            province_shapes[region.name] = region.shape.coordinates

        # regionMap - Store FMAP mapping data
        if region.multi_part:
            fmap_parts = [
                {"fmap_image": part.fmap_image, "offset": {"x": part.offset_x, "y": part.offset_y}}
                for part in region.map_parts.all()
            ]
            region_map[region.name] = {
                "multi_part": True,
                "parts": fmap_parts,
                "region_index": region.region_index
            }
        else:
            region_map[region.name] = {
                "fmap_image": region.fmap_image,
                "offset": {"x": region.offset_x, "y": region.offset_y},
                "region_index": region.region_index
            }

        # regionData - Store general region details
        capital = region.points_of_interest.filter(type='capital').first()
        region_data.append({
            "name": region.name,
            "province": region.province,
            "climate": region.climate,
            "capital": {
                "name": capital.name,
                "mapPixelX": capital.map_pixel_x,
                "mapPixelY": capital.map_pixel_y
            } if capital else None
        })

    return {
        "provinceShapes": province_shapes,
        "regionMap": region_map,
        "regionData": region_data,
    }


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


def get_chat_command_stats(start_date, end_date):
    chat_qs = ChatCommandLog.objects.filter(
        request_log__created_at__date__range=(start_date, end_date)
    )

    total = chat_qs.count()

    top_cmds = chat_qs.values('command').annotate(count=Count('id')).order_by('-count')[:10]
    top_users = chat_qs.values('user').annotate(count=Count('id')).order_by('-count')[:10]

    last_20 = chat_qs.order_by('-timestamp')[:20]
    last_20_list = [
        {
            "timestamp": timezone.localtime(c.timestamp, EST_TIMEZONE),
            "user": c.user,
            "command": c.command,
            "args": c.args,
            "raw": c.raw,
        }
        for c in last_20
    ]

    return {
        "total": total,
        "top_commands": [{"command": c['command'], "count": c['count']} for c in top_cmds],
        "top_users": [{"user": u['user'], "count": u['count']} for u in top_users],
        "last_20": last_20_list,
    }

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

    chat_command_stats = get_chat_command_stats(start_date, end_date)

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
            'distancePerDayKm': {},
            'mostCommonSong': None,
            'totalSongsHeard': 0,
            'topSongs': [],
            'topWeather': [],
        }

    # Main query - use iterator for large datasets to save memory
    # Only select the fields we actually need for distance calculation and first/last log
    logs = queryset.order_by('created_at').select_related('poi', 'region_fk').only(
        'created_at', 'player_x', 'player_z', 'region', 'poi', 'weather',
        'date', 'season', 'current_song', 'region_fk__name', 'poi__name', 'poi__emoji'
    )
    # Convert to list once for multiple iterations
    logs_list = list(logs)

    total_minutes = total_logs * 5

    # Distance calculation
    total_distance_km, previous_log, distance_per_day = 0, None, {}
    for log in logs_list:
        if previous_log:
            dist = math.sqrt((log.player_x - previous_log.player_x) ** 2 + (log.player_z - previous_log.player_z) ** 2) / 1000
            total_distance_km += dist
            day = log.created_at.date().isoformat()
            distance_per_day[day] = distance_per_day.get(day, 0) + dist
        previous_log = log

    # Region frequency
    region_counts = queryset.values('region').annotate(count=Count('id')).order_by('-count')[:10]
    top_regions = [r['region'] for r in region_counts]

    # Last seen timestamps for top regions - optimized to use already loaded data
    last_seen_region = {}
    top_regions_set = set(top_regions)  # Convert to set for faster lookup
    
    # Process logs in reverse order (most recent first) to find last seen timestamps
    for log in reversed(logs_list):
        if log.region in top_regions_set and log.region not in last_seen_region:
            last_seen_region[log.region] = log.created_at
            # Stop early if we've found all top regions
            if len(last_seen_region) == len(top_regions):
                break

    mostVisitedRegions = sorted(
        [
            {
                'region': region,
                'lastSeen': format_last_seen(last_seen_region.get(region))
            }
            for region in top_regions
        ],
        key=lambda r: last_seen_region.get(r['region']) or datetime.min,
        reverse=True
    )

    # POIs
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

    # Songs
    song_counts = queryset.exclude(current_song__isnull=True).values('current_song') \
        .annotate(count=Count('id')).order_by('-count')
    most_common_song = song_counts.first()
    total_songs_heard = song_counts.count()

    # Weather
    weather_counts = queryset.values('weather').annotate(count=Count('id')).order_by('-count')
    most_common_weather = weather_counts.first()

    # In-game time - optimized to avoid redundant queryset evaluation
    # Extract dates from already loaded logs instead of making another query
    unique_days = {extract_date_key(log.date) for log in logs_list if log.date}

    first_log = logs_list[0] if logs_list else None
    last_log = logs_list[-1] if logs_list else None

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
        'distancePerDayKm': {day: round(km, 2) for day, km in distance_per_day.items()},
        'mostCommonSong': most_common_song['current_song'] if most_common_song else None,
        'totalSongsHeard': total_songs_heard,
        'topSongs': get_top_values_by_time_counts(song_counts, 'current_song'),
        'topWeather': get_top_values_by_time_counts(weather_counts, 'weather'),
        'inGameTimeRange': {
            "startDate": extract_date_key(first_log.date) if first_log else None,
            "endDate": extract_date_key(last_log.date) if last_log else None,
            "startSeason": first_log.season if first_log else None,
            "endSeason": last_log.season if last_log else None,
            "uniqueDays": len(unique_days),
        },
        'chatCommandStats': chat_command_stats,
    }
