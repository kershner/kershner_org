import hashlib
import html
from datetime import date, datetime

from bs4 import BeautifulSoup
from django.utils import timezone

from roll20_stats.models import Roll20Message, SessionCharacterStats
    

TIMESTAMP_FORMAT = '%B %d, %Y %I:%M%p'

CHARACTER_ALIASES = {
    'Tyler K': 'Tommy Pimples',
    'Tyler K.': 'Tommy Pimples',
    'Tommy Pimples': 'Tommy Pimples',
}
SKIP_CHARACTERS = {'', 'Unknown'}
PLAYER_CHARACTERS = {
    'Tommy Pimples',
    'Tinraint "Taint" Bronzering',
    'Marvin Tuddles',
    'Max Callahan',
    'Flavius un Korvath',
}
ROLL_TYPES = {
    Roll20Message.TYPE_ROLL,
    Roll20Message.TYPE_ATTACK,
    Roll20Message.TYPE_DAMAGE,
    Roll20Message.TYPE_CHECK,
    Roll20Message.TYPE_SAVE,
}


def clean_text(value):
    """Collapse whitespace in a text value."""
    return ' '.join((value or '').split())


def normalize_character(name):
    """Return the canonical character name."""
    name = clean_text(name).rstrip(':')
    return CHARACTER_ALIASES.get(name, name)


def parse_assume_date(value):
    """Parse the optional trailing-session date."""
    if not value:
        return None
    if isinstance(value, date):
        return value
    return datetime.strptime(value, '%Y-%m-%d').date()


def make_aware(dt):
    """Attach the current Django timezone when needed."""
    if timezone.is_aware(dt):
        return dt
    return timezone.make_aware(dt, timezone.get_current_timezone())


def parse_timestamp(value, current_timestamp=None, assume_date=None, undated_session_date=None):
    """Parse a dated or time-only Roll20 timestamp."""
    value = clean_text(value)
    assume_date = parse_assume_date(assume_date)

    try:
        return make_aware(datetime.strptime(value, TIMESTAMP_FORMAT)), None
    except ValueError:
        pass

    time_value = datetime.strptime(value, '%I:%M%p').time()

    if undated_session_date:
        timestamp_date = undated_session_date
    elif current_timestamp and time_value < current_timestamp.time():
        if not assume_date:
            raise ValueError(
                'Found a later time-only Roll20 session after {}. Re-run with --assume-date YYYY-MM-DD.'
                .format(current_timestamp.strftime('%Y-%m-%d %I:%M%p'))
            )
        timestamp_date = assume_date
        undated_session_date = assume_date
    elif current_timestamp:
        timestamp_date = current_timestamp.date()
    elif assume_date:
        timestamp_date = assume_date
        undated_session_date = assume_date
    else:
        raise ValueError('Time-only timestamp found before any dated timestamp: {}'.format(value))

    return make_aware(datetime.combine(timestamp_date, time_value)), undated_session_date


def first_text(node, selector):
    """Return the first selected node's text."""
    found = node.select_one(selector)
    return clean_text(found.get_text(' ', strip=True)) if found else ''


def all_text(node, selector):
    """Return non-empty text from all selected nodes."""
    values = []
    for item in node.select(selector):
        value = clean_text(item.get_text(' ', strip=True))
        if value:
            values.append(value)
    return values


def parse_int(value):
    """Parse a simple integer string."""
    value = clean_text(value)
    if value.startswith('-'):
        return -int(value[1:]) if value[1:].isdigit() else None
    return int(value) if value.isdigit() else None


def parse_roll_title(title):
    """Parse one Roll20 evaluated roll title."""
    title = html.unescape(title or '')
    if not title.lower().startswith('rolling ') or '=' not in title:
        return None

    dice, expression = title[len('Rolling '):].split('=', 1)
    dice = clean_text(dice)
    expression_soup = BeautifulSoup(expression, 'html.parser')
    kept_values = []
    all_values = []

    for span in expression_soup.select('span'):
        value = parse_int(span.get_text())
        if value is None:
            continue
        all_values.append(value)
        if 'dropped' not in span.get('class', []):
            kept_values.append(value)

    if kept_values:
        roll = kept_values[0] if 'd20' in dice.lower() else sum(kept_values)
    else:
        roll = parse_int(expression.strip('() '))

    return {
        'dice': dice,
        'roll': roll,
        'values': all_values,
        'kept_values': kept_values,
    }


def get_evaluated_rolls(titles):
    """Return parsed evaluated rolls from title attributes."""
    rolls = []
    for title in titles:
        roll = parse_roll_title(title)
        if roll and roll['roll'] is not None:
            rolls.append(roll)
    return rolls


