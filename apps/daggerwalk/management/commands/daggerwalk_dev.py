import os
import socket
import subprocess
import sys
import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


REDIS_CONTAINER = "daggerwalk-redis"


class Command(BaseCommand):
    help = "Start Redis, the Daggerwalk cache worker, and the local Django server."

    def add_arguments(self, parser):
        parser.add_argument(
            "--noreload", action="store_true",
            help="Disable Django's automatic code reloader.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("daggerwalk_dev may only be run with development settings.")
        reloader_child = os.environ.get("RUN_MAIN") == "true"
        use_reloader = not options.get("noreload", False)

        if not reloader_child:
            self._start_redis()
            call_command("migrate")

        worker = None
        if reloader_child or not use_reloader:
            worker = subprocess.Popen([
                sys.executable, "-m", "celery", "-A", "kershner", "worker",
                "--pool=solo", "--loglevel=info",
            ])
            self.stdout.write(self.style.SUCCESS("Daggerwalk development services are ready."))
            self.stdout.write("Site: http://127.0.0.1:8000/daggerwalk/")

        try:
            call_command("runserver", "127.0.0.1:8000", use_reloader=use_reloader)
        finally:
            if worker is not None and worker.poll() is None:
                worker.terminate()
                try:
                    worker.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    worker.kill()

    def _start_redis(self):
        try:
            docker = subprocess.run(
                ["docker", "info"], stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except FileNotFoundError as exc:
            raise CommandError("Docker is not installed or is not on PATH.") from exc
        if docker.returncode:
            raise CommandError("Docker is not running. Start it, then try again.")

        exists = subprocess.run(
            ["docker", "inspect", REDIS_CONTAINER],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ).returncode == 0
        command = (
            ["docker", "start", REDIS_CONTAINER]
            if exists else
            [
                "docker", "run", "-d", "--name", REDIS_CONTAINER,
                "-p", "127.0.0.1:6379:6379", "redis:7-alpine",
            ]
        )
        try:
            subprocess.run(command, check=True)
        except subprocess.CalledProcessError as exc:
            raise CommandError("Could not start the Daggerwalk Redis container.") from exc

        # Harmless if already connected; fixes containers created by some
        # Rancher Desktop/Docker configurations without their default network.
        subprocess.run(
            ["docker", "network", "connect", "bridge", REDIS_CONTAINER],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", 6379), timeout=1):
                    return
            except OSError:
                time.sleep(0.5)
        raise CommandError("Redis did not become reachable at 127.0.0.1:6379.")
