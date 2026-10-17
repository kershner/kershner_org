from django.contrib import admin
from kershner.mixins.admin_advanced_filter import AdminAdvancedFilterMixin

from .models import Planet, PlanetVisit


@admin.register(Planet)
class PlanetAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ['name', 'galaxy_name', 'galaxy_index', 'planet_hex', 'biome', 'has_rings']
    search_fields = ['name', 'planet_hex', 'galaxy_name']
    list_filter = ['galaxy_index', 'biome', 'has_rings']
    ordering = ['name']
    readonly_fields = [field.name for field in Planet._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PlanetVisit)
class PlanetVisitAdmin(AdminAdvancedFilterMixin, admin.ModelAdmin):
    list_display = ['planet', 'timestamp']
    search_fields = ['planet__name', 'planet__planet_hex', 'planet__galaxy_name']
    list_filter = ['timestamp']
    ordering = ['-timestamp']
    date_hierarchy = 'timestamp'
    list_select_related = ['planet']
    readonly_fields = [field.name for field in PlanetVisit._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
