"""
Progression helpers for the Evennia Dragon Realms migration.
"""

from world.dr_data import GUILDS, GUILD_PRIMARY_SKILLS, SKILLS, build_starter_skills


MAX_SUPPORTED_CIRCLE = 10

GUILD_CIRCLE_PERKS = {
    guild_id: {
        circle: f"{guild_name} Circle {circle} recognition"
        for circle in range(1, 11)
    }
    for guild_id, guild_name in GUILDS.items()
}

GUILD_ABILITY_THEMES = {
    "barbarian": "martial focus and combat presence",
    "bard": "performance, lore, and group inspiration",
    "cleric": "devotion, recovery, and holy resolve",
    "empath": "care, diagnostics, and survival support",
    "moon_mage": "prediction, perception, and careful timing",
    "necromancer": "forbidden study and hidden resilience",
    "paladin": "oaths, defense, and steady protection",
    "ranger": "trailcraft, scouting, and wilderness movement",
    "thief": "stealth, misdirection, and urban awareness",
    "trader": "appraisal, negotiation, and logistics",
    "warrior_mage": "battle magic, elemental focus, and aggression",
}

GUILD_TECHNIQUES = {
    "barbarian": {"name": "Roar of Readiness", "skill": "tactics", "verb": "turns battlefield pressure into tactical clarity"},
    "bard": {"name": "Measured Refrain", "skill": "performance", "verb": "sets a rhythm that sharpens performance"},
    "cleric": {"name": "Litany of Resolve", "skill": "scholarship", "verb": "anchors devotion through studied discipline"},
    "empath": {"name": "Careful Diagnosis", "skill": "first_aid", "verb": "reads wounds and steadies triage"},
    "moon_mage": {"name": "Moment of Alignment", "skill": "perception", "verb": "studies timing through heightened perception"},
    "necromancer": {"name": "Hidden Thesis", "skill": "sorcery", "verb": "channels forbidden study into controlled theory"},
    "paladin": {"name": "Guarded Oath", "skill": "defending", "verb": "sets an oath into practical defense"},
    "ranger": {"name": "Trail Sign", "skill": "outdoorsmanship", "verb": "reads terrain and wilderness movement"},
    "thief": {"name": "Quiet Angle", "skill": "stealth", "verb": "finds cover in city noise and shadow"},
    "trader": {"name": "Ledger Sense", "skill": "appraisal", "verb": "weighs risk through quick appraisal"},
    "warrior_mage": {"name": "Elemental Vector", "skill": "targeted_magic", "verb": "aligns aggression with targeted magic"},
}

GUILD_BOONS = {
    "barbarian": {"name": "Battle Temper", "skill": "expertise", "text": "hardens your battle presence"},
    "bard": {"name": "Resonant Memory", "skill": "bardic_lore", "text": "sets guild lore into practiced recall"},
    "cleric": {"name": "Devotional Reserve", "skill": "theurgy", "text": "steadies your devotional reserves"},
    "empath": {"name": "Gentle Hands", "skill": "empathy", "text": "turns careful attention into steadier care"},
    "moon_mage": {"name": "Measured Fate", "skill": "astrology", "text": "marks a clearer pattern in your observations"},
    "necromancer": {"name": "Hidden Discipline", "skill": "thanatology", "text": "locks dangerous study behind discipline"},
    "paladin": {"name": "Oath-Bound Guard", "skill": "conviction", "text": "sets your oath into durable habit"},
    "ranger": {"name": "Trail Memory", "skill": "instinct", "text": "binds trail signs into reflex"},
    "thief": {"name": "Quiet Advantage", "skill": "backstab", "text": "banks a practical edge from silence"},
    "trader": {"name": "Market Poise", "skill": "trading", "text": "turns negotiation into steadier judgment"},
    "warrior_mage": {"name": "Elemental Reserve", "skill": "summoning", "text": "stores battlefield force in elemental focus"},
}

