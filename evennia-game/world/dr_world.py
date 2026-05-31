"""
Crossing room graph for the Evennia migration.
"""

from collections import deque

from evennia import create_object
from evennia.objects.models import ObjectDB

from world.dr_data import GUILDS, GUILD_PRIMARY_SKILLS, SKILLS
from world.dr_combat import ENEMIES
from world.dr_economy import FORAGE_ROOMS, SHOP_TASKS, SHOPS

START_ROOM_ID = "crossing-TG01-001"

DIRECTION_ALIASES = {
    "north": "n",
    "south": "s",
    "east": "e",
    "west": "w",
    "northeast": "ne",
    "northwest": "nw",
    "southeast": "se",
    "southwest": "sw",
    "up": "u",
    "down": "d",
}

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
        "exits": {"north": "crossing-RV01-001", "east": "crossing-RV02-002", "west": "crossing-RV02-009"},
    },
    "crossing-RV02-009": {
        "title": "Old Orchard Verge",
        "desc": "A neglected orchard edge leans over the trailhead, scattering fallen fruit and twig nests.",
        "exits": {"east": "crossing-RV02-001"},
        "targets": ("rv-orchard-crow",),
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
        "exits": {"west": "crossing-RV02-002", "east": "crossing-RV02-007"},
        "targets": ("rv-mud-beetle",),
    },
    "crossing-RV02-005": {
        "title": "Low Ridge Rabbit Run",
        "desc": "A low grassy ridge overlooks the outer brush and small animal tracks.",
        "exits": {"north": "crossing-RV02-003", "east": "crossing-RV02-006"},
        "targets": ("rv-ridge-hare",),
    },
    "crossing-RV02-006": {
        "title": "Root-Tangled Drainage",
        "desc": "A damp drainage cut winds through roots, stones, and discarded trail scraps.",
        "exits": {"west": "crossing-RV02-005"},
        "targets": ("rv-ditch-rat",),
    },
    "crossing-RV02-007": {
        "title": "Reed-Choked Culvert",
        "desc": "Tall reeds hide a stone culvert where shallow water carries scraps from the south road.",
        "exits": {"west": "crossing-RV02-004", "east": "crossing-RV02-008"},
        "targets": ("rv-reed-snake",),
    },
    "crossing-RV02-008": {
        "title": "Silted Canal Edge",
        "desc": "A slow canal edge gathers silt, broken reeds, and skittering shapes beyond the culvert.",
        "exits": {"west": "crossing-RV02-007", "east": "crossing-RV02-010"},
        "targets": ("rv-marsh-spider",),
    },
    "crossing-RV02-010": {
        "title": "Flooded Towpath",
        "desc": "A half-sunk towpath follows the old canal through slick stones, moss, and shallow pools.",
        "exits": {"west": "crossing-RV02-008", "south": "crossing-RV02-011"},
        "targets": ("rv-canal-newt",),
    },
    "crossing-RV02-011": {
        "title": "Ruined Lockworks",
        "desc": "Broken lock gates and algae-dark stonework mark an old water control point beyond the towpath.",
        "exits": {"north": "crossing-RV02-010", "east": "crossing-RV02-012"},
        "targets": ("rv-lockwork-crab",),
    },
    "crossing-RV02-012": {
        "title": "Canal Sluice Yard",
        "desc": "A narrow sluice yard collects old rope, damp crates, and quick movement under the canal wall.",
        "exits": {"west": "crossing-RV02-011", "east": "crossing-RV02-013"},
        "targets": ("rv-sluice-rat",),
    },
    "crossing-RV02-013": {
        "title": "Mossy Spillway Steps",
        "desc": "Slippery spillway steps descend beside green stone, tangled rope, and dark canal runoff.",
        "exits": {"west": "crossing-RV02-012"},
        "targets": ("rv-spillway-eel",),
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


def find_built_room(room_id):
    """Find an Evennia room by deterministic Crossing room id."""

    matches = ObjectDB.objects.filter(db_attributes__db_key="dr_room_id", db_attributes__db_value=room_id)
    for match in matches:
        if match.db.dr_room_id == room_id:
            return match
    return None


def hunting_guide(room):
    """Return command-first hunting ground guidance from the current room."""

    current_room_id = room.db.dr_room_id if room else START_ROOM_ID
    lines = ["Crossing hunting grounds:"]
    hunting_room_ids = [room_id for room_id, data in ROOMS.items() if data.get("targets")]
    for room_id in hunting_room_ids:
        data = ROOMS[room_id]
        path = find_path(current_room_id, room_id)
        if room_id == current_room_id:
            route = "here"
        elif path:
            route = "go " + ", ".join(path)
        else:
            route = "route unknown"
        targets = ", ".join(data.get("targets", ()))
        shop = SHOPS.get(room_id)
        forage = FORAGE_ROOMS.get(room_id)
        affordances = []
        if shop:
            affordances.append(f"shop: {shop['name']}")
        if forage:
            affordances.append(f"forage: {forage['item']}")
        extra = f" ({'; '.join(affordances)})" if affordances else ""
        lines.append(f"- {data['title']} ({room_id}): {targets}; {route}.{extra}")
    lines.append("Suggested loop: travel, survey, scan, appraise <enemy>, target <enemy>, advance, jab/bash, skin corpse, loot corpse.")
    return "\n".join(lines)


def shop_guide(room):
    """Return command-first shop and shop-task guidance from the current room."""

    current_room_id = room.db.dr_room_id if room else START_ROOM_ID
    lines = ["Crossing shops and tasks:"]
    for room_id, shop in SHOPS.items():
        path = find_path(current_room_id, room_id)
        if room_id == current_room_id:
            route = "here"
        elif path:
            route = "go " + ", ".join(path)
        else:
            route = "route unknown"
        stock = ", ".join(shop.get("stock", ())) or "nothing"
        task = SHOP_TASKS.get(room_id)
        task_text = f"; task: {task['name']} to {task['destination']}" if task else ""
        lines.append(f"- {shop['name']} ({room_id}, {shop['keeper']}): {stock}; {route}{task_text}.")
    lines.append("Suggested loop: travel, survey, shop, shop talk, shop stock, wallet, buy <item>, sell <item>, task request/status/complete.")
    return "\n".join(lines)


def task_guide(room):
    """Return command-first shop task guidance from the current room."""

    current_room_id = room.db.dr_room_id if room else START_ROOM_ID
    lines = ["Crossing shop tasks:"]
    for room_id, task in SHOP_TASKS.items():
        shop = SHOPS.get(room_id, {"name": room_id, "keeper": "shopkeeper"})
        destination_id = task["destination"]
        destination_shop = SHOPS.get(destination_id)
        destination_room = ROOMS.get(destination_id, {"title": destination_id})
        path = find_path(current_room_id, room_id)
        if room_id == current_room_id:
            route = "here"
        elif path:
            route = "go " + ", ".join(path)
        else:
            route = "route unknown"
        destination_text = destination_shop["name"] if destination_shop else destination_room["title"]
        lines.append(
            f"- {task['name']} from {shop['name']} ({room_id}, {shop['keeper']}): "
            f"reward {task['reward']} trias; {route}; deliver to {destination_text} ({destination_id})."
        )
    lines.append("Suggested loop: travel to a task shop, survey, task request, travel to destination, task status, task complete, wallet, experience.")
    return "\n".join(lines)


def guild_guide(room):
    """Return command-first guild registrar guidance from the current room."""

    current_room_id = room.db.dr_room_id if room else START_ROOM_ID
    lines = ["Crossing guild registrars:"]
    for guild_id, room_id in sorted(guild_registrar_rooms().items(), key=lambda item: GUILDS[item[0]]):
        path = find_path(current_room_id, room_id)
        if room_id == current_room_id:
            route = "here"
        elif path:
            route = "go " + ", ".join(path)
        else:
            route = "route unknown"
        primary_skill_id = GUILD_PRIMARY_SKILLS.get(guild_id, "athletics")
        primary_skill_name = SKILLS.get(primary_skill_id, primary_skill_id)
        lines.append(f"- {GUILDS[guild_id]} ({room_id}): primary {primary_skill_name}; {route}.")
    lines.append("Suggested loop: travel to a registrar, survey, registrar, join guild, guild path, train, circle status, circle.")
    return "\n".join(lines)


def forage_guide(room):
    """Return command-first forage guidance from the current room."""

    current_room_id = room.db.dr_room_id if room else START_ROOM_ID
    lines = ["Crossing forage sites:"]
    for room_id, forage in FORAGE_ROOMS.items():
        room_data = ROOMS.get(room_id, {"title": room_id})
        path = find_path(current_room_id, room_id)
        if room_id == current_room_id:
            route = "here"
        elif path:
            route = "go " + ", ".join(path)
        else:
            route = "route unknown"
        shop = SHOPS.get(room_id)
        shop_text = f"; nearby shop: {shop['name']}" if shop else ""
        lines.append(f"- {room_data['title']} ({room_id}): {forage['item']}; {route}{shop_text}.")
    lines.append("Suggested loop: travel, survey, forage, get wild_herbs, appraise wild_herbs, shops, sell wild_herbs.")
    return "\n".join(lines)


def survey_room(room, viewer=None):
    """Return command-first room affordances for movement, shops, guilds, forage, and targets."""

    if not room:
        return "You are nowhere."

    room_id = room.db.dr_room_id or "unknown"
    lines = [
        f"Survey: {room.key}",
        f"Room ID: {room_id}.",
    ]

    exits = []
    for exit_obj in sorted(room.exits, key=lambda candidate: candidate.key):
        alias = DIRECTION_ALIASES.get(exit_obj.key)
        exits.append(f"{exit_obj.key} ({alias})" if alias else exit_obj.key)
    lines.append("Exits: " + (", ".join(exits) if exits else "none."))

    guild_id = room.db.guild
    if guild_id:
        lines.append(f"Guild registrar: {GUILDS.get(guild_id, guild_id)}. Commands: registrar, join guild, train, circle.")
    else:
        lines.append("Guild registrar: none.")

    shop = SHOPS.get(room_id)
    if shop:
        lines.append(f"Shop: {shop['name']} ({shop['keeper']}). Commands: shop, shop talk, shop stock, buy, sell.")
        if room_id in SHOP_TASKS:
            task = SHOP_TASKS[room_id]
            lines.append(f"Shop task: {task['name']} to {task['destination']}. Command: task request.")
    else:
        lines.append("Shop: none.")

    forage = FORAGE_ROOMS.get(room_id)
    if forage:
        lines.append(f"Forage: {forage['item']}. Command: forage.")
    else:
        lines.append("Forage: none.")

    targets = tuple(room.db.targets or ())
    if targets:
        lines.append("Enemies: " + ", ".join(targets) + ". Commands: scan, appraise <enemy>, target <enemy>.")
    else:
        lines.append("Enemies: none.")

    visible = [
        obj.key
        for obj in room.contents
        if obj is not viewer and not obj.destination and not obj.db.enemy_id
    ]
    if visible:
        lines.append("Visible objects: " + ", ".join(sorted(visible)) + ". Command: get <item>.")
    return "\n".join(lines)


def build_crossing_world():
    """
    Create or update Crossing Room/Exit objects from ROOMS.

    This function is intentionally idempotent so builders and tests can rerun it
    safely while the data model is still evolving.
    """

    errors = validate_world_graph()
    if errors:
        return {"ok": False, "created_rooms": 0, "updated_rooms": 0, "created_exits": 0, "updated_exits": 0, "errors": errors}

    room_objects = {}
    created_rooms = 0
    updated_rooms = 0
    for room_id, data in ROOMS.items():
        room = find_built_room(room_id)
        if room:
            updated_rooms += 1
        else:
            room = create_object("typeclasses.rooms.Room", key=data["title"], aliases=[room_id])
            created_rooms += 1
        room.key = data["title"]
        room.db.desc = data["desc"]
        room.db.dr_room_id = room_id
        room.db.guild = data.get("guild")
        room.db.targets = tuple(data.get("targets", ()))
        room.db.shop = SHOPS.get(room_id)
        if room.db.shop:
            if room.db.shop_stock is None:
                room.db.shop_stock = tuple(room.db.shop["stock"])
            if room.db.shop_last_refresh is None:
                room.db.shop_last_refresh = "builder"
        if room_id not in room.aliases.all():
            room.aliases.add(room_id)
        room.save()
        room_objects[room_id] = room

    created_exits = 0
    updated_exits = 0
    for room_id, data in ROOMS.items():
        room = room_objects[room_id]
        wanted_exit_ids = set()
        for direction, destination_id in data.get("exits", {}).items():
            exit_id = f"{room_id}:{direction}"
            wanted_exit_ids.add(exit_id)
            destination = room_objects[destination_id]
            exit_obj = None
            for existing in room.exits:
                if existing.db.dr_exit_id == exit_id:
                    exit_obj = existing
                    break
            if exit_obj:
                updated_exits += 1
            else:
                exit_obj = create_object(
                    "typeclasses.exits.Exit",
                    key=direction,
                    location=room,
                    destination=destination,
                    aliases=[exit_id],
                )
                created_exits += 1
            exit_obj.key = direction
            exit_obj.destination = destination
            exit_obj.db.dr_exit_id = exit_id
            exit_obj.db.dr_room_id = room_id
            exit_obj.db.dr_destination_room_id = destination_id
            if exit_id not in exit_obj.aliases.all():
                exit_obj.aliases.add(exit_id)
            direction_alias = DIRECTION_ALIASES.get(direction)
            if direction_alias and direction_alias not in exit_obj.aliases.all():
                exit_obj.aliases.add(direction_alias)
            exit_obj.save()

        for existing in list(room.exits):
            if existing.db.dr_exit_id and existing.db.dr_exit_id not in wanted_exit_ids:
                existing.delete()

    created_npcs = 0
    updated_npcs = 0
    for room_id, shop in SHOPS.items():
        room = room_objects.get(room_id)
        if not room:
            continue
        shopkeepers = [
            obj
            for obj in room.contents
            if obj.db.npc_type == "shopkeeper" and obj.db.shop_room_id == room_id
        ]
        if shopkeepers:
            shopkeeper = shopkeepers[0]
            updated_npcs += 1
        else:
            shopkeeper = create_object(
                "typeclasses.npcs.Shopkeeper",
                key=shop["keeper"],
                location=room,
                home=room,
            )
            created_npcs += 1
        shopkeeper.key = shop["keeper"]
        shopkeeper.db.shop_name = shop["name"]
        shopkeeper.db.shop_room_id = room_id
        shopkeeper.db.dialogue = shop["dialogue"]
        shopkeeper.save()

    created_enemies = 0
    updated_enemies = 0
    created_respawn_scripts = 0
    updated_respawn_scripts = 0
    for room_id, data in ROOMS.items():
        room = room_objects[room_id]
        for enemy_id in data.get("targets", ()):
            enemy = ENEMIES.get(enemy_id)
            if not enemy:
                continue
            matches = [
                obj
                for obj in room.contents
                if obj.db.npc_type == "enemy" and obj.db.enemy_id == enemy_id
            ]
            if matches:
                enemy_obj = matches[0]
                updated_enemies += 1
            else:
                enemy_obj = create_object(
                    "typeclasses.npcs.Enemy",
                    key=enemy["name"],
                    location=room,
                    home=room,
                )
                created_enemies += 1
            enemy_obj.key = enemy["name"]
            enemy_obj.db.enemy_id = enemy_id
            enemy_obj.db.vitality = enemy["vitality"]
            enemy_obj.db.aggression = enemy["aggression"]
            enemy_obj.db.desc = enemy["description"]
            enemy_obj.save()
        if data.get("targets"):
            existing_scripts = [
                script
                for script in room.scripts.all()
                if script.db.script_marker == "dr_room_respawn"
            ]
            if existing_scripts:
                updated_respawn_scripts += 1
            else:
                script = room.scripts.add("typeclasses.scripts.RoomRespawnScript")
                script.db.script_marker = "dr_room_respawn"
                created_respawn_scripts += 1

    return {
        "ok": True,
        "created_rooms": created_rooms,
        "updated_rooms": updated_rooms,
        "created_exits": created_exits,
        "updated_exits": updated_exits,
        "created_npcs": created_npcs,
        "updated_npcs": updated_npcs,
        "created_enemies": created_enemies,
        "updated_enemies": updated_enemies,
        "created_respawn_scripts": created_respawn_scripts,
        "updated_respawn_scripts": updated_respawn_scripts,
        "errors": [],
    }
