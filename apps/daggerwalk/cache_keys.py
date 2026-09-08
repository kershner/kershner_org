DAGGERWALK_HOME_HTML_CACHE_KEY = "daggerwalk_home_html:v20260908-guild-heading-margin"
PROGRESSION_SNAPSHOT_CACHE_KEY = "daggerwalk_progression_snapshot"
PROGRESSION_HOME_CACHE_KEY = "daggerwalk_progression_home"
GUILD_HALL_HTML_CACHE_KEY = "daggerwalk_guild_hall_html"
LEADERBOARD_CACHE_KEY = "daggerwalk_leaderboard"


def completed_quest_html_cache_key(quest_id):
    return f"daggerwalk_completed_quest_html:v8:{quest_id}"

PROGRESSION_CACHE_KEYS = (
    DAGGERWALK_HOME_HTML_CACHE_KEY,
    PROGRESSION_SNAPSHOT_CACHE_KEY,
    PROGRESSION_HOME_CACHE_KEY,
    GUILD_HALL_HTML_CACHE_KEY,
    LEADERBOARD_CACHE_KEY,
)
