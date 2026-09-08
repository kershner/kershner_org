import math
from collections import Counter
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, IntegerField, Max, Q, Sum
from django.db.models.functions import Coalesce, Lower
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import Monument, POI, ProgressionEvent, Region, TwitchUserProfile
from .cache_keys import PROGRESSION_SNAPSHOT_CACHE_KEY


GUILDS = {
    "fighters": {"name": "Fighters Guild", "emoji": "⚔️", "titles": ["Apprentice", "Journeyman", "Swordsman", "Protector", "Defender", "Warder", "Guardian", "Champion", "Warrior", "Master"]},
    "mages": {"name": "Mages Guild", "emoji": "🔮", "titles": ["Apprentice", "Journeyman", "Evoker", "Conjurer", "Magician", "Enchanter", "Warlock", "Wizard", "Master Wizard", "Archmage"]},
    "thieves": {"name": "Thieves Guild", "emoji": "🗝️", "titles": ["Apprentice", "Journeyman", "Filcher", "Crook", "Robber", "Bandit", "Thief", "Ringleader", "Mastermind", "Master Thief"]},
    "dark-brotherhood": {"name": "Dark Brotherhood", "emoji": "🗡️", "titles": ["Apprentice", "Journeyman", "Operator", "Slayer", "Executioner", "Punisher", "Terminator", "Assassin", "Dark Brother", "Master Assassin"]},
}

MONUMENT_TYPES = {
    **{key: (label, "Pathfinder", emoji) for key, label, emoji in [
        ("cairn", "Cairn", "🪨"), ("signpost", "Signpost", "🪧"), ("milestone", "Milestone", "📍"), ("waystone", "Waystone", "🗿"), ("standing-stone", "Standing Stone", "🗿"), ("boundary-stone", "Boundary Stone", "🪨"), ("trail-marker", "Trail Marker", "🧭"),
        ("campfire", "Campfire", "🔥"), ("campsite", "Campsite", "⛺"), ("shelter", "Shelter", "🏚️"), ("watchpost", "Watchpost", "🛡️"), ("beacon", "Beacon", "🔥"), ("lantern-post", "Lantern Post", "🏮"), ("travelers-rest", "Traveler's Rest", "🛏️"),
        ("shrine", "Shrine", "🙏"), ("altar", "Altar", "🕯️"), ("totem", "Totem", "🗿"), ("mage-rune", "Mage Rune", "🔮"), ("mystic-well", "Mystic Well", "🧿"),
        ("memorial", "Memorial", "🕯️"), ("grave", "Grave", "⚰️"), ("tomb", "Tomb", "⚱️"), ("cenotaph", "Cenotaph", "🏛️"), ("stone-cross", "Stone Cross", "✝️"),
        ("fountain", "Fountain", "⛲"), ("wishing-well", "Wishing Well", "🪣"), ("ruined-arch", "Ruined Arch", "🏚️"), ("stone-pillar", "Stone Pillar", "🏛️"), ("bell", "Bell", "🔔"), ("sundial", "Sundial", "☀️"), ("treasure-cache", "Treasure Cache", "💎"), ("message-stone", "Message Stone", "📜"), ("peculiar-rock", "Peculiar Rock", "🪨"),
    ]},
    **{key: (label, "Hero of the Iliac Bay", emoji) for key, label, emoji in [
        ("obelisk", "Obelisk", "🗿"), ("guild-outpost", "Guild Outpost", "🏰"), ("reliquary", "Reliquary", "⚱️"), ("ritual-circle", "Ritual Circle", "⭕"), ("portal-stone", "Portal Stone", "🌀"), ("statue", "Statue", "🗽"), ("guild-banner", "Guild Banner", "🚩"), ("dragon-skull", "Dragon Skull", "🐉"),
    ]},
    **{key: (label, "Living Legend", emoji) for key, label, emoji in [
        ("hero-marker", "Hero Marker", "🏆"), ("forgotten-monument", "Forgotten Monument", "🏛️"), ("ancient-tree", "Ancient Tree", "🌳"),
    ]},
}


