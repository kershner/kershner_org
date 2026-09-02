from django.test import TestCase
from django.urls import reverse

from apps.daggerwalk.models import POI, Quest, Region, TwitchUserProfile
from apps.daggerwalk.serializers import QuestSerializer


class CompletedQuestDetailTests(TestCase):
    def setUp(self):
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