def get_dice(raw_dice, evaluated_rolls):
    """Return the best dice expression label."""
    values = [clean_text(value) for value in raw_dice if clean_text(value)]
    if not values:
        values = [roll['dice'] for roll in evaluated_rolls if roll.get('dice')]
    return '; '.join(values)[:200]


def get_roll(message_type, total, evaluated_rolls):
    """Return the natural d20 or fallback roll value."""
    d20_rolls = [roll for roll in evaluated_rolls if 'd20' in roll.get('dice', '').lower()]
    if d20_rolls and message_type != Roll20Message.TYPE_DAMAGE:
        return d20_rolls[0]['roll']
    if total is not None:
        return total
    if evaluated_rolls:
        return evaluated_rolls[0]['roll']
    return None


def get_total(message_type, total, evaluated_rolls):
    """Return the final total for damage and d20 rolls."""
    if total is not None:
        return total
    if message_type == Roll20Message.TYPE_DAMAGE:
        damage_rolls = [roll for roll in evaluated_rolls if 'd20' not in roll.get('dice', '').lower()]
        if damage_rolls:
            return sum(roll['roll'] for roll in damage_rolls)
    return None


def drop_message(character, message_type):
    """Skip NPC attacks and damage."""
    return message_type in {Roll20Message.TYPE_ATTACK, Roll20Message.TYPE_DAMAGE} and character not in PLAYER_CHARACTERS


def classify_type(title, subtitle, text, raw_dice, default_type, roll_subcategories=None):
    """Classify a Roll20 message type."""
    label = '{} {}'.format(clean_text(title), clean_text(subtitle)).lower()
    lower_text = clean_text(text).lower()
    dice_text = ' '.join(raw_dice).lower()
    subcategories = {clean_text(value).lower() for value in roll_subcategories or []}

    if 'damage' in subcategories:
        return Roll20Message.TYPE_DAMAGE
    if 'attack' in subcategories:
        return Roll20Message.TYPE_ATTACK
    if 'saving throw' in subcategories or 'save' in subcategories:
        return Roll20Message.TYPE_SAVE
    if 'check' in subcategories or 'skill' in subcategories:
        return Roll20Message.TYPE_CHECK
    if 'damage breakdown' in lower_text or 'damage result breakdown' in lower_text:
        return Roll20Message.TYPE_DAMAGE
    if 'attack breakdown' in lower_text or 'attack result breakdown' in lower_text:
        return Roll20Message.TYPE_ATTACK
    if 'saving throw' in label or ' save' in label or label.endswith('save'):
        return Roll20Message.TYPE_SAVE
    if 'check' in label:
        return Roll20Message.TYPE_CHECK
    if 'damage' in label and 'd20' not in dice_text:
        return Roll20Message.TYPE_DAMAGE
    if 'attack' in label:
        return Roll20Message.TYPE_ATTACK
    return default_type


def get_message_hash(data):
    """Build a stable hash for idempotent imports."""
    parts = [
        data['timestamp'].isoformat(),
        data.get('character', ''),
        data.get('type', ''),
        data.get('title', ''),
        data.get('subtitle', ''),
        data.get('dice', ''),
        str(data.get('roll') if data.get('roll') is not None else ''),
        str(data.get('total') if data.get('total') is not None else ''),
    ]
    return hashlib.sha256('|'.join(parts).encode('utf-8')).hexdigest()


def has_message_data(data, text):
    """Return whether a parsed message should be saved."""
    if data['character'] in SKIP_CHARACTERS:
        return False
    if data['type'] == Roll20Message.TYPE_TEXT:
        return bool(text and text != data['character'])
    return any([data.get('title'), data.get('subtitle'), data.get('dice'), data.get('roll') is not None])


def get_total_node_value(node):
    """Return Roll20's preferred total when available."""
    total_node = node.select_one('.die__total--preferred[data-result]')
    if not total_node:
        return None
    return parse_int(total_node.get('data-result'))


def get_default_type(node):
    """Return the broad type implied by Roll20's template."""
    rolltemplate = node.find('rolltemplate')
    if not rolltemplate:
        return Roll20Message.TYPE_TEXT
    classes = set(rolltemplate.get('class', []))
    return Roll20Message.TYPE_ROLL if 'dnd-2024--roll' in classes else Roll20Message.TYPE_CARD


