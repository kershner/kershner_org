from django.contrib import admin

from apps.roll20_stats.models import GameSession, Roll20Message, SessionCharacterStats


class ReadOnlyInlineMixin:
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class SessionCharacterStatsInline(ReadOnlyInlineMixin, admin.TabularInline):
    model = SessionCharacterStats
    fields = (
        'character',
        'entries',
        'rolls',
        'd20_rolls',
        'avg_d20',
        'nat20s',
        'nat1s',
        'attacks',
        'checks',
        'saves',
        'damage_rolls',
        'damage_total',
    )
    readonly_fields = fields
    ordering = ('character',)
    show_change_link = True


class Roll20MessageInline(ReadOnlyInlineMixin, admin.TabularInline):
    model = Roll20Message
    fk_name = 'session'
    fields = (
        'timestamp',
        'character',
        'type',
        'title',
        'subtitle',
        'dice',
        'roll',
        'total',
    )
    readonly_fields = fields
    ordering = ('timestamp', 'id')
    show_change_link = True


class StatsRoll20MessageInline(Roll20MessageInline):
    fk_name = 'session_character_stats'


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ('date', 'message_count', 'character_count', 'damage_total', 'nat20s', 'nat1s')
    search_fields = ('character_stats__character', 'messages__character', 'messages__title')
    ordering = ('-date',)
    inlines = (SessionCharacterStatsInline, Roll20MessageInline)
    readonly_fields = ('date',)

    def message_count(self, obj):
        return obj.messages.count()

    def character_count(self, obj):
        return obj.character_stats.count()

    def damage_total(self, obj):
        return sum(stat.damage_total for stat in obj.character_stats.all())

    def nat20s(self, obj):
        return sum(stat.nat20s for stat in obj.character_stats.all())

    def nat1s(self, obj):
        return sum(stat.nat1s for stat in obj.character_stats.all())


@admin.register(Roll20Message)
class Roll20MessageAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'session', 'character', 'type', 'title', 'dice', 'roll', 'total')
    list_filter = ('session', 'type', 'character')
    search_fields = ('sender', 'character', 'title', 'subtitle', 'dice')
    readonly_fields = ('import_hash',)
    ordering = ('-timestamp',)


@admin.register(SessionCharacterStats)
class SessionCharacterStatsAdmin(admin.ModelAdmin):
    fields = (
        'session',
        'character',
        'entries',
        'text_messages',
        'cards',
        'rolls',
        'd20_rolls',
        'd20_total',
        'avg_d20',
        'nat20s',
        'nat1s',
        'attacks',
        'checks',
        'saves',
        'damage_rolls',
        'damage_total',
    )
    readonly_fields = fields
    list_display = (
        'session',
        'character',
        'entries',
        'rolls',
        'd20_rolls',
        'avg_d20',
        'nat20s',
        'nat1s',
        'attacks',
        'checks',
        'saves',
        'damage_rolls',
        'damage_total',
    )
    list_filter = ('session', 'character')
    search_fields = ('character',)
    ordering = ('-session__date', 'character')
    inlines = (StatsRoll20MessageInline,)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
