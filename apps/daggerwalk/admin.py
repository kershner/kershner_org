from apps.daggerwalk.models import DaggerwalkLog, Quest, Region, RegionMapPart, POI, ProvinceShape, ChatCommandLog, TwitchUserProfile, Monument, ProgressionEvent
from kershner.mixins.admin_advanced_filter import AdminAdvancedFilterMixin
from apps.daggerwalk.tasks import post_to_bluesky, update_all_daggerwalk_caches
from apps.daggerwalk.progression import GUILDS, MONUMENT_TYPES, monument_token_balance
from apps.daggerwalk.cache_keys import PROGRESSION_CACHE_KEYS
from django.forms.models import BaseInlineFormSet
from django.http import HttpResponseRedirect
from django.utils.html import format_html
from django.contrib import messages
from django import forms
from urllib.parse import urlencode
from django.contrib import admin
from django.core.cache import cache
from django.db import transaction
from django.urls import reverse
from django.urls import path


MONUMENT_TYPE_CHOICES = [(key, details[0]) for key, details in MONUMENT_TYPES.items()]
GUILD_CHOICES = [("", "Unaffiliated"), *[(key, guild["name"]) for key, guild in GUILDS.items()]]


def refresh_progression_caches(model_admin, request, extra_keys=()):
    try:
        cache.delete_many((*PROGRESSION_CACHE_KEYS, *extra_keys))
        update_all_daggerwalk_caches.delay()
    except Exception:
        model_admin.message_user(
            request,
            "The change was saved, but caches could not be refreshed. The next Daggerwalk update will retry.",
            level=messages.WARNING,
        )


@transaction.atomic
def undo_guild_change(profile):
    event = profile.progression_events.filter(event_type="guild_change").order_by("-created_at").first()
    if not event:
        return False

    old_guild = (event.payload or {}).get("old_guild", "")
    new_guild = (event.payload or {}).get("new_guild", "")
    quest_events = list(profile.progression_events.filter(
        event_type="quest", created_at__gte=event.created_at, payload__guild=new_guild,
    ))
    for quest_event in quest_events:
        quest_event.payload = {**quest_event.payload, "guild": old_guild}
    ProgressionEvent.objects.bulk_update(quest_events, ["payload"])
    profile.progression_events.filter(
        event_type="guild_rank", created_at__gte=event.created_at, payload__guild=new_guild,
    ).delete()
    profile.current_guild = old_guild
    profile.save(update_fields=["current_guild"])
    event.delete()
    return True


class MonumentTypeFilter(admin.SimpleListFilter):
    title = "monument type"
    parameter_name = "monument_type"

    def lookups(self, request, model_admin):
        return MONUMENT_TYPE_CHOICES

    def queryset(self, request, queryset):
        return queryset.filter(monument_type=self.value()) if self.value() else queryset


class MonumentGuildFilter(admin.SimpleListFilter):
    title = "guild at placement"
    parameter_name = "guild_at_placement"

    def lookups(self, request, model_admin):
        return [("unaffiliated", "Unaffiliated"), *GUILD_CHOICES[1:]]

    def queryset(self, request, queryset):
        if self.value() == "unaffiliated":
            return queryset.filter(guild_at_placement="")
        return queryset.filter(guild_at_placement=self.value()) if self.value() else queryset


class MonumentAdminForm(forms.ModelForm):
    monument_type = forms.ChoiceField(choices=MONUMENT_TYPE_CHOICES)
    guild_at_placement = forms.ChoiceField(required=False, choices=GUILD_CHOICES)

    class Meta:
        model = Monument
        fields = "__all__"


