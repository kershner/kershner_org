from django.core.cache import cache
from django.core.management import call_command
from django.contrib.admin.sites import AdminSite
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta
from unittest.mock import Mock, call, patch

from apps.daggerwalk.models import (
    ChatCommandLog,
    DaggerwalkLog,
    POI,
    ProgressionEvent,
    Quest,
    Region,
    TwitchUserProfile,
    Monument,
)
from apps.daggerwalk.cache_keys import PROGRESSION_CACHE_KEYS, completed_quest_html_cache_key
from apps.daggerwalk.progression import cached_progression_snapshot, change_guild, credit_quest_progression, guild_hall_page_payload, guild_xp, place_monument, profile_payload, progression_home_payload, progression_snapshot, resolve_profile, token_count_for_xp
from apps.daggerwalk.quest_gen import complete_and_rotate_quest
from apps.daggerwalk.serializers import DaggerwalkLogSerializer, QuestSerializer
from apps.daggerwalk.admin import MonumentAdmin, TwitchUserProfileAdmin


class CompletedQuestDetailTests(TestCase):
    def setUp(self):
        cache.clear()
        region = Region.objects.create(
            name="Wayrest",
            province="High Rock",
            climate="Woodlands",
            emoji="🌲",
        )
        poi = POI.objects.create(
            name="Wayrest",
            region=region,
            type="capital",
            map_pixel_x=100,
            map_pixel_y=200,
            emoji="🏰",
        )
        self.quest = Quest.objects.create(
            status="completed",
            poi=poi,
            quest_giver_name="Lady Brisienna",
            description="Travel safely to Wayrest.",
            xp=30,
        )
        for username in ("ZedWalker", "aliceWalker"):
            profile = TwitchUserProfile.objects.create(twitch_username=username)
            profile.completed_quests.add(self.quest)

    def test_completed_quest_page_shows_quest_and_participants(self):
        response = self.client.get(reverse(
            "daggerwalk_quest_detail",
            args=[self.quest.id],
        ))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Travel to")
        self.assertContains(response, "Lady Brisienna")
        self.assertContains(response, "30 XP")
        self.assertContains(response, "aliceWalker")
        self.assertContains(response, "ZedWalker")

    def test_completed_quest_page_shows_cached_journey_stats(self):
        daggerfall = Region.objects.create(
            name="Daggerfall",
            province="High Rock",
            climate="Woodlands",
        )
        started_at = timezone.now() - timedelta(minutes=30)
        completed_at = timezone.now()
        Quest.objects.filter(pk=self.quest.pk).update(
            created_at=started_at,
            completed_at=completed_at,
        )
        self.quest.refresh_from_db()

        def create_log(world_x, world_z, region, location, weather, created_at):
            log = DaggerwalkLog.objects.create(
                world_x=world_x,
                world_z=world_z,
                map_pixel_x=100,
                map_pixel_y=200,
                region=region,
                location=location,
                player_x=0,
                player_y=0,
                player_z=0,
                date="Loredas, 7 Sun's Dusk, 3E 406, 12:47:25",
                weather=weather,
            )
            DaggerwalkLog.objects.filter(pk=log.pk).update(created_at=created_at)

        create_log(0, 0, daggerfall.name, "Wilderness", "Clear", started_at - timedelta(seconds=1))
        create_log(3000, 4000, "Ocean", "Ocean", "Rainy", started_at + timedelta(minutes=10))
        create_log(6000, 8000, "Wayrest", "Wayrest", "Rainy", completed_at - timedelta(seconds=1))

        url = reverse("daggerwalk_quest_detail", args=[self.quest.id])
        response = self.client.get(url)

        self.assertContains(response, "10 km")
        self.assertContains(response, "30m")
        self.assertContains(response, "Wilderness, Daggerfall")
        self.assertContains(response, "Wayrest")
        self.assertContains(response, "Clear · Rainy")
        self.assertContains(response, '<dd title="Daggerfall → Ocean → Wayrest">3</dd>', html=True)
        self.assertContains(response, '<dd title="Wayrest">1</dd>', html=True)
        self.assertIsNotNone(cache.get(completed_quest_html_cache_key(self.quest.id)))

        with self.assertNumQueries(0):
            cached_response = self.client.get(url)
        self.assertEqual(cached_response.content, response.content)

    def test_non_completed_quest_is_not_public(self):
        self.quest.status = "in_progress"
        self.quest.save()

        response = self.client.get(reverse(
            "daggerwalk_quest_detail",
            args=[self.quest.id],
        ))

        self.assertEqual(response.status_code, 404)

    def test_quest_payload_includes_participant_count(self):
        self.assertEqual(QuestSerializer(self.quest).data["participant_count"], 2)

    def test_previous_quest_title_links_to_detail_page(self):
        html = render_to_string("daggerwalk/quests.html", {
            "active_quests": [],
            "previous_quests": [self.quest],
            "leaderboard": [],
        })

        self.assertIn(
            f'href="{reverse("daggerwalk_quest_detail", args=[self.quest.id])}"',
            html,
        )

    def test_home_cache_miss_loads_previous_quests_from_database(self):
        with patch(
            "apps.daggerwalk.views.ensure_active_quests",
            return_value=[],
        ):
            response = self.client.get(reverse("daggerwalk"))

        self.assertContains(response, self.quest.quest_name)
        self.assertContains(
            response,
            reverse("daggerwalk_quest_detail", args=[self.quest.id]),
        )


