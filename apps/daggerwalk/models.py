from django.forms.models import model_to_dict
from django.db import models
import random


class Region(models.Model):
    PROVINCE_CHOICES = [
        ('High Rock', 'High Rock'),
        ('Hammerfell', 'Hammerfell'),
        ('High Rock/Hammerfell', 'High Rock/Hammerfell'),
    ]
    
    CLIMATE_CHOICES = [
        ('Desert', 'Desert'),
        ('Mountain', 'Mountain'),
        ('Woodlands', 'Woodlands'),
        ('Swamp', 'Swamp'),
        ('Ocean', 'Ocean'),
        ('Subtropical', 'Subtropical'),
        ('Rainforest', 'Rainforest'),
    ]
    
    name = models.CharField(max_length=100, unique=True)
    province = models.CharField(max_length=100, choices=PROVINCE_CHOICES)
    climate = models.CharField(max_length=100, choices=CLIMATE_CHOICES)
    
    # FMAP Mapping Data
    region_index = models.IntegerField(null=True, blank=True)
    multi_part = models.BooleanField(default=False)
    fmap_image = models.CharField(max_length=100, null=True, blank=True)  # For single image regions
    offset_x = models.IntegerField(null=True, blank=True)  # For single image regions
    offset_y = models.IntegerField(null=True, blank=True)  # For single image regions
    emoji = models.CharField(max_length=10, blank=True, null=True)
    
    def __str__(self):
        return f"{self.name} ({self.province})"

class POI(models.Model):
    """Points of Interest including capitals"""
    TYPE_CHOICES = [
        ('capital', 'Capital'),
        ('town', 'Town'),
        ('landmark', 'Landmark'),
        ('dungeon', 'Dungeon'),
    ]
    
    name = models.CharField(max_length=100)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='points_of_interest')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='town')
    map_pixel_x = models.IntegerField()
    map_pixel_y = models.IntegerField()
    description = models.TextField(blank=True, null=True)
    emoji = models.CharField(max_length=10, blank=True, null=True)
    
    class Meta:
        unique_together = ('region', 'name')
    
    def __str__(self):
        return f"{self.emoji}{self.name} ({self.type} of {self.region.name})"
    
    def save(self, *args, **kwargs):
        if not self.emoji:
            self.emoji = self.get_emoji()
        super().save(*args, **kwargs)

    @classmethod
    def get_emoji(cls):
        emoji_choices = [
            '💀', '☠️', '⚔️', '🗡️', '🏹', '🛡️', '⚱️', '🔮', '🕳️', '⛏️', '🕯️',
            '🏰', '🏚️', '⚰️', '🧱', '⛓️', '🔗',
            '🏠', '🏘️', '🏛️', '⛪', '🗿', '⚓', '⛲',
            '👑', '🗝️', '📜', '🏺', '🪓', '🔥', '📌', '🔑', '📖', '💎',
            '🏆', '🧿', '⚜️', '📯', '🪔', '🎯', '🧭',
            '🧙', '🐉', '🦄', '🐲', '🏮', '🧪', '⚗️', '📿', '💍',
            '🦴', '🩸', '👁️', '👣', '🧠', '🎭',
            '🎲', '🎪', '🧶', '🧵', '🧸', 
            '👹', '👺', '👻', '🧹', '🚪',  
            '⏳', '🏷️', '🎷', '🕰️',
            '🎃', '🃏', '⚖️', '⚒️', '🪒', '🔱', 
            '🖋️', '🖌️', '🖍️'
        ]
        return random.choice(emoji_choices)

