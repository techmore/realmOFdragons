"""
Progression helpers for the Evennia Dragon Realms migration.
"""

from world.dr_data import GUILDS, GUILD_PRIMARY_SKILLS, SKILLS, build_starter_skills


GUILD_CIRCLE_PERKS = {
    guild_id: {
        circle: f"{guild_name} Circle {circle} recognition"
        for circle in range(1, 11)
    }
    for guild_id, guild_name in GUILDS.items()
}


def normalize_skill_token(value):
    """Normalize player-entered skill names to internal ids."""

    return "_".join("".join(char.lower() if char.isalnum() else " " for char in value).split())


def resolve_skill_id(skills, requested):
    """Resolve a skill id or spaced display name."""

    token = normalize_skill_token(requested)
    if not token:
        return ""
    if token == "scouting":
        return "instinct"
    if token in skills:
        return token
    for skill_id, skill in skills.items():
        if normalize_skill_token(skill.get("name", "")) == token:
            return skill_id
    return token


def total_skill_ranks(skills):
    """Return total ranks across all skills."""

    return sum(int(skill.get("rank", 0)) for skill in skills.values())


def primary_skill_for_guild(guild_id):
    """Return the guild primary skill id, with commoner fallback."""

    return GUILD_PRIMARY_SKILLS.get(guild_id, "athletics")


def guild_circle_perk(guild_id, circle):
    """Return the clean-room milestone text for a guild Circle."""

    return GUILD_CIRCLE_PERKS.get(guild_id, {}).get(int(circle or 1), "Unaffiliated training milestone")


def unlocked_guild_perks(guild_id, circle):
    """Return all guild milestones unlocked through the current Circle, capped to Circle 10."""

    max_circle = min(10, max(1, int(circle or 1)))
    return [guild_circle_perk(guild_id, step) for step in range(1, max_circle + 1)]


def next_circle_requirement(circle):
    """Return the prototype Circle requirement for the next Circle."""

    next_circle = int(circle or 1) + 1
    return {"next_circle": next_circle, "total_ranks": next_circle * 3, "primary_rank": next_circle * 2}


def apply_skill_pool_gain(skills, skill_id, amount):
    """Apply a skill pool gain and rank up on the prototype 5-pulse threshold."""

    skill = skills.get(skill_id)
    if not skill:
        return []

    skill["pool"] = int(skill.get("pool", 0)) + max(1, int(amount))
    events = []
    if skill["pool"] >= 5:
        skill["pool"] -= 5
        skill["rank"] = int(skill.get("rank", 0)) + 1
        events.append(f"{skill['name']} improves to rank {skill['rank']}.")
    return events


def train_skill(character_state, requested_skill=""):
    """
    Train a requested skill or the character guild primary.

    character_state must contain guild_id and skills keys.
    """

    skills = character_state.setdefault("skills", build_starter_skills())
    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    if guild_id != "commoner" and room_guild_id != guild_id:
        if not room_guild_id:
            return ["You need a suitable training room or your guild registrar to train here."]
        return ["This guildhall will not train your guild."]
    primary_skill = primary_skill_for_guild(guild_id)
    skill_id = resolve_skill_id(skills, requested_skill) if requested_skill else primary_skill
    skill = skills.get(skill_id)
    if not skill:
        return [f'You do not know how to train "{skill_id}".']

    amount = 5 if skill_id == primary_skill else 3
    events = apply_skill_pool_gain(skills, skill_id, amount)
    if skill_id != "athletics":
        events.extend(apply_skill_pool_gain(skills, "athletics", 1))
    events.append(f"You drill {skill['name']}.")
    return events


def circle_status(character_state):
    """Return text describing the next Circle requirement."""

    circle = int(character_state.get("circle") or 1)
    guild_name = character_state.get("guild_name") or "Unaffiliated"
    guild_id = character_state.get("guild_id") or "commoner"
    skills = character_state.setdefault("skills", build_starter_skills())
    requirement = next_circle_requirement(circle)
    primary_skill_id = primary_skill_for_guild(guild_id)
    primary_skill = skills.get(primary_skill_id, {"name": SKILLS.get(primary_skill_id, "Primary skill"), "rank": 0})
    return [
        f"You are Circle {circle} in {guild_name}.",
        f"Next Circle {requirement['next_circle']}: total skill ranks {total_skill_ranks(skills)}/{requirement['total_ranks']}.",
        f"{primary_skill['name']} rank {primary_skill.get('rank', 0)}/{requirement['primary_rank']}.",
        f"Current milestone: {guild_circle_perk(guild_id, circle)}.",
    ]


def can_circle(character_state):
    """Return True if the character meets prototype Circle requirements."""

    circle = int(character_state.get("circle") or 1)
    guild_id = character_state.get("guild_id") or "commoner"
    if guild_id == "commoner":
        return False
    skills = character_state.setdefault("skills", build_starter_skills())
    requirement = next_circle_requirement(circle)
    primary = skills.get(primary_skill_for_guild(guild_id), {"rank": 0})
    return total_skill_ranks(skills) >= requirement["total_ranks"] and int(primary.get("rank", 0)) >= requirement["primary_rank"]


def circle_location_error(character_state):
    """Return an error if the character is not at their own guild registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    if guild_id == "commoner":
        return ""
    room_guild_id = character_state.get("room_guild_id")
    if not room_guild_id:
        return "You must stand before your guild registrar to advance circles."
    if room_guild_id != guild_id:
        return "This registrar cannot advance your guild."
    return ""


def advance_circle(character_state):
    """Advance one Circle if possible and return output events."""

    events = circle_status(character_state)
    if character_state.get("guild_id") == "commoner":
        events.append("You need to join a guild before you can advance circles.")
        return events
    location_error = circle_location_error(character_state)
    if location_error:
        events.append(location_error)
        return events
    if can_circle(character_state):
        character_state["circle"] = int(character_state.get("circle") or 1) + 1
        events.append(f"You advance to Circle {character_state['circle']}.")
        events.append(f"Milestone unlocked: {guild_circle_perk(character_state.get('guild_id'), character_state['circle'])}.")
        character_state["guild_perks"] = unlocked_guild_perks(character_state.get("guild_id"), character_state["circle"])
    return events
