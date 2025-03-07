from .models import Region, POI, DaggerwalkLog
from rest_framework import serializers


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = '__all__'


class POISerializer(serializers.ModelSerializer):
    class Meta:
        model = POI
        fields = '__all__'
        

class POISimpleSerializer(serializers.ModelSerializer):
    """A simpler serializer for POI data embedded in other responses"""
    class Meta:
        model = POI
        exclude = ['region']


class DaggerwalkLogSerializer(serializers.ModelSerializer):
    region_fk = RegionSerializer(read_only=True)
    poi = POISimpleSerializer(read_only=True)
    
    class Meta:
        model = DaggerwalkLog
        fields = '__all__'


class RegionWithPOIsSerializer(serializers.ModelSerializer):
    """Serializer for a region including its points of interest"""
    points_of_interest = POISimpleSerializer(many=True, read_only=True)
    
    class Meta:
        model = Region
        fields = '__all__'


class LogsWithPOIsResponse(serializers.Serializer):
    """Serializer for the response format containing logs and POIs for a region"""
    logs = DaggerwalkLogSerializer(many=True)
    pois = POISimpleSerializer(many=True)


class SingleLogWithPOIsResponse(serializers.Serializer):
    """Serializer for response containing a single log and POIs"""
    log = DaggerwalkLogSerializer()
    pois = POISimpleSerializer(many=True)