@admin.register(Monument)
class MonumentAdmin(admin.ModelAdmin):
    form = MonumentAdminForm
    list_display = ("poi", "owner", "monument_type_name", "guild_name", "created_at")
    list_filter = (MonumentTypeFilter, MonumentGuildFilter, "created_at")
    search_fields = ("poi__name", "owner__twitch_username", "poi__description")
    list_select_related = ("poi", "owner")
    autocomplete_fields = ("poi", "owner")
    readonly_fields = (
        "poi", "owner", "monument_type_name", "world_x", "world_z", "game_date",
        "guild_name", "renown_title_at_placement", "guild_title_at_placement",
        "created_at", "view_on_map_link",
    )
    fieldsets = (
        ("Monument", {"fields": ("poi", "owner", "monument_type_name", "view_on_map_link", "created_at")}),
        ("Placement", {"fields": ("world_x", "world_z", "game_date")}),
        ("Standing at placement", {"fields": ("renown_title_at_placement", "guild_name", "guild_title_at_placement")}),
    )
    add_fieldsets = (
        ("Monument", {"fields": ("poi", "owner", "monument_type")}),
        ("Placement", {"fields": ("world_x", "world_z", "game_date")}),
        ("Standing at placement", {"fields": ("renown_title_at_placement", "guild_at_placement", "guild_title_at_placement")}),
    )

    def get_fieldsets(self, request, obj=None):
        return self.fieldsets if obj else self.add_fieldsets

    def get_readonly_fields(self, request, obj=None):
        return self.readonly_fields if obj else ()

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not change:
            ProgressionEvent.objects.get_or_create(
                profile=obj.owner, event_type="monument", monument=obj,
                defaults={"payload": {"name": obj.poi.name, "type": obj.monument_type, "admin": True}},
            )
        refresh_progression_caches(self, request, ("daggerwalk_map_monuments", "daggerwalk_map_pois"))

    def delete_model(self, request, obj):
        self.delete_queryset(request, Monument.objects.filter(pk=obj.pk))

    @transaction.atomic
    def delete_queryset(self, request, queryset):
        monuments = list(queryset.values_list("id", "poi_id"))
        if not monuments:
            return
        monument_ids, poi_ids = zip(*monuments)
        ProgressionEvent.objects.filter(monument_id__in=monument_ids).delete()
        POI.objects.filter(id__in=poi_ids).delete()
        refresh_progression_caches(self, request, ("daggerwalk_map_monuments", "daggerwalk_map_pois"))

    @admin.display(description="Monument type", ordering="monument_type")
    def monument_type_name(self, obj):
        return MONUMENT_TYPES.get(obj.monument_type, (obj.monument_type.replace("-", " ").title(),))[0]

    @admin.display(description="Guild", ordering="guild_at_placement")
    def guild_name(self, obj):
        return GUILDS.get(obj.guild_at_placement, {}).get("name", "Unaffiliated")

    @admin.display(description="Map")
    def view_on_map_link(self, obj):
        if not obj or not obj.pk:
            return "-"
        return format_html('<a class="button" href="{}?monument={}" target="_blank">Open</a>', reverse("daggerwalk"), obj.pk)


EVENT_LABELS = {
    "guild_change": "Guild allegiance",
    "quest": "Quest completed",
    "renown": "Renown earned",
    "guild_rank": "Guild promotion",
    "monument": "Monument raised",
    "monument_visit": "Monument visited",
}


class ProgressionEventTypeFilter(admin.SimpleListFilter):
    title = "event"
    parameter_name = "event_type"

    def lookups(self, request, model_admin):
        return EVENT_LABELS.items()

    def queryset(self, request, queryset):
        return queryset.filter(event_type=self.value()) if self.value() else queryset


@admin.register(ProgressionEvent)
class ProgressionEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "profile_link", "event_name", "event_summary", "related_record")
    list_filter = (ProgressionEventTypeFilter, "created_at")
    search_fields = (
        "profile__twitch_username", "quest__description", "quest__poi__name",
        "monument__poi__name",
    )
    list_select_related = ("profile", "quest", "quest__poi", "monument", "monument__poi")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = (
        "created_at", "profile_link", "event_name", "event_summary",
        "quest_link", "monument_link", "event_type", "payload",
    )
    fieldsets = (
        ("Event", {"fields": ("created_at", "profile_link", "event_name", "event_summary")}),
        ("Related records", {"fields": ("quest_link", "monument_link")}),
        ("Technical details", {"fields": ("event_type", "payload"), "classes": ("collapse",)}),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="Walker", ordering="profile__twitch_username")
    def profile_link(self, obj):
        return self._admin_link(obj.profile, obj.profile.twitch_username)

    @admin.display(description="Event", ordering="event_type")
    def event_name(self, obj):
        return EVENT_LABELS.get(obj.event_type, obj.event_type.replace("_", " ").title())

    @admin.display(description="What happened")
    def event_summary(self, obj):
        payload = obj.payload or {}
        if obj.event_type == "quest" and obj.quest:
            return f"Earned {obj.quest.xp} XP for completing {obj.quest.quest_name}"
        if obj.event_type == "renown":
            return f"Reached {payload.get('title', 'a new Renown rank')}"
        if obj.event_type == "guild_rank":
            return f"Promoted to {payload.get('title', 'a new rank')} in {self._guild_name(payload.get('guild'))}"
        if obj.event_type == "guild_change":
            old_guild, new_guild = payload.get("old_guild"), payload.get("new_guild")
            if new_guild:
                return f"Joined {self._guild_name(new_guild)}" if not old_guild else f"Changed allegiance from {self._guild_name(old_guild)} to {self._guild_name(new_guild)}"
            return f"Left {self._guild_name(old_guild)}" if old_guild else "Became unaffiliated"
        if obj.event_type == "monument" and obj.monument:
            return f"Raised {obj.monument.poi.name}"
        if obj.event_type == "monument_visit" and obj.monument:
            return f"{obj.monument.poi.name} was visited during a quest"
        return "Progression history recorded"

    @admin.display(description="Related record")
    def related_record(self, obj):
        return self.quest_link(obj) if obj.quest_id else self.monument_link(obj)

    @admin.display(description="Quest")
    def quest_link(self, obj):
        return self._admin_link(obj.quest, obj.quest.quest_name) if obj.quest_id else "—"

    @admin.display(description="Monument")
    def monument_link(self, obj):
        return self._admin_link(obj.monument, obj.monument.poi.name) if obj.monument_id else "—"

    @staticmethod
    def _guild_name(key):
        return GUILDS.get(key, {}).get("name", str(key or "Unknown guild").replace("-", " ").title())

    @staticmethod
    def _admin_link(obj, label):
        url = reverse(f"admin:{obj._meta.app_label}_{obj._meta.model_name}_change", args=[obj.pk])
        return format_html('<a href="{}">{}</a>', url, label)



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
class DaggerwalkLogAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    change_list_template = "admin/daggerwalk/daggerwalklog_changelist.html"
    inlines = [ChatCommandLogInline]
    list_display = ('created_at', 'view_on_map_link', 'coordinates', 'region', 'location', 'formatted_date', 'weather',)
    list_filter = ('region', 'location', 'weather', 'season', 'created_at',)
    search_fields = ('region', 'location', 'weather', 'season', 'created_at',)
    
    def get_readonly_fields(self, request, obj=None):
        custom_fields = ['view_on_map_link', 'world_coordinates', 'map_pixel_coordinates', 'player_coordinates']
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
class RegionAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
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
class RegionMapPartAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ('region', 'fmap_image', 'offset_x', 'offset_y')
    search_fields = ('region__name', 'fmap_image')
    list_filter = ('region',)

    def get_model_perms(self, request):
        return {}

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]


