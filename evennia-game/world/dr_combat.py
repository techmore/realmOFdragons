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
    "rv-ditch-rat": {
        "name": "Ditch Rat",
        "vitality": 10,
        "aggression": "nipping",
        "description": "A muddy rat darts between roots and broken stones.",
        "loot": {"trias": 2, "items": ("travel_rations",)},
    },
    "rv-reed-snake": {
        "name": "Reed Snake",
        "vitality": 16,
        "aggression": "coiled",
        "description": "A thin snake coils beneath reeds and strikes at careless ankles.",
        "loot": {"trias": 3, "items": ("field_bandage",)},
    },
    "rv-marsh-spider": {
        "name": "Marsh Spider",
        "vitality": 18,
        "aggression": "skittering",
        "description": "A hand-sized spider skitters over wet silt and broken reeds.",
        "loot": {"trias": 4, "items": ("wild_herbs",)},
    },
    "rv-orchard-crow": {
        "name": "Orchard Crow",
        "vitality": 13,
        "aggression": "sharp-eyed",
        "description": "A black crow hops between fallen fruit and snaps at anything too close.",
        "loot": {"trias": 2, "items": ("wild_herbs",)},
    },
    "rv-canal-newt": {
        "name": "Canal Newt",
        "vitality": 15,
        "aggression": "slippery",
        "description": "A slick canal newt slips through shallow pools and snaps at moving fingers.",
        "loot": {"trias": 3, "items": ("field_bandage",)},
    },
    "rv-lockwork-crab": {
        "name": "Lockwork Crab",
        "vitality": 17,
        "aggression": "clacking",
        "description": "A hard-shelled crab clacks through broken lock stones and guards a shallow pool.",
        "loot": {"trias": 4, "items": ("rough_pelt",)},
    },
    "rv-sluice-rat": {
        "name": "Sluice Rat",
        "vitality": 19,
        "aggression": "waterlogged",
        "description": "A heavy canal rat drags wet rope scraps through the sluice yard and snaps at boots.",
        "loot": {"trias": 5, "items": ("field_bandage",)},
    },
    "rv-spillway-eel": {
        "name": "Spillway Eel",
        "vitality": 20,
        "aggression": "slippery",
        "description": "A dark eel twists through spillway runoff and lashes at movement near the steps.",
        "loot": {"trias": 5, "items": ("wild_herbs",)},
    },
    "rv-weir-otter": {
        "name": "Weir Otter",
        "vitality": 21,
        "aggression": "clever",
        "description": "A sleek otter darts along the weir timbers and snaps with surprising force.",
        "loot": {"trias": 5, "items": ("field_bandage",)},
    },
    "rv-bank-mink": {
        "name": "Bank Mink",
        "vitality": 16,
        "aggression": "quick",
        "description": "A narrow mink slips along the canal bank, watching hands and packs for openings.",
        "loot": {"trias": 4, "items": ("wild_herbs",)},
    },
    "rv-reed-heron": {
        "name": "Reed Heron",
        "vitality": 18,
        "aggression": "stabbing",
        "description": "A tall heron stalks the reed blind and jabs its beak at anything that crowds the mud.",
        "loot": {"trias": 4, "items": ("field_bandage",)},
    },
    "rv-causeway-turtle": {
        "name": "Causeway Turtle",
        "vitality": 22,
        "aggression": "stubborn",
        "description": "A broad turtle scrapes through fallen reeds and snaps at boots that step too close.",
        "loot": {"trias": 5, "items": ("rough_pelt",)},
    },
}

RANGES = ("missile", "pole", "melee")
STANCES = ("balanced", "offensive", "defensive")
PRESSURE_SCRIPT_MARKER = "dr_combat_pressure"
RECOVERY_SCRIPT_MARKER = "dr_recovery"
BLEEDING_SCRIPT_MARKER = "dr_bleeding"


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


def enemy_difficulty(enemy_id):
    enemy = ENEMIES.get(enemy_id, {})
    vitality = int(enemy.get("vitality", 0) or 0)
    if vitality <= 14:
        return "easy"
    if vitality <= 18:
        return "fair"
    return "sturdy"