def parse_roll20_messages(path, assume_date=None):
    """Yield normalized message dictionaries from a Roll20 export."""
    with open(path, encoding='utf-8', errors='ignore') as html_file:
        soup = BeautifulSoup(html_file, 'html.parser')

    current_timestamp = None
    undated_session_date = None
    last_character = None
    last_attack_character = None

    for node in soup.select('div.message'):
        timestamp_text = first_text(node, '.tstamp')
        if timestamp_text:
            current_timestamp, undated_session_date = parse_timestamp(
                timestamp_text,
                current_timestamp=current_timestamp,
                assume_date=assume_date,
                undated_session_date=undated_session_date,
            )
        if not current_timestamp:
            continue

        sender = first_text(node, '.by').rstrip(':')
        character = normalize_character(first_text(node, '.meta__character-name'))
        text = clean_text(node.get_text(' ', strip=True))
        title = first_text(node, '.header__title')[:200]
        subtitle = first_text(node, '.header__subtitle')[:200]
        raw_dice = all_text(node, '.rt-formula__raw')
        evaluated_titles = [item.get('title', '') for item in node.select('.rt-formula__evaluated-string[title]')]
        evaluated_rolls = get_evaluated_rolls(evaluated_titles)
        roll_subcategories = [item.get('data-rollsubcategory') for item in node.select('[data-rollsubcategory]')]

        message_type = classify_type(
            title,
            subtitle,
            text,
            raw_dice,
            get_default_type(node),
            roll_subcategories,
        )

        if character in SKIP_CHARACTERS and message_type == Roll20Message.TYPE_DAMAGE:
            character = last_attack_character or last_character or character
        if drop_message(character, message_type):
            continue

        total = get_total_node_value(node)
        dice = get_dice(raw_dice, evaluated_rolls)
        roll = get_roll(message_type, total, evaluated_rolls)
        final_total = get_total(message_type, total, evaluated_rolls)

        data = {
            'timestamp': current_timestamp,
            'sender': sender,
            'character': character,
            'type': message_type,
            'title': title,
            'subtitle': subtitle,
            'dice': dice,
            'roll': roll,
            'total': final_total,
        }
        if not has_message_data(data, text):
            continue

        if character not in SKIP_CHARACTERS:
            last_character = character
            if message_type == Roll20Message.TYPE_ATTACK:
                last_attack_character = character

        data['import_hash'] = get_message_hash(data)
        yield data


def is_d20_message(message):
    """Return whether a message has a natural d20 value."""
    return bool(message.dice and 'd20' in message.dice.lower() and message.roll is not None)


def empty_stats():
    """Return a blank stats dictionary."""
    return {
        'entries': 0,
        'text_messages': 0,
        'cards': 0,
        'rolls': 0,
        'd20_rolls': 0,
        'd20_total': 0,
        'nat20s': 0,
        'nat1s': 0,
        'attacks': 0,
        'checks': 0,
        'saves': 0,
        'damage_rolls': 0,
        'damage_total': 0,
    }


def add_message_to_stats(stats, message):
    """Add one message to an aggregate stats dictionary."""
    stats['entries'] += 1
    stats['text_messages'] += int(message.type == Roll20Message.TYPE_TEXT)
    stats['cards'] += int(message.type == Roll20Message.TYPE_CARD)
    stats['rolls'] += int(message.type in ROLL_TYPES)
    stats['attacks'] += int(message.type == Roll20Message.TYPE_ATTACK)
    stats['checks'] += int(message.type == Roll20Message.TYPE_CHECK)
    stats['saves'] += int(message.type == Roll20Message.TYPE_SAVE)

    if is_d20_message(message):
        stats['d20_rolls'] += 1
        stats['d20_total'] += message.roll
        stats['nat20s'] += int(message.roll == 20)
        stats['nat1s'] += int(message.roll == 1)

    if message.type == Roll20Message.TYPE_DAMAGE:
        damage_value = message.total if message.total is not None else message.roll
        if damage_value is not None:
            stats['damage_rolls'] += 1
            stats['damage_total'] += damage_value


def update_session_stats(session):
    """Refresh character stats for one session."""
    SessionCharacterStats.objects.filter(session=session).delete()
    grouped = {}

    for message in Roll20Message.objects.filter(session=session):
        stats = grouped.setdefault(message.character, empty_stats())
        add_message_to_stats(stats, message)

    stats_objects = [
        SessionCharacterStats(session=session, character=character, **stats)
        for character, stats in grouped.items()
    ]
    SessionCharacterStats.objects.bulk_create(stats_objects)

    for stats in SessionCharacterStats.objects.filter(session=session):
        Roll20Message.objects.filter(session=session, character=stats.character).update(session_character_stats=stats)
