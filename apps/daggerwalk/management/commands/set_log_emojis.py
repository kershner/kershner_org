from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.daggerwalk.models import DaggerwalkLog

class Command(BaseCommand):
    help = 'Efficiently sets emojis for all DaggerwalkLog instances that need them'

    def handle(self, *args, **options):
        # Get logs that need emojis (POIs without emojis already set)
        logs_needing_emoji = DaggerwalkLog.objects.filter(
            ~Q(location__in=["Wilderness", "Ocean"]),  # is_poi() equivalent
            Q(emoji__isnull=True) | Q(emoji='')        # emoji not set
        )
        
        count = logs_needing_emoji.count()
        self.stdout.write(self.style.WARNING(f'About to set emojis for {count} logs...'))
        
        # If no logs need emojis, we're done
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No logs need emojis. Done!'))
            return
            
        # Set emojis
        for log in logs_needing_emoji:
            log.emoji = DaggerwalkLog.get_emoji()
        
        # Bulk update just the emoji field
        DaggerwalkLog.objects.bulk_update(logs_needing_emoji, ['emoji'])
        
        self.stdout.write(self.style.SUCCESS('Success!'))