def engagement_suggestion(character, enemy_id=None):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "Suggested next command: revive."
    if int(character.db.roundtime or 0) > 0:
        return "Suggested next command: wait."
    if character.db.bleeding:
        inventory = tuple(character.db.inventory or ())
        if "field_bandage" in inventory:
            return "Suggested next command: use field_bandage."
        return "Suggested next command: retreat and buy field_bandage."

    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target") or enemy_id
    range_band = engagement.get("range") if engagement.get("target") == target_id else None
    if not target_id:
        return "Suggested next command: scan."
    if not range_band:
        return f"Suggested next command: target {target_id}."
    if range_band != "melee":
        return "Suggested next command: advance."
    return "Suggested next command: jab or bash."


def scan_room(room):
    enemy_ids = room_enemy_ids(room)
    if not enemy_ids:
        return "You scan the area and find no immediate threats."
    lines = ["You scan the area:"]
    for enemy_id in enemy_ids:
        enemy = ENEMIES.get(enemy_id, {"name": enemy_id, "aggression": "unknown"})
        lines.append(
            f"- {enemy['name']} ({enemy_id}), {enemy['aggression']}, {enemy_difficulty(enemy_id)} difficulty."
        )
    lines.append("Suggested next command: appraise <enemy id> or target <enemy id>.")
    return "\n".join(lines)


def appraise_enemy(character, requested_enemy=""):
    """Return a command-first enemy readout for scan/target/combat decisions."""

    ensure_engagement(character)
    requested_enemy = (requested_enemy or "").strip().lower()
    engagement = dict(character.db.engagement or {})
    enemy_id = requested_enemy
    if requested_enemy in ("", "target", "enemy"):
        enemy_id = engagement.get("target")
    if not enemy_id:
        return "Appraise what? Use `appraise <enemy id>` or target an enemy first."

    enemy = ENEMIES.get(enemy_id)
    enemy_obj = find_enemy_object(character.location, enemy_id)
    if not enemy or not enemy_obj:
        return f'You do not see "{enemy_id}" here.'

    current_vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 0) or 0)
    max_vitality = int(enemy.get("vitality", current_vitality) or current_vitality)
    range_band = engagement.get("range") if engagement.get("target") == enemy_id else "unengaged"
    loot = enemy.get("loot", {})
    loot_items = ", ".join(loot.get("items", ()) or ()) or "none"
    return "\n".join(
        [
            f"{enemy['name']} ({enemy_id})",
            f"Vitality: {current_vitality}/{max_vitality}. Aggression: {enemy['aggression']}.",
            f"Range: {range_band}.",
            f"Loot signs: {int(loot.get('trias', 0) or 0)} trias, items: {loot_items}.",
            f"Difficulty: {enemy_difficulty(enemy_id)}.",
            enemy["description"],
            engagement_suggestion(character, enemy_id),
        ]
    )


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
    if character.db.incapacitated is None:
        character.db.incapacitated = False
    if character.db.bleeding is None:
        character.db.bleeding = False


def health_text(character):
    ensure_engagement(character)
    condition = "incapacitated" if character.db.incapacitated else "standing"
    bleeding = "bleeding" if character.db.bleeding else "not bleeding"
    return f"Health: {character.db.health}/{character.db.max_health}. Balance: {character.db.balance}. Stance: {character.db.stance}. Condition: {condition}. Wounds: {bleeding}."


