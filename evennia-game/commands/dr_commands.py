"""
Dragon Realms Next Gen command scaffold for Evennia.

These commands intentionally keep the text-first interface. They are the
first migration bridge from the Node prototype into Evennia's command loop.
"""

import re

from evennia.commands.command import Command
from evennia.utils.create import create_object

from world.dr_data import ATTRIBUTES, GUILDS, RACES, SKILLSETS, build_starter_skills
from world.dr_combat import advance, appraise_enemy, bash, combat_status, defend, flee, health_text, hurl, jab, loot_corpse, range_status, respawn_room_enemies, rest, retreat, revive, room_enemy_ids, scan_room, skin_corpse, stance, target_enemy, wait_recover
from world.dr_economy import SHOPS, appraise_item, buy_item, complete_shop_task, drop_item, equipment_text, forage_room, format_shop, format_shop_stock, get_item, hands_text, inventory_text, refresh_shop_stock, remove_item, repair_item, request_shop_task, sell_item, shop_talk, task_status, use_item, wallet_text, wear_item, wield_item
from world.dr_guilds import join_guild, registrar_text
from world.dr_identity import choose_race, normalize_race_token, reroll_attributes
from world.dr_progression import advance_circle, circle_status, experience_summary, guild_ability_summary, guild_history_summary, guild_path_summary, guild_title, guild_title_ladder, study_room, train_skill, unlocked_guild_perks, use_guild_boon, use_guild_capstone, use_guild_drill, use_guild_focus, use_guild_milestone, use_guild_passive, use_guild_practice, use_guild_rite, use_guild_technique
from world.dr_world import DIRECTION_ALIASES, ROOMS, START_ROOM_ID, build_crossing_world, find_built_room, find_path, forage_guide, guild_guide, hunting_guide, shop_guide, survey_room, task_guide, travel_guide


CHARACTER_NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z '-]{2,29}$")


ACCOUNT_HELP_TEXT = "\n".join(
    [
        "Dragon Realms account commands:",
        "create character <name> = <race> - create an unaffiliated Circle 1 character.",
        "characters / roster - list playable characters on this account.",
        "puppet <name> - enter Crossing as that character.",
        "Guilds are joined in-world after puppeting; do not choose a guild at account creation.",
        f"Races: {', '.join(RACES.values())}.",
    ]
)

CHARACTER_HELP_TEXT = "\n".join(
    [
        "Dragon Realms commands:",
        "Identity: score, attributes/stats, skills, race, reroll attributes.",
        "Guilds/Circles: guilds, registrar, join guild, guild/perks, guild history, title, experience, abilities, guild path, milestone, focus, technique, passive, drill, practice, rite, boon, capstone, study, train, circle, circle status.",
        "Movement: journey, room/exits/where, survey, routes, hunting, then use direction names or aliases like n, sw, u, d.",
        "Shops/Fieldcraft: shops, tasks, forage guide, shop, wallet, task request/status/complete, appraise <item>, shop talk, shop stock, shop refresh, buy <item>, sell <item>, forage, get/drop, use <item>, tend/treat, inventory, hands, equipment, wield, wear, remove/stow, repair.",
        "Combat: scan, target <enemy>, appraise target, range, advance, retreat, combat, stance, hurl/throw, jab/attack, bash, defend, flee, wait/recover, rest, skin corpse, loot corpse, revive/stand.",
        "Focused help: help progression, help room, help scan, help targets, help combat.",
    ]
)

CHARACTER_HELP_TOPICS = {
    "room": "\n".join(
        [
            "Room and movement help:",
            "room / exits / where - show the current room, room ID, exits, guild/shop markers, enemies, and visible objects.",
            "survey - summarize room affordances: exits, registrar, shop, task, forage, enemies, and visible objects.",
            "Move with full directions or classic aliases: n, s, e, w, ne, nw, se, sw, u, d.",
            "Guilds are joined in-world at registrar rooms; shops and hunting rooms are discovered by walking Crossing.",
        ]
    ),
    "scan": "\n".join(
        [
            "Scan help:",
            "scan - list enemies in the current room.",
            "Each scan entry shows the enemy id and aggression so you can decide what to target.",
            "Use appraise <enemy id> for vitality, aggression, current range, loot signs, and description.",
        ]
    ),
    "targets": "\n".join(
        [
            "Target help:",
            "target <enemy id> - begin an engagement at missile range.",
            "range - show your current engagement range.",
            "advance - move from missile to pole to melee range.",
            "retreat - move back through range bands; retreat from missile breaks engagement.",
        ]
    ),
    "combat": "\n".join(
        [
            "Combat help:",
            "combat / prompt - show health, balance, roundtime, stance, condition, target, range, and enemy vitality.",
            "hurl / throw - ranged maneuver from missile or pole range using Light Thrown and agility.",
            "jab / attack - quick melee maneuver using Small Edged and agility.",
            "bash - heavier melee maneuver using Brawling and strength.",
            "defend - defensive stance and balance recovery. flee - break engagement with recovery time.",
            "wait / recover - tick roundtime down. rest - recover roundtime, health, or incapacitation. revive / stand - recover from incapacitation in smoke-test form.",
        ]
    ),
    "progression": "\n".join(
        [
            "Progression path:",
            "1. From the account prompt: create character <name> = <race>, then puppet <name>.",
            "2. In Crossing: use journey, room/exits/where, survey, and routes, then walk with directions or aliases like n, sw, u, d.",
            "3. Join in-world: visit a guild registrar, use registrar for guidance, then use join guild. Guilds are not chosen during account creation.",
            "4. Train and circle: use guild path, title, experience, train, study, milestone, passive, drill, practice, boon, capstone, skills, circle status, circle, abilities, focus, and technique at your own guild registrar through Circle 10.",
            "5. Gear up and work: use shop, task request/status/complete, appraise <item>, shop talk, shop stock, buy <item>, sell <item>, get/drop, use <item>, tend/treat wounds, inventory, hands, equipment, wield, wear, remove/stow, and repair.",
            "6. Hunt and forage: walk to beginner hunting rooms, forage, scan, appraise <enemy>, target <enemy>, advance to melee, then jab or bash.",
            "7. Recover and harvest: use combat/prompt, wait/recover/rest for roundtime, defend or flee as needed, revive/stand/rest if incapacitated, then skin corpse, loot corpse, and get dropped items after a kill.",
        ]
    ),
}
CHARACTER_HELP_TOPICS["target"] = CHARACTER_HELP_TOPICS["targets"]


