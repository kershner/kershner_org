"""Automatic discovery and selection of Bluesky tags for daily videos."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import math
import random
import re
from statistics import median

from atproto_client.models.app.bsky.feed.search_posts import Params as SearchParams
from django.core.cache import cache


TAG_POOL_CACHE_KEY = "daggerwalk:bluesky:video-tag-pool:v1"
CORE_TAGS = ("daggerfall", "elderscrolls", "retrogaming")
SEED_TAGS = CORE_TAGS + ("crpg", "dosgaming", "pcgaming", "twitchclips")

# Last known-good pool, used until the first audit and whenever Bluesky search
# is unavailable. These were measured against 30 days of organic activity.
FALLBACK_TAGS = (
    "tes", "crpg", "rpgs", "adventuregames", "pcgames",
    "classicgaming", "dosgaming", "msdos", "90sgaming", "dosgames",
    "retrogames", "retrocomputing", "classicgames", "dos",
    "blueskygaming", "rpgcommunity", "twitchstreamer",
    "gamingcommunity", "twitchclips", "gameclips", "gamedev", "pixelart",
    "rpg", "pcgaming", "gaming", "twitch", "fantasy",
)
AVAILABLE_TAGS = tuple(dict.fromkeys(CORE_TAGS + FALLBACK_TAGS))
BLOCKED_TAGS = {
    "nsfw", "politics", "giveaway", "giveaways", "followback",
    "webdev", "javascript", "django", "obs", "gameautomation",
    "gamingbot", "proceduralstorytelling",
}
TAG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{1,31}$")
MAX_DISCOVERED_CANDIDATES = 25
MAX_POOL_SIZE = 20
MIN_POOL_SIZE = 10


def _search_posts(client, tag, *, since, until=None, limit=100):
    """Return raw post dictionaries, tolerating embed types newer than the SDK."""
    params = SearchParams(
        q=f"#{tag}",
        tag=[tag],
        limit=limit,
        sort="latest",
        since=since,
        until=until,
    )
    response = client.app.bsky.feed._client.invoke_query(
        "app.bsky.feed.searchPosts",
        params=params,
        output_encoding="application/json",
    )
    return list(response.content.get("posts", []))


def _post_tags(post):
    tags = set()
    for facet in post.get("record", {}).get("facets", []):
        for feature in facet.get("features", []):
            if feature.get("$type") == "app.bsky.richtext.facet#tag":
                tag = str(feature.get("tag", "")).casefold()
                if TAG_PATTERN.fullmatch(tag):
                    tags.add(tag)
    return tags


def _engagement(post):
    return sum(
        post.get(field) or 0
        for field in ("likeCount", "repostCount", "replyCount", "quoteCount")
    )


def _created_at(post):
    value = post.get("record", {}).get("createdAt")
    if not value:
        return None
    # Bluesky can return nanoseconds, while Python 3.10's ISO parser accepts at
    # most six fractional digits. Preserve microseconds and discard the excess.
    value = re.sub(
        r"(\.\d{6})\d+(?=(?:Z|[+-]\d{2}:\d{2})$)",
        r"\1",
        str(value),
    ).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _discover_candidates(client, own_did, now):
    """Find tags that organic authors use alongside proven Daggerwalk tags."""
    since = (now - timedelta(days=30)).isoformat().replace("+00:00", "Z")
    post_counts = Counter()
    authors = defaultdict(set)
    for seed in SEED_TAGS:
        for post in _search_posts(client, seed, since=since):
            author_did = post.get("author", {}).get("did")
            if not author_did or author_did == own_did:
                continue
            for tag in _post_tags(post) - set(CORE_TAGS):
                if tag in BLOCKED_TAGS:
                    continue
                post_counts[tag] += 1
                authors[tag].add(author_did)

    eligible = [
        tag for tag, count in post_counts.items()
        if count >= 2 and len(authors[tag]) >= 2
    ]
    eligible.sort(
        key=lambda tag: (post_counts[tag], len(authors[tag])),
        reverse=True,
    )
    return Counter({tag: post_counts[tag] for tag in eligible[:MAX_DISCOVERED_CANDIDATES]})


def _audit_candidate(client, tag, own_did, now):
    """Measure mature organic engagement and anti-spam signals for one tag."""
    since_dt = now - timedelta(days=30)
    until_dt = now - timedelta(hours=24)
    posts = _search_posts(
        client,
        tag,
        since=since_dt.isoformat().replace("+00:00", "Z"),
        until=until_dt.isoformat().replace("+00:00", "Z"),
    )
    posts = [
        post for post in posts
        if post.get("author", {}).get("did") not in (None, own_did)
    ]
    dated_posts = [(post, _created_at(post)) for post in posts]
    recent_posts = [
        post for post, created_at in dated_posts
        if created_at and created_at >= now - timedelta(days=7)
    ]
    author_counts = Counter(post.get("author", {}).get("did") for post in posts)
    interactions = [_engagement(post) for post in posts]
    ordered = sorted(interactions)
    p75 = ordered[round((len(ordered) - 1) * 0.75)] if ordered else 0
    return {
        "posts_7d": len(recent_posts),
        "posts_30d": len(posts),
        "authors_30d": len(author_counts),
        "top_author_share": (
            max(author_counts.values()) / len(posts) if posts else 1.0
        ),
        "median_engagement": median(interactions) if interactions else 0,
        "p75_engagement": p75,
    }


def _candidate_score(metrics, cooccurrences):
    engagement = 1 + metrics["median_engagement"] + 0.25 * metrics["p75_engagement"]
    activity = math.log2(1 + min(metrics["posts_7d"], 100))
    diversity = math.log2(1 + metrics["authors_30d"])
    relevance = 1 + 0.1 * math.log2(1 + cooccurrences)
    return round(engagement * activity * diversity * relevance, 3)


def refresh_tag_pool(client, own_did, now=None):
    """Discover, score, and persist a new rotating tag pool."""
    now = now or datetime.now(timezone.utc)
    discovered = _discover_candidates(client, own_did, now)
    candidates = set(FALLBACK_TAGS) | set(discovered)
    ranked = []
    for tag in candidates:
        if tag in CORE_TAGS or tag in BLOCKED_TAGS or not TAG_PATTERN.fullmatch(tag):
            continue
        metrics = _audit_candidate(client, tag, own_did, now)
        if (
            metrics["posts_7d"] < 2
            or metrics["authors_30d"] < 5
            or metrics["median_engagement"] < 1
            or metrics["top_author_share"] > 0.35
        ):
            continue
        ranked.append({
            "tag": tag,
            "score": _candidate_score(metrics, discovered[tag]),
            **metrics,
        })

    ranked.sort(key=lambda item: (item["score"], item["tag"]), reverse=True)
    ranked = ranked[:MAX_POOL_SIZE]
    if len(ranked) < MIN_POOL_SIZE:
        raise RuntimeError(
            f"Bluesky tag audit produced only {len(ranked)} qualifying tags"
        )

    payload = {
        "updated_at": now.isoformat().replace("+00:00", "Z"),
        "tags": ranked,
    }
    cache.set(TAG_POOL_CACHE_KEY, payload, timeout=None)
    return payload


def active_rotating_tags():
    try:
        payload = cache.get(TAG_POOL_CACHE_KEY) or {}
        tags = list(dict.fromkeys(
            item.get("tag") for item in payload.get("tags", [])
            if isinstance(item, dict) and item.get("tag")
        ))
        if len(tags) >= 3:
            return tags
    except Exception:
        pass
    return list(FALLBACK_TAGS)


def select_video_tags():
    """Return three stable anchors plus three audited rotating tags."""
    pool = [tag for tag in active_rotating_tags() if tag not in CORE_TAGS]
    return list(CORE_TAGS) + random.sample(pool, 3)
