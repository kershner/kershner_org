from apps.daggerwalk.models import DaggerwalkLog
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from urllib.parse import urlencode

@admin.register(DaggerwalkLog)
class DaggerwalkLogAdmin(admin.ModelAdmin):
    list_display = ('real_time_utc', 'coordinates', 'region', 'location', 'formatted_date', 'weather', 'view_on_map_link')
    list_filter = ('region', 'location', 'location_type', 'weather', 'real_time_utc',)
    search_fields = ('region', 'location', 'location_type', 'weather', 'real_time_utc',)
    
    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields] + ['view_on_map_link']
    
    def coordinates(self, obj):
        if obj.map_pixel_x is not None and obj.map_pixel_y is not None:
            return f"{obj.map_pixel_x}, {obj.map_pixel_y}"
        return '-'
    coordinates.short_description = 'Map X,Y'

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

    def real_time_utc(self, obj):
        if obj.real_time_utc:
            return obj.real_time_utc.strftime('%Y-%m-%d %I:%M:%S %p')
        return None
    real_time_utc.admin_order_field = 'real_time_utc'
    real_time_utc.short_description = 'Time (UTC)'

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
                '<a href="{}" class="button default" target="_blank" style="white-space: nowrap;">View on Map</a>',
                url
            )
        return '-'
    view_on_map_link.short_description = 'View'
    
    fieldsets = (
        ('Location', {
            'fields': (
                'region', 
                'location', 
                'location_type',
                'view_on_map_link',
            ),
        }),
        ('Coordinates', {
            'fields': (
                ('world_x', 'world_z'),
                ('map_pixel_x', 'map_pixel_y'),
                ('player_x', 'player_y', 'player_z')
            ),
        }),
        ('Time & Environment', {
            'fields': (
                'date',
                'real_time_utc',
                'weather',
                'current_song'
            ),
        })
    )