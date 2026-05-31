"""
Guild helpers for the Evennia Dragon Realms migration.
"""

from world.dr_data import GUILDS
from world.dr_progression import unlocked_guild_perks


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
