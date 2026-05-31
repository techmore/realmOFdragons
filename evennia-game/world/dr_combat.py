"""
Clean-room enemy and engagement helpers for the Evennia migration.
"""

from evennia import create_object
from evennia.utils.create import create_script

from world.dr_economy import ITEMS, coins, set_coins
from world.dr_data import build_starter_attributes, build_starter_skills
from world.dr_progression import apply_skill_pool_gain

ENEMIES = {
    "rv-wolf-cub": {
        "name": "Wolf Cub",
        "vitality": 18,
        "aggression": "watchful",
        "description": "A young wolf tests the air and keeps low to the brush.",
        "loot": {"trias": 4, "items": ("travel_rations",)},
    },
    "rv-boarlet": {
        "name": "Boarlet",
        "vitality": 22,
        "aggression": "stubborn",
        "description": "A small boar paws at the dirt and snorts sharply.",
        "loot": {"trias": 5, "items": ("travel_rations",)},
    },
    "rv-mud-beetle": {
        "name": "Mud Beetle",
        "vitality": 14,
        "aggression": "skittish",
        "description": "A glossy beetle pushes through the mud on hooked legs.",
        "loot": {"trias": 3, "items": ("torch",)},
    },
    "rv-ridge-hare": {
        "name": "Ridge Hare",
        "vitality": 12,
        "aggression": "flighty",
        "description": "A lean hare freezes near the grass line.",
        "loot": {"trias": 2, "items": ()},
    },
}

RANGES = ("missile", "pole", "melee")
STANCES = ("balanced", "offensive", "defensive")
PRESSURE_SCRIPT_MARKER = "dr_combat_pressure"


def room_enemy_ids(room):
    if not room:
        return ()
    return tuple(
        obj.db.enemy_id
        for obj in room.contents
        if obj.db.npc_type == "enemy" and obj.db.enemy_id
    )


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


def create_enemy(room, enemy_id):
    enemy = ENEMIES[enemy_id]
    enemy_obj = create_object(
        "typeclasses.npcs.Enemy",
        key=enemy["name"],
        location=room,
        home=room,
    )
    enemy_obj.db.enemy_id = enemy_id
    enemy_obj.db.vitality = enemy["vitality"]
    enemy_obj.db.aggression = enemy["aggression"]
    enemy_obj.db.desc = enemy["description"]
    enemy_obj.save()
    return enemy_obj


def respawn_room_enemies(room):
    if not room:
        return "There is nowhere to respawn enemies."
    target_ids = tuple(room.db.targets or ())
    if not target_ids:
        return "No enemy spawns are configured here."

    existing = set(room_enemy_ids(room))
    created = []
    for enemy_id in target_ids:
        if enemy_id in existing or enemy_id not in ENEMIES:
            continue
        create_enemy(room, enemy_id)
        created.append(ENEMIES[enemy_id]["name"])
    if not created:
        return "Enemy spawns are already active here."
    return "Respawned: " + ", ".join(created) + "."


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


def attribute_value(character, attribute):
    attributes = character.db.attributes or build_starter_attributes()
    return int(attributes.get(attribute, 10) or 10)


def skill_rank(character, skill_id):
    skills = character.db.skills or build_starter_skills()
    skill = skills.get(skill_id, {})
    return int(skill.get("rank", 0) or 0)


def maneuver_damage(character, maneuver):
    if maneuver == "jab":
        return 4 + attribute_value(character, "agility") // 5 + skill_rank(character, "small_edged") // 10
    if maneuver == "bash":
        return 8 + attribute_value(character, "strength") // 5 + skill_rank(character, "brawling") // 10
    return 1


def apply_combat_skill_gain(character, skill_id):
    skills = character.db.skills or build_starter_skills()
    events = apply_skill_pool_gain(skills, skill_id, 2)
    events.extend(apply_skill_pool_gain(skills, "tactics", 1))
    character.db.skills = skills
    return events


def apply_enemy_retaliation(character, enemy):
    damage = retaliation_damage(character)
    health = max(0, int(character.db.health or 0) - damage)
    character.db.health = health
    return f"{enemy['name']} presses back for {damage} damage. You have {health} health remaining."


def apply_enemy_pressure(character):
    ensure_engagement(character)
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    range_band = engagement.get("range")
    if not target_id:
        return "No enemy pressure: not engaged."
    if range_band not in ("pole", "melee"):
        return "No enemy pressure: target is too far away."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    if not find_enemy_object(character.location, target_id):
        character.db.engagement = {"target": None, "range": None}
        stop_combat_pressure(character)
        return f"No enemy pressure: {enemy['name']} is gone."
    return apply_enemy_retaliation(character, enemy)


def combat_pressure_scripts(character):
    return [
        script
        for script in character.scripts.all()
        if script.db.script_marker == PRESSURE_SCRIPT_MARKER
    ]


def ensure_combat_pressure(character):
    scripts = combat_pressure_scripts(character)
    if scripts:
        return scripts[0]
    script = create_script("typeclasses.scripts.CombatPressureScript", obj=character)
    script.db.script_marker = PRESSURE_SCRIPT_MARKER
    return script


