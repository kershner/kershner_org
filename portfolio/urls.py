from . import views as portfolio_views
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path('', portfolio_views.home, name='home'),
    path('music/', portfolio_views.music, name='music'),
    path('admin/', admin.site.urls),
]
