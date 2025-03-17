from apps.daggerwalk.models import DaggerwalkLog, Region, RegionMapPart, POI, ProvinceShape
from django.utils.html import format_html
from urllib.parse import urlencode
from django.contrib import admin
from django.urls import reverse

@admin.register(DaggerwalkLog)
class DaggerwalkLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'view_on_map_link', 'coordinates', 'region', 'location', 'formatted_date', 'weather',)
    list_filter = ('region', 'location', 'weather', 'season', 'created_at',)
    search_fields = ('region', 'location', 'weather', 'season', 'created_at',)
    
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
                'region_fk',
                'location',
                'poi',
                'last_known_region',
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
    
class ReadOnlyInline(admin.TabularInline):
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class RegionMapPartInline(ReadOnlyInline):
    model = RegionMapPart


class POIInline(ReadOnlyInline):
    model = POI

    def has_add_permission(self, request, obj=None):
        return True


class ProvinceShapeInline(ReadOnlyInline):
    model = ProvinceShape


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ('name', 'province', 'climate')
    list_filter = ('province', 'climate', 'multi_part')
    search_fields = ('name',)

    def has_add_permission(self, request):
        return False

    def get_readonly_fields(self, request, obj=None):
        exclude_fields = ['climate']
        all_fields = [f.name for f in self.model._meta.fields]
        readonly_fields = [field for field in all_fields if field not in exclude_fields]
        return readonly_fields
    
    def get_inline_instances(self, request, obj=None):
        """Only include RegionMapPartInline if the region is multi-part."""
        inlines = [POIInline]
        if obj and obj.multi_part:
            inlines.append(RegionMapPartInline)
        return [inline(self.model, self.admin_site) for inline in inlines]


@admin.register(RegionMapPart)
class RegionMapPartAdmin(admin.ModelAdmin):
    list_display = ('region', 'fmap_image', 'offset_x', 'offset_y')
    search_fields = ('region__name', 'fmap_image')
    list_filter = ('region',)

    def has_add_permission(self, request):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]


@admin.register(POI)
class POIAdmin(admin.ModelAdmin):
    list_display = ('name', 'region', 'type', 'map_coordinates', 'view_on_map_link')
    list_filter = ('region', 'type')
    search_fields = ('name', 'region__name', 'type')

    def map_coordinates(self, obj):
        return f"X: {obj.map_pixel_x}, Y: {obj.map_pixel_y}"
    map_coordinates.short_description = "Map Coordinates"

    def view_on_map_link(self, obj):
        if obj.region and obj.map_pixel_x is not None and obj.map_pixel_y is not None:
            base_url = reverse('daggerwalk')
            query_params = urlencode({
                'region': obj.region.name,
                'x': obj.map_pixel_x,
                'y': obj.map_pixel_y
            })
            url = f'{base_url}?{query_params}'
            return format_html('<a href="{}" class="button" target="_blank">Map</a>', url)
        return '-'
    view_on_map_link.short_description = 'View on Map'

    def get_readonly_fields(self, request, obj=None):
        custom_fields = ['map_coordinates', 'view_on_map_link']
        return [f.name for f in self.model._meta.fields] + custom_fields


@admin.register(ProvinceShape)
class ProvinceShapeAdmin(admin.ModelAdmin):
    list_display = ('region', 'num_coordinates', 'view_shape_data')
    search_fields = ('region__name',)

    def num_coordinates(self, obj):
        return len(obj.coordinates) if obj.coordinates else 0
    num_coordinates.short_description = "Number of Coordinates"

    def view_shape_data(self, obj):
        return format_html('<pre style="max-width: 400px; white-space: pre-wrap;">{}</pre>', obj.coordinates)
    view_shape_data.short_description = "Shape Data"

    def has_add_permission(self, request):
        return False

    def get_readonly_fields(self, request, obj=None):
        custom_fields = ['num_coordinates', 'view_shape_data']
        return [f.name for f in self.model._meta.fields] + custom_fields