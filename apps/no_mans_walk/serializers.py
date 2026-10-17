from rest_framework import serializers

from .models import Planet


class PlanetSerializer(serializers.ModelSerializer):
    last_visited = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Planet
        fields = '__all__'


class PlanetIngestionSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField()

    class Meta:
        model = Planet
        exclude = ['id']
        # Existing identities are valid upsert targets, not validation errors.
        validators = []

    def validate_planet_hex(self, value):
        return value.upper()


class PlanetBatchSerializer(serializers.Serializer):
    planets = PlanetIngestionSerializer(many=True, allow_empty=False)
