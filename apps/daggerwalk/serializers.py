from .models import Region, POI, DaggerwalkLog
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
