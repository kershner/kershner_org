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
    """
    Get date ranges for streaming days (9am EST to midnight EST).
    Each streaming day is 15 hours: 9:00am - 11:59:59pm on the same calendar day.
    """
    now_est = timezone.now().astimezone(EST_TIMEZONE)
    current_date = now_est.date()
    
    # Today's streaming day: 9am today to midnight tonight (or now if before midnight)
    today_start = EST_TIMEZONE.localize(datetime.combine(current_date, datetime.min.time().replace(hour=9)))
    today_end = EST_TIMEZONE.localize(datetime.combine(current_date, datetime.max.time()))  # 11:59:59.999999pm
    
    # Use current time if we haven't reached midnight yet
    if now_est < today_end:
        today_end = now_est
    
    # Yesterday's streaming day: 9am yesterday to midnight yesterday
    yesterday_date = current_date - timedelta(days=1)
    yesterday_start = EST_TIMEZONE.localize(datetime.combine(yesterday_date, datetime.min.time().replace(hour=9)))
    yesterday_end = EST_TIMEZONE.localize(datetime.combine(yesterday_date, datetime.max.time()))
    
    # Last 7 streaming days: 9am 6 days ago to now (or midnight today)
    seven_days_ago_date = current_date - timedelta(days=6)
    seven_days_start = EST_TIMEZONE.localize(datetime.combine(seven_days_ago_date, datetime.min.time().replace(hour=9)))
    seven_days_end = today_end
    
    # This month: 9am on the 1st to now (or midnight today)
    first_of_month = current_date.replace(day=1)
    month_start = EST_TIMEZONE.localize(datetime.combine(first_of_month, datetime.min.time().replace(hour=9)))
    month_end = today_end

    return {
        'today': (today_start, today_end),
        'yesterday': (yesterday_start, yesterday_end),
        'last_7_days': (seven_days_start, seven_days_end),
        'this_month': (month_start, month_end),
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

def calculate_daggerwalk_stats(range_keyword, all_logs, all_chats, all_quests):
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

    # Determine date range and filter logs
    if range_keyword == 'all':
        if not all_logs:
            raise ValueError('No logs available.')
        start_datetime = all_logs[0]['created_at']
        end_datetime = all_logs[-1]['created_at']
        filtered_logs = all_logs
        # For 'all', no UTC conversion needed since we use all logs
        start_datetime_utc = start_datetime
        end_datetime_utc = end_datetime
    else:
        start_datetime, end_datetime = ranges[range_keyword]
        # Convert to UTC for comparison (logs are stored in UTC)
        start_datetime_utc = start_datetime.astimezone(pytz.UTC)
        end_datetime_utc = end_datetime.astimezone(pytz.UTC)
        
        # Filter by datetime (not just date) to respect streaming day hours
        filtered_logs = [
            log for log in all_logs 
            if start_datetime_utc <= log['created_at'] <= end_datetime_utc
        ]
    
    # Convert to dates for display purposes
    start_date = start_datetime.date() if hasattr(start_datetime, 'date') else start_datetime
    end_date = end_datetime.date() if hasattr(end_datetime, 'date') else end_datetime
    
    filtered_chats = [
        chat for chat in all_chats
        if start_datetime_utc <= chat['request_log__created_at'] <= end_datetime_utc
    ]
    
    filtered_quests = [
        quest for quest in all_quests
        if quest.get('completed_at') and start_datetime_utc <= quest['completed_at'] <= end_datetime_utc
    ]

    # Chat command stats
    total_cmds = len(filtered_chats)
    unique_users = set(chat['user'] for chat in filtered_chats)
    walker_count = len(unique_users)
    
    cmd_counts = {}
    user_counts = {}
    for chat in filtered_chats:
        cmd_counts[chat['command']] = cmd_counts.get(chat['command'], 0) + 1
        user_counts[chat['user']] = user_counts.get(chat['user'], 0) + 1
    
    most_common_cmd = max(cmd_counts.items(), key=lambda x: x[1])[0] if cmd_counts else None
    
    command_summary = {
        "totalCommands": total_cmds,
        "mostCommonCommand": most_common_cmd,
        "numWalkers": walker_count,
        "avgCommandsPerWalker": round(total_cmds / walker_count, 2) if walker_count else 0,
    }

    top_cmds = sorted(cmd_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_users = sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    last_100 = filtered_chats[:100]
    
    chat_command_stats = {
        "total": total_cmds,
        "top_commands": [{"command": cmd, "count": count} for cmd, count in top_cmds],
        "top_users": [{"user": user, "count": count} for user, count in top_users],
        "last_100": [
            {
                "timestamp": timezone.localtime(
                    datetime.fromisoformat(str(c['timestamp'])) if isinstance(c['timestamp'], str) 
                    else c['timestamp'], 
                    EST_TIMEZONE
                ),
                "user": c['user'],
                "command": c['command'],
                "args": c['args'],
                "raw": c['raw'],
            }
            for c in last_100
        ],
    }

    total_logs = len(filtered_logs)
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
            'inGameTimeRange': {},
            'chatCommandStats': chat_command_stats,
            'commandSummary': command_summary,
            'questStats': {},
        }

    # Calculate walking time from actual time span instead of log count
    # (to account for duplicate logs created in quick succession)
    if total_logs > 1:
        first_time = filtered_logs[0]['created_at']
        last_time = filtered_logs[-1]['created_at']
        time_diff_minutes = (last_time - first_time).total_seconds() / 60
        total_minutes = int(time_diff_minutes)
    else:
        total_minutes = total_logs * 5

    # Calculate total distance traveled
    total_distance_km = 0.0
    prev_x = prev_z = None
    for log in filtered_logs:
        fx, fz = float(log['player_x']), float(log['player_z'])
        if prev_x is not None and prev_z is not None:
            dx = fx - prev_x
            dz = fz - prev_z
            total_distance_km += math.sqrt(dx * dx + dz * dz) / 1000.0
        prev_x, prev_z = fx, fz

    # Quest stats
    quest_count = len(filtered_quests)
    quest_stats = {
        "completedQuests": quest_count,
        "avgQuestTime": None,
        "totalXpAwarded": 0,
        "walkersWithXp": 0,
        "avgDistanceTraveled": None,
    }
    
    if quest_count > 0:
        dur_minutes = [
            int((q['completed_at'] - q['created_at']).total_seconds() / 60)
            for q in filtered_quests
            if q.get('created_at') and q.get('completed_at')
        ]
        avg_duration = (sum(dur_minutes) / len(dur_minutes)) if dur_minutes else 0
        total_xp = sum(q.get('xp', 0) for q in filtered_quests)
        
        walkers_with_xp = (
            TwitchUserProfile.objects.filter(
                completed_quests__status="completed",
                completed_quests__completed_at__range=(start_datetime, end_datetime),
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

    # Region frequency and last seen
    region_data = {}
    for log in filtered_logs:
        region = log['region']
        if region not in region_data:
            region_data[region] = {'count': 0, 'last_seen': log['created_at']}
        region_data[region]['count'] += 1
        if log['created_at'] > region_data[region]['last_seen']:
            region_data[region]['last_seen'] = log['created_at']
    
    region_stats = sorted(region_data.items(), key=lambda x: x[1]['count'], reverse=True)[:10]
    mostVisitedRegions = sorted(
        [
            {
                'region': region,
                'lastSeen': format_last_seen(data['last_seen']),
            }
            for region, data in region_stats
        ],
        key=lambda r: (r['lastSeen'] is not None, r['lastSeen']),
        reverse=True
    )

    # POI stats
    poi_data = {}
    for log in filtered_logs:
        if log.get('poi__name'):
            key = (log['poi__name'], log.get('region_fk__name'), log.get('poi__emoji'))
            poi_data[key] = poi_data.get(key, 0) + 1
    
    top_pois = sorted(poi_data.items(), key=lambda x: x[1], reverse=True)[:10]
    topPOIsVisited = [
        {
            'poi': poi_name,
            'region': region_name,
            'emoji': emoji,
            'timeSpentMinutes': count * 5
        }
        for (poi_name, region_name, emoji), count in top_pois
    ]

    # Song stats
    song_counts = {}
    for log in filtered_logs:
        if log.get('current_song'):
            song = log['current_song']
            song_counts[song] = song_counts.get(song, 0) + 1
    
    song_items = sorted(song_counts.items(), key=lambda x: x[1], reverse=True)
    most_common_song = song_items[0][0] if song_items else None
    total_songs_heard = len(song_counts)

    # Weather stats
    weather_counts = {}
    for log in filtered_logs:
        weather = log['weather']
        weather_counts[weather] = weather_counts.get(weather, 0) + 1
    
    weather_items = sorted(weather_counts.items(), key=lambda x: x[1], reverse=True)
    most_common_weather = weather_items[0][0] if weather_items else None

    # In-game time range and unique days
    first_entry = filtered_logs[0] if filtered_logs else None
    last_entry = filtered_logs[-1] if filtered_logs else None

    unique_days = set()
    for log in filtered_logs:
        if log.get('date'):
            unique_days.add(extract_date_key(log['date']))

    def get_top_values(items_dict, attr_name, top_n=10):
        results = []
        sorted_items = sorted(items_dict.items(), key=lambda x: x[1], reverse=True)[:top_n]
        for value, count in sorted_items:
            entry = {
                'name': value,
                'time': format_minutes(count * 5)
            }
            if attr_name == 'weather':
                entry['emoji'] = DaggerwalkLog.get_weather_emoji(value)
            results.append(entry)
        return results

    return {
        'startDate': start_date.isoformat(),
        'endDate': end_date.isoformat(),
        'totalLogs': total_logs,
        'totalPlaytimeMinutes': total_minutes,
        'formattedPlaytime': format_minutes(total_minutes),
        'totalDistanceKm': format_distance(total_distance_km),
        'mostVisitedRegions': mostVisitedRegions,
        'mostCommonWeather': most_common_weather,
        'topPOIsVisited': topPOIsVisited,
        'mostCommonSong': most_common_song,
        'totalSongsHeard': total_songs_heard,
        'topSongs': get_top_values(song_counts, 'current_song'),
        'topWeather': get_top_values(weather_counts, 'weather'),
        'inGameTimeRange': {
            "startDate": extract_date_key(first_entry['date']) if first_entry else None,
            "endDate": extract_date_key(last_entry['date']) if last_entry else None,
            "startSeason": first_entry.get('season') if first_entry else None,
            "endSeason": last_entry.get('season') if last_entry else None,
            "uniqueDays": len(unique_days),
        },
        'chatCommandStats': chat_command_stats,
        'commandSummary': command_summary,
        'questStats': quest_stats,
    }