def stop_combat_pressure(character):
    for script in combat_pressure_scripts(character):
        script.stop()
        script.delete()


def create_corpse(room, enemy_id, enemy):
    loot = enemy.get("loot", {})
    corpse = create_object(
        "typeclasses.objects.Corpse",
        key=f"{enemy['name']} corpse",
        location=room,
        home=room,
    )
    corpse.db.enemy_id = enemy_id
    corpse.db.enemy_name = enemy["name"]
    corpse.db.loot_trias = int(loot.get("trias", 0) or 0)
    corpse.db.loot_items = tuple(loot.get("items", ()) or ())
    corpse.db.desc = f"The remains of {enemy['name']} lie here."
    for item_id in corpse.db.loot_items:
        item = ITEMS.get(item_id, {"name": item_id, "description": item_id})
        item_obj = create_object(
            "typeclasses.objects.Item",
            key=item["name"],
            location=corpse,
            home=room,
        )
        item_obj.db.item_id = item_id
        item_obj.db.desc = item.get("description", item["name"])
        item_obj.save()
    script = create_script("typeclasses.scripts.CorpseDecayScript", obj=corpse, start_delay=True)
    script.db.script_marker = "dr_corpse_decay"
    corpse.save()
    return corpse


def corpse_objects(room):
    if not room:
        return []
    return [obj for obj in room.contents if obj.db.object_type == "corpse"]


def loot_corpse(character):
    corpses = corpse_objects(character.location)
    if not corpses:
        return "There is no corpse here to loot."
    corpse = corpses[0]
    trias = int(corpse.db.loot_trias or 0)
    if trias:
        character.db.wallet = set_coins(character.db.wallet, coins(character.db.wallet) + trias)
    item_ids = []
    for item_obj in list(corpse.contents):
        if item_obj.db.object_type == "item" and item_obj.db.item_id:
            item_ids.append(item_obj.db.item_id)
            item_obj.location = character.location
            item_obj.home = character.location
            item_obj.save()

    parts = []
    if trias:
        parts.append(f"{trias} trias")
    if item_ids:
        parts.append(", ".join(item_ids))
    corpse.db.loot_items = ()
    corpse.delete()
    if not parts:
        return "You search the corpse but find no usable loot."
    return "You loot " + " and ".join(parts) + " from the corpse."


def loot_preview(enemy):
    loot = enemy.get("loot", {})
    trias = int(loot.get("trias", 0) or 0)
    item_ids = tuple(loot.get("items", ()) or ())
    parts = []
    if trias:
        parts.append(f"{trias} trias")
    if item_ids:
        parts.append(", ".join(item_ids))
    if not parts:
        return "You find no usable loot."
    return "You recover " + " and ".join(parts) + "."


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
    ensure_combat_pressure(character)
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
        stop_combat_pressure(character)
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
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    damage = maneuver_damage(character, "jab")
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 1
    skill_events = apply_combat_skill_gain(character, "small_edged")
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [f"You jab {enemy['name']} for {damage} damage. {enemy['name']} collapses.", *skill_events, loot_text]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    pressure = apply_enemy_retaliation(character, enemy)
    parts = [f"You jab {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.", *skill_events, pressure]
    return "\n".join(parts)


def bash(character):
    ensure_engagement(character)
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Bash what? Target an enemy first."
    if engagement.get("range") != "melee":
        return "You need to be at melee range to bash."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    enemy_obj = find_enemy_object(character.location, target_id)
    if not enemy_obj:
        character.db.engagement = {"target": None, "range": None}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    damage = maneuver_damage(character, "bash")
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 2
    skill_events = apply_combat_skill_gain(character, "brawling")
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [f"You bash {enemy['name']} for {damage} damage. {enemy['name']} collapses.", *skill_events, loot_text]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    pressure = apply_enemy_retaliation(character, enemy)
    parts = [f"You bash {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.", *skill_events, pressure]
    return "\n".join(parts)


def stance(character, requested):
    ensure_engagement(character)
    requested = (requested or "").strip().lower()
    if not requested:
        return f"Your stance is {character.db.stance} and your balance is {character.db.balance}."
    if requested not in STANCES:
        return f'Unknown stance "{requested}". Stances: {", ".join(STANCES)}.'
    character.db.stance = requested
    return f"You settle into a {requested} stance."


def defend(character):
    ensure_engagement(character)
    character.db.stance = "defensive"
    character.db.balance = "balanced"
    character.db.roundtime = 0
    return "You set your feet, raise your guard, and recover your balance."


def flee(character):
    ensure_engagement(character)
    engagement = dict(character.db.engagement or {})
    if not engagement.get("target"):
        return "You are not engaged."
    character.db.engagement = {"target": None, "range": None}
    character.db.balance = "recovering"
    character.db.roundtime = 1
    stop_combat_pressure(character)
    return "You break away from combat and flee to missile range."


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
