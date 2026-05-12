"""
Identity helpers for the Evennia Dragon Realms migration.
"""

from world.dr_data import RACES


def normalize_race_token(value):
    """Normalize player-entered race names to race ids."""

    token = "_".join("".join(char.lower() if char.isalnum() else " " for char in value).split())
    aliases = {
        "gortog": "gor_tog",
        "gor_tog": "gor_tog",
        "skra_mur": "s_raeth",
        "skra": "s_raeth",
        "s_kra_mur": "s_raeth",
        "s_raeth": "s_raeth",
        "s_kra": "s_raeth",
    }
    return aliases.get(token, token)


def choose_race(character_state, requested_race):
    """
    Choose a canonical race for an unaffiliated Circle 1 character.

    Race selection is intentionally constrained to the early identity phase.
    Guilds are joined later in-world at registrar rooms.
    """

    race_id = normalize_race_token(requested_race)
    if not race_id:
        return {
            "changed": False,
            "events": [
                f"Choose a race: {', '.join(RACES.values())}.",
                "Usage: race <race name>",
            ],
        }
    if race_id not in RACES:
        return {
            "changed": False,
            "events": [f'Unknown race "{requested_race}". Choose one of: {", ".join(RACES.values())}.'],
        }
    if character_state.get("guild_id", "commoner") != "commoner" or int(character_state.get("circle") or 1) != 1:
        return {
            "changed": False,
            "events": ["Race can only be chosen before joining a guild and before advancing beyond Circle 1."],
        }

    character_state["race"] = race_id
    character_state["race_name"] = RACES[race_id]
    character_state["guild_id"] = "commoner"
    character_state["guild_name"] = "Unaffiliated"
    character_state["circle"] = 1
    return {"changed": True, "events": [f"You are now recorded as {RACES[race_id]}."]}