def combat_status(character):
    """Return a concise combat prompt/status block."""

    ensure_engagement(character)
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    lines = [
        f"Health: {character.db.health}/{character.db.max_health}.",
        f"Balance: {character.db.balance}. Roundtime: {character.db.roundtime}. Stance: {character.db.stance}.",
        f"Condition: {'incapacitated' if character.db.incapacitated else 'standing'}.",
        f"Wounds: {'bleeding' if character.db.bleeding else 'not bleeding'}.",
    ]
    if not target_id:
        lines.append("Engagement: none.")
        lines.append(engagement_suggestion(character))
        return "\n".join(lines)
    enemy = ENEMIES.get(target_id, {"name": target_id})
    enemy_obj = find_enemy_object(character.location, target_id)
    if not enemy_obj:
        lines.append(f"Engagement: {enemy['name']} is gone.")
        lines.append("Suggested next command: scan.")
        return "\n".join(lines)
    lines.append(f"Engagement: {enemy['name']} at {engagement.get('range') or 'unknown'} range.")
    if engagement.get("aimed"):
        lines.append("Aim: set for your next ranged attack.")
    if engagement.get("feinted"):
        lines.append("Feint: set for your next melee attack.")
    lines.append(f"Enemy vitality: {int(enemy_obj.db.vitality or 0)}/{int(enemy.get('vitality', 0) or 0)}.")
    lines.append(engagement_suggestion(character))
    return "\n".join(lines)


def maneuver_guide(character):
    """Return command-first combat options for the current range and state."""

    ensure_engagement(character)
    if character.db.incapacitated:
        return "\n".join(
            [
                "Combat maneuvers:",
                "State: incapacitated.",
                "- revive / stand: recover enough to act.",
                "- rest: also recovers from incapacitation.",
            ]
        )

    lines = ["Combat maneuvers:"]
    roundtime = int(character.db.roundtime or 0)
    if roundtime > 0:
        lines.append(f"Recovery: wait / recover for {roundtime} pulse before another maneuver.")
    if character.db.bleeding:
        inventory = tuple(character.db.inventory or ())
        if "field_bandage" in inventory:
            lines.append("Wounds: use field_bandage or tend to stop bleeding.")
        else:
            lines.append("Wounds: retreat, buy field_bandage, then tend.")

    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    range_band = engagement.get("range")
    if not target_id:
        lines.extend(
            [
                "Target: none.",
                "- scan: find enemies in this room.",
                "- appraise <enemy id>: read vitality, loot signs, difficulty, and range.",
                "- target <enemy id>: start combat at missile range.",
                "- combat / prompt: show health, balance, roundtime, and engagement.",
            ]
        )
        return "\n".join(lines)

    enemy = ENEMIES.get(target_id, {"name": target_id})
    lines.append(f"Target: {enemy['name']} at {range_band or 'unknown'} range.")
    lines.append("- range: show the current engagement band.")
    lines.append("- stance balanced/offensive/defensive: tune damage and incoming pressure.")

    if range_band == "missile":
        lines.extend(
            [
                "- aim: set up a stronger hurl or shot.",
                "- shoot / fire: spend practice_arrows for a bow-style ranged attack.",
                "- hurl / throw: attack now from range.",
                "- advance: close to pole range.",
                "- retreat: break engagement from missile range.",
            ]
        )
    elif range_band == "pole":
        lines.extend(
            [
                "- aim: set up a stronger hurl or shot before the enemy is fully close.",
                "- shoot / fire: spend practice_arrows at close range, but expect pressure.",
                "- hurl / throw: attack from pole range, but expect close pressure.",
                "- advance: close to melee range for jab, bash, feint, and defenses.",
                "- retreat: step back to missile range.",
            ]
        )
    elif range_band == "melee":
        lines.extend(
            [
                "- feint / fake: set up the next jab, kick, or bash.",
                "- jab / attack: fast melee strike.",
                "- kick: brawling strike with moderate roundtime.",
                "- bash: heavier melee strike.",
                "- dodge / evade: avoid the next close pressure.",
                "- parry: turn aside pressure with a held weapon.",
                "- block / shield block: stop pressure with a shield.",
                "- defend: recover balance and set defensive stance.",
                "- flee: break engagement with roundtime.",
            ]
        )
    else:
        lines.append("- advance or retreat: recover a known range band.")

    if engagement.get("aimed"):
        lines.append("Set state: aim is ready; your next hurl or shot is stronger.")
    if engagement.get("feinted"):
        lines.append("Set state: feint is ready; your next jab, kick, or bash is stronger.")
    if character.db.balance == "dodging":
        lines.append("Defensive state: ready to dodge the next close pressure.")
    if character.db.balance == "parrying":
        lines.append("Defensive state: ready to parry the next close pressure.")
    if character.db.balance == "blocking":
        lines.append("Defensive state: ready to block the next close pressure.")

    hands = dict(character.db.hands or {})
    worn = list((character.db.equipment or {}).get("worn", []))
    held_weapon_id = hands.get("right") or hands.get("left")
    held_weapon = ITEMS.get(held_weapon_id or "")
    if range_band == "melee" and (not held_weapon or held_weapon.get("slot") not in ("right", "held")):
        lines.append("Equipment hint: wield small_blade before using parry.")
    has_shield = hands.get("left") == "leather_shield" or hands.get("right") == "leather_shield" or "leather_shield" in worn
    if range_band == "melee" and not has_shield:
        lines.append("Equipment hint: wear or wield leather_shield before using block.")

    lines.append("Use combat / prompt for health, enemy vitality, and the suggested next command.")
    return "\n".join(lines)