class DaggerwalkLog(models.Model):
    # World coordinates
    world_x = models.IntegerField(help_text="X coordinate in world space")
    world_z = models.IntegerField(help_text="Z coordinate in world space")

    # Map coordinates
    map_pixel_x = models.SmallIntegerField(help_text="X coordinate on the world map")
    map_pixel_y = models.SmallIntegerField(help_text="Y coordinate on the world map")

    # Location information
    region = models.CharField(max_length=255, help_text="Region name")
    region_fk = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs')
    location = models.CharField(max_length=255, help_text="Specific location name")
    poi = models.ForeignKey(POI, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs')
    last_known_region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True)

    # Precise player coordinates
    player_x = models.DecimalField(max_digits=20, decimal_places=6, help_text="Precise X coordinate of player")
    player_y = models.DecimalField(max_digits=20, decimal_places=6, help_text="Precise Y coordinate of player")
    player_z = models.DecimalField(max_digits=20, decimal_places=6, help_text="Precise Z coordinate of player")

    # Time information
    date = models.CharField(max_length=255, help_text="In-game date and time")
    created_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when this log entry was created")

    # Environment
    weather = models.CharField(max_length=255, help_text="Current weather condition")
    current_song = models.CharField(max_length=255, null=True, blank=True, help_text="Currently playing background music")
    season = models.CharField(max_length=255, null=True, blank=True, help_text="Current in-game season")

    class Meta:
        verbose_name = 'Daggerwalk Log'
        verbose_name_plural = 'Daggerwalk Logs'

    def __str__(self):
        formatted_datetime = self.created_at.strftime("%b %d, %I:%M%p %Y")
        # Remove leading zero from hour
        formatted_datetime = formatted_datetime.replace(" 0", " ")
        return f"{self.region} - {formatted_datetime}"
    
    def save(self, *args, **kwargs):
        self.season = self.determine_season()
        
        # Try to set the foreign key to Region
        try:
            self.region_fk = Region.objects.get(name=self.region)
        except Region.DoesNotExist:
            self.region_fk = None

        # Handle Ocean region - set last_known_region to most recent non-ocean region
        if self.region.lower() == "ocean" and not self.last_known_region:
            # Get the most recent log entry that isn't in the Ocean and has a region_fk
            last_land_log = DaggerwalkLog.objects.exclude(
                region__iexact="Ocean"
            ).exclude(
                region_fk__isnull=True
            ).order_by('-created_at').first()
            
            if last_land_log and last_land_log.region_fk:
                self.last_known_region = last_land_log.region_fk
            
        # Try to associate with a POI if not wilderness/ocean
        non_poi_keywords = ["Wilderness", "Ocean"]
        is_wilderness = any(keyword.lower() in self.location.lower() for keyword in non_poi_keywords)
        
        if not is_wilderness and self.region_fk:
            try:
                # Try to find a POI with matching name and region
                self.poi = POI.objects.get(name=self.location, region=self.region_fk)
            except POI.DoesNotExist:
                # If no POI exists, create one
                self.poi = POI.objects.create(
                    name=self.location,
                    region=self.region_fk,
                    type='landmark',
                    map_pixel_x=self.map_pixel_x,
                    map_pixel_y=self.map_pixel_y
                )

        super().save(*args, **kwargs)
    
    def determine_season(self):
        """
        Determine season based on in-game date string.
        Parses date strings like: 'Loredas, 7 Sun's Dusk, 3E 406, 12:47:25'
        """
        try:
            # Simple mapping of normalized month names to seasons
            seasons = {
                "morningstar": "Winter",
                "sunsdawn": "Winter", 
                "eveningstar": "Winter",
                "firstseed": "Spring", 
                "rainshand": "Spring",
                "secondseed": "Spring", 
                "midyear": "Summer", 
                "lastseed": "Summer", 
                "sunsheight": "Summer",
                "hearthfire": "Autumn",  
                "frostfall": "Autumn",
                "sunsdusk": "Autumn",
            }
            
            # Search for each month name in the date string
            date_lower = self.date.lower()
            date_simple = ''.join(c for c in date_lower if c.isalnum())
            
            for month, season in seasons.items():
                if month in date_simple:
                    return season
                    
            return "Unknown"
        except Exception:
            return "Unknown"

class RegionMapPart(models.Model):
    """For multi-part region maps"""
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='map_parts')
    fmap_image = models.CharField(max_length=100)
    offset_x = models.IntegerField()
    offset_y = models.IntegerField()
    
    def __str__(self):
        return f"Map part for {self.region.name}"

class ProvinceShape(models.Model):
    """For storing the polygon coordinates of region shapes"""
    region = models.OneToOneField(Region, on_delete=models.CASCADE, related_name='shape')
    # Using JSON field to store the coordinate pairs, supported in PostgreSQL and SQLite ≥ 3.9
    coordinates = models.JSONField()  # Contains array of [x, y] points
    
    def __str__(self):
        return f"Shape for {self.region.name}"