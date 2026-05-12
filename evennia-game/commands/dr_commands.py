"""
Dragon Realms Next Gen command scaffold for Evennia.

These commands intentionally keep the text-first interface. They are the
first migration bridge from the Node prototype into Evennia's command loop.
"""

from evennia.commands.command import Command

from world.dr_data import SKILLSETS, build_starter_skills
from world.dr_combat import advance, bash, defend, flee, health_text, jab, loot_corpse, range_status, respawn_room_enemies, retreat, scan_room, stance, target_enemy, wait_recover
from world.dr_economy import buy_item, format_shop, get_item, hands_text, inventory_text, sell_item, shop_talk
from world.dr_guilds import join_guild
from world.dr_identity import choose_race
from world.dr_progression import advance_circle, train_skill
from world.dr_world import build_crossing_world


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
        race_name = character.db.race_name or "Human"
        guild_name = character.db.guild_name or "Unaffiliated"
        circle = character.db.circle or 1
        wallet = character.db.wallet or {"plat": 0, "trias": 0, "lucan": 0, "silk": 0}

        character.msg(
            "\n".join(
                [
                    f"You are {character.key}, race {race_name}.",
                    f"Guild: {guild_name}. Circle {circle}.",
                    "Wallet: "
                    f"{wallet.get('plat', 0)} plat, {wallet.get('trias', 0)} trias, "
                    f"{wallet.get('lucan', 0)} lucan, {wallet.get('silk', 0)} silk.",
                ]
            )
        )


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
            "race": character.db.race or "human",
            "race_name": character.db.race_name or "Human",
            "guild_id": character.db.guild_id or "commoner",
            "guild_name": character.db.guild_name or "Unaffiliated",
            "circle": character.db.circle or 1,
        }
        result = choose_race(state, self.args.strip())
        if result["changed"]:
            character.db.race = state["race"]
            character.db.race_name = state["race_name"]
            character.db.guild_id = state["guild_id"]
            character.db.guild_name = state["guild_name"]
            character.db.circle = state["circle"]
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
        character.msg("\n".join(result["events"]))


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
        }
        events = train_skill(state, self.args.strip())
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRCircle(Command):
    """
    Check or advance Circle progression.

    Usage:
      circle
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
        }
        events = advance_circle(state)
        character.db.circle = state["circle"]
        character.db.skills = state["skills"]
        character.msg("\n".join(events))


class CmdDRShop(Command):
    """
    Show or talk to the current shopkeeper.

    Usage:
      shop
      shop talk
    """

    key = "shop"
    locks = "cmd:all()"
    help_category = "Dragon Realms"

    def func(self):
        action = self.args.strip().lower()
        if action == "talk":
            self.caller.msg(shop_talk(self.caller.location))
            return
        self.caller.msg(format_shop(self.caller.location))


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
