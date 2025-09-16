from .models import ChatCommandLog, Quest, Region, POI, DaggerwalkLog, TwitchUserProfile
from rest_framework import serializers


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = '__all__'


class POISerializer(serializers.ModelSerializer):
    region = RegionSerializer(read_only=True)

    class Meta:
        model = POI
        fields = '__all__'

class DaggerwalkLogSerializer(serializers.ModelSerializer):
    region_fk = RegionSerializer(read_only=True)
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

    class Meta:
        model = Quest
        fields = '__all__'

    def get_quest_giver_img_url(self, obj):
        return obj.quest_giver_img_url  # model property

    def get_quest_name(self, obj):
        return obj.quest_name  # model property


class TwitchUserProfileSerializer(serializers.ModelSerializer):
    total_xp = serializers.IntegerField(read_only=True)  # reads the model property 'total_xp'
    completed_quests_count = serializers.SerializerMethodField()

    class Meta:
        model = TwitchUserProfile
        fields = ('twitch_username', 'created_at', 'total_xp', 'completed_quests_count')

    def get_completed_quests_count(self, obj):
        # uses annotated value if present; falls back to a count()
        return getattr(obj, 'completed_quests_count', obj.completed_quests.count())
