from . import views as portfolio_views
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path('', portfolio_views.home),
    path('admin/', admin.site.urls),
]
