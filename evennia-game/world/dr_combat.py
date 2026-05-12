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
STANCES = ("balanced", "offensive", "defensive")


def room_enemy_ids(room):
    if not room:
        return ()
    enemy_ids = tuple(
        obj.db.enemy_id
        for obj in room.contents
        if obj.db.npc_type == "enemy" and obj.db.enemy_id
    )
    return enemy_ids or tuple(room.db.targets or ())


def find_enemy_object(room, enemy_id):
    if not room:
        return None
    for obj in room.contents:
        if obj.db.npc_type == "enemy" and obj.db.enemy_id == enemy_id:
            return obj
    return None


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
    if character.db.balance is None:
        character.db.balance = "balanced"
    if character.db.roundtime is None:
        character.db.roundtime = 0
    if character.db.stance is None:
        character.db.stance = "balanced"
    if character.db.max_health is None:
        character.db.max_health = 30
    if character.db.health is None:
        character.db.health = character.db.max_health


def health_text(character):
    ensure_engagement(character)
    return f"Health: {character.db.health}/{character.db.max_health}. Balance: {character.db.balance}. Stance: {character.db.stance}."


def retaliation_damage(character):
    stance_name = character.db.stance or "balanced"
    if stance_name == "defensive":
        return 1
    if stance_name == "offensive":
        return 3
    return 2


def apply_enemy_retaliation(character, enemy):
    damage = retaliation_damage(character)
    health = max(0, int(character.db.health or 0) - damage)
    character.db.health = health
    return f"{enemy['name']} presses back for {damage} damage. You have {health} health remaining."


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


def jab(character):
    ensure_engagement(character)
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Jab what? Target an enemy first."
    if engagement.get("range") != "melee":
        return "You need to be at melee range to jab."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    enemy_obj = find_enemy_object(character.location, target_id)
    if not enemy_obj:
        character.db.engagement = {"target": None, "range": None}
        return f"{enemy['name']} is no longer here."

    damage = 6
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 1
    if vitality <= 0:
        enemy_obj.delete()
        character.db.engagement = {"target": None, "range": None}
        return f"You jab {enemy['name']} for {damage} damage. {enemy['name']} collapses."

    enemy_obj.db.vitality = vitality
    pressure = apply_enemy_retaliation(character, enemy)
    return f"You jab {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.\n{pressure}"


def stance(character, requested):
    ensure_engagement(character)
    requested = (requested or "").strip().lower()
    if not requested:
        return f"Your stance is {character.db.stance} and your balance is {character.db.balance}."
    if requested not in STANCES:
        return f'Unknown stance "{requested}". Stances: {", ".join(STANCES)}.'
    character.db.stance = requested
    return f"You settle into a {requested} stance."


def wait_recover(character):
    ensure_engagement(character)
    roundtime = int(character.db.roundtime or 0)
    if roundtime <= 0:
        character.db.balance = "balanced"
        return "You are already balanced."
    roundtime -= 1
    character.db.roundtime = roundtime
    if roundtime <= 0:
        character.db.balance = "balanced"
        return "You recover your balance."
    return f"You wait. Roundtime: {roundtime}."
