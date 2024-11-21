from rest_framework import serializers
from .models import Whoosh


class WhooshSerializer(serializers.ModelSerializer):
    class Meta:
        model = Whoosh
        fields = '__all__'