class DaggerwalkLogSerializerTests(TestCase):
    def test_last_known_region_is_nested_for_ocean_titles(self):
        region = Region.objects.create(
            name="Wayrest",
            province="High Rock",
            climate="Woodlands",
        )
        log = DaggerwalkLog(
            world_x=1,
            world_z=2,
            map_pixel_x=3,
            map_pixel_y=4,
            region="Ocean",
            location="Ocean",
            player_x=0,
            player_y=0,
            player_z=0,
            date="Tirdas, 12 Sun's Height, 3E 405, 18:30:00",
            weather="Clear",
            last_known_region=region,
        )

        self.assertEqual(
            DaggerwalkLogSerializer(log).data["last_known_region"]["name"],
            "Wayrest",
        )

class ProgressionTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Daggerfall", province="High Rock", climate="Woodlands")
        self.poi = POI.objects.create(name="Privateer's Hold", region=self.region, type="dungeon", map_pixel_x=100, map_pixel_y=100)

    def award(self, profile, xp):
        quest = Quest.objects.create(status="completed", poi=self.poi, xp=xp, completed_at=timezone.now())
        profile.completed_quests.add(quest)
        return quest

    def test_renown_and_repeatable_tokens_use_historical_xp(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 35000)
        payload = profile_payload(profile, position=1)
        self.assertEqual(payload["renown_title"], "Living Legend")
        self.assertEqual(token_count_for_xp(35000), 5)
        self.assertEqual(payload["tokens_available"], 5)

    def test_admin_adjustment_grants_and_removes_monument_tokens(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker", monument_token_adjustment=-1)
        self.award(profile, 200)
        state = {"worldX": 100000, "worldZ": 100000, "mapPixelX": 10, "mapPixelY": 20, "region": self.region.name, "locationType": "Wilderness", "date": "Loredas, 1 Frostfall"}

        self.assertEqual(profile_payload(profile)["tokens_available"], 0)
        with self.assertRaisesMessage(ValueError, "available Monument Token"):
            place_monument(profile, "cairn", state)

        profile.monument_token_adjustment = 2
        profile.save(update_fields=["monument_token_adjustment"])
        self.assertEqual(profile_payload(profile)["tokens_available"], 3)
        place_monument(profile, "cairn", state)
        self.assertEqual(profile_payload(profile)["tokens_available"], 2)

    def test_admin_can_undo_latest_guild_change_and_its_guild_xp(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 50)
        change_guild(profile, "mages")
        profile.refresh_from_db()
        guild_quest = self.award(profile, 200)
        credit_quest_progression(guild_quest, [profile])
        self.assertEqual(guild_xp(profile, "mages"), 200)

        model_admin = TwitchUserProfileAdmin(TwitchUserProfile, AdminSite())
        model_admin.message_user = Mock()
        with patch("apps.daggerwalk.admin.update_all_daggerwalk_caches.delay"):
            model_admin.undo_latest_guild_change(
                Mock(), TwitchUserProfile.objects.filter(pk=profile.pk),
            )

        profile.refresh_from_db()
        self.assertEqual(profile.current_guild, "")
        self.assertEqual(guild_xp(profile, "mages"), 0)
        self.assertFalse(profile.progression_events.filter(event_type="guild_change").exists())
        self.assertFalse(profile.progression_events.filter(event_type="guild_rank").exists())
        self.assertEqual(
            profile.progression_events.get(event_type="quest", quest=guild_quest).payload["guild"], "",
        )

    def test_admin_deleting_monument_removes_poi_and_history_and_refunds_token(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 200)
        state = {"worldX": 100000, "worldZ": 100000, "mapPixelX": 10, "mapPixelY": 20, "region": self.region.name, "locationType": "Wilderness", "date": "Loredas, 1 Frostfall"}
        monument = place_monument(profile, "cairn", state)
        poi_id = monument.poi_id

        model_admin = MonumentAdmin(Monument, AdminSite())
        with patch("apps.daggerwalk.admin.update_all_daggerwalk_caches.delay"):
            model_admin.delete_model(Mock(), monument)

        self.assertFalse(Monument.objects.filter(pk=monument.pk).exists())
        self.assertFalse(POI.objects.filter(pk=poi_id).exists())
        self.assertFalse(ProgressionEvent.objects.filter(monument_id=monument.pk).exists())
        self.assertEqual(profile_payload(profile)["tokens_available"], 1)

    def test_guild_requires_xp_and_starts_configured_cooldown(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        with self.assertRaisesMessage(ValueError, "Complete a quest"):
            change_guild(profile, "mages")
        self.award(profile, 50)
        payload = change_guild(profile, "mages")
        self.assertEqual(payload["guild"]["name"], "Mages Guild")
        self.assertGreater(parse_datetime(payload["guild_cooldown_until"]), timezone.now())
        with self.assertRaisesMessage(ValueError, "cooldown"):
            change_guild(profile, "fighters")

    def test_guild_xp_is_derived_only_from_quests_completed_after_joining(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 50)
        change_guild(profile, "mages")
        profile.refresh_from_db()
        guild_quest = self.award(profile, 75)

        credit_quest_progression(guild_quest, [profile])

        self.assertEqual(guild_xp(profile, "mages"), 75)
        self.assertContains(self.client.get(reverse("daggerwalk_guild_hall")), "Walker")

    def test_new_guild_member_appears_in_hall_before_earning_guild_xp(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 50)
        change_guild(profile, "mages")

        mages = next(guild for guild in guild_hall_page_payload() if guild["key"] == "mages")

        self.assertEqual(mages["walkers"], 1)
        self.assertEqual(mages["rank_ladder"][0]["count"], 1)
        self.assertEqual(mages["recent_promotions"][0].profile, profile)
        self.assertEqual(mages["recent_promotions"][0].guild_hall_title, "Apprentice")

    def test_twitch_rename_creates_a_new_profile(self):
        original = resolve_profile("OldName", "123")
        renamed = resolve_profile("NewName", "123")

        self.assertNotEqual(original.pk, renamed.pk)
        self.assertEqual(TwitchUserProfile.objects.filter(twitch_user_id="123").count(), 2)

    def test_only_qualifying_commands_receive_quest_xp(self):
        request_log = DaggerwalkLog.objects.create(
            world_x=1000, world_z=1000, map_pixel_x=100, map_pixel_y=100,
            region=self.region.name, location=self.poi.name,
            player_x=0, player_y=0, player_z=0, date="1 Morning Star", weather="Clear",
        )
        quest = Quest.objects.create(status="in_progress", slot=1, poi=self.poi, xp=25)
        stamp = timezone.now()
        ChatCommandLog.objects.create(request_log=request_log, timestamp=stamp, user="GameWalker", command="walk")
        ChatCommandLog.objects.create(request_log=request_log, timestamp=stamp, user="InfoOnly", command="renown")
        complete_and_rotate_quest(quest, stamp, request_log.id)
        self.assertTrue(TwitchUserProfile.objects.get(twitch_username="GameWalker").completed_quests.filter(id=quest.id).exists())
        self.assertFalse(TwitchUserProfile.objects.filter(twitch_username="InfoOnly").exists())

    def test_monument_creation_is_transactional_and_enforces_spacing(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 200)
        state = {"worldX": 100000, "worldZ": 100000, "mapPixelX": 10, "mapPixelY": 20, "region": self.region.name, "locationType": "Wilderness", "date": "Loredas, 1 Frostfall"}
        monument = place_monument(profile, "cairn", state)
        self.assertEqual(monument.poi.name, "Walker's Cairn")
        self.assertEqual(str(monument), "Walker's Cairn")
        self.assertEqual(profile_payload(profile)["tokens_available"], 0)
        other = TwitchUserProfile.objects.create(twitch_username="Other")
        self.award(other, 200)
        with self.assertRaisesMessage(ValueError, "too close"):
            place_monument(other, "cairn", {**state, "worldX": 100001})
        self.assertEqual(Monument.objects.count(), 1)

    def test_chronicle_guild_hall_and_registry_render(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 200)
        change_guild(profile, "fighters")
        state = {
            "worldX": 100000, "worldZ": 100000, "mapPixelX": 10, "mapPixelY": 20,
            "region": self.region.name, "locationType": "Town",
            "date": "Loredas, 17 Rain's Hand, 3E 405, 21:38:37",
            "weather": "Rainy", "season": "Winter",
        }
        monument = place_monument(profile, "cairn", state)
        self.assertEqual(
            monument.poi.description,
            "On a rainy evening in mid-spring, this Cairn was raised in Daggerfall by Walker, "
            "Pathfinder and Apprentice of the Fighters Guild. Loredas, 17 Rain's Hand, 3E 405.",
        )
        self.assertEqual(monument.game_date, "Loredas, 17 Rain's Hand, 3E 405")
        self.assertContains(self.client.get(reverse("daggerwalk_walker", args=["Walker"])), "Pathfinder")
        self.assertContains(self.client.get(reverse("daggerwalk_guild_hall")), "Fighters Guild")
        with self.assertTemplateUsed("daggerwalk/includes/monument_table.html"):
            registry = self.client.get(reverse("daggerwalk_monuments"))
        self.assertContains(registry, "Cairn")
        self.assertContains(registry, "How Monuments Work")
        self.assertContains(registry, "parchment-panel monument-registry-heading")
        self.assertContains(registry, "monument-emoji-cell")
        self.assertContains(registry, "Last Visited")
        self.assertContains(registry, "Never")
        self.assertContains(registry, "!monument &lt;type&gt;")
        self.assertContains(registry, "!monument types more")
        self.assertNotContains(registry, "!monument place")

        overview = render_to_string(
            "daggerwalk/progression.html",
            progression_home_payload(guilds=[{
                "emoji": "⚔️", "name": "Fighters Guild",
                "total_xp": 200, "contributors": 1,
            }]),
        )
        self.assertIn("monument-table", overview)
        self.assertIn("guild-summary-card", overview)
        self.assertIn("guild-summary-ledger", overview)
        self.assertIn("Last Visited", overview)
        self.assertIn("Loredas, 17 Rain&#x27;s Hand, 3E 405", overview)

    def test_progression_snapshot_uses_constant_query_count(self):
        quest = Quest.objects.create(status="completed", poi=self.poi, xp=25, completed_at=timezone.now())
        profiles = [
            TwitchUserProfile(twitch_username=f"Walker{index}", current_guild="fighters")
            for index in range(10)
        ]
        TwitchUserProfile.objects.bulk_create(profiles)
        TwitchUserProfile.completed_quests.through.objects.bulk_create([
            TwitchUserProfile.completed_quests.through(
                twitchuserprofile_id=profile.id, quest_id=quest.id
            )
            for profile in profiles
        ])
        ProgressionEvent.objects.bulk_create([
            ProgressionEvent(
                profile=profile, quest=quest, event_type="quest",
                payload={"guild": "fighters"},
            )
            for profile in profiles
        ])

        with CaptureQueriesContext(connection) as queries:
            snapshot = progression_snapshot()

        self.assertEqual(len(snapshot["profiles"]), 10)
        self.assertLessEqual(len(queries), 6)

        cached_progression_snapshot(refresh=True)
        with CaptureQueriesContext(connection) as cached_queries:
            cached = cached_progression_snapshot()
        self.assertEqual(cached["profiles"], snapshot["profiles"])
        self.assertEqual(len(cached_queries), 0)

    def test_quest_progression_credit_is_batched_across_participants(self):
        quest = Quest.objects.create(status="completed", poi=self.poi, xp=25, completed_at=timezone.now())
        profiles = [
            TwitchUserProfile(twitch_username=f"Walker{index}", current_guild="fighters")
            for index in range(10)
        ]
        TwitchUserProfile.objects.bulk_create(profiles)
        TwitchUserProfile.completed_quests.through.objects.bulk_create([
            TwitchUserProfile.completed_quests.through(
                twitchuserprofile_id=profile.id, quest_id=quest.id
            )
            for profile in profiles
        ])

        with CaptureQueriesContext(connection) as queries:
            credit_quest_progression(quest, profiles)

        self.assertEqual(
            ProgressionEvent.objects.filter(event_type="quest", quest=quest).count(),
            10,
        )
        self.assertLessEqual(len(queries), 10)

    @override_settings(DAGGERWALK_API_KEY="test-key")
    @patch("apps.daggerwalk.views.update_all_daggerwalk_caches.delay")
    def test_guild_change_survives_cache_queue_failure_after_commit(self, rebuild):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 50)
        cache.set_many({key: "stale" for key in PROGRESSION_CACHE_KEYS}, timeout=None)
        rebuild.side_effect = RuntimeError("cache worker unavailable")

        response = self.client.post(
            reverse("daggerwalk_bot_guild"),
            {"username": "Walker", "guild": "mages"},
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer test-key",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(cache.get(key) is None for key in PROGRESSION_CACHE_KEYS))
        self.assertEqual(
            TwitchUserProfile.objects.get(pk=profile.pk).current_guild,
            "mages",
        )
        rebuild.assert_called_once_with()


class ProgressionDemoCommandTests(TestCase):
    def test_seed_is_idempotent_and_clear_removes_only_demo_data(self):
        real_profile = TwitchUserProfile.objects.create(twitch_username="RealWalker")

        call_command("seed_progression_demo", skip_cache=True, verbosity=0)
        call_command("seed_progression_demo", skip_cache=True, verbosity=0)

        demo_profiles = TwitchUserProfile.objects.filter(twitch_user_id__startswith="daggerwalk-demo-")
        self.assertEqual(demo_profiles.count(), 40)
        self.assertEqual(Monument.objects.filter(owner__in=demo_profiles).count(), 12)
        self.assertEqual(ProgressionEvent.objects.filter(profile__in=demo_profiles, event_type="quest").count(), 120)

        call_command("seed_progression_demo", clear=True, skip_cache=True, verbosity=0)
        self.assertFalse(TwitchUserProfile.objects.filter(twitch_user_id__startswith="daggerwalk-demo-").exists())
        self.assertTrue(TwitchUserProfile.objects.filter(pk=real_profile.pk).exists())


class DaggerwalkDevCommandTests(SimpleTestCase):
    @override_settings(DEBUG=True)
    @patch("apps.daggerwalk.management.commands.daggerwalk_dev.call_command")
    @patch("apps.daggerwalk.management.commands.daggerwalk_dev.subprocess.Popen")
    @patch("apps.daggerwalk.management.commands.daggerwalk_dev.Command._start_redis")
    def test_starts_web_services_and_cleans_up_worker(self, start_redis, popen, call_command_mock):
        from apps.daggerwalk.management.commands.daggerwalk_dev import Command

        worker = popen.return_value
        worker.poll.return_value = None

        Command().handle(noreload=True)

        start_redis.assert_called_once_with()
        self.assertEqual(call_command_mock.call_args_list[:2], [
            call("migrate"),
            call("seed_progression_demo"),
        ])
        call_command_mock.assert_called_with("runserver", "127.0.0.1:8000", use_reloader=False)
        worker.terminate.assert_called_once_with()
        worker.wait.assert_called_once_with(timeout=10)
