from apps.daggerwalk.models import DaggerwalkLog
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from urllib.parse import urlencode

@admin.register(DaggerwalkLog)
class DaggerwalkLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'view_on_map_link', 'coordinates', 'region', 'location', 'formatted_date', 'weather', 'reset')
    list_filter = ('region', 'location', 'location_type', 'weather', 'created_at', 'reset',)
    search_fields = ('region', 'location', 'location_type', 'weather', 'created_at',)
    
    def get_readonly_fields(self, request, obj=None):
        custom_fields = ['view_on_map_link', 'delete_previous_button']
        return [f.name for f in self.model._meta.fields] + custom_fields
    
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
              'reset',
              'view_on_map_link',
              'delete_previous_button'
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
                ('world_x', 'world_z'),
                ('map_pixel_x', 'map_pixel_y'),
                ('player_x', 'player_y', 'player_z')
            ),
        }),
        ('Time & Environment', {
            'fields': (
                'date',
                'weather',
                'current_song'
            ),
        })
    )

    def has_add_permission(self, request):
        return False
