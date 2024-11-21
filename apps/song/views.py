from apps.song.serializers import SongSerializer
from apps.api.views import BaseListAPIView
from apps.song.models import Song


class SongListAPIView(BaseListAPIView):
    queryset = Song.objects.all()
    serializer_class = SongSerializer