def maneuver_status_text(character):
    return "Combat state:\n" + combat_status(character)


def retaliation_damage(character):
    if character.db.balance == "dodging":
        character.db.balance = "balanced"
        return 0
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
    if maneuver == "kick":
        return 6 + attribute_value(character, "agility") // 6 + skill_rank(character, "brawling") // 10
    if maneuver == "hurl":
        return 3 + attribute_value(character, "agility") // 6 + skill_rank(character, "light_thrown") // 10
    if maneuver == "shoot":
        return 4 + attribute_value(character, "reflex") // 6 + skill_rank(character, "bows") // 10 + skill_rank(character, "missile_mastery") // 12
    return 1


def apply_combat_skill_gain(character, skill_id):
    skills = character.db.skills or build_starter_skills()
    events = apply_skill_pool_gain(skills, skill_id, 2)
    events.extend(apply_skill_pool_gain(skills, "tactics", 1))
    character.db.skills = skills
    return events


def apply_enemy_retaliation(character, enemy):
    if character.db.balance == "blocking":
        character.db.balance = "balanced"
        return f"You block {enemy['name']}'s pressure with your shield."
    if character.db.balance == "parrying":
        character.db.balance = "balanced"
        return f"You parry {enemy['name']}'s pressure aside with your weapon."
    damage = retaliation_damage(character)
    if damage <= 0:
        return f"You dodge {enemy['name']}'s pressure and avoid the hit."
    health = max(0, int(character.db.health or 0) - damage)
    character.db.health = health
    if damage >= 2:
        character.db.bleeding = True
        ensure_bleeding(character)
    if health <= 0:
        character.db.incapacitated = True
        character.db.engagement = {"target": None, "range": None}
        character.db.balance = "fallen"
        character.db.roundtime = 0
        stop_combat_pressure(character)
        return f"{enemy['name']} presses back for {damage} damage. You collapse, incapacitated."
    wound_text = " You are bleeding." if character.db.bleeding else ""
    return f"{enemy['name']} presses back for {damage} damage. You have {health} health remaining.{wound_text}"


