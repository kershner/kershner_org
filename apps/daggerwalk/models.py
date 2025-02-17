from django.db import models


class DaggerwalkLog(models.Model):
    # World coordinates
    world_x = models.IntegerField(help_text="X coordinate in world space")
    world_z = models.IntegerField(help_text="Z coordinate in world space")

    # Map coordinates
    map_pixel_x = models.SmallIntegerField(help_text="X coordinate on the world map")
    map_pixel_y = models.SmallIntegerField(help_text="Y coordinate on the world map")

    # Location information
    region = models.CharField(max_length=255, help_text="Region name")
    location = models.CharField(max_length=255, help_text="Specific location name")
    location_type = models.CharField(max_length=255, help_text="Type of location")

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
        # Determine and set the season before saving
        self.season = self.determine_season()
        super().save(*args, **kwargs)
    
    def determine_season(self):
        """Determine season based on the in-game date string format:
        'Sundas, 1 Last Seed, 3E 406, 10:32:56'"""
        try:
            date_parts = self.date.split(',')
            month_part = date_parts[1].strip()  # "1 Last Seed"
            month = ' '.join(month_part.split()[1:])  # "Last Seed"
            
            # Matching the provided seasonal mapping exactly
            seasons = {
                "Morning Star": "Winter", 
                "Sun's Dusk": "Winter", 
                "Evening Star": "Winter",
                "First Seed": "Spring", 
                "Rain's Hand": "Spring",
                "Second Seed": "Summer", 
                "Midyear": "Summer", 
                "Sun's Height": "Summer",
                "Last Seed": "Autumn", 
                "Hearthfire": "Autumn", 
                "Frostfall": "Autumn"
            }
            
            return seasons.get(month, "Unknown")
        except (ValueError, IndexError) as e:
            print(f"Error parsing date: {self.date} - {str(e)}")
            return "Unknown"
