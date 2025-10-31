from django.core.management.base import BaseCommand
from django.db.models import OuterRef, Subquery
from apps.daggerwalk.models import POI, DaggerwalkLog


class Command(BaseCommand):
    help = "Backfill POI.discovered with the earliest DaggerwalkLog.created_at linked to each POI."

    def handle(self, *args, **options):
        self.stdout.write("Backfilling POI.discovered values...")

        # Subquery to get earliest log date per POI
        earliest_log_subquery = (
            DaggerwalkLog.objects
            .filter(poi=OuterRef("pk"))
            .order_by("created_at")
            .values("created_at")[:1]
        )

        # Update only POIs missing discovered dates
        updated_count = (
            POI.objects
            .filter(discovered__isnull=True)
            .update(discovered=Subquery(earliest_log_subquery))
        )

        self.stdout.write(self.style.SUCCESS(f"Updated {updated_count} POI records."))
