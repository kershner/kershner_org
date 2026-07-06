from django.core.exceptions import FieldDoesNotExist, ValidationError
from django.http import JsonResponse, QueryDict
from django.db import models
from django.urls import path
from django import forms
import json


class AdminAdvancedFiltersMixin:
    advanced_filters_title = "Advanced Filters"
    advanced_filters_js = ("js/adminAdvancedFilters.js",)
    advanced_filters_css = ("css/admin-advanced-filters.css",)
    
    text_field_types = (
        models.CharField,
        models.TextField,
        models.SlugField,
        models.EmailField,
        models.URLField,
    )

    comparable_field_types = (
        models.IntegerField,
        models.FloatField,
        models.DecimalField,
        models.DateField,
        models.DateTimeField,
        models.TimeField,
    )

    @property
    def media(self):
        # Include Select2/autocomplete assets because injected admin widgets need them.
        return super().media + forms.Media(
            js=(
                "admin/js/vendor/jquery/jquery.js",
                "admin/js/vendor/select2/select2.full.js",
                "admin/js/jquery.init.js",
                "admin/js/autocomplete.js",
                *self.advanced_filters_js,
            ),
            css={
                "screen": (
                    "admin/css/vendor/select2/select2.css",
                    "admin/css/autocomplete.css",
                    *self.advanced_filters_css,
                ),
            },
        )

    def get_urls(self):
        # Adds one endpoint per ModelAdmin using this mixin.
        opts = self.model._meta

        return [
            path(
                "advanced-filters/",
                self.admin_site.admin_view(self.advanced_filters_view),
                name=f"{opts.app_label}_{opts.model_name}_advanced_filters",
            ),
            *super().get_urls(),
        ]

    def advanced_filters_view(self, request):
        # GET returns field config; POST returns matching primary keys.
        if request.method == "GET":
            return JsonResponse(self.get_advanced_filters_config(request))

        if request.method == "POST":
            return self.handle_advanced_filters_submit(request)

        return JsonResponse({"error": "Unsupported method."}, status=405)

    def get_advanced_filters_config(self, request):
        # Returns field metadata and server-rendered widgets for the modal.
        form = self.get_form(request)()
        fields = []

        for field_name in self.get_advanced_filters_field_names(request):
            model_field = self.get_model_field(field_name)
            if model_field is None:
                continue

            form_field = self.get_advanced_filters_form_field(request, form, field_name, model_field)
            if form_field is None:
                continue

            bound_field = forms.BoundField(form, form_field, field_name)

            fields.append(
                {
                    "name": field_name,
                    "label": str(form_field.label or model_field.verbose_name or field_name),
                    "html": bound_field.as_widget(attrs={"id": f"id_{field_name}"}),
                    "lookups": self.get_advanced_filters_lookups(model_field),
                    "input_type": self.get_advanced_filters_input_type(model_field),
                }
            )

        return {
            "title": self.advanced_filters_title,
            "pk_field": self.model._meta.pk.name,
            "fields": fields,
        }

    def handle_advanced_filters_submit(self, request):
        # Validates posted filters, applies them, and returns matching IDs.
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON."}, status=400)

        filters = payload.get("filters", [])
        if not isinstance(filters, list):
            return JsonResponse({"error": "Invalid filters."}, status=400)

        try:
            filter_kwargs = self.build_advanced_filters_kwargs(request, self.get_form(request)(), filters)
        except ValidationError as error:
            return JsonResponse({"error": error.messages}, status=400)

        queryset = self.get_queryset(request)
        if filter_kwargs:
            queryset = queryset.filter(**filter_kwargs)

        ids = queryset.values_list(self.model._meta.pk.name, flat=True)

        return JsonResponse({
            "pk_field": self.model._meta.pk.name,
            "ids": [str(value) for value in ids],
        })

    def build_advanced_filters_kwargs(self, request, form, filters):
        # Converts validated UI filter rows into Django ORM filter kwargs.
        kwargs = {}
        allowed_fields = set(self.get_advanced_filters_field_names(request))

        for item in filters:
            field_name, lookup, values = self.validate_advanced_filters_item(item, allowed_fields)
            model_field = self.get_model_field(field_name)

            if model_field is None:
                raise ValidationError(f"Invalid model field: {field_name}")

            if lookup not in self.get_advanced_filters_lookups(model_field):
                raise ValidationError(f"Invalid lookup for {field_name}: {lookup}")

            if lookup == "isnull":
                kwargs[f"{field_name}__isnull"] = self.clean_isnull_value(values)
                continue

            form_field = self.get_advanced_filters_form_field(request, form, field_name, model_field)
            if form_field is None:
                raise ValidationError(f"Field cannot be filtered: {field_name}")

            kwargs[f"{field_name}__{lookup}"] = self.clean_filter_value(
                form_field,
                lookup,
                values,
                field_name,
            )

        return kwargs

    def validate_advanced_filters_item(self, item, allowed_fields):
        # Validates the basic shape of a posted filter row.
        if not isinstance(item, dict):
            raise ValidationError("Invalid filter item.")

        field_name = item.get("field")
        lookup = item.get("lookup")
        values = item.get("values", {})

        if field_name not in allowed_fields:
            raise ValidationError(f"Invalid field: {field_name}")

        return field_name, lookup, values

    def get_advanced_filters_field_names(self, request):
        # Uses ModelAdmin field order, flattening row/group tuples.
        return list(self.flatten_fields(self.get_fields(request)))

    def flatten_fields(self, fields):
        # Converts nested field tuples/lists into a flat field-name sequence.
        for field in fields:
            if isinstance(field, (list, tuple)):
                yield from field
            else:
                yield field

    def get_model_field(self, field_name):
        # Safely resolves a concrete model field by name.
        try:
            return self.model._meta.get_field(field_name)
        except FieldDoesNotExist:
            return None

    def get_advanced_filters_form_field(self, request, form, field_name, model_field):
        # Prefer the ModelAdmin form field; fall back to normal admin widget creation.
        return form.fields.get(field_name) or self.formfield_for_dbfield(model_field, request=request)

    def clean_filter_value(self, form_field, lookup, values, field_name):
        # Lets Django form fields clean values before ORM filtering.
        querydict = self.values_to_querydict(values)
        raw_value = form_field.widget.value_from_datadict(querydict, {}, field_name)

        if lookup == "in":
            return self.clean_in_value(form_field, raw_value)

        return form_field.clean(raw_value)

    def values_to_querydict(self, values):
        # Rebuilds posted JS values into the shape Django widgets expect.
        querydict = QueryDict("", mutable=True)

        if not isinstance(values, dict):
            return querydict

        for key, value in values.items():
            if isinstance(value, list):
                querydict.setlist(key, [str(item) for item in value])
            else:
                querydict[key] = str(value)

        return querydict

    def clean_in_value(self, form_field, raw_value):
        # Supports comma-separated "in" values and multi-select fields.
        if isinstance(form_field, forms.ModelMultipleChoiceField):
            return list(form_field.clean(raw_value))

        raw_values = raw_value if isinstance(raw_value, (list, tuple)) else str(raw_value).split(",")

        return [
            form_field.clean(value.strip())
            for value in raw_values
            if str(value).strip()
        ]

    def clean_isnull_value(self, values):
        # Converts checkbox/select-ish posted values into a boolean.
        if isinstance(values, dict):
            value = values.get("value", values.get("isnull", "true"))
        else:
            value = values

        if isinstance(value, list):
            value = value[0] if value else "true"

        return str(value).lower() in {"1", "true", "yes", "on"}

    def get_advanced_filters_input_type(self, model_field):
        # Hints JS to convert date/time widgets to native browser inputs.
        if isinstance(model_field, models.DateTimeField):
            return "datetime-local"

        if isinstance(model_field, models.DateField):
            return "date"

        if isinstance(model_field, models.TimeField):
            return "time"

        return ""

    def get_advanced_filters_lookups(self, model_field):
        # Returns conservative lookup choices by field type.
        if isinstance(model_field, models.BooleanField):
            return ["exact", *self.null_lookup(model_field)]

        lookups = ["exact", "in", *self.null_lookup(model_field)]

        if isinstance(model_field, self.text_field_types):
            lookups.extend((
                "iexact",
                "contains",
                "icontains",
                "startswith",
                "istartswith",
                "endswith",
                "iendswith",
            ))

        if isinstance(model_field, self.comparable_field_types):
            lookups.extend(("gt", "gte", "lt", "lte"))

        return lookups

    def null_lookup(self, model_field):
        # Adds isnull only when the model field supports NULL.
        return ["isnull"] if model_field.null else []