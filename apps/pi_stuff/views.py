from django.views.generic import TemplateView
from .serializers import CategorySerializer
from .models import Category
import json


class PiStuffHomeView(TemplateView):
    template_name = 'pi_stuff/home.html'
    
    def get_context_data(self, **kwargs):
        categories = Category.objects.prefetch_related('playlists').all()
        serializer = CategorySerializer(categories, many=True)
        
        return {
            'categories': categories,
            'categories_json': json.dumps(serializer.data)
        }