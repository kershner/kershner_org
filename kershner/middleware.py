class SubdomainMiddleware:
    """
    Detects kershner.org subdomain requests, stores the subdomain on the request,
    and routes them through the subdomain-specific URL config.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = request.get_host().split(':')[0]

        if host.endswith('.kershner.org') and host not in {'kershner.org', 'www.kershner.org'}:
            request.subdomain = host.removesuffix('.kershner.org')
            request.urlconf = 'kershner.subdomain_urls'
        else:
            request.subdomain = None

        return self.get_response(request)