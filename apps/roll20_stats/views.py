from django.views.generic import TemplateView


class DnDHome(TemplateView):
    template_name = "dnd/home.html"

    def get_context_data(self, **kwargs):
        ctx = {
            "message": "poop",
        }
        return ctx
    