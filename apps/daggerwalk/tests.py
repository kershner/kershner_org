from django.core.cache import cache
from django.contrib.admin.sites import AdminSite
from django.core.management import call_command
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from collections import Counter
from datetime import datetime, timedelta, timezone as datetime_timezone
from io import StringIO
from unittest.mock import Mock, patch

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
from apps.daggerwalk.progression import cached_progression_snapshot, change_guild, credit_quest_progression, guild_hall_page_payload, guild_xp, place_monument, profile_payload, progression_event_description, progression_home_payload, progression_snapshot, resolve_profile, token_count_for_xp
from apps.daggerwalk.quest_gen import complete_and_rotate_quest, ensure_active_quests
from apps.daggerwalk.serializers import DaggerwalkLogSerializer, QuestSerializer
from apps.daggerwalk.admin import MonumentAdmin, TwitchUserProfileAdmin
from apps.daggerwalk import tasks as daggerwalk_tasks


class BlueskyVideoTagTests(SimpleTestCase):
    def test_bluesky_nanosecond_timestamp_is_accepted_on_python_310(self):
        from apps.daggerwalk import bluesky_tags

        created_at = bluesky_tags._created_at({
            "record": {"createdAt": "2026-09-07T22:06:36.969953734Z"},
        })

        self.assertEqual(
            created_at,
            datetime(
                2026, 9, 7, 22, 6, 36, 969953,
                tzinfo=datetime_timezone.utc,
            ),
        )

    def test_malformed_bluesky_timestamp_does_not_abort_weekly_audit(self):
        from apps.daggerwalk import bluesky_tags

        self.assertIsNone(bluesky_tags._created_at({
            "record": {"createdAt": "not-a-timestamp"},
        }))

    def test_tag_catalog_is_large_relevant_and_each_post_stays_focused(self):
        self.assertGreaterEqual(len(daggerwalk_tasks.BLUESKY_AVAILABLE_TAGS), 30)
        self.assertTrue({
            "crpg",
            "dosgaming",
            "retrogames",
            "twitchclips",
            "gamingcommunity",
            "pcgaming",
        }.issubset(daggerwalk_tasks.BLUESKY_AVAILABLE_TAGS))
        self.assertTrue({
            "webdev",
            "javascript",
            "django",
            "obs",
            "gameautomation",
            "proceduralstorytelling",
        }.isdisjoint(daggerwalk_tasks.BLUESKY_AVAILABLE_TAGS))

        with (
            patch("apps.daggerwalk.bluesky_tags.cache.get", return_value=None),
            patch(
                "apps.daggerwalk.bluesky_tags.random.sample",
                return_value=["crpg", "twitchclips", "pcgaming"],
            ),
        ):
            tags = daggerwalk_tasks.select_bluesky_video_tags()

        self.assertEqual(tags, [
            "daggerfall",
            "elderscrolls",
            "retrogaming",
            "crpg",
            "twitchclips",
            "pcgaming",
        ])

    def test_video_post_publishes_all_tags_as_searchable_facets(self):
        client = Mock()
        client.me.did = "did:example:daggerwalk"
        client.get_current_time_iso.return_value = "2026-09-08T18:00:00Z"
        client.com.atproto.repo.create_record.return_value = {
            "uri": "at://post",
            "cid": "post-cid",
        }

        with (
            patch("apps.daggerwalk.bluesky_tags.cache.get", return_value=None),
            patch(
                "apps.daggerwalk.bluesky_tags.random.sample",
                return_value=["crpg", "twitchclips", "pcgaming"],
            ),
        ):
            daggerwalk_tasks.post_video_to_bluesky("Daily walk", "video-blob", client)

        data = client.com.atproto.repo.create_record.call_args.kwargs["data"]
        record = data["record"]
        self.assertEqual(record["langs"], ["en"])
        self.assertEqual(len(record["facets"]), 6)
        self.assertEqual(
            [facet["features"][0]["tag"] for facet in record["facets"]],
            [
                "daggerfall",
                "elderscrolls",
                "retrogaming",
                "crpg",
                "twitchclips",
                "pcgaming",
            ],
        )
        encoded_text = record["text"].encode("utf-8")
        for facet in record["facets"]:
            start = facet["index"]["byteStart"]
            end = facet["index"]["byteEnd"]
            tag = facet["features"][0]["tag"]
            self.assertEqual(encoded_text[start:end].decode("utf-8"), f"#{tag}")

    def test_weekly_audit_promotes_discovered_tags_and_updates_cache(self):
        from apps.daggerwalk import bluesky_tags

        now = datetime(2026, 9, 8, tzinfo=datetime_timezone.utc)

        def metrics(_client, tag, _own_did, _now):
            if tag == "promisingtag":
                return {
                    "posts_7d": 50,
                    "posts_30d": 100,
                    "authors_30d": 60,
                    "top_author_share": 0.05,
                    "median_engagement": 12,
                    "p75_engagement": 25,
                }
            return {
                "posts_7d": 10,
                "posts_30d": 40,
                "authors_30d": 20,
                "top_author_share": 0.1,
                "median_engagement": 3,
                "p75_engagement": 6,
            }

        with (
            patch.object(
                bluesky_tags,
                "_discover_candidates",
                return_value=Counter({"promisingtag": 12}),
            ),
            patch.object(bluesky_tags, "_audit_candidate", side_effect=metrics),
            patch.object(bluesky_tags.cache, "set") as cache_set,
        ):
            payload = bluesky_tags.refresh_tag_pool(Mock(), "did:example:own", now)

        self.assertEqual(payload["tags"][0]["tag"], "promisingtag")
        self.assertEqual(len(payload["tags"]), bluesky_tags.MAX_POOL_SIZE)
        cache_set.assert_called_once_with(
            bluesky_tags.TAG_POOL_CACHE_KEY,
            payload,
            timeout=None,
        )

    def test_weekly_audit_does_not_replace_pool_with_bad_results(self):
        from apps.daggerwalk import bluesky_tags

        bad_metrics = {
            "posts_7d": 1,
            "posts_30d": 2,
            "authors_30d": 1,
            "top_author_share": 1.0,
            "median_engagement": 0,
            "p75_engagement": 0,
        }
        with (
            patch.object(bluesky_tags, "_discover_candidates", return_value=Counter()),
            patch.object(bluesky_tags, "_audit_candidate", return_value=bad_metrics),
            patch.object(bluesky_tags.cache, "set") as cache_set,
        ):
            with self.assertRaises(RuntimeError):
                bluesky_tags.refresh_tag_pool(Mock(), "did:example:own")

        cache_set.assert_not_called()

    def test_weekly_audit_is_registered_with_celery_beat(self):
        from kershner.celery import app

        schedule = app.conf.beat_schedule["daggerwalk-audit-bluesky-tags-weekly"]
        self.assertEqual(
            schedule["task"],
            "apps.daggerwalk.tasks.audit_bluesky_video_tags",
        )