def format_route(current_room_id, destination_room_id):
    if current_room_id == destination_room_id:
        return "here"
    path = find_path(current_room_id, destination_room_id)
    if not path:
        return "route unknown"
    return "go " + ", ".join(path)


def journey_summary(character):
    """Return a compact command-first next-step summary for the current character."""

    room = character.location
    room_id = room.db.dr_room_id if room else START_ROOM_ID
    room_title = room.key if room else "nowhere"
    lines = [
        "Journey:",
        f"Location: {room_title} ({room_id}).",
        "Navigation: use `routes` for all destinations or `survey` for this room.",
    ]

    active_task = character.db.active_task
    if active_task:
        destination_id = active_task.get("destination")
        destination_title = SHOPS.get(destination_id, ROOMS.get(destination_id, {"title": destination_id})).get("name") or ROOMS.get(destination_id, {"title": destination_id})["title"]
        lines.append(
            f"Task: {active_task.get('name')} -> {destination_title} ({destination_id}); {format_route(room_id, destination_id)}; then `task complete`."
        )
    else:
        lines.append("Task: none. Use `tasks` to find shop work or `task request` at a task shop.")

    guild_id = character.db.guild_id or "commoner"
    circle = int(character.db.circle or 1)
    if guild_id == "commoner":
        lines.append("Guild: unaffiliated. Use `guilds`, travel to a registrar, then `join guild`.")
    else:
        guild_state = {
            "guild_id": guild_id,
            "circle": circle,
            "skills": character.db.skills or build_starter_skills(),
            "guild_boons": character.db.guild_boons or [],
            "guild_capstones": character.db.guild_capstones or [],
            "room_guild_id": room.db.guild if room else None,
        }
        guild_path = guild_path_summary(guild_state)
        lines.append(f"Guild: {character.db.guild_name or GUILDS.get(guild_id, guild_id)}, Circle {circle}. {guild_path[-1]}")

    engagement = dict(character.db.engagement or {})
    target = engagement.get("target")
    range_band = engagement.get("range")
    if character.db.incapacitated:
        lines.append("Combat: incapacitated. Use `revive` or `rest`.")
    elif character.db.bleeding:
        lines.append("Combat: bleeding. Use `tend` or `use field_bandage`.")
    elif target:
        lines.append(f"Combat: engaged with {target} at {range_band}. Use `combat`, `advance`, `jab`, `bash`, `defend`, or `flee`.")
    elif room and room_enemy_ids(room):
        lines.append("Combat: enemies here. Use `scan`, `appraise <enemy>`, `target <enemy>`, and `advance`.")
    else:
        lines.append("Combat: no active target. Use `hunting` to find enemies.")

    lines.append("Economy/fieldcraft: use `shops`, `forage guide`, `inventory`, `wallet`, and `equipment`.")
    return "\n".join(lines)


def account_roster_text(account):
    characters = list(account.characters.all())
    if not characters:
        return "\n".join(
            [
                "No characters yet.",
                "Usage: create character <name> = <race name>",
                f"Races: {', '.join(RACES.values())}.",
                "Guilds are joined in-world at registrar rooms after you enter Crossing.",
            ]
        )
    lines = [
        "Characters:",
        "Use `puppet <name>` to enter Crossing. Use `unpuppet` to return to this account roster.",
    ]
    for character in characters:
        race_name = character.db.race_name or "Unchosen"
        guild_name = character.db.guild_name or "Unaffiliated"
        circle = character.db.circle or 1
        location = character.location.key if character.location else "nowhere"
        room_id = character.location.db.dr_room_id if character.location else "unknown"
        lines.append(f"- {character.key}: {race_name}, {guild_name}, Circle {circle}, at {location} ({room_id}).")
        if character.db.guild_id in (None, "commoner"):
            lines.append(f"  Next for {character.key}: puppet, use `survey`, then walk to a registrar and `join guild`.")
        elif int(circle or 1) < 10:
            lines.append(f"  Next for {character.key}: puppet, return to your guild registrar, then `train` and `circle`.")
        elif f"{character.db.guild_id}:10" not in tuple(character.db.guild_boons or ()):
            lines.append(f"  Next for {character.key}: puppet, return to your guild registrar, then claim `boon`.")
        elif f"{character.db.guild_id}:10" not in tuple(character.db.guild_capstones or ()):
            lines.append(f"  Next for {character.key}: puppet, return to your guild registrar, then claim `capstone`.")
        else:
            lines.append(f"  Next for {character.key}: puppet, then continue training, shops, survey, or hunting.")
    lines.append("Use `puppet <name>` to enter a listed character.")
    return "\n".join(lines)


