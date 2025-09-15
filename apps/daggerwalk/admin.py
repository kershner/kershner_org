from apps.daggerwalk.models import DaggerwalkLog, Quest, Region, RegionMapPart, POI, ProvinceShape, ChatCommandLog, TwitchUserProfile
from apps.daggerwalk.tasks import post_to_bluesky
from django.forms.models import BaseInlineFormSet
from django.http import HttpResponseRedirect
from django.utils.html import format_html
from django.contrib import messages
from urllib.parse import urlencode
from django.contrib import admin
from django.urls import reverse
from django.urls import path


class ReadOnlyInline(admin.TabularInline):
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class ChatCommandLogInlineFormSet(BaseInlineFormSet):
    LIMIT = 25

    def get_queryset(self):
        qs = super().get_queryset().order_by('-timestamp')
        return qs[: self.LIMIT]


class ChatCommandLogInline(ReadOnlyInline):
    model = ChatCommandLog
    formset = ChatCommandLogInlineFormSet
    fields = ('timestamp', 'profile_display', 'command', 'args')
    readonly_fields = ('timestamp', 'profile_display', 'command', 'args', 'created_at')
    verbose_name = "Chat Command"
    verbose_name_plural = "Last 25 Chat Commands"

    def profile_display(self, obj):
        if obj.profile_id:
            url = reverse('admin:daggerwalk_twitchuserprofile_change', args=[obj.profile_id])
            return format_html('<a href="{}">{}</a>', url, obj.profile.twitch_username)
        return '-'
    profile_display.short_description = 'Twitch user profile'


@admin.register(DaggerwalkLog)
class DaggerwalkLogAdmin(admin.ModelAdmin):
    change_list_template = "admin/daggerwalk/daggerwalklog_changelist.html"
    inlines = [ChatCommandLogInline]
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
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("run-bluesky-post/", self.admin_site.admin_view(self.run_bluesky_post), name="run_bluesky_post"),
        ]
        return custom_urls + urls

    def run_bluesky_post(self, request):
        post_to_bluesky.delay()
        self.message_user(request, "Bluesky post triggered.", level=messages.SUCCESS)
        return HttpResponseRedirect(request.META.get("HTTP_REFERER", "/admin/"))

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

    def get_model_perms(self, request):
        return {}

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

    def get_model_perms(self, request):
        return {}

    def get_readonly_fields(self, request, obj=None):
        custom_fields = ['num_coordinates', 'view_shape_data']
        return [f.name for f in self.model._meta.fields] + custom_fields


@admin.register(ChatCommandLog)
class ChatCommandLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'profile', 'command', 'args_short', 'created_at')
    list_filter = ('profile', 'user', 'command', 'created_at')
    search_fields = (
        'user',
        'profile__twitch_username',
        'command',
        'args',
        'raw',
        'request_log__region',
        'request_log__location',
    )
    ordering = ('-timestamp',)
    autocomplete_fields = ('profile', 'request_log')

    def args_short(self, obj):
        return (obj.args[:60] + '…') if obj.args and len(obj.args) > 60 else (obj.args or '')
    args_short.short_description = 'Args'

    def has_add_permission(self, request):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

@admin.register(Quest)
class QuestAdmin(admin.ModelAdmin):
    list_display = ('quest_name', 'status', 'quest_giver_img_thumb', 'description', 'xp', 'view_on_map_link', 'created_at')
    list_filter = ('status', 'poi__region', 'created_at')
    search_fields = ('description', 'poi__name', 'poi__region__name')
    readonly_fields = ('id', 'created_at', 'view_on_map_link', 'completed_at', 'quest_name', 'quest_giver_img_thumb')
    autocomplete_fields = ('poi',)

    fieldsets = (
        ('General', {
            'fields': (
                'id',
                'quest_name',
                'status',
                'xp',
                'completed_at',
                'created_at',
            ),
        }),
        ('Content', {
            'fields': (
                'quest_giver_img_thumb',
                'description',
            ),
        }),
        ('Location', {
            'fields': (
                'poi',
                'view_on_map_link',
            ),
        }),
    )

    @admin.display(description="Preview")
    def quest_giver_img_thumb(self, obj):
        if not obj.pk:
            return "-"
        return format_html(f'<img src="{obj.quest_giver_img_url}" /><br>{obj.quest_giver_name}', )
    quest_giver_img_thumb.short_description = "Quest Giver"

    def view_on_map_link(self, obj):
        poi = obj.poi
        if poi and poi.region and poi.map_pixel_x is not None and poi.map_pixel_y is not None:
            base_url = reverse('daggerwalk')
            query_params = urlencode({
                'region': poi.region.name,
                'x': poi.map_pixel_x,
                'y': poi.map_pixel_y
            })
            url = f'{base_url}?{query_params}'
            return format_html('<a href="{}" class="button" target="_blank">Map</a>', url)
        return '-'
    view_on_map_link.short_description = 'View on map'

@admin.register(TwitchUserProfile)
class TwitchUserProfileAdmin(admin.ModelAdmin):
    list_display = ('twitch_username', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('twitch_username',)
    readonly_fields = ('id', 'twitch_username', 'created_at', 'view_all_chat_commands', 'total_xp')
    autocomplete_fields = ('completed_quests',)
    inlines = [ChatCommandLogInline]

    fieldsets = (
        ('General', {
            'fields': (
                'id',
                'twitch_username',
                'created_at',
                'view_all_chat_commands',
            ),
        }),
        ('Quests', {
            'fields': (
                'total_xp',
                'completed_quests',
            ),
        }),
    )

    def has_add_permission(self, request):
        return False

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if 'completed_quests' in form.base_fields:
            form.base_fields['completed_quests'].queryset = Quest.objects.filter(status='completed')
        return form

    def view_all_chat_commands(self, obj):
        if not obj or not obj.pk:
            return '-'
        url = f"{reverse('admin:daggerwalk_chatcommandlog_changelist')}?profile__id__exact={obj.pk}"
        return format_html('<a class="button" href="{}" target="_blank">View all chat commands</a>', url)
    view_all_chat_commands.short_description = 'Chat commands'
