import os

from django.core.management.base import BaseCommand, CommandError

try:
    from apps.roll20_stats.models import GameSession, Roll20Message
    from apps.roll20_stats.utils import parse_roll20_messages, update_session_stats
except ImportError:
    from roll20_stats.models import GameSession, Roll20Message
    from roll20_stats.utils import parse_roll20_messages, update_session_stats


class Command(BaseCommand):
    help = 'Import a Roll20 HTML chat log.'

    def add_arguments(self, parser):
        parser.add_argument('html_path')
        parser.add_argument('--assume-date', help='Date for a trailing time-only session, e.g. 2026-06-18.')
        parser.add_argument('--reset', action='store_true')

    def handle(self, *args, **options):
        html_path = options['html_path']
        if not os.path.exists(html_path):
            raise CommandError('File not found: {}'.format(html_path))

        if options['reset']:
            GameSession.objects.all().delete()

        try:
            messages = parse_roll20_messages(html_path, assume_date=options.get('assume_date'))
            created_count = 0
            affected_session_ids = set()

            for data in messages:
                session, _ = GameSession.objects.get_or_create(date=data['timestamp'].date())
                data['session'] = session
                _, created = Roll20Message.objects.get_or_create(import_hash=data['import_hash'], defaults=data)
                if created:
                    created_count += 1
                    affected_session_ids.add(session.id)

            for session in GameSession.objects.filter(id__in=affected_session_ids):
                update_session_stats(session)
        except ValueError as exc:
            raise CommandError(str(exc))

        self.stdout.write(self.style.SUCCESS(
            'Imported {} new messages across {} sessions.'.format(created_count, len(affected_session_ids))
        ))