@override_settings(
    CLOUDFRONT_DISTRIBUTION_ID="DIST123",
    AWS_ACCESS_KEY_ID="key",
    AWS_SECRET_ACCESS_KEY="secret",
)
class CloudFrontInvalidationTests(SimpleTestCase):
    @patch("apps.daggerwalk.management.commands.invalidate_cloudfront.boto3.client")
    def test_invalidates_entire_distribution(self, boto_client):
        client = boto_client.return_value
        client.create_invalidation.return_value = {"Invalidation": {"Id": "INV123"}}

        call_command("invalidate_cloudfront", stdout=StringIO())

        batch = client.create_invalidation.call_args.kwargs
        self.assertEqual(batch["DistributionId"], "DIST123")
        client.get_paginator.assert_not_called()
        self.assertEqual(batch["InvalidationBatch"]["Paths"], {
            "Quantity": 1,
            "Items": ["/*"],
        })

TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "daggerwalk-tests",
    }
}


class DaggerwalkModsTemplateTests(SimpleTestCase):
    def test_sticky_navigation_links_to_about_tab(self):
        html = render_to_string("daggerwalk/site_menu.html", {"show_view_tabs": True})

        self.assertIn(
            'data-site-section="about" href="/daggerwalk/?tab=about#about">About</a>',
            html,
        )

    def test_about_contains_canonical_mod_anchor_and_current_mods(self):
        html = render_to_string("daggerwalk/about.html")

        self.assertIn('id="mods"', html)
        self.assertIn("World of Daggerfall", html)
        self.assertIn("World of Daggerfall &ndash; Biomes", html)
        self.assertIn("Climates Travel Map", html)
        self.assertIn("Context-Sensitive Interaction (fork)", html)
        self.assertIn("Console Command Binds", html)
        self.assertIn("Future Shock Weapons", html)
        self.assertIn("Daggerfall Expanded Textures", html)
        self.assertIn("Sprite Sound Framework", html)
        self.assertIn("Wandering NPCs", html)
        self.assertIn("Seasons of the Iliac Bay", html)
        self.assertIn("Custom Daggerwalk mods", html)
        self.assertIn("nexusmods.com/daggerfallunity/mods/1377", html)

    def test_commands_lists_both_mod_aliases(self):
        html = render_to_string("daggerwalk/commands.html")

        self.assertIn("!modlist / !mods", html)


