import math

from .models import ChatCommandLog, Quest, Region, POI, DaggerwalkLog
from rest_framework import serializers


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = '__all__'


class POISerializer(serializers.ModelSerializer):
    region = RegionSerializer(read_only=True)
    monument_id = serializers.SerializerMethodField()
    monument_owner = serializers.SerializerMethodField()
    monument_guild = serializers.SerializerMethodField()

    def get_monument_id(self, obj):
        return obj.monument.id if hasattr(obj, "monument") else None

    def get_monument_owner(self, obj):
        return obj.monument.owner.twitch_username if hasattr(obj, "monument") else None

    def get_monument_guild(self, obj):
        return obj.monument.guild_at_placement if hasattr(obj, "monument") else ""

    class Meta:
        model = POI
        fields = '__all__'

class DaggerwalkLogSerializer(serializers.ModelSerializer):
    region_fk = RegionSerializer(read_only=True)
    last_known_region = RegionSerializer(read_only=True)
    poi = POISerializer(read_only=True)
    
    class Meta:
        model = DaggerwalkLog
        fields = '__all__'


class RegionWithPOIsSerializer(serializers.ModelSerializer):
    """Serializer for a region including its points of interest"""
    points_of_interest = POISerializer(many=True, read_only=True)
    
    class Meta:
        model = Region
        fields = '__all__'


class ChatCommandLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatCommandLog
        fields = '__all__'


class QuestSerializer(serializers.ModelSerializer):
    poi = POISerializer(read_only=True)
    quest_giver_img_url = serializers.SerializerMethodField()
    quest_name = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    participant_names = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    progression_announcements = serializers.SerializerMethodField()

    class Meta:
        model = Quest
        fields = '__all__'

    def get_quest_giver_img_url(self, obj):
        return obj.quest_giver_img_url  # model property

    def get_quest_name(self, obj):
        return obj.quest_name  # model property

    def get_participant_count(self, obj):
        return obj.completed_by.count()

    def get_participant_names(self, obj):
        return list(obj.completed_by.order_by("twitch_username").values_list("twitch_username", flat=True)[:3])

    def get_duration_minutes(self, obj):
        if not obj.completed_at:
            return None
        return max(0, int((obj.completed_at - obj.created_at).total_seconds() / 60))

    def get_distance_km(self, obj):
        """Return the recorded world-path distance traveled during this quest."""
        if not obj.completed_at:
            return None

        points = DaggerwalkLog.objects.filter(
            created_at__gte=obj.created_at,
            created_at__lte=obj.completed_at,
        ).order_by("created_at").values_list("world_x", "world_z")

        total_world_units = 0.0
        previous = None
        for point in points.iterator():
            if previous is not None:
                total_world_units += math.hypot(
                    point[0] - previous[0],
                    point[1] - previous[1],
                )
            previous = point

        return round(total_world_units / 1000.0, 2)

    def get_progression_announcements(self, obj):
        return getattr(obj, "progression_announcements", [])
