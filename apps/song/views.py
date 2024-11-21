from apps.song.serializers import SongSerializer
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.song.models import Song


class SongListAPIView(APIView):
    def get_queryset(self):
        return Song.objects.all()

    def get(self, request):
        queryset = self.get_queryset()
        serializer = SongSerializer(queryset, many=True)
        return Response(serializer.data)
