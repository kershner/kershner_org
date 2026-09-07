from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.daggerwalk.models import Monument, POI, ProgressionEvent, Quest, Region, TwitchUserProfile
from apps.daggerwalk.progression import GUILDS, MONUMENT_TYPES, _monument_description, renown_for_xp


DEMO_MARKER = "[Daggerwalk progression demo]"
DEMO_USER_ID_PREFIX = "daggerwalk-demo-"


class Command(BaseCommand):
    help = "Seed realistic Guild Hall, Chronicle, and Monument Registry demo data."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Remove demo data without recreating it.")
        parser.add_argument("--skip-cache", action="store_true", help="Do not rebuild Daggerwalk caches afterward.")

    @transaction.atomic
    def handle(self, *args, **options):
        self._clear_demo_data()
        if options["clear"]:
            if not options["skip_cache"]:
                from apps.daggerwalk.tasks import update_all_daggerwalk_caches
                update_all_daggerwalk_caches()
            self.stdout.write(self.style.SUCCESS("Progression demo data removed."))
            return

        regions, quest_pois = self._locations()
        profiles = self._walkers(quest_pois)
        monuments = self._monuments(profiles, regions)
        self._visits(profiles, monuments)

        if not options["skip_cache"]:
            from apps.daggerwalk.tasks import update_all_daggerwalk_caches
            update_all_daggerwalk_caches()

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(profiles)} walkers, {len(profiles) * 3} quest credits, "
            f"and {len(monuments)} monuments."
        ))
        self.stdout.write("Guild Hall: /daggerwalk/guilds/")
        self.stdout.write("Monuments: /daggerwalk/monuments/")
        self.stdout.write(f"Example Chronicle: /daggerwalk/walkers/{profiles[0].twitch_username}/")

    def _clear_demo_data(self):
        profiles = TwitchUserProfile.objects.filter(twitch_user_id__startswith=DEMO_USER_ID_PREFIX)
        Quest.objects.filter(description__startswith=DEMO_MARKER).delete()
        POI.objects.filter(Q(description__startswith=DEMO_MARKER) | Q(monument__owner__in=profiles)).delete()
        profiles.delete()

    def _locations(self):
        region_specs = [
            ("Daggerfall", "High Rock", "Woodlands"),
            ("Wayrest", "High Rock", "Woodlands"),
            ("Sentinel", "Hammerfell", "Desert"),
            ("Wrothgarian Mountains", "High Rock", "Mountain"),
        ]
        regions = [
            Region.objects.get_or_create(name=name, defaults={"province": province, "climate": climate})[0]
            for name, province, climate in region_specs
        ]
        quest_pois = []
        for index, region in enumerate(regions):
            poi, _ = POI.objects.get_or_create(
                region=region,
                name=f"Demo Crossroads {index + 1}",
                defaults={
                    "type": "landmark", "map_pixel_x": 40 + index * 20,
                    "map_pixel_y": 60 + index * 15, "emoji": "🧭",
                    "description": f"{DEMO_MARKER} Quest destination.",
                    "discovered": timezone.now(),
                },
            )
            quest_pois.append(poi)
        return regions, quest_pois

    def _walkers(self, quest_pois):
        profiles = []
        thresholds = settings.DAGGERWALK_GUILD_RANK_THRESHOLDS
        now = timezone.now()
        for guild_index, (guild_key, guild) in enumerate(GUILDS.items()):
            for level, title in enumerate(guild["titles"]):
                next_threshold = thresholds[level + 1] if level + 1 < len(thresholds) else thresholds[level] + 900
                xp = thresholds[level] + max(20, (next_threshold - thresholds[level]) // 3)
                username = f"DemoWalker{guild_index * 10 + level + 1:02d}"
                profile = TwitchUserProfile.objects.create(
                    twitch_username=username,
                    twitch_user_id=f"{DEMO_USER_ID_PREFIX}{guild_index}-{level}",
                    current_guild=guild_key,
                )
                joined_at = now - timedelta(days=120 - level * 7 - guild_index)
                self._event(profile, "guild_change", joined_at, payload={"old_guild": "", "new_guild": guild_key, "demo": True})

                portions = (xp // 3, xp // 3, xp - (xp // 3) * 2)
                for quest_index, quest_xp in enumerate(portions):
                    completed_at = joined_at + timedelta(days=quest_index * 8 + 2)
                    quest = Quest.objects.create(
                        status="completed", xp=quest_xp,
                        poi=quest_pois[(guild_index + quest_index) % len(quest_pois)],
                        quest_giver_name="Demo Guild Steward",
                        description=f"{DEMO_MARKER} Service for the {guild['name']}.",
                        completed_at=completed_at,
                    )
                    Quest.objects.filter(pk=quest.pk).update(created_at=completed_at - timedelta(hours=3))
                    profile.completed_quests.add(quest)
                    self._event(profile, "quest", completed_at, quest=quest, payload={"guild": guild_key, "demo": True})

                if level:
                    self._event(
                        profile, "guild_rank", joined_at + timedelta(days=28),
                        payload={"guild": guild_key, "level": level, "title": title, "demo": True},
                    )
                renown_title = renown_for_xp(xp)[1]
                self._event(profile, "renown", joined_at + timedelta(days=24), payload={"title": renown_title, "demo": True})
                profiles.append(profile)
        return profiles

    def _monuments(self, profiles, regions):
        monuments = []
        tiers = ((3, "cairn"), (7, "guild-banner"), (9, "ancient-tree"))
        now = timezone.now()
        for guild_index, (guild_key, guild) in enumerate(GUILDS.items()):
            guild_profiles = profiles[guild_index * 10:(guild_index + 1) * 10]
            for monument_index, (owner_level, monument_type) in enumerate(tiers):
                owner = guild_profiles[owner_level]
                label, _, emoji = MONUMENT_TYPES[monument_type]
                region = regions[(guild_index + monument_index) % len(regions)]
                raised_at = now - timedelta(days=18 - guild_index * 2 - monument_index)
                name = f"{owner.twitch_username}'s {label}"
                game_date = f"Loredas, {10 + guild_index + monument_index} Frostfall, 3E 424"
                guild_title = guild["titles"][owner_level]
                description = DEMO_MARKER + " " + _monument_description(
                    owner, label, region,
                    {"date": game_date, "weather": "Clear", "season": "Autumn"},
                    renown_for_xp(owner.total_xp)[1], guild_title,
                )
                poi = POI.objects.create(
                    name=name, region=region, type="landmark",
                    map_pixel_x=120 + guild_index * 40 + monument_index * 7,
                    map_pixel_y=90 + guild_index * 25 + monument_index * 9,
                    description=description, emoji=emoji, discovered=raised_at,
                )
                level = owner_level
                monument = Monument.objects.create(
                    poi=poi, owner=owner, monument_type=monument_type,
                    world_x=200000 + (guild_index * 3 + monument_index) * 60000,
                    world_z=300000 + (guild_index * 3 + monument_index) * 60000,
                    game_date=game_date,
                    guild_at_placement=guild_key,
                    renown_title_at_placement=renown_for_xp(owner.total_xp)[1],
                    guild_title_at_placement=guild_title,
                )
                Monument.objects.filter(pk=monument.pk).update(created_at=raised_at)
                self._event(owner, "monument", raised_at, monument=monument, payload={"name": name, "type": monument_type, "demo": True})
                monuments.append(monument)
        return monuments

    def _visits(self, profiles, monuments):
        now = timezone.now()
        for monument_index, monument in enumerate(monuments):
            for visit_index in range(monument_index % 7 + 1):
                visitor = profiles[(monument_index * 3 + visit_index) % len(profiles)]
                self._event(
                    visitor, "monument_visit", now - timedelta(days=visit_index, hours=monument_index),
                    monument=monument, payload={"demo": True},
                )

    @staticmethod
    def _event(profile, event_type, created_at, **fields):
        event = ProgressionEvent.objects.create(profile=profile, event_type=event_type, **fields)
        ProgressionEvent.objects.filter(pk=event.pk).update(created_at=created_at)
        return event
