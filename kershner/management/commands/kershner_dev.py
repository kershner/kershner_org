import os
import subprocess
import sys

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Start the local kershner.org Django server and Celery worker."

    def handle(self, *args, **options):
        worker = None
        if os.environ.get("RUN_MAIN") == "true":
            worker = subprocess.Popen([
                sys.executable, "-m", "celery", "-A", "kershner", "worker",
                "--pool=solo", "--loglevel=info",
            ])
            self.stdout.write(self.style.SUCCESS("kershner.org development services are ready."))
            self.stdout.write("Site: http://127.0.0.1:8000/")

        try:
            call_command("runserver", "127.0.0.1:8000")
        finally:
            if worker is not None:
                worker.terminate()
