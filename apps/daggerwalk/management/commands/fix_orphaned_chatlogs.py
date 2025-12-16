"""
Management command to fix ChatCommandLog entries that have NULL profile FK
but match existing TwitchUserProfile usernames (case-insensitive).

Usage:
    python manage.py fix_orphaned_chatlogs --dry-run  # See what would be fixed
    python manage.py fix_orphaned_chatlogs            # Actually fix them
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from apps.daggerwalk.models import TwitchUserProfile, ChatCommandLog


class Command(BaseCommand):
    help = 'Link ChatCommandLog entries with NULL profile FK to their matching TwitchUserProfile'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made\n'))
        
        # Find all chat logs with NULL profile FK
        orphaned_logs = ChatCommandLog.objects.filter(profile__isnull=True)
        total_orphaned = orphaned_logs.count()
        
        if total_orphaned == 0:
            self.stdout.write(self.style.SUCCESS('No orphaned chat logs found!'))
            return
        
        self.stdout.write(f'Found {total_orphaned:,} chat logs with NULL profile FK\n')
        
        # Get distinct usernames from orphaned logs
        distinct_users = list(
            orphaned_logs.values_list('user', flat=True).distinct()
        )
        
        self.stdout.write(f'Found {len(distinct_users)} distinct usernames in orphaned logs\n')
        
        # Build a map: username_lower -> profile_id
        profile_map = {}
        missing_profiles = []
        
        for username in distinct_users:
            try:
                profile = TwitchUserProfile.objects.get(twitch_username__iexact=username)
                profile_map[username.lower()] = profile.id
            except TwitchUserProfile.DoesNotExist:
                missing_profiles.append(username)
        
        self.stdout.write(f'Found profiles for {len(profile_map)} usernames')
        
        if missing_profiles:
            self.stdout.write(
                self.style.WARNING(
                    f'\nWARNING: {len(missing_profiles)} usernames have no matching profile:'
                )
            )
            for username in missing_profiles[:20]:  # Show first 20
                count = orphaned_logs.filter(user=username).count()
                self.stdout.write(f'  - {username} ({count} logs)')
            if len(missing_profiles) > 20:
                self.stdout.write(f'  ... and {len(missing_profiles) - 20} more')
            self.stdout.write(
                self.style.WARNING(
                    '\nThese chat logs will remain orphaned. '
                    'Profiles will be created when these users complete quests.\n'
                )
            )
        
        # Update orphaned logs
        total_fixed = 0
        
        if not dry_run:
            with transaction.atomic():
                for username_lower, profile_id in profile_map.items():
                    # Update all chat logs for this user (case-insensitive)
                    updated = ChatCommandLog.objects.filter(
                        profile__isnull=True,
                        user__iexact=username_lower
                    ).update(profile_id=profile_id)
                    
                    if updated > 0:
                        total_fixed += updated
                        self.stdout.write(f'✓ Linked {updated:,} logs to profile: {username_lower}')
        else:
            # Dry run - just count what would be updated
            for username_lower, profile_id in profile_map.items():
                would_update = ChatCommandLog.objects.filter(
                    profile__isnull=True,
                    user__iexact=username_lower
                ).count()
                
                if would_update > 0:
                    total_fixed += would_update
                    profile = TwitchUserProfile.objects.get(id=profile_id)
                    self.stdout.write(
                        f'[DRY RUN] Would link {would_update:,} logs to profile: {profile.twitch_username}'
                    )
        
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN COMPLETE'))
            self.stdout.write(f'Would fix {total_fixed:,} orphaned chat logs')
            self.stdout.write(f'Would leave {total_orphaned - total_fixed:,} orphaned (no matching profiles)')
        else:
            self.stdout.write(self.style.SUCCESS('FIX COMPLETE'))
            self.stdout.write(self.style.SUCCESS(f'Fixed {total_fixed:,} orphaned chat logs'))
            remaining = ChatCommandLog.objects.filter(profile__isnull=True).count()
            self.stdout.write(f'Remaining orphaned: {remaining:,} (no matching profiles)')