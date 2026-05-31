"""
Guild helpers for the Evennia Dragon Realms migration.
"""

from world.dr_data import GUILDS
from world.dr_progression import GUILD_TECHNIQUES, primary_skill_for_guild, unlocked_guild_perks


REGISTRAR_PERSONALITIES = {
    "barbarian": "The registrar studies your stance before speaking.",
    "bard": "The registrar taps a measured rhythm against the roll book.",
    "cleric": "The registrar weighs your intent with calm attention.",
    "empath": "The registrar watches for steadiness and care.",
    "moon_mage": "The registrar notes the hour before answering.",
    "necromancer": "The registrar keeps the conversation quiet and exact.",
    "paladin": "The registrar speaks with formal restraint.",
    "ranger": "The registrar checks your trail readiness at a glance.",
    "thief": "The registrar keeps one eye on the room while speaking.",
    "trader": "The registrar balances the ledger before looking up.",
    "warrior_mage": "The registrar stands near scorched practice marks.",
}


def join_guild(character_state, room_state):
    """Join the guild represented by the current room, if it is a registrar."""

    guild_id = room_state.get("guild")
    if not guild_id:
        return {"joined": False, "events": ["There is no guild registrar here."]}
    if guild_id not in GUILDS:
        return {"joined": False, "events": [f'The registrar data for "{guild_id}" is not recognized.']}
    if character_state.get("guild_id") not in (None, "", "commoner"):
        return {"joined": False, "events": [f"You are already registered with {character_state.get('guild_name')}."]}

    character_state["guild_id"] = guild_id
    character_state["guild_name"] = GUILDS[guild_id]
    character_state["circle"] = int(character_state.get("circle") or 1)
    character_state["guild_perks"] = unlocked_guild_perks(guild_id, character_state["circle"])
    return {"joined": True, "events": [f"You are now registered with {GUILDS[guild_id]}.", f"Milestone unlocked: {character_state['guild_perks'][-1]}."]}


def registrar_text(character_state, room_state):
    """Return room registrar guidance with guild-specific next commands."""

    guild_id = room_state.get("guild")
    if not guild_id:
        return ["There is no guild registrar here. Find a guildhall in Crossing first."]
    if guild_id not in GUILDS:
        return [f'The registrar data for "{guild_id}" is not recognized.']
    guild_name = GUILDS[guild_id]
    primary_skill_id = primary_skill_for_guild(guild_id)
    technique = GUILD_TECHNIQUES.get(guild_id, {})
    character_guild_id = character_state.get("guild_id") or "commoner"
    circle = int(character_state.get("circle") or 1)
    lines = [
        f"{guild_name} registrar:",
        REGISTRAR_PERSONALITIES.get(guild_id, "The registrar reviews the guild roll."),
        f"Primary training: {primary_skill_id}.",
        f"Signature technique: {technique.get('name', 'Guild technique')}.",
    ]
    if character_guild_id == "commoner":
        lines.extend(
            [
                "You are not registered with a guild.",
                "Next commands: join guild, guild, train, circle status.",
            ]
        )
    elif character_guild_id == guild_id:
        lines.extend(
            [
                f"You are registered here at Circle {circle}.",
                "Next commands: train, circle status, circle, abilities, focus, technique, mentor, lesson, passive, drill, practice, rite, boon, capstone.",
            ]
        )
    else:
        lines.extend(
            [
                f"You are already registered with {character_state.get('guild_name')}.",
                "This registrar can explain the hall, but cannot train or advance your guild.",
            ]
        )
    return lines