def renown_for_xp(xp):
    ladder = settings.DAGGERWALK_RENOWN_LADDER
    level = max(i for i, (threshold, _) in enumerate(ladder) if xp >= threshold)
    next_entry = ladder[level + 1] if level + 1 < len(ladder) else None
    return level, ladder[level][1], next_entry


def token_count_for_xp(xp):
    base = sum(xp >= threshold for threshold in settings.DAGGERWALK_MONUMENT_TOKEN_THRESHOLDS)
    repeat = max(0, (xp - settings.DAGGERWALK_RENOWN_LADDER[-1][0]) // settings.DAGGERWALK_REPEAT_MONUMENT_TOKEN_XP)
    return base + repeat


def monument_token_balance(profile, xp=None, used=None):
    xp = profile.total_xp if xp is None else xp
    used = profile.monuments.count() if used is None else used
    earned = token_count_for_xp(xp)
    adjustment = profile.monument_token_adjustment
    return earned, adjustment, used, max(0, earned + adjustment - used)


def guild_xp(profile, guild):
    cached = getattr(profile, "_guild_xp_by_key", None)
    if cached is not None:
        return cached.get(guild, 0)
    value = profile.progression_events.filter(event_type="quest", payload__guild=guild).aggregate(
        total=Coalesce(Sum("quest__xp"), 0, output_field=IntegerField())
    )["total"]
    return value or 0


def guild_rank(guild, xp, profile=None):
    thresholds = settings.DAGGERWALK_GUILD_RANK_THRESHOLDS
    level = max(i for i, threshold in enumerate(thresholds) if xp >= threshold)
    if profile:
        cached = getattr(profile, "_guild_rank_levels", None)
        if cached is not None:
            recorded_level = cached.get(guild, 0)
        else:
            recorded_level = max((
                event.payload.get("level", 0)
                for event in profile.progression_events.filter(
                    event_type="guild_rank", payload__guild=guild
                ).only("payload")
            ), default=0)
        level = max(level, recorded_level)
    titles = GUILDS[guild]["titles"]
    next_threshold = thresholds[level + 1] if level + 1 < len(thresholds) else None
    return level, titles[level], next_threshold


def profile_payload(profile, position=None):
    xp = profile.xp_value if hasattr(profile, "xp_value") else profile.total_xp
    _, title, next_renown = renown_for_xp(xp)
    tokens_used = profile.monuments_count_value if hasattr(profile, "monuments_count_value") else profile.monuments.count()
    tokens_earned, token_adjustment, tokens_used, tokens_available = monument_token_balance(profile, xp, tokens_used)
    guild = profile.current_guild
    guild_data = None
    if guild in GUILDS:
        gx = guild_xp(profile, guild)
        rank_level, rank_title, next_guild = guild_rank(guild, gx, profile)
        guild_data = {"key": guild, **GUILDS[guild], "xp": gx, "title": rank_title, "next_xp": next_guild}
    cooldown_until = (
        profile.guild_cooldown_value
        if hasattr(profile, "guild_cooldown_value")
        else guild_cooldown_until(profile)
    )
    thresholds = list(settings.DAGGERWALK_MONUMENT_TOKEN_THRESHOLDS)
    threshold = settings.DAGGERWALK_RENOWN_LADDER[-1][0] + settings.DAGGERWALK_REPEAT_MONUMENT_TOKEN_XP
    while threshold <= xp:
        threshold += settings.DAGGERWALK_REPEAT_MONUMENT_TOKEN_XP
    next_token = next((v for v in thresholds if v > xp), threshold)
    return {
        "username": profile.twitch_username, "twitch_user_id": profile.twitch_user_id,
        "profile_image_url": profile.twitch_profile_image_url, "xp": xp,
        "quests": profile.completed_quests_count_value if hasattr(profile, "completed_quests_count_value") else profile.completed_quests.count(), "position": position,
        "renown_title": title,
        "next_renown": {"xp": next_renown[0], "title": next_renown[1]} if next_renown else None,
        "guild": guild_data,
        "guild_cooldown_until": cooldown_until.isoformat() if cooldown_until else None,
        "tokens_available": tokens_available, "tokens_earned": tokens_earned,
        "token_adjustment": token_adjustment, "next_token_xp": next_token,
        "tokens_used": tokens_used, "monuments_placed": tokens_used,
    }


def progression_snapshot():
    profiles = list(TwitchUserProfile.objects.annotate(
        xp_value=Coalesce(Sum("completed_quests__xp"), 0, output_field=IntegerField()),
        completed_quests_count_value=Count("completed_quests", distinct=True),
    ).filter(xp_value__gt=0).order_by("-xp_value", Lower("twitch_username")))
    excluded = {name.casefold() for name in settings.DAGGERWALK_PROGRESSION_EXCLUDED_USERS}
    profiles = [profile for profile in profiles if profile.twitch_username.casefold() not in excluded]
    profile_ids = [profile.id for profile in profiles]
    monument_counts = dict(
        Monument.objects.filter(owner_id__in=profile_ids)
        .values_list("owner_id").annotate(total=Count("id"))
    )
    guild_cooldowns = {
        profile_id: changed_at + timedelta(days=settings.DAGGERWALK_GUILD_COOLDOWN_DAYS)
        for profile_id, changed_at in ProgressionEvent.objects.filter(
            event_type="guild_change", profile_id__in=profile_ids
        ).values("profile_id").annotate(changed_at=Max("created_at")).values_list(
            "profile_id", "changed_at"
        )
    }
    guild_xp_by_profile = {}
    for row in ProgressionEvent.objects.filter(
        event_type="quest", profile_id__in=profile_ids
    ).values("profile_id", "payload__guild").annotate(
        total=Coalesce(Sum("quest__xp"), 0, output_field=IntegerField())
    ):
        guild_xp_by_profile.setdefault(row["profile_id"], {})[row["payload__guild"]] = row["total"]
    rank_levels_by_profile = {}
    for profile_id, payload in ProgressionEvent.objects.filter(
        event_type="guild_rank", profile_id__in=profile_ids
    ).values_list("profile_id", "payload"):
        guild = payload.get("guild", "")
        levels = rank_levels_by_profile.setdefault(profile_id, {})
        levels[guild] = max(levels.get(guild, 0), payload.get("level", 0))
    for profile in profiles:
        profile.monuments_count_value = monument_counts.get(profile.id, 0)
        profile.guild_cooldown_value = guild_cooldowns.get(profile.id)
        profile._guild_xp_by_key = guild_xp_by_profile.get(profile.id, {})
        profile._guild_rank_levels = rank_levels_by_profile.get(profile.id, {})
    payload = {}
    previous_xp = None
    position = 0
    for index, profile in enumerate(profiles, 1):
        if profile.xp_value != previous_xp:
            position = index
            previous_xp = profile.xp_value
        payload[profile.twitch_username.casefold()] = profile_payload(profile, position)
    monuments = list(Monument.objects.select_related("poi", "poi__region").values(
        "id", "poi__name", "poi__region__name", "poi__map_pixel_x", "poi__map_pixel_y"
    ))
    return {"profiles": payload, "guilds": GUILDS, "monument_types": monument_type_payload(), "monuments": monuments}


def cached_progression_snapshot(refresh=False):
    snapshot = None if refresh else cache.get(PROGRESSION_SNAPSHOT_CACHE_KEY)
    if snapshot is None:
        snapshot = progression_snapshot()
        cache.set(PROGRESSION_SNAPSHOT_CACHE_KEY, snapshot, timeout=None)
    return snapshot


def resolve_profile(username, twitch_user_id=""):
    profile = TwitchUserProfile.objects.filter(twitch_username__iexact=username).first()
    if not profile:
        profile = TwitchUserProfile.objects.create(twitch_username=username, twitch_user_id=twitch_user_id or None)
    changed = []
    if twitch_user_id and profile.twitch_user_id != twitch_user_id:
        profile.twitch_user_id = twitch_user_id
        changed.append("twitch_user_id")
    if changed:
        profile.save(update_fields=changed)
    return profile


@transaction.atomic
def change_guild(profile, guild):
    profile = TwitchUserProfile.objects.select_for_update().get(pk=profile.pk)
    if profile.total_xp <= 0:
        raise ValueError("Complete a quest before joining a guild.")
    now = timezone.now()
    cooldown_until = guild_cooldown_until(profile)
    if cooldown_until and cooldown_until > now:
        raise ValueError(f"Guild allegiance is on cooldown until {cooldown_until.isoformat()}.")
    if guild and guild not in GUILDS:
        raise ValueError("Unknown guild.")
    old = profile.current_guild
    if old == guild:
        raise ValueError("You already have that guild allegiance.")
    profile.current_guild = guild
    profile.save(update_fields=["current_guild"])
    ProgressionEvent.objects.create(
        profile=profile,
        event_type="guild_change",
        payload={
            "old_guild": old,
            "new_guild": guild,
            "title": GUILDS[guild]["titles"][0] if guild else "",
        },
    )
    profile.guild_cooldown_value = now + timedelta(days=settings.DAGGERWALK_GUILD_COOLDOWN_DAYS)
    return profile_payload(profile)


def guild_cooldown_until(profile):
    latest = profile.progression_events.filter(event_type="guild_change").order_by("-created_at").first()
    return latest.created_at + timedelta(days=settings.DAGGERWALK_GUILD_COOLDOWN_DAYS) if latest else None


def monument_type_payload():
    gates = {name: threshold for threshold, name in settings.DAGGERWALK_RENOWN_LADDER}
    return {key: {"label": label, "required_title": title, "required_xp": gates[title], "emoji": emoji} for key, (label, title, emoji) in MONUMENT_TYPES.items()}


def _monument_preview(profile, monument_type, state):
    if monument_type not in MONUMENT_TYPES:
        raise ValueError("Unknown monument type. Use the exact name shown by !monument types.")
    label, required_title, emoji = MONUMENT_TYPES[monument_type]
    required_xp = next(xp for xp, title in settings.DAGGERWALK_RENOWN_LADDER if title == required_title)
    if profile.total_xp < required_xp:
        raise ValueError(f"{label} requires {required_title} renown.")
    if monument_token_balance(profile)[3] < 1:
        raise ValueError("You do not have an available Monument Token.")
    _validate_monument_state(state)
    region = Region.objects.filter(name__iexact=state["region"]).first()
    if not region:
        raise ValueError("That region is not recognized.")
    base_name = f"{profile.twitch_username}'s {label}"
    name = _available_monument_name(region, base_name, state)
    return {"name": name, "label": label, "emoji": emoji, "region": region}


def _validate_monument_state(state):
    required = ("worldX", "worldZ", "mapPixelX", "mapPixelY", "region", "locationType", "date")
    if any(state.get(key) in (None, "") for key in required):
        raise ValueError("Current location data is incomplete.")
    if str(state["locationType"]).casefold() not in {"wilderness", "town"}:
        raise ValueError("Monuments may only be placed in the wilderness or a town.")
    if str(state["region"]).casefold() in {"ocean", "unknown"}:
        raise ValueError("Monuments cannot be placed here.")
    try:
        world_x, world_z = int(state["worldX"]), int(state["worldZ"])
        map_x, map_y = int(state["mapPixelX"]), int(state["mapPixelY"])
    except (TypeError, ValueError):
        raise ValueError("Current coordinates are invalid.")
    if not (0 <= world_x <= 32768000 and 0 <= world_z <= 16384000 and 0 <= map_x <= 999 and 0 <= map_y <= 499):
        raise ValueError("Current coordinates are outside the Iliac Bay map.")
    captured = parse_datetime(state.get("capturedAt", ""))
    if captured and timezone.now() - captured > timedelta(minutes=10):
        raise ValueError("That location snapshot is stale. Start placement again.")


def _available_monument_name(region, base_name, state):
    existing = {
        name.casefold()
        for name in POI.objects.filter(region=region, name__istartswith=base_name).values_list("name", flat=True)
    }
    if base_name.casefold() not in existing:
        return base_name
    epithets = ["Frostfall", "Rain-Worn", "Woodland", "Northroad", "Moonlit", "Wayfarer's", "Storm-Watched"]
    start = (abs(int(state["worldX"])) + abs(int(state["worldZ"]))) % len(epithets)
    for offset in range(len(epithets)):
        candidate = f"{base_name} of {epithets[(start + offset) % len(epithets)]}"
        if candidate.casefold() not in existing:
            return candidate
    return f"{base_name} #{len(existing) + 1}"


def _game_date_details(game_date):
    game_date = str(game_date).strip()
    date_parts = game_date.rsplit(",", 1)
    try:
        hour = datetime.strptime(date_parts[-1].strip(), "%H:%M:%S").hour
    except ValueError:
        return game_date, ""
    time_of_day = "morning" if 6 <= hour < 12 else "afternoon" if hour < 18 else "evening" if hour < 22 else "night"
    return date_parts[0].strip(), time_of_day


def _monument_description(profile, label, region, state, renown_title, guild_title=""):
    game_date = str(state["date"]).strip()
    date_without_time, time_of_day = _game_date_details(game_date)

    season = str(state.get("season") or "").strip()
    try:
        month = game_date.split(",")[1].strip().split(" ", 1)[1].lower().replace("'", "").replace(" ", "")
        season_name, months = next(
            (name, months) for name, months in (
                ("winter", ("eveningstar", "morningstar", "sunsdawn")),
                ("spring", ("firstseed", "rainshand", "secondseed")),
                ("summer", ("midyear", "sunsheight", "lastseed")),
                ("autumn", ("hearthfire", "frostfall", "sunsdusk")),
            ) if month in months
        )
        season = f"{('early', 'mid', 'late')[months.index(month)]}-{season_name}"
    except (IndexError, StopIteration):
        season = season.lower()

    weather = str(state.get("weather") or "").strip().lower()
    weather = {"thunderstorm": "stormy", "thunderstorming": "stormy"}.get(weather, weather)
    if weather and time_of_day and season:
        opening = f"On a {weather} {time_of_day} in {season}"
    elif weather and time_of_day:
        opening = f"On a {weather} {time_of_day}"
    elif time_of_day and season:
        opening = f"On a {time_of_day} in {season}"
    elif weather and season:
        opening = f"In {weather} weather during {season}"
    elif weather:
        opening = f"In {weather} weather"
    elif season:
        opening = f"During {season}"
    else:
        opening = ""

    guild_standing = f" and {guild_title} of the {GUILDS[profile.current_guild]['name']}" if guild_title else ""
    region_name = region.name
    if region_name.lower().endswith((" mountains", " desert")) or region_name.lower() == "ocean":
        region_name = f"the {region_name}"
    description = (
        f"this {label} was raised in {region_name} by {profile.twitch_username}, "
        f"{renown_title}{guild_standing}. {date_without_time}."
    )
    return f"{opening}, {description}" if opening else description[0].upper() + description[1:]


@transaction.atomic
def place_monument(profile, monument_type, state):
    profile = TwitchUserProfile.objects.select_for_update().get(pk=profile.pk)
    preview = _monument_preview(profile, monument_type, state)
    wx, wz = int(state["worldX"]), int(state["worldZ"])
    mx, my = int(state["mapPixelX"]), int(state["mapPixelY"])
    nearby = Monument.objects.filter(poi__map_pixel_x=mx, poi__map_pixel_y=my).exists()
    if not nearby:
        radius = settings.DAGGERWALK_MONUMENT_MIN_WORLD_DISTANCE
        nearby = any(math.hypot(wx - x, wz - z) < radius for x, z in Monument.objects.values_list("world_x", "world_z"))
    if nearby:
        raise ValueError("Another user monument is too close to this location.")
    region = preview["region"]
    guild_title = ""
    if profile.current_guild in GUILDS:
        xp = guild_xp(profile, profile.current_guild)
        guild_title = guild_rank(profile.current_guild, xp, profile)[1]
    renown_title = renown_for_xp(profile.total_xp)[1]
    description = _monument_description(profile, preview["label"], region, state, renown_title, guild_title)
    poi = POI.objects.create(name=preview["name"], region=region, type="landmark", map_pixel_x=mx, map_pixel_y=my, description=description, emoji=preview["emoji"], discovered=timezone.now())
    monument = Monument.objects.create(
        poi=poi, owner=profile,
        monument_type=monument_type, world_x=wx, world_z=wz,
        game_date=_game_date_details(state["date"])[0],
        guild_at_placement=profile.current_guild,
        renown_title_at_placement=renown_title,
        guild_title_at_placement=guild_title,
    )
    ProgressionEvent.objects.create(profile=profile, event_type="monument", monument=monument, payload={"name": poi.name, "type": monument_type})
    return monument


def credit_quest_progression(quest, profiles):
    if not profiles:
        return []
    profile_ids = [profile.id for profile in profiles]
    credited_ids = set(
        ProgressionEvent.objects.filter(
            profile_id__in=profile_ids, quest=quest, event_type="quest"
        ).values_list("profile_id", flat=True)
    )
    profiles = [profile for profile in profiles if profile.id not in credited_ids]
    if not profiles:
        return []
    profile_ids = [profile.id for profile in profiles]
    total_xp = dict(
        TwitchUserProfile.objects.filter(id__in=profile_ids).annotate(
            value=Coalesce(Sum("completed_quests__xp"), 0, output_field=IntegerField())
        ).values_list("id", "value")
    )
    guild_xp_by_profile = {}
    for row in ProgressionEvent.objects.filter(
        profile_id__in=profile_ids, event_type="quest"
    ).values("profile_id", "payload__guild").annotate(
        total=Coalesce(Sum("quest__xp"), 0, output_field=IntegerField())
    ):
        guild_xp_by_profile.setdefault(row["profile_id"], {})[row["payload__guild"]] = row["total"]
    rank_levels_by_profile = {}
    for profile_id, payload in ProgressionEvent.objects.filter(
        profile_id__in=profile_ids, event_type="guild_rank"
    ).values_list("profile_id", "payload"):
        guild = payload.get("guild", "")
        levels = rank_levels_by_profile.setdefault(profile_id, {})
        levels[guild] = max(levels.get(guild, 0), payload.get("level", 0))

    events = []
    quest_events = []
    milestone_events = []
    for profile in profiles:
        guild = profile.current_guild if profile.current_guild in GUILDS else ""
        old_guild_xp = guild_xp_by_profile.get(profile.id, {}).get(guild, 0) if guild else 0
        quest_events.append(ProgressionEvent(
            profile=profile, quest=quest, event_type="quest",
            payload={"guild": guild},
        ))
        new_xp = total_xp[profile.id]
        old_level = renown_for_xp(max(0, new_xp - quest.xp))[0]
        new_level, new_title, _ = renown_for_xp(new_xp)
        if new_level > old_level:
            milestone_events.append(ProgressionEvent(
                profile=profile, quest=quest, event_type="renown",
                payload={"old_level": old_level, "level": new_level, "title": new_title},
            ))
        if old_level == 0 and new_level >= 1:
            events.append({"type": "unlock", "username": profile.twitch_username, "title": "Wayfarer"})
        if new_level > old_level and new_level in {3, 6, 7, 8}:
            events.append({"type": "renown", "username": profile.twitch_username, "title": settings.DAGGERWALK_RENOWN_LADDER[new_level][1]})
        if guild:
            profile._guild_rank_levels = rank_levels_by_profile.get(profile.id, {})
            old_rank = guild_rank(guild, old_guild_xp, profile)[0]
            xp = old_guild_xp + quest.xp
            rank_level, title, _ = guild_rank(guild, xp, profile)
            if rank_level > old_rank:
                public = rank_level in {2, 6, 8, 9}
                milestone_events.append(ProgressionEvent(
                    profile=profile, quest=quest, event_type="guild_rank",
                    payload={"guild": guild, "level": rank_level, "title": title},
                ))
                if public:
                    events.append({"type": "guild_rank", "username": profile.twitch_username, "guild": GUILDS[guild]["name"], "title": title})
    ProgressionEvent.objects.bulk_create(quest_events)
    ProgressionEvent.objects.bulk_create(milestone_events)
    return events


def guild_hall_payload():
    aggregates = {key: {"total": 0, "contributors": 0, "active": 0} for key in GUILDS}
    for row in ProgressionEvent.objects.filter(event_type="quest").values(
        "payload__guild", "profile_id", "profile__current_guild"
    ).annotate(total=Coalesce(Sum("quest__xp"), 0, output_field=IntegerField())):
        guild = row["payload__guild"]
        if guild not in aggregates:
            continue
        aggregate = aggregates[guild]
        aggregate["total"] += row["total"]
        aggregate["contributors"] += 1
        if row["profile__current_guild"] == guild:
            aggregate["active"] += row["total"]

    member_counts = dict(
        TwitchUserProfile.objects.filter(current_guild__in=GUILDS)
        .values("current_guild").annotate(total=Count("id"))
        .values_list("current_guild", "total")
    )

    result = []
    for key, info in GUILDS.items():
        values = aggregates[key]
        total, contributors, active = values["total"], values["contributors"], values["active"]
        result.append({
            "key": key, **info, "total_xp": total,
            "contributors": contributors,
            "walkers": member_counts.get(key, 0),
            "active_service_xp": active,
            "average_per_contributor": round(total / contributors, 1) if contributors else 0,
        })
    return result


def guild_hall_page_payload(guilds=None):
    if guilds is None:
        guilds = guild_hall_payload()
    rank_levels_by_profile = {}
    for profile_id, payload in ProgressionEvent.objects.filter(
        event_type="guild_rank"
    ).values_list("profile_id", "payload"):
        guild = payload.get("guild", "")
        levels = rank_levels_by_profile.setdefault(profile_id, {})
        levels[guild] = max(levels.get(guild, 0), payload.get("level", 0))

    for guild in guilds:
        contributors = list(
            TwitchUserProfile.objects.filter(
                progression_events__event_type="quest",
                progression_events__payload__guild=guild["key"],
            ).annotate(guild_xp_value=Sum("progression_events__quest__xp"))
            .order_by("-guild_xp_value", Lower("twitch_username"))
        )
        for walker in contributors:
            walker._guild_rank_levels = rank_levels_by_profile.get(walker.id, {})
        guild["top_contributors"] = contributors[:10]
        members = list(
            TwitchUserProfile.objects.filter(current_guild=guild["key"])
            .annotate(guild_xp_value=Coalesce(Sum(
                "progression_events__quest__xp",
                filter=Q(
                    progression_events__event_type="quest",
                    progression_events__payload__guild=guild["key"],
                ),
            ), 0, output_field=IntegerField()))
        )
        for walker in members:
            walker._guild_rank_levels = rank_levels_by_profile.get(walker.id, {})
        guild["monuments"] = Monument.objects.filter(
            guild_at_placement=guild["key"]
        ).select_related("poi", "owner")[:8]
        rank_counts = Counter(
            guild_rank(guild["key"], walker.guild_xp_value, walker)[0]
            for walker in members
        )
        guild["rank_ladder"] = [
            {"level": level + 1, "title": title, "count": rank_counts.get(level, 0)}
            for level, title in enumerate(guild["titles"])
        ]
        recent_promotions = list(ProgressionEvent.objects.filter(
            Q(event_type="guild_rank", payload__guild=guild["key"])
            | Q(event_type="guild_change", payload__new_guild=guild["key"])
        ).select_related("profile").order_by("-created_at")[:5])
        for event in recent_promotions:
            event.guild_hall_title = (event.payload or {}).get("title") or guild["titles"][0]
        guild["recent_promotions"] = recent_promotions
    return guilds


def monument_display_rows(monuments):
    for monument in monuments:
        monument.type_name = MONUMENT_TYPES.get(
            monument.monument_type,
            (monument.monument_type.replace("-", " ").title(),),
        )[0]
        monument.guild_name = GUILDS.get(
            monument.guild_at_placement,
            {},
        ).get("name", monument.guild_at_placement.replace("-", " ").title())
    return monuments


def progression_home_payload(guilds=None):
    """Small, cache-friendly progression summary for the Daggerwalk home page."""
    recent_monuments = list(
        Monument.objects
        .select_related("poi", "poi__region", "owner")
        .annotate(
            latest_visit=Max(
                "progression_events__created_at",
                filter=Q(progression_events__event_type="monument_visit"),
            )
        )
        .order_by("-created_at")[:8]
    )
    return {
        "progression_guilds": guilds if guilds is not None else guild_hall_payload(),
        "recent_monuments": monument_display_rows(recent_monuments),
        "monument_count": Monument.objects.count(),
    }
