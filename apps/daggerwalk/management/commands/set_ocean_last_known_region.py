from django.core.management.base import BaseCommand
from apps.daggerwalk.models import DaggerwalkLog
from django.db import transaction


class Command(BaseCommand):
    help = 'Updates all Ocean logs with the last known region based on chronological order'

    def handle(self, *args, **options):
        self.stdout.write('Starting Ocean logs update...')
        
        # Get all Ocean logs
        ocean_logs = DaggerwalkLog.objects.filter(
            region__iexact='Ocean',
            last_known_region__isnull=True
        ).order_by('created_at')
        
        count = 0
        with transaction.atomic():
            for ocean_log in ocean_logs:
                # Find the most recent non-ocean log before this one
                last_land_log = DaggerwalkLog.objects.exclude(
                    region__iexact='Ocean'
                ).exclude(
                    region_fk__isnull=True
                ).filter(
                    created_at__lt=ocean_log.created_at
                ).order_by('-created_at').first()
                
                if last_land_log and last_land_log.region_fk:
                    ocean_log.last_known_region = last_land_log.region_fk
                    ocean_log.save(update_fields=['last_known_region'])
                    count += 1
                    
                    if count % 100 == 0:
                        self.stdout.write(f'Updated {count} logs so far...')
        
        self.stdout.write(self.style.SUCCESS(f'Successfully updated {count} Ocean logs with last known region'))