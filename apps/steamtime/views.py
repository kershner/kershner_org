###  This is ancient code from ~2014.  I like the project and want it to remain accessible so I've put the bare
###  minimum effort in to clean it up and port it to this Django project.
###  Original code here: https://github.com/kershner/steamtime
from django.template import Context, Template
from apps.steamtime import st_functions
from django.http import HttpResponse
from django.conf import settings
import requests

API_URL = 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/'
API_2_WEEKS = 'http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/'
API_URL_STEAMID = 'http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/'
API_PLAYER = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/'
API_FRIENDS = 'http://api.steampowered.com/ISteamUser/GetFriendList/v0001/'
API_KEY = settings.STEAM_API_KEY
url_format = '%s?key=%s&steamid=%s&format=json&include_appinfo=1'
playtime_all = 'playtime_forever'
playtime_2weeks = 'playtime_2weeks'



def steamtime(request):
    return render_steamtime_template('home.html', {})


def results(request):
    ctx = {}

    if request.method == 'POST':
        steam_id, display_name = st_functions.test_user_input(request.POST.get('steamid', None))
        if not steam_id:
            ctx['message'] = 'Please enter a Steam ID'
            return render_steamtime_template('home.html', ctx)

        try:  # Performing the two main API calls
            main_url = '%s' % url_format % (API_URL, API_KEY, steam_id)
            api_call_all = requests.get('%s' % url_format % (API_URL, API_KEY, steam_id))
            api_call_2weeks = requests.get('%s' % url_format % (API_2_WEEKS, API_KEY, steam_id))

            # Storing Steam API JSON response in variables
            data_all = api_call_all.json()
            data_2weeks = api_call_2weeks.json()

            if not data_all['response']:
                ctx['message'] = 'This profile is either private or inactive, please try another SteamID.'
                return render_steamtime_template('home.html', ctx)

            # Parsing API calls into organized lists
            two_weeks = st_functions.parse_data(data_2weeks, playtime_2weeks, 'all', 1, steam_id)
            all_10 = st_functions.parse_data(data_all, playtime_all, 10, 0, steam_id)
            all_20 = st_functions.parse_data(data_all, playtime_all, 20, 0, steam_id)
            all_all = st_functions.parse_data(data_all, playtime_all, 'all', 0, steam_id)

            # Calling chart formatting function on organized API data
            if two_weeks == 'privacy':
                donut_data_2weeks = ''
                line_data_2weeks = ''
                bar_data_2weeks = ''
            else:
                donut_data_2weeks = st_functions.format_data(two_weeks[0], 'donut')
                line_data_2weeks = st_functions.format_data(two_weeks[0], 'line')
                bar_data_2weeks = st_functions.format_data(two_weeks[0], 'bar')

            donut_data_10 = st_functions.format_data(all_10[0], 'donut')
            donut_data_20 = st_functions.format_data(all_20[0], 'donut')
            line_data_10 = st_functions.format_data(all_10[0], 'line')
            line_data_20 = st_functions.format_data(all_20[0], 'line')
            bar_data_10 = st_functions.format_data(all_10[0], 'bar')
            bar_data_20 = st_functions.format_data(all_20[0], 'bar')

            # Pulling out Hall of Shame data
            shame_list = st_functions.hall_of_shame(data_all)[0]
            shame_total = st_functions.hall_of_shame(data_all)[1]

            # Grabbing friends list
            friends = st_functions.get_friends(steam_id)

            # Getting user images
            user_images = st_functions.get_user_images(steam_id)
            user_image = user_images[0]
            user_image_icon = user_images[1]

            profile_url = 'http://steamcommunity.com/profiles/%s' % steam_id

            two_weeks_stats_pages = st_functions.get_two_weeks_stats_page(two_weeks[0], steam_id, two_weeks)
            st_functions.append_2weeks_stat_pages(two_weeks_stats_pages, two_weeks)

            stats = st_functions.statistics(all_all, two_weeks, shame_list)

            distinctions = st_functions.get_distinctions(all_all, two_weeks, stats)

        except (KeyError, IndexError) as e:
                print(e)
                ctx['message'] = 'Invalid profile name or SteamID, please try again'
                return render_steamtime_template('home.html', ctx)

        except requests.ConnectionError:
                ctx['message'] = 'The API request took too long and has timed out, please try again.'
                return render_steamtime_template('home.html', ctx)

        ctx = {
            'shame_list': shame_list,
            'shame_total': shame_total,
            'two_weeks': two_weeks,
            'all_10': all_10,
            'all_20': all_20,
            'all_all': all_all,
            'donut_data_2weeks': donut_data_2weeks,
            'donut_data_10': donut_data_10,
            'donut_data_20': donut_data_20,
            'line_data_2weeks': line_data_2weeks,
            'line_data_10': line_data_10,
            'line_data_20': line_data_20,
            'bar_data_2weeks': bar_data_2weeks,
            'bar_data_10': bar_data_10,
            'bar_data_20': bar_data_20,
            'display_name': display_name,
            'user_image': user_image,
            'user_image_icon': user_image_icon,
            'friends': friends,
            'profile_url': profile_url,
            'two_weeks_stats_pages': two_weeks_stats_pages,
            'stats': stats,
            'distinctions': distinctions,
            'title': 'Results'
        }

        return render_steamtime_template('results.html', ctx)


def render_steamtime_template(template, ctx):
    template_url = f'{settings.BASE_CLOUDFRONT_URL}steamtime/html/{template}'
    template_response = requests.get(template_url)
    template = Template(template_response.text)
    context = Context(ctx)
    return HttpResponse(template.render(context))
