from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.generics import ListAPIView
from django.db import models

class BaseListAPIView(ListAPIView):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    ordering_fields = '__all__'
    ordering = ['id']

    @property
    def filterset_fields(self):
        model = self.queryset.model
        return [
            field.name
            for field in model._meta.fields
            if not isinstance(field, (models.ImageField, models.FileField))
        ]

    @property
    def search_fields(self):
        model = self.queryset.model
        return [
            field.name
            for field in model._meta.fields
            if isinstance(field, (models.CharField, models.TextField))
        ]
