from .quest_gen import build_ctx_from_quest, seed_for_quest, unique_description, generate_giver_name
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from django.conf import settings
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
    discovered = models.DateTimeField(blank=True, null=True, help_text="Timestamp when this POI was discovered")
    
    class Meta:
        unique_together = ('region', 'name')
    
    def __str__(self):
        return f"{self.emoji}{self.name} ({self.type} of {self.region.name})"
    
    def save(self, *args, **kwargs):
        if not self.emoji:
            self.emoji = self.get_emoji()
        
        if not self.discovered:
            from apps.daggerwalk.models import DaggerwalkLog  # avoid circular import
            earliest_log = (
                DaggerwalkLog.objects
                .filter(poi=self)
                .order_by("created_at")
                .values_list("created_at", flat=True)
                .first()
            )
            if earliest_log:
                self.discovered = earliest_log

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

        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['region']),
            models.Index(fields=['region', 'created_at']),
            models.Index(fields=['poi']),
            models.Index(fields=['current_song']),
            models.Index(fields=['weather']),
        ]

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
        
    @staticmethod
    def get_weather_emoji(weather):
        weather_emoji = {
            "Sunny": "☀️",
            "Clear": "🌙",
            "Cloudy": "☁️",
            "Foggy": "🌫️",
            "Rainy": "🌧️",
            "Snowy": "🌨️",
            "Thunderstorm": "⛈️",
            "Blizzard": "❄️"
        }
        return weather_emoji.get(weather, "")

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
    

class ChatCommandLog(models.Model):
    request_log = models.ForeignKey(
        'daggerwalk.DaggerwalkLog',
        on_delete=models.CASCADE,
        related_name='chat_commands'
    )

    # Link to TwitchUserProfile (optional, filled when user matches)
    profile = models.ForeignKey(
        'daggerwalk.TwitchUserProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_command_logs'
    )

    # Parsed fields
    timestamp = models.DateTimeField()
    user = models.CharField(max_length=50, db_index=True)  # raw username
    command = models.CharField(max_length=32, db_index=True)
    args = models.TextField(blank=True, default="")  # keep raw args string
    raw = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['command', 'timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"!{self.command} {self.args}"

    def save(self, *args, **kwargs):
        # Try to link to TwitchUserProfile automatically if not set
        if not self.profile:
            try:
                self.profile = TwitchUserProfile.objects.get(twitch_username__iexact=self.user)
            except TwitchUserProfile.DoesNotExist:
                self.profile = None
        super().save(*args, **kwargs)


def rand_quest_giver_img_number():
    return random.randint(1, 502)    


class Quest(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('disabled', 'Disabled'),
    ]

    description = models.TextField(blank=True, default="")
    quest_giver_name = models.CharField(max_length=100, blank=True, default="")
    quest_giver_img_number = models.PositiveSmallIntegerField(
        default=rand_quest_giver_img_number,
        validators=[MinValueValidator(1), MaxValueValidator(502)],
        help_text="1–502"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available', db_index=True)
    xp = models.PositiveIntegerField(default=0)
    poi = models.ForeignKey('POI', on_delete=models.SET_NULL, null=True, blank=True, related_name='quests')

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    @property
    def quest_name(self):
        return f"Travel to {self.poi.emoji}{self.poi.name} in {self.poi.region.name}" if self.poi else "-"

    @property
    def quest_giver_img_url(self):
        return f"{settings.BASE_CLOUDFRONT_URL}daggerwalk/quests/quest_giver_images/{self.quest_giver_img_number}.png"

    def __str__(self):
        return self.quest_name

    def _get_old_status(self):
        if not self.pk:
            return None
        return (
            Quest.objects.filter(pk=self.pk)
            .values_list("status", flat=True)
            .first()
        )

    def _maybe_init_xp(self, is_create: bool):
        if is_create and self.xp == 0:
            # multiples of 5 between 0 and 50 inclusive
            self.xp = random.randrange(5, 55, 5)

    def _pick_random_from_qs(self, qs):
        """
        Faster than order_by('?') for medium/large tables:
        sample a random offset based on count, then pick one row.
        """
        count = qs.count()
        if count == 0:
            return None
        return qs.all()[random.randrange(count)]

    def _choose_poi_if_needed(self, is_create: bool):
        if not (is_create and self.poi is None):
            return

        with transaction.atomic():
            # Last quest's region (if any)
            last_q = (
                Quest.objects.exclude(poi__isnull=True)
                .select_related('poi__region')
                .order_by('-created_at')
                .only('poi__region')  # light fetch
                .first()
            )
            last_region_id = last_q.poi.region_id if last_q and last_q.poi_id else None

            # Unused first
            used_ids = (
                Quest.objects.exclude(poi__isnull=True)
                .values_list('poi_id', flat=True)
                .distinct()
            )
            unused_qs = POI.objects.exclude(id__in=list(used_ids))

            selected = None

            def pick_with_region_preference(qs, exclude_region_id):
                if exclude_region_id:
                    preferred = qs.exclude(region_id=exclude_region_id)
                    return self._pick_random_from_qs(preferred) or self._pick_random_from_qs(qs)
                return self._pick_random_from_qs(qs)

            if unused_qs.exists():
                selected = pick_with_region_preference(unused_qs, last_region_id)
            else:
                all_qs = POI.objects.all()
                selected = pick_with_region_preference(all_qs, last_region_id)

            if selected:
                self.poi = selected

    def _maybe_init_giver_name(self, is_create: bool):
        if is_create and not self.quest_giver_name:
            self.quest_giver_name = generate_giver_name(seed_for_quest(self))

    def _maybe_init_description(self, is_create: bool):
        if is_create and not self.description and self.poi:
            ctx = build_ctx_from_quest(self)
            recent = (
                Quest.objects.order_by('-created_at')
                .values_list('description', flat=True)[:75]
            )
            self.description = unique_description(ctx, seed_for_quest(self), recent)

    def _sync_completed_at(self, old_status):
        if self.status == "completed" and not self.completed_at:
            self.completed_at = timezone.now()
        elif old_status == "completed" and self.status != "completed":
            # If reverting from completed, clear timestamp
            self.completed_at = None

    def save(self, *args, **kwargs):
        is_create = self.pk is None
        old_status = None if is_create else self._get_old_status()

        self._maybe_init_xp(is_create)
        self._choose_poi_if_needed(is_create)
        self._maybe_init_giver_name(is_create)
        self._maybe_init_description(is_create)
        self._sync_completed_at(old_status)

        super().save(*args, **kwargs)


class TwitchUserProfile(models.Model):
    twitch_username = models.CharField(max_length=50, unique=True, db_index=True)
    completed_quests = models.ManyToManyField(Quest, related_name='completed_by', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.twitch_username

    @property
    def chat_commands(self):
        return ChatCommandLog.objects.filter(user__iexact=self.twitch_username)
    
    @property
    def total_xp(self):
        result = self.completed_quests.aggregate(total=Sum('xp'))
        return result['total'] or 0