@override_settings(CACHES=TEST_CACHES)
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

    def test_completed_quest_page_has_persisted_herald(self):
        walker = TwitchUserProfile.objects.get(twitch_username="aliceWalker")
        ProgressionEvent.objects.create(
            profile=walker,
            quest=self.quest,
            event_type="renown",
            payload={"level": 1, "title": "Wayfarer"},
        )
        ProgressionEvent.objects.create(
            profile=walker,
            quest=self.quest,
            event_type="guild_rank",
            payload={"guild": "fighters", "level": 3, "title": "Protector"},
        )

        response = self.client.get(reverse(
            "daggerwalk_quest_detail",
            args=[self.quest.id],
        ))

        self.assertContains(response, "📯 Herald")
        self.assertContains(response, "aliceWalker")
        self.assertContains(response, "Reached Wayfarer Renown")
        self.assertContains(response, "Promoted to Protector in the Fighters Guild")

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

@override_settings(CACHES=TEST_CACHES)
class QuestQueueTests(TestCase):
    def setUp(self):
        self.pois = []
        for index in range(1, 8):
            region = Region.objects.create(
                name=f"Queue Region {index}",
                province="High Rock",
                climate="Woodlands",
            )
            self.pois.append(POI.objects.create(
                name=f"Queue Destination {index}",
                region=region,
                type="town",
                map_pixel_x=index,
                map_pixel_y=index,
            ))

    def test_completion_promotes_first_queued_quest_for_same_slot(self):
        active = Quest.objects.create(status="in_progress", slot=1, poi=self.pois[0])
        first = Quest.objects.create(status="available", slot=1, poi=self.pois[1])
        second = Quest.objects.create(status="available", slot=1, poi=self.pois[2])
        created_at = first.created_at

        _, next_quest = complete_and_rotate_quest(active, timezone.now())

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(next_quest.pk, first.pk)
        self.assertEqual(first.status, "in_progress")
        self.assertEqual(first.created_at, created_at)
        self.assertGreater(first.started_at, first.created_at)
        self.assertEqual(second.status, "available")
        self.assertIsNone(second.started_at)

    def test_queue_is_isolated_by_slot(self):
        active = Quest.objects.create(status="in_progress", slot=1, poi=self.pois[0])
        other_slot = Quest.objects.create(
            status="available", slot=2, poi=self.pois[1]
        )

        _, next_quest = complete_and_rotate_quest(active, timezone.now())

        other_slot.refresh_from_db()
        self.assertNotEqual(next_quest.pk, other_slot.pk)
        self.assertEqual(next_quest.slot, 1)
        self.assertEqual(other_slot.status, "available")

    def test_ensure_active_quests_promotes_queue_before_generating(self):
        queued = Quest.objects.create(
            status="available", slot=2, poi=self.pois[0]
        )

        active_quests = ensure_active_quests()

        self.assertEqual([quest.slot for quest in active_quests], [1, 2, 3])
        self.assertEqual(next(quest.pk for quest in active_quests if quest.slot == 2), queued.pk)

    def test_random_fallback_does_not_take_a_queued_destination(self):
        active = Quest.objects.create(status="in_progress", slot=1, poi=self.pois[0])
        queued = Quest.objects.create(
            status="available", slot=2, poi=self.pois[1]
        )

        _, next_quest = complete_and_rotate_quest(active, timezone.now())

        self.assertNotEqual(next_quest.poi_id, queued.poi_id)