STUDY_ROOMS = {
    "crossing-GU02-001": {"name": "Arcane Study Hall", "skill": "arcana", "text": "You study public notes on basic magical theory"},
    "crossing-GU12-001": {"name": "Moon Mage Observatory", "skill": "astrology", "text": "You study careful star tables and timing marks"},
    "crossing-GU13-001": {"name": "Lower Study", "skill": "thanatology", "text": "You study coded marginalia in the secluded lower study"},
    "crossing-GU06-001": {"name": "Bard Guild Conservatory", "skill": "performance", "text": "You study cadence marks and performance notation"},
    "crossing-GU08-001": {"name": "Empath Guild Clinic", "skill": "first_aid", "text": "You study triage notes and careful diagnostic examples"},
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


def guild_ability_summary(guild_id, circle):
    """Return user-visible clean-room ability text unlocked through the current Circle."""

    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You have no guild abilities yet. Visit a registrar and use `join guild`."]
    max_circle = min(10, max(1, int(circle or 1)))
    guild_name = GUILDS[guild_id]
    theme = GUILD_ABILITY_THEMES.get(guild_id, "guild training")
    lines = [f"{guild_name} abilities through Circle {max_circle}:"]
    for step in range(1, max_circle + 1):
        lines.append(f"- Circle {step}: {theme}; {guild_circle_perk(guild_id, step)}.")
    if guild_id in GUILD_BOONS:
        boon = GUILD_BOONS[guild_id]
        lines.append(f"Registrar boon: {boon['name']} supports {SKILLS[boon['skill']]}. Use `boon` at your registrar once per Circle.")
    if max_circle >= MAX_SUPPORTED_CIRCLE:
        lines.append(f"Circle {MAX_SUPPORTED_CIRCLE} is the current supported ability cap.")
    else:
        lines.append("Use `circle status` to see what is needed for the next unlock.")
    return lines


def use_guild_focus(character_state):
    """Apply the active guild focus as a small primary-skill pulse."""

    guild_id = character_state.get("guild_id") or "commoner"
    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You have no guild focus yet. Visit a registrar and use `join guild`."]
    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    primary_skill = skills.get(primary_skill_id)
    if not primary_skill:
        return [f"Your {GUILDS[guild_id]} focus cannot find its primary skill."]
    pulse = 1 + ((circle - 1) // 3)
    events = apply_skill_pool_gain(skills, primary_skill_id, pulse)
    events.append(f"You center your {GUILDS[guild_id]} focus through Circle {circle}, feeding {primary_skill['name']} by {pulse}.")
    events.append("Use `abilities` to review your current guild unlocks.")
    return events


def use_guild_technique(character_state):
    """Apply a guild-specific Circle-scaled support technique."""

    guild_id = character_state.get("guild_id") or "commoner"
    technique = GUILD_TECHNIQUES.get(guild_id)
    if not technique:
        return ["You have no guild technique yet. Visit a registrar and use `join guild`."]
    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    skill_id = technique["skill"]
    skill = skills.get(skill_id)
    if not skill:
        return [f"Your {technique['name']} cannot find {skill_id} training."]
    pulse = 1 + (circle // 4)
    events = apply_skill_pool_gain(skills, skill_id, pulse)
    events.append(f"{technique['name']} {technique['verb']}, feeding {skill['name']} by {pulse}.")
    events.append("Use `guild` and `abilities` to review your Circle milestones.")
    return events


def use_guild_practice(character_state):
    """Practice guild forms at the character's own registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You need to join a guild before using guild practice."]
    if room_guild_id != guild_id:
        return ["Guild practice requires your own registrar. Use `circle status` to find the right room."]

    events = [f"You practice before the {GUILDS[guild_id]} registrar."]
    events.extend(use_guild_focus(character_state))
    events.extend(use_guild_technique(character_state))
    return events


def use_guild_boon(character_state):
    """Claim a persistent once-per-Circle guild boon at the character's own registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    boon = GUILD_BOONS.get(guild_id)
    if not boon:
        return ["You need to join a guild before claiming a guild boon."]
    if room_guild_id != guild_id:
        return ["Guild boons are granted only by your own registrar. Use `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    boon_key = f"{guild_id}:{circle}"
    claimed = list(character_state.get("guild_boons") or [])
    if boon_key in claimed:
        return [f"{boon['name']} for Circle {circle} is already claimed."]

    skills = character_state.setdefault("skills", build_starter_skills())
    skill_id = boon["skill"]
    skill = skills.get(skill_id)
    if not skill:
        return [f"{boon['name']} cannot find {skill_id} training."]
    pulse = 2 + (circle // 2)
    events = apply_skill_pool_gain(skills, skill_id, pulse)
    claimed.append(boon_key)
    character_state["guild_boons"] = claimed
    events.append(f"{boon['name']} {boon['text']}, granting a Circle {circle} boon to {skill['name']} by {pulse}.")
    events.append("This boon is now recorded on your guild progression.")
    return events


def study_room(character_state):
    """Study notes in public study rooms or at a character's own registrar."""

    room_id = character_state.get("room_id") or ""
    room_guild_id = character_state.get("room_guild_id")
    guild_id = character_state.get("guild_id") or "commoner"
    skills = character_state.setdefault("skills", build_starter_skills())
    if room_guild_id and room_guild_id == guild_id and guild_id in GUILDS:
        skill_id = primary_skill_for_guild(guild_id)
        skill = skills.get(skill_id, {"name": SKILLS.get(skill_id, skill_id)})
        events = apply_skill_pool_gain(skills, "scholarship", 2)
        events.extend(apply_skill_pool_gain(skills, skill_id, 1))
        events.append(f"You study {GUILDS[guild_id]} registrar notes, reinforcing Scholarship and {skill['name']}.")
        return events

    study = STUDY_ROOMS.get(room_id)
    if not study:
        return ["There is nothing structured to study here. Try a study hall, observatory, clinic, conservatory, or your own registrar."]
    skill_id = study["skill"]
    skill = skills.get(skill_id, {"name": SKILLS.get(skill_id, skill_id)})
    events = apply_skill_pool_gain(skills, "scholarship", 2)
    events.extend(apply_skill_pool_gain(skills, skill_id, 1))
    events.append(f"{study['text']}, reinforcing Scholarship and {skill['name']}.")
    return events


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
    if guild_id == "commoner":
        return [
            f"You are Circle {circle} in {guild_name}.",
            "You are unaffiliated and cannot advance circles yet.",
            "Next step: visit a guild registrar in Crossing and use `join guild`.",
        ]
    registrar_room_id = registrar_room_for_guild(guild_id)
    room_guild_id = character_state.get("room_guild_id")
    location_hint = f"Registrar: {registrar_room_id}." if registrar_room_id else "Registrar: unknown."
    if circle >= MAX_SUPPORTED_CIRCLE:
        return [
            f"You are Circle {circle} in {guild_name}.",
            f"Circle {MAX_SUPPORTED_CIRCLE} is the current supported cap for this Evennia port.",
            f"Current milestone: {guild_circle_perk(guild_id, circle)}.",
            location_hint,
            "Next step: continue training skills or test Crossing shops and hunting rooms.",
        ]
    requirement = next_circle_requirement(circle)
    primary_skill_id = primary_skill_for_guild(guild_id)
    primary_skill = skills.get(primary_skill_id, {"name": SKILLS.get(primary_skill_id, "Primary skill"), "rank": 0})
    total_ranks = total_skill_ranks(skills)
    primary_rank = int(primary_skill.get("rank", 0) or 0)
    total_remaining = max(0, requirement["total_ranks"] - total_ranks)
    primary_remaining = max(0, requirement["primary_rank"] - primary_rank)
    if total_remaining == 0 and primary_remaining == 0:
        if room_guild_id == guild_id:
            next_step = "Next step: use `circle` to advance."
        else:
            next_step = "Next step: stand before your guild registrar and use `circle`."
    elif room_guild_id == guild_id:
        next_step = f"Next step: train {primary_skill_id}."
    else:
        next_step = "Next step: return to your guild registrar to train and circle."
    return [
        f"You are Circle {circle} in {guild_name}.",
        f"Next Circle {requirement['next_circle']}: total skill ranks {total_ranks}/{requirement['total_ranks']} ({total_remaining} needed).",
        f"{primary_skill['name']} rank {primary_rank}/{requirement['primary_rank']} ({primary_remaining} needed).",
        f"Current milestone: {guild_circle_perk(guild_id, circle)}.",
        location_hint,
        next_step,
    ]


def registrar_room_for_guild(guild_id):
    """Return the Crossing registrar room id without making progression own world data."""

    try:
        from world.dr_world import guild_registrar_rooms
    except ImportError:
        return ""
    return guild_registrar_rooms().get(guild_id, "")


def can_circle(character_state):
    """Return True if the character meets prototype Circle requirements."""

    circle = int(character_state.get("circle") or 1)
    guild_id = character_state.get("guild_id") or "commoner"
    if circle >= MAX_SUPPORTED_CIRCLE:
        return False
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
    if int(character_state.get("circle") or 1) >= MAX_SUPPORTED_CIRCLE:
        events.append("You have reached the current Circle 10 cap.")
        character_state["guild_perks"] = unlocked_guild_perks(character_state.get("guild_id"), MAX_SUPPORTED_CIRCLE)
        return events
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
