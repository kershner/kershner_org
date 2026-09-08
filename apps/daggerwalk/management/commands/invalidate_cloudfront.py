import time

import boto3
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Invalidate the entire website in CloudFront."

    def handle(self, *args, **options):
        client = boto3.client(
            "cloudfront",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        domain = settings.CLOUDFRONT_DOMAIN.removeprefix("https://").split("/", 1)[0]
        distribution_id = self._distribution_id(client, domain)
        if not distribution_id:
            raise CommandError(f"No CloudFront distribution found for {domain}.")

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

    @staticmethod
    def _distribution_id(client, domain):
        for page in client.get_paginator("list_distributions").paginate():
            for distribution in page.get("DistributionList", {}).get("Items", []):
                aliases = distribution.get("Aliases", {}).get("Items", [])
                if domain == distribution.get("DomainName") or domain in aliases:
                    return distribution["Id"]
        return None
