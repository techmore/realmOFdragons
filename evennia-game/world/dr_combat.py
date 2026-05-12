"""
Clean-room enemy and engagement helpers for the Evennia migration.
"""

ENEMIES = {
    "rv-wolf-cub": {
        "name": "Wolf Cub",
        "vitality": 18,
        "aggression": "watchful",
        "description": "A young wolf tests the air and keeps low to the brush.",
    },
    "rv-boarlet": {
        "name": "Boarlet",
        "vitality": 22,
        "aggression": "stubborn",
        "description": "A small boar paws at the dirt and snorts sharply.",
    },
    "rv-mud-beetle": {
        "name": "Mud Beetle",
        "vitality": 14,
        "aggression": "skittish",
        "description": "A glossy beetle pushes through the mud on hooked legs.",
    },
    "rv-ridge-hare": {
        "name": "Ridge Hare",
        "vitality": 12,
        "aggression": "flighty",
        "description": "A lean hare freezes near the grass line.",
    },
}

RANGES = ("missile", "pole", "melee")


def room_enemy_ids(room):
    return tuple(room.db.targets or ()) if room else ()


def scan_room(room):
    enemy_ids = room_enemy_ids(room)
    if not enemy_ids:
        return "You scan the area and find no immediate threats."
    lines = ["You scan the area:"]
    for enemy_id in enemy_ids:
        enemy = ENEMIES.get(enemy_id, {"name": enemy_id, "aggression": "unknown"})
        lines.append(f"- {enemy['name']} ({enemy_id}), {enemy['aggression']}")
    return "\n".join(lines)


def ensure_engagement(character):
    if character.db.engagement is None:
        character.db.engagement = {"target": None, "range": None}


def target_enemy(character, enemy_id):
    ensure_engagement(character)
    enemy_id = (enemy_id or "").strip().lower()
    if not enemy_id:
        return "Target what?"
    if enemy_id not in room_enemy_ids(character.location):
        return f'You do not see "{enemy_id}" here.'
    enemy = ENEMIES.get(enemy_id)
    if not enemy:
        return f'Unknown enemy "{enemy_id}".'
    character.db.engagement = {"target": enemy_id, "range": "missile"}
    return f"You target {enemy['name']} at missile range."


def range_status(character):
    ensure_engagement(character)
    engagement = character.db.engagement or {}
    target_id = engagement.get("target")
    range_band = engagement.get("range")
    if not target_id:
        return "You are not engaged."
    enemy = ENEMIES.get(target_id, {"name": target_id})
    return f"You are engaged with {enemy['name']} at {range_band or 'unknown'} range."


def advance(character):
    ensure_engagement(character)
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Advance on what? Target an enemy first."
    current = engagement.get("range") or "missile"
    if current == "melee":
        return "You are already at melee range."
    next_range = RANGES[RANGES.index(current) + 1]
    engagement["range"] = next_range
    character.db.engagement = engagement
    enemy = ENEMIES.get(target_id, {"name": target_id})
    return f"You advance on {enemy['name']} to {next_range} range."


def retreat(character):
    ensure_engagement(character)
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "You are not engaged."
    current = engagement.get("range") or "missile"
    if current == "missile":
        character.db.engagement = {"target": None, "range": None}
        return "You retreat and break engagement."
    next_range = RANGES[RANGES.index(current) - 1]
    engagement["range"] = next_range
    character.db.engagement = engagement
    enemy = ENEMIES.get(target_id, {"name": target_id})
    return f"You retreat from {enemy['name']} to {next_range} range."
