from django.core.management.base import BaseCommand
from apps.song.models import Song
import logging

logger = logging.getLogger('logfile')


class Command(BaseCommand):
    help = 'Simple test code'

    def handle(self, *args, **options):
        print('\nPoop')

        search_string = 'take_3_mixed.mp3'
        songs = Song.objects.all()
        songs_that_need_to_be_fixed = []
        for song in songs:
            filename = song.file.name
            filename_trimmed = filename[filename.find('/') + 1:]
            if filename_trimmed == search_string:
                songs_that_need_to_be_fixed.append(song)

        print('\nsongs_that_need_to_be_fixed:')
        for song in songs_that_need_to_be_fixed:
            print('{} - filename: {}'.format(song, song.file.name))

        print('\nDone!')
