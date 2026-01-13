from django.views.generic import TemplateView


class PiStuffHomeView(TemplateView):
    template_name = 'pi_stuff/home.html'
