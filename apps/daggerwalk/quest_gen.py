# quest_gen.py
import hashlib, random, re
from dataclasses import dataclass
from typing import Iterable

# --- Context -----------------------------------------------------------------
@dataclass(frozen=True)
class QuestCtx:
    poi_name: str

# --- Phrase Pools -------------------------------------------------------------
DIRECT_VERBS = [
    "Survey", "Scout", "Inspect", "Observe", "Visit",
    "Check on", "Confirm rumors about", "Verify the tales of",
]

DELIVER_VERBS = [
    "Deliver", "Carry", "Bring", "Ferry", "Transport",
    "Hand off", "Make a delivery", "Convey",
]

ESCORT_VERBS = ["Escort", "Guide"]

SURVEY_VERBS = [
    "Map the approach to", "Sketch approaches to", "Log coordinates for",
    "Record sightings near", "Assess conditions at", "Mark hazards around",
]

DELIVER_OBJECTS = [
    "a sealed letter", "a small parcel", "urgent news", "a writ of passage",
    "supplies", "medicine", "maps for review", "signed papers",
    "a guild voucher", "an invitation", "a sealed satchel",
    "a coded missive", "an accounting ledger", "a pouch of coin",
]

ESCORT_OBJECTS = [
    "a weary traveler", "a caravan", "a courier", "a pilgrim",
    "a scholar", "a merchant", "a scout", "a messenger",
]

SURVEY_OBJECTS = [
    "the boundary stones", "the signal post", "the trailhead",
    "the marker stones", "the ridge overlook", "the ruined arch",
    "the standing stones", "the waygate", "the ford", "the cairn register",
    "the warding sign", "the cliff path", "the crater rim",
]

GIVER_PREFIXES = [
    "Al", "Bel", "Cor", "Dar", "Ela", "Fen", "Gar", "Hel", "Is", "Jar",
    "Kel", "Lor", "Mar", "Nor", "Or", "Per", "Qua", "Ran", "Sel", "Tor",
    "Ul", "Var", "Wil", "Xan", "Yor", "Zel",
]

GIVER_SUFFIXES = [
    "an", "ar", "en", "eth", "iel", "in", "ir", "is", "or", "oth",
    "ric", "us", "as", "on", "iel", "ael", "orim", "dil", "mir", "wyn",
]

GIVER_TITLES = [
    "", "", "", "the Brave", "the Sly", "the Elder", "the Bold",
    "the Wanderer", "the Stern", "the Merchant", "the Farmer",
    "the Knight", "the Mystic", "the Blacksmith",
]

# --- Helpers -----------------------------------------------------------------
def _rng(seed_str: str) -> random.Random:
    h = hashlib.blake2b(seed_str.encode(), digest_size=8).hexdigest()
    return random.Random(int(h, 16))

_VOWEL = set("aeiou")
# words that start with vowel letter but take "a" (yoo/you/wa sound or leading 'one')
_A_EXCEPT = (
    "university", "universe", "unit", "unique", "unicorn", "user", "usual", "euro",
    "europe", "eucalyptus", "ubiquitous", "uterus", "utility", "utopian", "u-",
    "one", "once"
)
# words that start with consonant letter but take "an" (silent h)
_AN_EXCEPT = ("honest", "honor", "honour", "hour", "heir", "heiress", "honourable")

def _needs_an(word: str) -> bool:
    w = word.lower()
    if w.startswith(_AN_EXCEPT):
        return True
    if w.startswith(_A_EXCEPT):
        return False
    # Acronyms: use "an" if first letter is vowel sound-like: A, E, F, H, I, L, M, N, O, R, S, X
    if len(word) <= 4 and word.isupper() and word[0] in "AEFHILMNORSX":
        return True
    return w[0] in _VOWEL

def _normalize_articles(text: str) -> str:
    # Fix "a/an" before the next word
    def repl(m: re.Match) -> str:
        art = m.group(1).lower()
        word = m.group(2)
        correct = "an" if _needs_an(word) else "a"
        return ("An" if art[0].isupper() else correct) + " " + word
    return re.sub(r'\b([Aa]n?)\s+([A-Za-z][\w-]*)', repl, text)

# --- Public API --------------------------------------------------------------
def generate_description(ctx: QuestCtx, seed_str: str) -> str:
    """
    One clean sentence, always ends with a period.
    Modes (approx):
      - direct (~30%) | deliver (~35%) | survey-with-object (~20%) | escort (~15%)
    """
    rng = _rng(seed_str)
    roll = rng.random()

    if roll < 0.30:
        verb = rng.choice(DIRECT_VERBS)
        base = f"{verb} {ctx.poi_name}"

    elif roll < 0.65:
        verb = rng.choice(DELIVER_VERBS)
        if verb == "Make a delivery":
            if rng.random() < 0.6:
                obj = rng.choice(DELIVER_OBJECTS)
                base = f"{verb} of {obj} to {ctx.poi_name}"
            else:
                base = f"{verb} to {ctx.poi_name}"
        else:
            obj = rng.choice(DELIVER_OBJECTS)
            base = f"{verb} {obj} to {ctx.poi_name}"

    elif roll < 0.85:
        verb = rng.choice(SURVEY_VERBS)
        obj = rng.choice(SURVEY_OBJECTS)
        base = f"{verb} {obj} at {ctx.poi_name}"

    else:
        verb = rng.choice(ESCORT_VERBS)
        obj = rng.choice(ESCORT_OBJECTS)
        base = f"{verb} {obj} to {ctx.poi_name}"

    base = _normalize_articles(base.strip())
    return base + "."

def unique_description(ctx: QuestCtx, seed_str: str, recent: Iterable[str], max_tries: int = 8) -> str:
    recent_set = set(s.strip() for s in recent if s)
    desc = ""
    for i in range(max_tries):
        desc = generate_description(ctx, f"{seed_str}:{i}")
        if desc not in recent_set:
            return desc
    return desc  # fallback

def seed_for_quest(quest) -> str:
    poi_id = getattr(quest.poi, "id", 0)
    return f"{getattr(quest, 'quest_giver_img_number', 0)}:{getattr(quest, 'xp', 0)}:{poi_id}"

def build_ctx_from_quest(quest) -> QuestCtx:
    return QuestCtx(poi_name=quest.poi.name if quest.poi else "somewhere")

def generate_giver_name(seed_str: str) -> str:
    rng = _rng("giver:" + seed_str)
    first = rng.choice(GIVER_PREFIXES) + rng.choice(GIVER_SUFFIXES)
    title = rng.choice(GIVER_TITLES)
    return f"{first} {title}".strip()
