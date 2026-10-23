from collections import defaultdict

from django.conf import settings
from django.db import transaction
from django.db.models import F, Max
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer
from rest_framework.response import Response

from apps.api.views import BaseListAPIView

from .models import Planet, PlanetVisit
from .serializers import PlanetBatchSerializer, PlanetSerializer


class PlanetBrowsableAPIRenderer(BrowsableAPIRenderer):
    def show_form_for_method(self, view, method, request, obj):
        return method != 'POST' and super().show_form_for_method(view, method, request, obj)


class PlanetListAPIView(BaseListAPIView):
    queryset = Planet.objects.annotate(last_visited=Max('visits__timestamp'))
    serializer_class = PlanetSerializer
    ordering = [F('last_visited').desc(nulls_last=True), 'galaxy_index', 'name', 'id']
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    renderer_classes = [JSONRenderer, PlanetBrowsableAPIRenderer]

    def post(self, request):
        token = settings.NO_MANS_WALK_API_TOKEN
        if not token or request.headers.get('Authorization') != f'Bearer {token}':
            return Response({'status': 'error', 'message': 'Unauthorized'}, status=401)

        batch = PlanetBatchSerializer(data=request.data)
        batch.is_valid(raise_exception=True)

        # Repeated planets share one upsert; the final entry supplies metadata.
        metadata_by_planet = {}
        visits = defaultdict(set)
        for entry in batch.validated_data['planets']:
            metadata = dict(entry)
            timestamp = metadata.pop('timestamp')
            key = (metadata.pop('galaxy_index'), metadata.pop('planet_hex'))
            metadata_by_planet[key] = metadata
            visits[key].add(timestamp)

        counts = {'planets_created': 0, 'planets_updated': 0, 'visits_created': 0}
        with transaction.atomic():
            for key, metadata in sorted(metadata_by_planet.items()):
                planet, created = Planet.objects.select_for_update().get_or_create(
                    galaxy_index=key[0], planet_hex=key[1], defaults=metadata,
                )
                if created:
                    counts['planets_created'] += 1
                elif any(getattr(planet, field) != value for field, value in metadata.items()):
                    Planet.objects.filter(pk=planet.pk).update(**metadata)
                    counts['planets_updated'] += 1

                for timestamp in sorted(visits[key]):
                    _, created = PlanetVisit.objects.get_or_create(planet=planet, timestamp=timestamp)
                    counts['visits_created'] += int(created)

        return Response(counts)
