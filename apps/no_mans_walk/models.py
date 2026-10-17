from django.db import models


class Planet(models.Model):
    galaxy_index = models.IntegerField()
    planet_hex = models.CharField(max_length=12)
    name = models.CharField(max_length=255)
    galaxy_name = models.CharField(max_length=255)
    biome = models.CharField(max_length=255)
    weather = models.CharField(max_length=255)
    flora = models.CharField(max_length=255)
    fauna = models.CharField(max_length=255)
    sentinels = models.CharField(max_length=255)
    has_rings = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['galaxy_index', 'planet_hex'], name='nmw_unique_planet',
            ),
        ]

    def __str__(self):
        return f'{self.name} ({self.galaxy_index}:{self.planet_hex})'


class PlanetVisit(models.Model):
    planet = models.ForeignKey(Planet, on_delete=models.CASCADE, related_name='visits')
    timestamp = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['planet', 'timestamp'], name='nmw_unique_planet_visit',
            ),
        ]