def apply_enemy_pressure(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        stop_combat_pressure(character)
        return "No enemy pressure: you are incapacitated."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    range_band = engagement.get("range")
    if not target_id:
        return "No enemy pressure: not engaged."
    if not engagement.get("pressure_ready"):
        engagement["pressure_ready"] = True
        character.db.engagement = engagement
        return "Enemy pressure gathers at range."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    if not find_enemy_object(character.location, target_id):
        character.db.engagement = {"target": None, "range": None}
        stop_combat_pressure(character)
        return f"No enemy pressure: {enemy['name']} is gone."
    if range_band == "missile":
        engagement["range"] = "pole"
        character.db.engagement = engagement
        return f"{enemy['name']} closes from missile to pole range."
    if range_band == "pole":
        engagement["range"] = "melee"
        character.db.engagement = engagement
        return f"{enemy['name']} closes from pole to melee range."
    if range_band != "melee":
        return "No enemy pressure: target is at an unknown range."
    return apply_enemy_retaliation(character, enemy)


def combat_pressure_scripts(character):
    return [
        script
        for script in character.scripts.all()
        if script.db.script_marker == PRESSURE_SCRIPT_MARKER
    ]


def bleeding_scripts(character):
    return [
        script
        for script in character.scripts.all()
        if script.db.script_marker == BLEEDING_SCRIPT_MARKER
    ]


def ensure_bleeding(character):
    scripts = bleeding_scripts(character)
    if scripts:
        return scripts[0]
    script = create_script("typeclasses.scripts.BleedingScript", obj=character)
    script.db.script_marker = BLEEDING_SCRIPT_MARKER
    return script


def stop_bleeding(character):
    character.db.bleeding = False
    for script in bleeding_scripts(character):
        script.stop()
        script.delete()


def apply_bleeding_tick(character):
    ensure_engagement(character)
    if not character.db.bleeding:
        stop_bleeding(character)
        return "No bleeding: wounds are stable."
    health = max(0, int(character.db.health or 0) - 1)
    character.db.health = health
    if health <= 0:
        character.db.incapacitated = True
        character.db.engagement = {"target": None, "range": None}
        character.db.balance = "fallen"
        character.db.roundtime = 0
        stop_combat_pressure(character)
        stop_bleeding(character)
        return "Bleeding overwhelms you. You collapse, incapacitated."
    return f"You lose 1 health to bleeding. You have {health} health remaining."


def ensure_combat_pressure(character):
    scripts = combat_pressure_scripts(character)
    if scripts:
        return scripts[0]
    script = create_script("typeclasses.scripts.CombatPressureScript", obj=character)
    script.db.script_marker = PRESSURE_SCRIPT_MARKER
    return script


def recovery_scripts(character):
    return [
        script
        for script in character.scripts.all()
        if script.db.script_marker == RECOVERY_SCRIPT_MARKER
    ]


def ensure_recovery(character):
    scripts = recovery_scripts(character)
    if scripts:
        return scripts[0]
    script = create_script("typeclasses.scripts.RecoveryScript", obj=character, start_delay=True)
    script.db.script_marker = RECOVERY_SCRIPT_MARKER
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
    corpse.db.skinned = False
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


def skin_corpse(character):
    corpses = corpse_objects(character.location)
    if not corpses:
        return "There is no corpse here to skin."
    corpse = corpses[0]
    if corpse.db.skinned:
        return f"The {corpse.db.enemy_name or 'corpse'} has already been skinned."
    pelt = ITEMS["rough_pelt"]
    pelt_obj = create_object(
        "typeclasses.objects.Item",
        key=pelt["name"],
        location=character.location,
        home=character.location,
    )
    pelt_obj.db.item_id = "rough_pelt"
    pelt_obj.db.desc = pelt["description"]
    pelt_obj.save()
    corpse.db.skinned = True
    skills = character.db.skills or build_starter_skills()
    events = apply_skill_pool_gain(skills, "skinning", 3)
    events.extend(apply_skill_pool_gain(skills, "outdoorsmanship", 1))
    character.db.skills = skills
    lines = [f"You skin the {corpse.db.enemy_name or 'corpse'} and prepare a rough_pelt."]
    lines.extend(events)
    lines.append("Suggested next command: get rough_pelt or loot corpse.")
    return "\n".join(lines)


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
    if character.db.incapacitated:
        return "You are incapacitated and cannot target enemies."
    enemy_id = (enemy_id or "").strip().lower()
    if not enemy_id:
        return "Target what?"
    if enemy_id not in room_enemy_ids(character.location):
        return f'You do not see "{enemy_id}" here.'
    enemy = ENEMIES.get(enemy_id)
    if not enemy:
        return f'Unknown enemy "{enemy_id}".'
    character.db.engagement = {"target": enemy_id, "range": "missile", "aimed": False, "feinted": False, "pressure_ready": False}
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
    aimed = " Aim is set." if engagement.get("aimed") else ""
    feinted = " Feint is set." if engagement.get("feinted") else ""
    return f"You are engaged with {enemy['name']} at {range_band or 'unknown'} range.{aimed}{feinted}"


def aim(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot aim."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Aim at what? Target an enemy first."
    if engagement.get("range") not in ("missile", "pole"):
        return "You need missile or pole range to aim."
    enemy = ENEMIES.get(target_id, {"name": target_id})
    if not find_enemy_object(character.location, target_id):
        character.db.engagement = {"target": None, "range": None, "aimed": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."
    engagement["aimed"] = True
    character.db.engagement = engagement
    character.db.balance = "aiming"
    character.db.roundtime = 1
    ensure_recovery(character)
    return f"You take careful aim at {enemy['name']}. Your next hurl or shot will strike harder."


def feint(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot feint."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Feint at what? Target an enemy first."
    if engagement.get("range") != "melee":
        return "You need melee range to feint."
    enemy = ENEMIES.get(target_id, {"name": target_id})
    if not find_enemy_object(character.location, target_id):
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."
    engagement["feinted"] = True
    character.db.engagement = engagement
    character.db.balance = "feinting"
    character.db.roundtime = 1
    ensure_recovery(character)
    skills = character.db.skills or build_starter_skills()
    skill_events = apply_skill_pool_gain(skills, "tactics", 2)
    character.db.skills = skills
    lines = [
        f"You feint at {enemy['name']}, opening a line for your next melee strike.",
        *skill_events,
        "Your next jab, kick, or bash will strike harder.",
    ]
    return "\n".join(lines)


def advance(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot advance."
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
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return "You retreat and break engagement."
    next_range = RANGES[RANGES.index(current) - 1]
    engagement["range"] = next_range
    character.db.engagement = engagement
    enemy = ENEMIES.get(target_id, {"name": target_id})
    return f"You retreat from {enemy['name']} to {next_range} range."


def jab(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot attack."
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
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    feinted = bool(engagement.get("feinted"))
    damage = maneuver_damage(character, "jab") + (1 if feinted else 0)
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 1
    ensure_recovery(character)
    if feinted:
        engagement["feinted"] = False
        character.db.engagement = engagement
    skill_events = apply_combat_skill_gain(character, "small_edged")
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [
            f"You jab {enemy['name']} for {damage} damage. {enemy['name']} collapses.",
            *skill_events,
            loot_text,
            "Suggested next command: loot corpse.",
        ]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    pressure = apply_enemy_retaliation(character, enemy)
    parts = [
        f"You jab {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.",
        *skill_events,
        pressure,
        maneuver_status_text(character),
    ]
    if feinted:
        parts.insert(1, "Your feint opens the strike.")
    return "\n".join(parts)


def bash(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot attack."
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
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    feinted = bool(engagement.get("feinted"))
    damage = maneuver_damage(character, "bash") + (1 if feinted else 0)
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 2
    ensure_recovery(character)
    if feinted:
        engagement["feinted"] = False
        character.db.engagement = engagement
    skill_events = apply_combat_skill_gain(character, "brawling")
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [
            f"You bash {enemy['name']} for {damage} damage. {enemy['name']} collapses.",
            *skill_events,
            loot_text,
            "Suggested next command: loot corpse.",
        ]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    pressure = apply_enemy_retaliation(character, enemy)
    parts = [
        f"You bash {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.",
        *skill_events,
        pressure,
        maneuver_status_text(character),
    ]
    if feinted:
        parts.insert(1, "Your feint opens the strike.")
    return "\n".join(parts)


def kick(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot kick."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Kick what? Target an enemy first."
    if engagement.get("range") != "melee":
        return "You need to be at melee range to kick."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    enemy_obj = find_enemy_object(character.location, target_id)
    if not enemy_obj:
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    feinted = bool(engagement.get("feinted"))
    damage = maneuver_damage(character, "kick") + (1 if feinted else 0)
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 1
    ensure_recovery(character)
    if feinted:
        engagement["feinted"] = False
        character.db.engagement = engagement
    skill_events = apply_combat_skill_gain(character, "brawling")
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [
            f"You kick {enemy['name']} for {damage} damage. {enemy['name']} collapses.",
            *skill_events,
            loot_text,
            "Suggested next command: loot corpse.",
        ]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    pressure = apply_enemy_retaliation(character, enemy)
    parts = [
        f"You kick {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.",
        *skill_events,
        pressure,
        maneuver_status_text(character),
    ]
    if feinted:
        parts.insert(1, "Your feint opens the strike.")
    return "\n".join(parts)


def hurl(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot hurl."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Hurl at what? Target an enemy first."
    if engagement.get("range") not in ("missile", "pole"):
        return "You need missile or pole range to hurl."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    enemy_obj = find_enemy_object(character.location, target_id)
    if not enemy_obj:
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    aimed = bool(engagement.get("aimed"))
    damage = maneuver_damage(character, "hurl") + (2 if aimed else 0)
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 1
    ensure_recovery(character)
    engagement["aimed"] = False
    character.db.engagement = engagement
    skill_events = apply_combat_skill_gain(character, "light_thrown")
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [
            f"You hurl at {enemy['name']} for {damage} damage. {enemy['name']} collapses.",
            *skill_events,
            loot_text,
            "Suggested next command: loot corpse.",
        ]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    parts = [
        f"You hurl at {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.",
        *skill_events,
    ]
    if aimed:
        parts.append("Your careful aim adds force to the throw.")
    if engagement.get("range") == "pole":
        parts.append(apply_enemy_retaliation(character, enemy))
    else:
        parts.append(f"{enemy['name']} is still too far away to press back.")
    parts.append(maneuver_status_text(character))
    return "\n".join(parts)


def consume_carried_item(character, item_id):
    inventory = list(character.db.inventory or [])
    if item_id not in inventory:
        return False
    inventory.remove(item_id)
    character.db.inventory = inventory
    for obj in list(character.contents):
        if obj.db.object_type == "item" and obj.db.item_id == item_id:
            obj.delete()
            break
    return True


def shoot(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot shoot."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    target_id = engagement.get("target")
    if not target_id:
        return "Shoot at what? Target an enemy first."
    if engagement.get("range") not in ("missile", "pole"):
        return "You need missile or pole range to shoot."
    if "practice_arrows" not in tuple(character.db.inventory or ()):
        return "You need practice_arrows in your pack to shoot."

    enemy = ENEMIES.get(target_id, {"name": target_id})
    enemy_obj = find_enemy_object(character.location, target_id)
    if not enemy_obj:
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        return f"{enemy['name']} is no longer here."

    consume_carried_item(character, "practice_arrows")
    aimed = bool(engagement.get("aimed"))
    damage = maneuver_damage(character, "shoot") + (2 if aimed else 0)
    vitality = int(enemy_obj.db.vitality or enemy.get("vitality", 1)) - damage
    character.db.balance = "recovering"
    character.db.roundtime = 1
    ensure_recovery(character)
    engagement["aimed"] = False
    character.db.engagement = engagement
    skill_events = apply_combat_skill_gain(character, "bows")
    skill_events.extend(apply_skill_pool_gain(character.db.skills, "missile_mastery", 1))
    if vitality <= 0:
        enemy_obj.delete()
        create_corpse(character.location, target_id, enemy)
        character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
        stop_combat_pressure(character)
        loot_text = loot_preview(enemy)
        parts = [
            f"You shoot {enemy['name']} for {damage} damage. {enemy['name']} collapses.",
            *skill_events,
            loot_text,
            "Suggested next command: loot corpse.",
        ]
        return "\n".join(parts)

    enemy_obj.db.vitality = vitality
    parts = [
        f"You shoot {enemy['name']} for {damage} damage. It has {vitality} vitality remaining.",
        *skill_events,
        "You spend a bundle of practice_arrows.",
    ]
    if aimed:
        parts.append("Your careful aim adds force to the shot.")
    if engagement.get("range") == "pole":
        parts.append(apply_enemy_retaliation(character, enemy))
    else:
        parts.append(f"{enemy['name']} is still too far away to press back.")
    parts.append(maneuver_status_text(character))
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
    if character.db.incapacitated:
        return "You are incapacitated and cannot defend."
    character.db.stance = "defensive"
    character.db.balance = "balanced"
    character.db.roundtime = 0
    return "You set your feet, raise your guard, and recover your balance."


def dodge(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot dodge."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    if not engagement.get("target"):
        return "Dodge what? Target an enemy first."
    character.db.stance = "defensive"
    character.db.balance = "dodging"
    character.db.roundtime = 1
    ensure_recovery(character)
    skill_events = apply_combat_skill_gain(character, "evasion")
    lines = [
        "You shift into motion, ready to dodge the next close press.",
        *skill_events,
        "The next enemy pressure against you is reduced if it reaches you.",
    ]
    return "\n".join(lines)


def parry(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot parry."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    if not engagement.get("target"):
        return "Parry what? Target an enemy first."
    hands = dict(character.db.hands or {})
    held_weapon_id = hands.get("right") or hands.get("left")
    held_weapon = ITEMS.get(held_weapon_id or "")
    if not held_weapon or held_weapon.get("slot") not in ("right", "held"):
        return "You need a held weapon to parry. Try `wield small_blade` first."
    character.db.stance = "defensive"
    character.db.balance = "parrying"
    character.db.roundtime = 1
    ensure_recovery(character)
    skill_events = apply_combat_skill_gain(character, "parry_ability")
    lines = [
        f"You set {held_weapon['name']} to parry the next close press.",
        *skill_events,
        "The next close enemy pressure against you can be turned aside.",
    ]
    return "\n".join(lines)


def block(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot block."
    if int(character.db.roundtime or 0) > 0:
        return f"You are still recovering for {character.db.roundtime} pulse."
    engagement = dict(character.db.engagement or {})
    if not engagement.get("target"):
        return "Block what? Target an enemy first."
    hands = dict(character.db.hands or {})
    worn = list((character.db.equipment or {}).get("worn", []))
    has_shield = hands.get("left") == "leather_shield" or hands.get("right") == "leather_shield" or "leather_shield" in worn
    if not has_shield:
        return "You need a shield held or worn to block. Try `wear leather_shield` or `wield leather_shield` first."
    character.db.stance = "defensive"
    character.db.balance = "blocking"
    character.db.roundtime = 1
    ensure_recovery(character)
    skill_events = apply_combat_skill_gain(character, "shield_usage")
    lines = [
        "You set your shield to block the next close press.",
        *skill_events,
        "The next close enemy pressure against you can be stopped by your shield.",
    ]
    return "\n".join(lines)


def flee(character):
    ensure_engagement(character)
    if character.db.incapacitated:
        return "You are incapacitated and cannot flee."
    engagement = dict(character.db.engagement or {})
    if not engagement.get("target"):
        return "You are not engaged."
    character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
    character.db.balance = "recovering"
    character.db.roundtime = 1
    ensure_recovery(character)
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


def revive(character):
    ensure_engagement(character)
    if not character.db.incapacitated:
        return "You are already standing."
    character.db.incapacitated = False
    character.db.health = max(1, int(character.db.max_health or 30) // 2)
    character.db.balance = "balanced"
    character.db.roundtime = 0
    character.db.engagement = {"target": None, "range": None, "aimed": False, "feinted": False}
    return f"You recover enough to stand. Health: {character.db.health}/{character.db.max_health}."


def rest(character):
    """Rest as a command-first recovery verb for roundtime or incapacitation."""

    ensure_engagement(character)
    if character.db.incapacitated:
        return revive(character)
    if int(character.db.roundtime or 0) > 0:
        return wait_recover(character)
    if int(character.db.health or 0) < int(character.db.max_health or 30):
        healed = min(3, int(character.db.max_health or 30) - int(character.db.health or 0))
        character.db.health = int(character.db.health or 0) + healed
        character.db.balance = "balanced"
        return f"You rest and recover {healed} health. Health: {character.db.health}/{character.db.max_health}."
    character.db.balance = "balanced"
    return "You rest, already balanced and healthy."
