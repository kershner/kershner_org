from django.shortcuts import render


def screenbloom_landing(request):
    base_s3_url = 'https://kershner-misc.s3.us-west-2.amazonaws.com/screenbloom_com'
    ctx = {'base_s3_url': base_s3_url}
    return render(request, 'screenbloom/landing.html', ctx)
