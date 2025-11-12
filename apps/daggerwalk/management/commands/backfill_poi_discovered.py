from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Min
from apps.daggerwalk.models import POI, DaggerwalkLog

class Command(BaseCommand):
    help = "Recalculate and correct POI.discovered timestamps based on earliest linked DaggerwalkLog (skips capitals)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without saving."
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        self.stdout.write(f"{'Dry-run' if dry_run else 'Updating'} POI.discovered values (excluding capitals)...\n")

        pois = (
            POI.objects.exclude(type="capital")
            .annotate(earliest_log=Min("logs__created_at"))
        )

        changed = 0
        for poi in pois:
            old_val = poi.discovered
            new_val = poi.earliest_log or timezone.now()

            # Skip if unchanged
            if old_val and abs((old_val - new_val).total_seconds()) < 1:
                continue

            changed += 1
            self.stdout.write(
                f" - {poi.name} ({poi.region.name})\n"
                f"   old: {old_val}\n"
                f"   new: {new_val}\n"
            )

            if not dry_run:
                poi.discovered = new_val
                poi.save(update_fields=["discovered"])

        summary = f"\n{changed} non-capital POIs {'would be' if dry_run else 'were'} updated."
        self.stdout.write(self.style.SUCCESS(summary))