@admin.register(POI)
class POIAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ('name', 'region', 'type', 'discovered', 'map_coordinates', 'view_on_map_link')
    list_filter = ('region', 'type', 'discovered')
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
class ProvinceShapeAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
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
class ChatCommandLogAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
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
class QuestAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ('quest_name', 'slot', 'status', 'quest_giver_img_thumb', 'description', 'xp', 'view_on_map_link', 'created_at')
    list_filter = ('status', 'poi__region', 'created_at')
    search_fields = ('description', 'poi__name', 'poi__region__name')
    readonly_fields = ('id', 'created_at', 'view_on_map_link', 'completed_at', 'quest_name', 'quest_giver_img_thumb')
    autocomplete_fields = ('poi',)

    fieldsets = (
        ('General', {
            'fields': (
                'id',
                'quest_name',
                'slot',
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
class TwitchUserProfileAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ('twitch_username', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('twitch_username',)
    readonly_fields = ('id', 'twitch_username', 'created_at', 'view_all_chat_commands', 'total_xp', 'monument_token_summary')
    autocomplete_fields = ('completed_quests',)
    actions = ('undo_latest_guild_change',)
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
            'classes': ('collapse',),
        }),
        ('Monument Tokens', {
            'fields': (
                'monument_token_summary',
                'monument_token_adjustment',
            ),
            'description': 'Use a positive adjustment to grant tokens or a negative adjustment to remove them. Existing monuments are never removed.',
        }),
    )

    def has_add_permission(self, request):
        return False

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if 'completed_quests' in form.base_fields:
            form.base_fields['completed_quests'].queryset = Quest.objects.filter(status='completed')
        return form

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if 'monument_token_adjustment' in form.changed_data:
            refresh_progression_caches(self, request)

    @admin.action(description='Undo latest guild change')
    def undo_latest_guild_change(self, request, queryset):
        undone = sum(undo_guild_change(profile) for profile in queryset)
        if undone:
            refresh_progression_caches(self, request)
        self.message_user(request, f'Undid the latest guild change for {undone} walker(s).')

    @admin.display(description='Current balance')
    def monument_token_summary(self, obj):
        if not obj or not obj.pk:
            return '-'
        earned, adjustment, used, available = monument_token_balance(obj)
        return f'{available} available ({earned} XP-earned {adjustment:+d} admin adjustment − {used} used)'

    def view_all_chat_commands(self, obj):
        if not obj or not obj.pk:
            return '-'
        url = f"{reverse('admin:daggerwalk_chatcommandlog_changelist')}?profile__id__exact={obj.pk}"
        return format_html('<a class="button" href="{}" target="_blank">View all chat commands</a>', url)
    view_all_chat_commands.short_description = 'Chat commands'
