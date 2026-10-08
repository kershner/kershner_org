from datetime import datetime

import requests
from django.core.management.base import BaseCommand, CommandError

from apps.daggerwalk import threads


class Command(BaseCommand):
    help = "Authorize the Daggerwalk Threads account or show token status"

    def add_arguments(self, parser):
        parser.add_argument("--status", action="store_true")

    def handle(self, *args, **options):
        try:
            if options["status"]:
                status = threads.token_status()
                if not status:
                    self.stdout.write("Threads is not authorized.")
                    return
                expiry = datetime.fromtimestamp(status["expires_at"])
                self.stdout.write(f"Threads user: {status['user_id']}")
                self.stdout.write(f"Token expires: {expiry:%Y-%m-%d %H:%M:%S}")
                return

            url, state = threads.authorization_url()
            self.stdout.write("Open this URL and approve access:\n")
            self.stdout.write(url)
            redirected_url = input("\nPaste the complete redirected URL: ").strip()
            saved = threads.authorize(redirected_url, state)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Threads authorization saved for user {saved['user_id']}."
                )
            )
        except (threads.ThreadsError, requests.RequestException) as error:
            raise CommandError(str(error)) from error