@override_settings(CACHES=TEST_CACHES)
class ProgressionTests(TestCase):
    def setUp(self):
        cache.clear()
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

    def test_guild_quest_total_counts_shared_quest_once(self):
        walkers = [
            TwitchUserProfile.objects.create(
                twitch_username=username,
                current_guild="fighters",
            )
            for username in ("WalkerOne", "WalkerTwo")
        ]
        quest = Quest.objects.create(
            status="completed",
            poi=self.poi,
            xp=50,
            completed_at=timezone.now(),
        )
        for walker in walkers:
            walker.completed_quests.add(quest)
            ProgressionEvent.objects.create(
                profile=walker,
                quest=quest,
                event_type="quest",
                payload={"guild": "fighters"},
            )

        fighters = next(
            guild for guild in guild_hall_page_payload()
            if guild["key"] == "fighters"
        )

        self.assertEqual(fighters["walkers"], 2)
        self.assertEqual(fighters["quests_completed"], 1)

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

    def test_monument_after_midnight_is_described_as_night(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 200)
        monument = place_monument(profile, "cairn", {
            "worldX": 100000, "worldZ": 100000,
            "mapPixelX": 10, "mapPixelY": 20,
            "region": self.region.name, "locationType": "Wilderness",
            "date": "Sundas, 29 Frostfall, 3E 424, 00:53:25",
            "weather": "Rainy", "season": "Autumn",
        })

        self.assertIn("rainy night", monument.poi.description)
        self.assertNotIn("afternoon", monument.poi.description)

    def test_chronicle_guild_hall_and_registry_render(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        self.award(profile, 200)
        change_guild(profile, "fighters")
        request_log = DaggerwalkLog.objects.create(
            world_x=1000, world_z=1000, map_pixel_x=100, map_pixel_y=100,
            region=self.region.name, location=self.poi.name,
            player_x=0, player_y=0, player_z=0,
            date="1 Morning Star", weather="Clear",
        )
        ChatCommandLog.objects.create(
            request_log=request_log,
            profile=profile,
            timestamp=timezone.now(),
            user=profile.twitch_username,
            command="renown",
            args="details",
        )
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
        chronicle = self.client.get(reverse("daggerwalk_walker", args=["Walker"]))
        self.assertContains(chronicle, "Pathfinder")
        self.assertContains(chronicle, "Recent Command Log")
        self.assertContains(chronicle, "!renown")
        self.assertContains(chronicle, "details")
        self.assertContains(chronicle, "Joined the Fighters Guild")
        self.assertContains(chronicle, "Raised Walker&#x27;s Cairn")
        guild_hall = self.client.get(reverse("daggerwalk_guild_hall"))
        self.assertContains(guild_hall, "Fighters Guild")
        self.assertContains(guild_hall, 'class="site-nav-link active" href="/daggerwalk/guilds/"')
        with self.assertTemplateUsed("daggerwalk/includes/monument_table.html"):
            registry = self.client.get(reverse("daggerwalk_monuments"))
        self.assertContains(registry, "Cairn")
        self.assertNotContains(registry, "How Monuments Work")
        self.assertNotContains(registry, "monument-guide-title")
        self.assertContains(registry, "How do I earn and place a monument?")
        self.assertContains(registry, "monument-heading-icon")
        self.assertContains(registry, "Last Visited")
        self.assertNotContains(registry, "Never")
        self.assertContains(registry, "!monument &lt;type&gt;")
        self.assertContains(registry, "!monument types more")
        self.assertNotContains(registry, "!monument place")

        overview = render_to_string(
            "daggerwalk/progression.html",
            progression_home_payload(guilds=[{
                "emoji": "⚔️", "name": "Fighters Guild",
                "total_xp": 200, "walkers": 1, "quests_completed": 1,
            }]),
        )
        self.assertIn("monument-table", overview)
        self.assertIn("guild-summary-card", overview)
        self.assertIn("guild-summary-ledger", overview)
        self.assertIn("Members", overview)
        self.assertIn("Quests", overview)
        self.assertNotIn("Contributors", overview)
        self.assertIn("Last Visited", overview)
        self.assertIn("Loredas, 17 Rain&#x27;s Hand, 3E 405", overview)

    def test_every_progression_event_has_a_specific_description(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        quest = self.award(profile, 200)
        monument = place_monument(profile, "cairn", {
            "worldX": 100000, "worldZ": 100000,
            "mapPixelX": 10, "mapPixelY": 20,
            "region": self.region.name, "locationType": "Wilderness",
            "date": "Loredas, 1 Frostfall",
        })
        cases = [
            (ProgressionEvent(event_type="quest", quest=quest, payload={"guild": "fighters"}), f"Completed {quest.quest_name} and earned 200 XP for the Fighters Guild"),
            (ProgressionEvent(event_type="renown", payload={"title": "Pathfinder"}), "Reached Pathfinder Renown"),
            (ProgressionEvent(event_type="guild_rank", payload={"guild": "fighters", "title": "Protector"}), "Promoted to Protector in the Fighters Guild"),
            (ProgressionEvent(event_type="guild_change", payload={"old_guild": "mages", "new_guild": "fighters"}), "Changed allegiance from the Mages Guild to the Fighters Guild"),
            (ProgressionEvent(event_type="monument", monument=monument), "Raised Walker's Cairn"),
            (ProgressionEvent(event_type="monument_visit", quest=quest, monument=monument), f"Walker's Cairn was visited during {quest.quest_name}"),
        ]

        for event, expected in cases:
            with self.subTest(event_type=event.event_type):
                self.assertEqual(progression_event_description(event), expected)

    def test_progression_home_lists_latest_twenty_monuments(self):
        profile = TwitchUserProfile.objects.create(twitch_username="Walker")
        created_at = timezone.now() - timedelta(days=1)
        for index in range(21):
            poi = POI.objects.create(
                name=f"Monument {index}",
                region=self.region,
                type="landmark",
                map_pixel_x=index,
                map_pixel_y=index,
            )
            monument = Monument.objects.create(
                poi=poi,
                owner=profile,
                monument_type="cairn",
                world_x=index,
                world_z=index,
                game_date="1 Morning Star",
                renown_title_at_placement="Wayfarer",
            )
            Monument.objects.filter(pk=monument.pk).update(
                created_at=created_at + timedelta(minutes=index),
            )

        payload = progression_home_payload(guilds=[])

        self.assertEqual(len(payload["recent_monuments"]), 20)
        self.assertEqual(payload["recent_monuments"][0].poi.name, "Monument 20")
        self.assertEqual(payload["recent_monuments"][-1].poi.name, "Monument 1")

    def test_unlisted_walker_keeps_public_chronicle_without_public_rankings(self):
        hidden = TwitchUserProfile.objects.create(
            twitch_username="billcrystals",
            current_guild="mages",
        )
        visible = TwitchUserProfile.objects.create(twitch_username="VisibleWalker")
        quest = self.award(hidden, 200)
        visible.completed_quests.add(quest)
        ProgressionEvent.objects.create(
            profile=hidden,
            quest=quest,
            event_type="quest",
            payload={"guild": "mages"},
        )
        monument = place_monument(hidden, "cairn", {
            "worldX": 100000, "worldZ": 100000,
            "mapPixelX": 10, "mapPixelY": 20,
            "region": self.region.name, "locationType": "Wilderness",
            "date": "Loredas, 1 Frostfall",
        })

        snapshot = progression_snapshot()

        self.assertNotIn("billcrystals", snapshot["profiles"])
        self.assertEqual(snapshot["profiles"]["visiblewalker"]["position"], 1)
        self.assertIn(monument.id, {row["id"] for row in snapshot["monuments"]})
        self.assertIn(
            monument,
            progression_home_payload(guilds=[])["recent_monuments"],
        )
        chronicle = self.client.get(reverse("daggerwalk_walker", args=["billcrystals"]))
        self.assertEqual(chronicle.status_code, 200)
        self.assertContains(chronicle, "billcrystals")
        self.assertNotContains(chronicle, "All-time rank")

        quest_page = self.client.get(reverse("daggerwalk_quest_detail", args=[quest.pk]))
        self.assertContains(quest_page, "VisibleWalker")
        self.assertNotContains(quest_page, "billcrystals")
        self.assertEqual(QuestSerializer(quest).data["participant_names"], ["VisibleWalker"])

        mages = next(guild for guild in guild_hall_page_payload() if guild["key"] == "mages")
        self.assertNotIn(hidden, mages["top_contributors"])
        self.assertEqual(mages["walkers"], 0)
        self.assertIn(monument, mages["monuments"])
        self.assertContains(
            self.client.get(reverse("daggerwalk_monuments")),
            "billcrystals",
        )

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
