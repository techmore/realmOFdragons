"""
Crossing room graph for the Evennia migration.
"""

from collections import deque

from world.dr_data import GUILDS

START_ROOM_ID = "crossing-TG01-001"

ROOMS = {
    START_ROOM_ID: {
        "title": "Crossing Town Green",
        "desc": "A broad square with a fountain, benches, guards, and roads leading toward the guild districts.",
        "exits": {
            "north": "crossing-IN02-001",
            "east": "crossing-MA01-001",
            "south": "crossing-RV01-001",
            "northeast": "crossing-GU01-001",
            "northwest": "crossing-GU02-001",
            "southeast": "crossing-GU03-001",
            "southwest": "crossing-GU04-001",
            "up": "crossing-GU05-001",
        },
    },
    "crossing-IN02-001": {
        "title": "Crossing Inns Row",
        "desc": "Warm inn windows and busy foot traffic line the road north of the green.",
        "exits": {
            "south": START_ROOM_ID,
            "north": "crossing-GU06-001",
            "east": "crossing-GU07-001",
            "west": "crossing-GU08-001",
        },
    },
    "crossing-MA01-001": {
        "title": "Marksman Way",
        "desc": "Targets, practice lanes, and old training rigs fill the narrow way.",
        "exits": {"west": START_ROOM_ID, "east": "crossing-GU09-001", "north": "crossing-MA01-002"},
    },
    "crossing-MA01-002": {
        "title": "Marksman Sheds",
        "desc": "A shed courtyard with spare bows, frames, and trainers calling short corrections.",
        "exits": {"south": "crossing-MA01-001"},
    },
    "crossing-RV01-001": {
        "title": "South Gate Road",
        "desc": "The road drops toward the gate approach and beginner foraging trails.",
        "exits": {"north": START_ROOM_ID, "east": "crossing-GU10-001", "west": "crossing-GU11-001", "south": "crossing-RV02-001"},
    },
    "crossing-RV02-001": {
        "title": "South Gate Trailhead",
        "desc": "A gate marker stands near the road where foragers move in and out.",
        "exits": {"north": "crossing-RV01-001", "east": "crossing-RV02-002"},
    },
    "crossing-RV02-002": {
        "title": "Brushline Forage Fork",
        "desc": "Scrubland edges and low brush form a beginner hunting fork.",
        "exits": {"west": "crossing-RV02-001", "south": "crossing-RV02-003", "east": "crossing-RV02-004"},
        "targets": ("rv-wolf-cub",),
    },
    "crossing-RV02-003": {
        "title": "Willow Tract",
        "desc": "A narrow game trail leads outward through willow and brush.",
        "exits": {"north": "crossing-RV02-002", "south": "crossing-RV02-005"},
        "targets": ("rv-boarlet",),
    },
    "crossing-RV02-004": {
        "title": "Muddy Beetle Bend",
        "desc": "Wet stones and roots mark a shallow bend where small vermin pick through mud.",
        "exits": {"west": "crossing-RV02-002"},
        "targets": ("rv-mud-beetle",),
    },
    "crossing-RV02-005": {
        "title": "Low Ridge Rabbit Run",
        "desc": "A low grassy ridge overlooks the outer brush and small animal tracks.",
        "exits": {"north": "crossing-RV02-003"},
        "targets": ("rv-ridge-hare",),
    },
    "crossing-GU01-001": {
        "title": "Martial Practice Hall",
        "desc": "A public martial practice room for early drills.",
        "exits": {"southwest": START_ROOM_ID},
    },
    "crossing-GU02-001": {
        "title": "Arcane Study Hall",
        "desc": "A quiet public study room for basic magical theory.",
        "exits": {"southeast": START_ROOM_ID, "north": "crossing-GU12-001"},
    },
    "crossing-GU03-001": {
        "title": "Trail Scout Lodge",
        "desc": "Maps, trail markers, and field gear line the lodge walls.",
        "exits": {"northwest": START_ROOM_ID, "south": "crossing-GU14-001"},
    },
    "crossing-GU04-001": {
        "title": "Shadowed Utility Hall",
        "desc": "A narrow utility hall with quiet corners and careful foot traffic.",
        "exits": {"northeast": START_ROOM_ID, "south": "crossing-GU15-001"},
    },
    "crossing-GU05-001": {
        "title": "Cleric Guild Registrar",
        "desc": "A clean hall where a cleric registrar records new members.",
        "exits": {"down": START_ROOM_ID},
        "guild": "cleric",
    },
    "crossing-GU06-001": {
        "title": "Bard Guild Conservatory",
        "desc": "A bright conservatory where a bard registrar keeps membership rolls.",
        "exits": {"south": "crossing-IN02-001"},
        "guild": "bard",
    },
    "crossing-GU07-001": {
        "title": "Trader Guild Exchange",
        "desc": "An exchange desk where a trader registrar watches contracts and ledgers.",
        "exits": {"west": "crossing-IN02-001"},
        "guild": "trader",
    },
    "crossing-GU08-001": {
        "title": "Empath Guild Clinic",
        "desc": "A calm clinic where an empath registrar receives new students.",
        "exits": {"east": "crossing-IN02-001"},
        "guild": "empath",
    },
    "crossing-GU09-001": {
        "title": "Paladin Guild Yard",
        "desc": "A disciplined yard where a paladin registrar stands beside the practice lists.",
        "exits": {"west": "crossing-MA01-001"},
        "guild": "paladin",
    },
    "crossing-GU10-001": {
        "title": "Barbarian Guild Pit",
        "desc": "A sand-floored pit where a barbarian registrar sizes up new blood.",
        "exits": {"west": "crossing-RV01-001"},
        "guild": "barbarian",
    },
    "crossing-GU11-001": {
        "title": "Warrior Mage Guild Range",
        "desc": "A scorched range where a warrior mage registrar keeps an eye on practice.",
        "exits": {"east": "crossing-RV01-001"},
        "guild": "warrior_mage",
    },
    "crossing-GU12-001": {
        "title": "Moon Mage Observatory",
        "desc": "An upper observatory where a moon mage registrar marks the rolls.",
        "exits": {"south": "crossing-GU02-001", "east": "crossing-GU13-001"},
        "guild": "moon_mage",
    },
    "crossing-GU13-001": {
        "title": "Lower Study",
        "desc": "A secluded study where a necromancer registrar keeps careful records.",
        "exits": {"west": "crossing-GU12-001"},
        "guild": "necromancer",
    },
    "crossing-GU14-001": {
        "title": "Ranger Field Room",
        "desc": "A practical field room where a ranger registrar checks trail readiness.",
        "exits": {"north": "crossing-GU03-001"},
        "guild": "ranger",
    },
    "crossing-GU15-001": {
        "title": "Thief Practice",
        "desc": "A quiet practice room where a thief registrar speaks only when needed.",
        "exits": {"north": "crossing-GU04-001"},
        "guild": "thief",
    },
}


def guild_registrar_rooms():
    """Return guild id to registrar room id mapping."""

    return {room["guild"]: room_id for room_id, room in ROOMS.items() if room.get("guild")}


def validate_world_graph():
    """Return graph validation errors."""

    errors = []
    for room_id, room in ROOMS.items():
        for direction, destination in room.get("exits", {}).items():
            if destination not in ROOMS:
                errors.append(f"{room_id} exit {direction} points to missing room {destination}.")
    missing_guilds = sorted(set(GUILDS) - set(guild_registrar_rooms()))
    for guild_id in missing_guilds:
        errors.append(f"Missing registrar room for {guild_id}.")
    return errors


def find_path(start_room_id, end_room_id):
    """Find a shortest list of directions between rooms."""

    if start_room_id not in ROOMS or end_room_id not in ROOMS:
        return []
    if start_room_id == end_room_id:
        return []

    queue = deque([(start_room_id, [])])
    seen = {start_room_id}
    while queue:
        room_id, path = queue.popleft()
        for direction, destination in ROOMS[room_id].get("exits", {}).items():
            if destination in seen:
                continue
            next_path = [*path, direction]
            if destination == end_room_id:
                return next_path
            seen.add(destination)
            queue.append((destination, next_path))
    return []
