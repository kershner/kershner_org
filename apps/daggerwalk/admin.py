from apps.daggerwalk.models import DaggerwalkLog
from django.utils.html import format_html
from urllib.parse import urlencode
from django.contrib import admin
from django.urls import reverse

@admin.register(DaggerwalkLog)
class DaggerwalkLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'view_on_map_link', 'coordinates', 'region', 'location', 'formatted_date', 'weather',)
    list_filter = ('region', 'location', 'location_type', 'weather', 'season', 'created_at',)
    search_fields = ('region', 'location', 'location_type', 'weather', 'season', 'created_at',)
    
    def get_readonly_fields(self, request, obj=None):
        custom_fields = ['view_on_map_link', 'delete_previous_button', 'world_coordinates', 'map_pixel_coordinates', 'player_coordinates']
        return [f.name for f in self.model._meta.fields] + custom_fields
    
    def coordinates(self, obj):
        if obj.map_pixel_x is not None and obj.map_pixel_y is not None:
            return f"{obj.map_pixel_x}, {obj.map_pixel_y}"
        return '-'
    coordinates.short_description = 'Map X,Y'

    def world_coordinates(self, obj):
        if obj.world_x is not None and obj.world_z is not None:
            return f"X: {obj.world_x}, Y: {obj.world_z}"
        return '-'
    world_coordinates.short_description = 'World'

    def map_pixel_coordinates(self, obj):
        if obj.map_pixel_x is not None and obj.map_pixel_y is not None:
            return f"X: {obj.map_pixel_x}, Y: {obj.map_pixel_y}"
        return '-'
    map_pixel_coordinates.short_description = 'Map Pixel'

    def player_coordinates(self, obj):
        if obj.player_x is not None and obj.player_y is not None:
            return f"X: {obj.player_x}, Y: {obj.player_y}, Z: {obj.player_z}"
        return '-'
    player_coordinates.short_description = 'Player'

    def formatted_date(self, obj):
        if obj.date:
            parts = obj.date.split(', ')
            if len(parts) >= 3:
                day_month = parts[1]
                time = parts[-1]
                try:
                    hour, minute, second = map(int, time.split(':'))
                    period = 'PM' if hour >= 12 else 'AM'
                    hour = hour % 12
                    if hour == 0:
                        hour = 12
                    time_str = f"{hour}:{minute:02d}{period}"
                    return f"{day_month}, {time_str}"
                except ValueError:
                    return obj.date
        return obj.date
    formatted_date.admin_order_field = 'date'
    formatted_date.short_description = 'Game Date'

    def view_on_map_link(self, obj):
        if obj.region and obj.map_pixel_x is not None and obj.map_pixel_y is not None:
            base_url = reverse('daggerwalk')
            query_params = urlencode({
                'region': obj.region,
                'x': obj.map_pixel_x,
                'y': obj.map_pixel_y
            })
            url = f'{base_url}?{query_params}'
            return format_html(
                '<a href="{}" class="button" target="_blank">Map</a>',
                url
            )
        return '-'
    view_on_map_link.short_description = 'View'

    def delete_previous_button(self, obj):
        url = reverse('delete_previous_logs', args=[obj.id])
        js = f"""
            if(confirm('Delete all logs before this one?')) {{
                fetch('{url}', {{
                    method: 'POST',
                    headers: {{'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value}}
                }}).then(() => location.reload());
            }}
        """
        return format_html(
            '<a class="button" onclick="{}" href="#">Delete Previous</a>',
            js
        )
    delete_previous_button.short_description = 'Delete previous logs'
    
    fieldsets = (
        ('General', {
            'fields': (
              'id',
              'created_at',
              'view_on_map_link',
            ),
        }),
        ('Location', {
            'fields': (
                'region', 
                'location', 
                'location_type',
            ),
        }),
        ('Coordinates', {
            'fields': (
                'world_coordinates',
                'map_pixel_coordinates',
                'player_coordinates'
            ),
        }),
        ('Time & Environment', {
            'fields': (
                'date',
                'weather',
                'current_song',
                'season'
            ),
        }),
        ('Delete', {
            'classes': ('collapse',),
            'fields': ('delete_previous_button',),
        })
    )

    def has_add_permission(self, request):
        return False