import time

import boto3
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Invalidate the entire website in CloudFront."

    def handle(self, *args, **options):
        distribution_id = settings.CLOUDFRONT_DISTRIBUTION_ID
        if not distribution_id:
            raise CommandError(
                "Set CLOUDFRONT_DISTRIBUTION_ID or cloudfront_distribution_id "
                "in site_config/parameters.json."
            )

        client = boto3.client(
            "cloudfront",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        response = client.create_invalidation(
            DistributionId=distribution_id,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": ["/*"]},
                "CallerReference": f"website-deploy-{time.time_ns()}",
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Created CloudFront invalidation {response['Invalidation']['Id']}."
        ))