class CmdDRAccountHelp(Command):
    """
    Show Dragon Realms account command help.

    Usage:
      account help
      drhelp
    """

    key = "account help"
    aliases = ["drhelp"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        (self.account or self.caller).msg(ACCOUNT_HELP_TEXT)


class CmdDRAccountCreateCharacter(Command):
    """
    Create a playable character from the account prompt.

    Usage:
      create character
      create character <name> = <race name>

    Guilds are not chosen here; new characters enter Crossing unaffiliated.
    """

    key = "create character"
    aliases = ["create"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        account = self.account or self.caller
        args = self.args.strip()
        races = ", ".join(RACES.values())
        if args.startswith("character"):
            args = args[len("character") :].strip()
        if not args:
            account.msg(f"Usage: create character <name> = <race name>\nRaces: {races}.")
            return
        if "=" not in args:
            account.msg(f"Usage: create character <name> = <race name>\nRaces: {races}.")
            return

        name, race_name = [part.strip() for part in args.split("=", 1)]
        race_id = normalize_race_token(race_name)
        if not name:
            account.msg("Name is required. Usage: create character <name> = <race name>")
            return
        if not CHARACTER_NAME_PATTERN.match(name):
            account.msg("Character names must be 3-30 characters, start with a letter, and use only letters, spaces, apostrophes, or hyphens.")
            return
        existing_names = {character.key.lower() for character in account.characters.all()}
        if name.lower() in existing_names:
            account.msg(f'You already have a character named "{name}". Choose another name.')
            return
        if race_id not in RACES:
            account.msg(f'Unknown race "{race_name}". Races: {races}.')
            return

        build_crossing_world()
        start_room = find_built_room(START_ROOM_ID)
        character = create_object(
            "typeclasses.characters.Character",
            key=name,
            location=start_room,
            home=start_room,
        )
        state = {
            "race": character.db.race,
            "race_name": character.db.race_name or "Unchosen",
            "attributes": character.db.attributes or {},
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
        }
        result = choose_race(state, race_id)
        if not result["changed"]:
            character.delete()
            account.msg("\n".join(result["events"]))
            return

        character.db.race = state["race"]
        character.db.race_name = state["race_name"]
        character.db.attributes = state["attributes"]
        character.db.guild_id = state["guild_id"]
        character.db.guild_name = state["guild_name"]
        character.db.circle = state["circle"]
        character.db.skills = build_starter_skills()
        character.db.wallet = {"plat": 0, "trias": 100, "lucan": 0, "silk": 0}
        character.db.inventory = []
        character.db.hands = {"left": None, "right": None}
        character.db.equipment = {"worn": []}
        character.db.equipment_condition = {}
        character.db.health = 25
        character.db.max_health = 25
        character.db.balance = "balanced"
        character.db.roundtime = 0
        character.db.stance = "balanced"
        character.db.engagement = {"target": None, "range": None}
        character.db.bleeding = False
        character.db.incapacitated = False
        character.db.creation_complete = True
        account.characters.add(character)
        account.msg(
            "\n".join(
                [
                    f"Created {character.key}, a {state['race_name']} unaffiliated Circle 1 character.",
                    f"Use `puppet {character.key}` to enter Crossing.",
                    "After entering, use `room` to inspect exits and visit a guild registrar to `join guild`.",
                ]
            )
        )


class CmdDRAccountCharacters(Command):
    """
    List playable characters on this account.

    Usage:
      characters
      roster
    """

    key = "characters"
    aliases = ["roster"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        account = self.account or self.caller
        account.msg(account_roster_text(account))


class CmdDRScore(Command):
    """
    Show character identity and progression state.

    Usage:
      score
    """

    key = "score"
    aliases = ["info"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        race_name = character.db.race_name or "Unchosen"
        guild_name = character.db.guild_name or "Unaffiliated"
        circle = character.db.circle or 1
        wallet = character.db.wallet or {"plat": 0, "trias": 0, "lucan": 0, "silk": 0}
        attributes = character.db.attributes or {}
        attribute_line = ", ".join(f"{attribute} {attributes.get(attribute, 0)}" for attribute in ATTRIBUTES)

        character.msg(
            "\n".join(
                [
                    f"You are {character.key}, race {race_name}.",
                    f"Guild: {guild_name}. Circle {circle}.",
                    f"Attributes: {attribute_line}.",
                    "Wallet: "
                    f"{wallet.get('plat', 0)} plat, {wallet.get('trias', 0)} trias, "
                    f"{wallet.get('lucan', 0)} lucan, {wallet.get('silk', 0)} silk.",
                ]
            )
        )


class CmdDRAttributes(Command):
    """
    Show race-derived character attributes.

    Usage:
      attributes
      stats
      stat <attribute>
    """

    key = "attributes"
    aliases = ["stats", "stat"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        attributes = character.db.attributes or {}
        requested = self.args.strip().lower()
        if requested:
            attribute_id = "_".join("".join(char.lower() if char.isalnum() else " " for char in requested).split())
            if attribute_id not in ATTRIBUTES:
                character.msg(f'Unknown attribute "{requested}". Attributes: {", ".join(ATTRIBUTES)}.')
                return
            character.msg(f"{attribute_id}: {attributes.get(attribute_id, 0)}")
            return
        lines = ["Attributes:"]
        for attribute_id in ATTRIBUTES:
            lines.append(f"{attribute_id}: {attributes.get(attribute_id, 0)}")
        character.msg("\n".join(lines))


class CmdDRRerollAttributes(Command):
    """
    Reroll race-derived starting attributes before joining a guild.

    Usage:
      reroll attributes
      reroll attributes <seed>

    The optional seed is mainly for repeatable smoke tests.
    """

    key = "reroll"
    aliases = ["roll attributes", "reroll attributes", "roll stats"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        args = self.args.strip()
        if args.startswith("attributes"):
            args = args[len("attributes") :].strip()
        if args.startswith("stats"):
            args = args[len("stats") :].strip()
        state = {
            "race": character.db.race,
            "attributes": character.db.attributes or {},
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
        }
        result = reroll_attributes(state, seed=args or None)
        if result["changed"]:
            character.db.attributes = state["attributes"]
        character.msg("\n".join(result["events"]))


class CmdDRHelp(Command):
    """
    Show Dragon Realms command help.

    Usage:
      drhelp
      commands
    """

    key = "drhelp"
    aliases = ["commands"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        topic = self.args.strip().lower()
        if topic in CHARACTER_HELP_TOPICS:
            self.caller.msg(CHARACTER_HELP_TOPICS[topic])
            return
        if topic:
            known = ", ".join(sorted(CHARACTER_HELP_TOPICS))
            self.caller.msg(f'Unknown help topic "{topic}". Known topics: {known}.')
            return
        self.caller.msg(CHARACTER_HELP_TEXT)


class CmdDRRoom(Command):
    """
    Show DR-oriented room and navigation status.

    Usage:
      room
      exits
      where
    """

    key = "room"
    aliases = ["exits", "where"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        room = character.location
        if not room:
            character.msg("You are nowhere.")
            return

        exits = []
        for exit_obj in sorted(room.exits, key=lambda candidate: candidate.key):
            alias = DIRECTION_ALIASES.get(exit_obj.key)
            exits.append(f"{exit_obj.key} ({alias})" if alias else exit_obj.key)

        lines = [
            room.key,
            room.db.desc or "There is nothing notable here.",
            f"Room ID: {room.db.dr_room_id or 'unknown'}.",
            "Exits: " + (", ".join(exits) if exits else "none."),
        ]

        guild_id = room.db.guild
        if guild_id:
            lines.append(f"Guild registrar: {GUILDS.get(guild_id, guild_id)}.")

        shop = room.db.shop
        if shop:
            lines.append(f"Shop: {shop['name']} ({shop['keeper']}).")

        enemies = room_enemy_ids(room)
        if enemies:
            lines.append("Enemies: " + ", ".join(enemies) + ".")

        visible = [
            obj.key
            for obj in room.contents
            if obj is not character and not obj.destination and not obj.db.enemy_id
        ]
        if visible:
            lines.append("Also here: " + ", ".join(sorted(visible)) + ".")

        character.msg("\n".join(lines))


class CmdDRSurvey(Command):
    """
    Survey current room affordances.

    Usage:
      survey
      search room
    """

    key = "survey"
    aliases = ["search room", "look around"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(survey_room(self.caller.location, self.caller))


class CmdDRHunting(Command):
    """
    Show beginner hunting grounds and routes from here.

    Usage:
      hunting
      hunting grounds
      hunt
    """

    key = "hunting"
    aliases = ["hunting grounds", "hunt"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(hunting_guide(self.caller.location))


class CmdDRRoutes(Command):
    """
    Show routes to every configured Crossing room from here.

    Usage:
      routes
      travel guide
      map
    """

    key = "routes"
    aliases = ["travel guide", "map", "directions"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(travel_guide(self.caller.location))


class CmdDRJourney(Command):
    """
    Show a compact current journey and next-step summary.

    Usage:
      journey
      next steps
      todo
    """

    key = "journey"
    aliases = ["next steps", "todo", "status"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(journey_summary(self.caller))


class CmdDRSkills(Command):
    """
    Show skill ranks and pools.

    Usage:
      skills
      skills <skillset>

    Skillsets: armor, weapon, magic, survival, lore, guild
    """

    key = "skills"
    aliases = ["skill"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        skills = character.db.skills or build_starter_skills()
        if not character.db.skills:
            character.db.skills = skills

        requested = self.args.strip().lower()
        known = ", ".join(SKILLSETS.keys())
        if requested:
            skill_ids = SKILLSETS.get(requested)
            if not skill_ids:
                character.msg(f'Unknown skillset "{requested}". Known skillsets: {known}.')
                return
            lines = [f"Skillset: {requested}."]
        else:
            skill_ids = list(skills.keys())
            lines = [f"Skillsets: {known}."]

        for skill_id in skill_ids:
            skill = skills.get(skill_id, {"name": skill_id, "rank": 0, "pool": 0})
            lines.append(f"{skill_id}: {skill['name']} rank {skill['rank']}, pool {skill['pool']}")

        character.msg("\n".join(lines))


class CmdDRRace(Command):
    """
    Choose or view your race.

    Usage:
      race
      race <race name>
      choose race <race name>

    Race selection is only available before joining a guild and before
    advancing beyond Circle 1.
    """

    key = "race"
    aliases = ["choose race"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "race": character.db.race,
            "race_name": character.db.race_name or "Unchosen",
            "attributes": character.db.attributes or {},
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
        }
        result = choose_race(state, self.args.strip())
        if result["changed"]:
            character.db.race = state["race"]
            character.db.race_name = state["race_name"]
            character.db.attributes = state["attributes"]
            character.db.guild_id = state["guild_id"]
            character.db.guild_name = state["guild_name"]
            character.db.circle = state["circle"]
            character.db.creation_complete = True
        character.msg("\n".join(result["events"]))


class CmdDRCreateCharacter(Command):
    """
    Complete initial character creation.

    Usage:
      create character
      create character <race name>

    Guilds are not chosen here; they must be joined in-world at registrars.
    """

    key = "create character"
    aliases = ["create"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        args = self.args.strip()
        if args.startswith("character"):
            args = args[len("character") :].strip()
        character = self.caller
        state = {
            "race": character.db.race,
            "race_name": character.db.race_name or "Unchosen",
            "attributes": character.db.attributes or {},
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
        }
        result = choose_race(state, args)
        if result["changed"]:
            character.db.race = state["race"]
            character.db.race_name = state["race_name"]
            character.db.attributes = state["attributes"]
            character.db.guild_id = state["guild_id"]
            character.db.guild_name = state["guild_name"]
            character.db.circle = state["circle"]
            character.db.creation_complete = True
            character.msg("\n".join([*result["events"], "You enter Crossing as an unaffiliated Circle 1 character."]))
            return
        character.msg("\n".join(result["events"]))


class CmdDRJoinGuild(Command):
    """
    Join the guild registrar in the current room.

    Usage:
      join guild
    """

    key = "join guild"
    aliases = ["join"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        if not character.db.creation_complete:
            character.msg("Choose a race before joining a guild. Usage: race <race name>")
            return
        room = character.location
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
        }
        room_state = {"guild": room.db.guild if room else None}
        result = join_guild(state, room_state)
        if result["joined"]:
            character.db.guild_id = state["guild_id"]
            character.db.guild_name = state["guild_name"]
            character.db.circle = state["circle"]
            character.db.guild_perks = state["guild_perks"]
        character.msg("\n".join(result["events"]))


class CmdDRRegistrar(Command):
    """
    Ask the current guild registrar for in-world guidance.

    Usage:
      registrar
      ask registrar
    """

    key = "registrar"
    aliases = ["ask registrar", "guild registrar"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        room = character.location
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
        }
        room_state = {"guild": room.db.guild if room else None}
        character.msg("\n".join(registrar_text(state, room_state)))


class CmdDRGuildsGuide(Command):
    """
    Show guild registrars, primary skills, and routes from here.

    Usage:
      guilds
      guild guide
      registrars
    """

    key = "guilds"
    aliases = ["guild guide", "registrars"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(guild_guide(self.caller.location))


class CmdDRGuildPerks(Command):
    """
    Show guild identity and unlocked Circle milestones.

    Usage:
      guild
      perks
    """

    key = "guild"
    aliases = ["perks", "milestones"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        guild_id = character.db.guild_id or "commoner"
        guild_name = character.db.guild_name or "Unaffiliated"
        circle = int(character.db.circle or 1)
        if guild_id == "commoner":
            character.msg("You are unaffiliated. Visit a guild registrar and use `join guild`.")
            return
        perks = character.db.guild_perks or unlocked_guild_perks(guild_id, circle)
        character.db.guild_perks = perks
        lines = [f"Guild: {guild_name}. Circle {circle}.", f"Title: {guild_title(guild_id, circle)}.", "Unlocked milestones:"]
        lines.extend(f"- {perk}" for perk in perks)
        character.msg("\n".join(lines))


class CmdDRGuildTitle(Command):
    """
    Show current and earned guild titles.

    Usage:
      title
      titles
      guild title
    """

    key = "title"
    aliases = ["titles", "guild title"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        guild_id = character.db.guild_id or "commoner"
        circle = int(character.db.circle or 1)
        character.msg("\n".join(guild_title_ladder(guild_id, circle)))


class CmdDRGuildHistory(Command):
    """
    Show earned guild milestones and claimed rewards.

    Usage:
      guild history
      renown
      rewards
    """

    key = "guild history"
    aliases = ["renown", "rewards", "reward history"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "guild_boons": character.db.guild_boons or [],
            "guild_capstones": character.db.guild_capstones or [],
        }
        character.msg("\n".join(guild_history_summary(state)))


class CmdDRExperience(Command):
    """
    Show compact Circle progress and skill-rank requirements.

    Usage:
      experience
      exp
      progress
    """

    key = "experience"
    aliases = ["exp", "progress"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "guild_boons": character.db.guild_boons or [],
            "guild_capstones": character.db.guild_capstones or [],
        }
        character.msg("\n".join(experience_summary(state)))


class CmdDRGuildAbilities(Command):
    """
    Show guild ability flavor unlocked through the current Circle.

    Usage:
      abilities
      guild abilities
    """

    key = "abilities"
    aliases = ["guild abilities", "ability"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        guild_id = character.db.guild_id or "commoner"
        circle = int(character.db.circle or 1)
        character.msg("\n".join(guild_ability_summary(guild_id, circle)))


class CmdDRGuildPath(Command):
    """
    Show a concise Circle-aware guild action plan.

    Usage:
      guild path
      path
      next
    """

    key = "guild path"
    aliases = ["path", "next"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "guild_boons": character.db.guild_boons or [],
            "guild_capstones": character.db.guild_capstones or [],
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        character.msg("\n".join(guild_path_summary(state)))


class CmdDRGuildFocus(Command):
    """
    Use the active guild focus as a small primary-skill pulse.

    Usage:
      focus
      guild focus
    """

    key = "focus"
    aliases = ["guild focus"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
        }
        events = use_guild_focus(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildTechnique(Command):
    """
    Use the guild's Circle-scaled support technique.

    Usage:
      technique
      guild technique
    """

    key = "technique"
    aliases = ["guild technique"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
        }
        events = use_guild_technique(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildMilestone(Command):
    """
    Practice the current named guild Circle milestone at your registrar.

    Usage:
      milestone
      guild milestone
      guild lesson
    """

    key = "milestone"
    aliases = ["guild milestone", "guild lesson", "lesson"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = use_guild_milestone(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildPassive(Command):
    """
    Reinforce passive guild identity training.

    Usage:
      passive
      guild passive
    """

    key = "passive"
    aliases = ["guild passive"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
        }
        events = use_guild_passive(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildDrill(Command):
    """
    Run a registrar-gated guild drill.

    Usage:
      drill
      guild drill
    """

    key = "drill"
    aliases = ["guild drill", "drills"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = use_guild_drill(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildPractice(Command):
    """
    Practice guild forms at your own registrar.

    Usage:
      practice
      guild practice
    """

    key = "practice"
    aliases = ["guild practice"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = use_guild_practice(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildRite(Command):
    """
    Perform a Circle 5+ guild rite at your own registrar.

    Usage:
      rite
      guild rite
    """

    key = "rite"
    aliases = ["guild rite", "rites"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = use_guild_rite(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRGuildBoon(Command):
    """
    Claim a once-per-Circle guild boon at your own registrar.

    Usage:
      boon
      guild boon
    """

    key = "boon"
    aliases = ["guild boon", "boons"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "guild_boons": character.db.guild_boons or [],
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = use_guild_boon(state)
        character.db.skills = state["skills"]
        character.db.guild_boons = state.get("guild_boons", character.db.guild_boons or [])
        character.msg("\n".join(events))


class CmdDRGuildCapstone(Command):
    """
    Claim a Circle 10 guild capstone at your own registrar.

    Usage:
      capstone
      guild capstone
    """

    key = "capstone"
    aliases = ["guild capstone", "capstones"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "guild_capstones": character.db.guild_capstones or [],
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = use_guild_capstone(state)
        character.db.skills = state["skills"]
        character.db.guild_capstones = state.get("guild_capstones", character.db.guild_capstones or [])
        character.msg("\n".join(events))


class CmdDRTrain(Command):
    """
    Train a skill.

    Usage:
      train
      train <skill>
    """

    key = "train"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "skills": character.db.skills or build_starter_skills(),
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = train_skill(state, self.args.strip())
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRStudy(Command):
    """
    Study lore notes in study rooms or at your own registrar.

    Usage:
      study
      read
    """

    key = "study"
    aliases = ["read"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "skills": character.db.skills or build_starter_skills(),
            "room_id": character.location.db.dr_room_id if character.location else "",
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        events = study_room(state)
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRCircle(Command):
    """
    Check or advance Circle progression.

    Usage:
      circle
      circle status
    """

    key = "circle"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        character = self.caller
        state = {
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
            "skills": character.db.skills or build_starter_skills(),
            "guild_perks": character.db.guild_perks or [],
            "guild_boons": character.db.guild_boons or [],
            "guild_capstones": character.db.guild_capstones or [],
            "room_guild_id": character.location.db.guild if character.location else None,
        }
        if self.args.strip().lower() in ("status", "check", "requirements", "reqs"):
            events = circle_status(state)
            character.msg("\n".join(events))
            return
        events = advance_circle(state)
        character.db.circle = state["circle"]
        character.db.skills = state["skills"]
        character.db.guild_perks = state.get("guild_perks", character.db.guild_perks or [])
        character.msg("\n".join(events))


class CmdDRShop(Command):
    """
    Show or talk to the current shopkeeper.

    Usage:
      shop
      shop talk
      shop stock
      shop refresh
    """

    key = "shop"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        action = self.args.strip().lower()
        if action == "talk":
            self.caller.msg(shop_talk(self.caller.location))
            return
        if action == "stock":
            self.caller.msg(format_shop_stock(self.caller.location))
            return
        if action == "refresh":
            self.caller.msg(refresh_shop_stock(self.caller.location))
            return
        self.caller.msg(format_shop(self.caller.location))


class CmdDRShops(Command):
    """
    Show Crossing shop counters, stock, tasks, and routes from here.

    Usage:
      shops
      shop guide
      stores
    """

    key = "shops"
    aliases = ["shop guide", "stores"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(shop_guide(self.caller.location))


class CmdDRTask(Command):
    """
    Request, check, or complete a beginner shop task.

    Usage:
      task
      task request
      task status
      task complete
      job
    """

    key = "task"
    aliases = ["job"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        action = self.args.strip().lower() or "status"
        if action in ("request", "ask", "start"):
            self.caller.msg(request_shop_task(self.caller))
            return
        if action in ("complete", "finish", "turn in", "turnin"):
            self.caller.msg(complete_shop_task(self.caller))
            return
        self.caller.msg(task_status(self.caller))


class CmdDRTasksGuide(Command):
    """
    Show shop task routes, rewards, and destination shops from here.

    Usage:
      tasks
      task guide
      jobs
      job guide
    """

    key = "tasks"
    aliases = ["task guide", "jobs", "job guide"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(task_guide(self.caller.location))


class CmdDRBuy(Command):
    """
    Buy an item from the current shop.

    Usage:
      buy <item id>
    """

    key = "buy"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(buy_item(self.caller, self.args))


class CmdDRSell(Command):
    """
    Sell a carried item to the current shop.

    Usage:
      sell <item id>
    """

    key = "sell"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(sell_item(self.caller, self.args))


class CmdDRWallet(Command):
    """
    Show carried coin.

    Usage:
      wallet
      money
      coins
    """

    key = "wallet"
    aliases = ["money", "coins"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(wallet_text(self.caller))


class CmdDRForage(Command):
    """
    Search the current trail or hunting room for beginner forage.

    Usage:
      forage
      gather
      search
    """

    key = "forage"
    aliases = ["gather", "search"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(forage_room(self.caller))


class CmdDRForageGuide(Command):
    """
    Show forage sites and routes from here.

    Usage:
      forage guide
      forage sites
      gather guide
    """

    key = "forage guide"
    aliases = ["forage sites", "gather guide"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(forage_guide(self.caller.location))


class CmdDRDrop(Command):
    """
    Drop carried gear into the current room.

    Usage:
      drop <item id>
    """

    key = "drop"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(drop_item(self.caller, self.args))


class CmdDRInventory(Command):
    """
    Show carried pack inventory.

    Usage:
      inventory
    """

    key = "inventory"
    aliases = ["inv"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(inventory_text(self.caller))


class CmdDRLoot(Command):
    """
    Loot a corpse in the current room.

    Usage:
      loot corpse
    """

    key = "loot"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        if self.args.strip().lower() != "corpse":
            self.caller.msg("Usage: loot corpse")
            return
        self.caller.msg(loot_corpse(self.caller))


class CmdDRSkin(Command):
    """
    Skin a corpse in the current room.

    Usage:
      skin corpse
    """

    key = "skin"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        if self.args.strip().lower() != "corpse":
            self.caller.msg("Usage: skin corpse")
            return
        self.caller.msg(skin_corpse(self.caller))


class CmdDRGet(Command):
    """
    Get a dropped item.

    Usage:
      get <item id>
    """

    key = "get"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(get_item(self.caller, self.args))


class CmdDRHands(Command):
    """
    Show held items.

    Usage:
      hands
    """

    key = "hands"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(hands_text(self.caller))


class CmdDREquipment(Command):
    """
    Show held and worn equipment.

    Usage:
      equipment
    """

    key = "equipment"
    aliases = ["equip"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(equipment_text(self.caller))


class CmdDRRepair(Command):
    """
    Repair or maintain worn/held beginner gear.

    Usage:
      repair <item id>
    """

    key = "repair"
    aliases = ["maintain"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(repair_item(self.caller, self.args))


class CmdDRRemove(Command):
    """
    Remove worn gear or stow held gear back into your pack.

    Usage:
      remove <item id>
      stow <item id>
      unwear <item id>
      unwield <item id>
    """

    key = "remove"
    aliases = ["stow", "unwear", "unwield"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(remove_item(self.caller, self.args))


class CmdDRWield(Command):
    """
    Wield carried gear.

    Usage:
      wield <item id>
    """

    key = "wield"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(wield_item(self.caller, self.args))


class CmdDRWear(Command):
    """
    Wear carried gear.

    Usage:
      wear <item id>
    """

    key = "wear"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(wear_item(self.caller, self.args))


class CmdDRUse(Command):
    """
    Use a carried consumable item.

    Usage:
      use <item id>
    """

    key = "use"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(use_item(self.caller, self.args))


class CmdDRTend(Command):
    """
    Tend wounds with a carried field bandage.

    Usage:
      tend
      tend <item id>
      treat
      treat <item id>
    """

    key = "tend"
    aliases = ["treat"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        item_id = self.args.strip() or "field_bandage"
        self.caller.msg(use_item(self.caller, item_id))


class CmdDRHealth(Command):
    """
    Show current health and combat posture.

    Usage:
      health
    """

    key = "health"
    aliases = ["vitals"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(health_text(self.caller))


class CmdDRCombat(Command):
    """
    Show combat prompt state.

    Usage:
      combat
      prompt
    """

    key = "combat"
    aliases = ["prompt"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(combat_status(self.caller))


class CmdDRScan(Command):
    """
    Scan the room for enemies.

    Usage:
      scan
    """

    key = "scan"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(scan_room(self.caller.location))


class CmdDRTarget(Command):
    """
    Target an enemy in the room.

    Usage:
      target <enemy id>
    """

    key = "target"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(target_enemy(self.caller, self.args))


class CmdDRAppraise(Command):
    """
    Appraise an enemy or visible item.

    Usage:
      appraise <enemy id>
      appraise <item id>
      appraise target
    """

    key = "appraise"
    aliases = ["assess"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        enemy_text = appraise_enemy(self.caller, self.args)
        if not enemy_text.startswith('You do not see "'):
            self.caller.msg(enemy_text)
            return
        self.caller.msg(appraise_item(self.caller, self.args))


class CmdDRRange(Command):
    """
    Show current engagement range.

    Usage:
      range
    """

    key = "range"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(range_status(self.caller))


class CmdDRAdvance(Command):
    """
    Advance toward a targeted enemy.

    Usage:
      advance
    """

    key = "advance"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(advance(self.caller))


class CmdDRRetreat(Command):
    """
    Retreat from a targeted enemy.

    Usage:
      retreat
    """

    key = "retreat"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(retreat(self.caller))


class CmdDRJab(Command):
    """
    Jab a targeted enemy at melee range.

    Usage:
      jab
      attack
    """

    key = "jab"
    aliases = ["attack"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(jab(self.caller))


class CmdDRBash(Command):
    """
    Bash a targeted enemy at melee range.

    Usage:
      bash
    """

    key = "bash"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(bash(self.caller))


class CmdDRHurl(Command):
    """
    Hurl a quick ranged attack at missile or pole range.

    Usage:
      hurl
      throw
    """

    key = "hurl"
    aliases = ["throw", "lob"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(hurl(self.caller))


class CmdDRStance(Command):
    """
    View or set combat stance.

    Usage:
      stance
      stance balanced
      stance offensive
      stance defensive
    """

    key = "stance"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(stance(self.caller, self.args))


class CmdDRDefend(Command):
    """
    Recover into a defensive guard.

    Usage:
      defend
    """

    key = "defend"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(defend(self.caller))


class CmdDRFlee(Command):
    """
    Break engagement.

    Usage:
      flee
    """

    key = "flee"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(flee(self.caller))


class CmdDRRevive(Command):
    """
    Recover from incapacitation.

    Usage:
      revive
      stand
    """

    key = "revive"
    aliases = ["stand"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(revive(self.caller))


class CmdDRWait(Command):
    """
    Wait one recovery pulse.

    Usage:
      wait
    """

    key = "wait"
    aliases = ["recover"]
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(wait_recover(self.caller))


class CmdDRRest(Command):
    """
    Rest to recover roundtime, health, or incapacitation.

    Usage:
      rest
    """

    key = "rest"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(rest(self.caller))


class CmdDRRespawn(Command):
    """
    Respawn missing enemies configured for the current room.

    Usage:
      respawn
    """

    key = "respawn"
    aliases = ["repop"]
    locks = "cmd:perm(Builders)"
    help_category = "Dragon Realms"

    def func(self):
        self.caller.msg(respawn_room_enemies(self.caller.location))


class CmdDRBuildCrossing(Command):
    """
    Build or update the Crossing room graph.

    Usage:
      drbuild crossing
    """

    key = "drbuild"
    locks = "cmd:perm(Builders)"
    help_category = "Dragon Realms"

    def func(self):
        if self.args.strip().lower() != "crossing":
            self.caller.msg("Usage: drbuild crossing")
            return
        result = build_crossing_world()
        if not result["ok"]:
            self.caller.msg("Crossing build failed:\n" + "\n".join(result["errors"]))
            return
        self.caller.msg(
            "Crossing build complete: "
            f"{result['created_rooms']} rooms created, {result['updated_rooms']} rooms updated, "
            f"{result['created_exits']} exits created, {result['updated_exits']} exits updated, "
            f"{result['created_npcs']} NPCs created, {result['updated_npcs']} NPCs updated, "
            f"{result['created_enemies']} enemies created, {result['updated_enemies']} enemies updated, "
            f"{result['created_respawn_scripts']} respawn scripts created, "
            f"{result['updated_respawn_scripts']} respawn scripts updated."
        )
