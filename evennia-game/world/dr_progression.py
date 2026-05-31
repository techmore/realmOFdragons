"""
Progression helpers for the Evennia Dragon Realms migration.
"""

from world.dr_data import GUILDS, GUILD_PRIMARY_SKILLS, SKILLS, build_starter_skills


MAX_SUPPORTED_CIRCLE = 10

GUILD_TITLE_BASES = {
    "barbarian": "Pit",
    "bard": "Verse",
    "cleric": "Votive",
    "empath": "Clinic",
    "moon_mage": "Star",
    "necromancer": "Veiled",
    "paladin": "Oath",
    "ranger": "Trail",
    "thief": "Shadow",
    "trader": "Ledger",
    "warrior_mage": "Elemental",
}

GUILD_TITLE_RANKS = {
    1: "Novice",
    2: "Apprentice",
    3: "Initiate",
    4: "Adept",
    5: "Journeyman",
    6: "Practitioner",
    7: "Specialist",
    8: "Veteran",
    9: "Senior",
    10: "Tenth-Circle",
}

GUILD_CIRCLE_PERK_NAMES = {
    "barbarian": (
        "Pit Footing",
        "War Cry Breath",
        "Iron Hide Habit",
        "Blooded Measure",
        "Fury Harness",
        "Shock Line Read",
        "Unbroken Charge",
        "Pain Ledger",
        "Field Dominance",
        "Roar-Keeper Authority",
    ),
    "bard": (
        "Conservatory Ear",
        "Carried Beat",
        "Audience Read",
        "Memory Verse",
        "Counter-Melody",
        "Story Anchor",
        "Resonant Step",
        "Lore Chorus",
        "Commanding Refrain",
        "Masterwork Cadence",
    ),
    "cleric": (
        "Votive Posture",
        "Quiet Prayer",
        "Clean Doctrine",
        "Sanctuary Habit",
        "Consecrated Focus",
        "Wound Vigil",
        "Litany Resolve",
        "Pilgrim Authority",
        "Rite-Keeper Memory",
        "Charged Benediction",
    ),
    "empath": (
        "Gentle Attention",
        "Pulse Read",
        "Calm Hands",
        "Triage Path",
        "Shared Burden",
        "Pain Boundary",
        "Steady Clinic",
        "Crisis Poise",
        "Whole-Patient Sense",
        "Vigilant Mercy",
    ),
    "moon_mage": (
        "Night-Sky Habit",
        "Timing Mark",
        "Pattern Glimpse",
        "Careful Forecast",
        "Conjunction Step",
        "Fate Ledger",
        "Horizon Read",
        "Moment Thread",
        "Prediction Anchor",
        "Tenth Sign Clarity",
    ),
    "necromancer": (
        "Quiet Margin",
        "Veiled Method",
        "Bone-Library Recall",
        "Sealed Question",
        "Forbidden Discipline",
        "Ashen Proof",
        "Hidden Vessel",
        "Grave Measure",
        "Closed Formula",
        "Black Thesis Control",
    ),
    "paladin": (
        "Oath Stance",
        "Shield Courtesy",
        "Line Discipline",
        "Judgment Habit",
        "Vigil Step",
        "Guarded Advance",
        "Mercy Bound",
        "Standard Bearer",
        "Unyielding Watch",
        "Oath-Forged Charge",
    ),
    "ranger": (
        "Trail Memory",
        "Weather Nose",
        "Quiet Footing",
        "Game Sign",
        "Green Route",
        "Ambush Sense",
        "Long Path Patience",
        "Wilderness Ledger",
        "Known Crossing",
        "Trailmaster Certainty",
    ),
    "thief": (
        "Blind-Corner Sense",
        "Soft Step",
        "Crowd Mask",
        "Lock Patience",
        "Shadow Route",
        "Clean Lift",
        "Exit Ledger",
        "Silent Bargain",
        "Perfect Timing",
        "Unseen Authority",
    ),
    "trader": (
        "Counter Courtesy",
        "Quick Tally",
        "Route Price",
        "Risk Ledger",
        "Contract Poise",
        "Market Memory",
        "Cargo Judgment",
        "Negotiator's Pause",
        "Guild Credit",
        "Master Ledger Authority",
    ),
    "warrior_mage": (
        "Spark Discipline",
        "Battle Channel",
        "Elemental Reach",
        "Heat Measure",
        "Storm Focus",
        "Target Line",
        "Force Reserve",
        "Battlefield Attunement",
        "Elemental Command",
        "Tenth-Circle Vector",
    ),
}

GUILD_CIRCLE_PERKS = {
    guild_id: {
        circle: f"{GUILDS[guild_id]} Circle {circle}: {perk_name}"
        for circle, perk_name in enumerate(perk_names, start=1)
    }
    for guild_id, perk_names in GUILD_CIRCLE_PERK_NAMES.items()
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

GUILD_SIGNATURES = {
    "barbarian": {"name": "Roar Line", "skill": "tactics", "text": "sets battlefield presence into a quick command"},
    "bard": {"name": "Carried Refrain", "skill": "performance", "text": "carries a useful phrase through movement and work"},
    "cleric": {"name": "Votive Mark", "skill": "scholarship", "text": "sets doctrine into a practical remembered sign"},
    "empath": {"name": "Clinic Read", "skill": "first_aid", "text": "turns patient attention into immediate triage"},
    "moon_mage": {"name": "Moment Thread", "skill": "perception", "text": "catches a small pattern before it passes"},
    "necromancer": {"name": "Veiled Formula", "skill": "sorcery", "text": "keeps forbidden theory ordered and quiet"},
    "paladin": {"name": "Oath Line", "skill": "defending", "text": "sets protection into a visible stance"},
    "ranger": {"name": "Trail Mark", "skill": "outdoorsmanship", "text": "reads the next sign in terrain and habit"},
    "thief": {"name": "Shadow Pass", "skill": "stealth", "text": "finds a quiet angle through ordinary motion"},
    "trader": {"name": "Ledger Mark", "skill": "appraisal", "text": "turns a quick value read into practiced judgment"},
    "warrior_mage": {"name": "Elemental Line", "skill": "targeted_magic", "text": "aligns aimed force with battle focus"},
}

GUILD_MENTORS = {
    "barbarian": {"name": "Pit Mentor", "skill": "tactics", "advice": "measures your stance and demands cleaner pressure before the next charge"},
    "bard": {"name": "Conservatory Mentor", "skill": "bardic_lore", "advice": "sets your current Circle lesson into a sharper story and cadence"},
    "cleric": {"name": "Votive Mentor", "skill": "theurgy", "advice": "checks your doctrine, posture, and resolve before releasing you back to practice"},
    "empath": {"name": "Clinic Mentor", "skill": "empathy", "advice": "walks you through a calmer read of pain, breath, and triage order"},
    "moon_mage": {"name": "Observatory Mentor", "skill": "astrology", "advice": "marks your timing errors against a careful pattern ledger"},
    "necromancer": {"name": "Lower Study Mentor", "skill": "thanatology", "advice": "keeps your dangerous questions disciplined and quietly indexed"},
    "paladin": {"name": "Yard Mentor", "skill": "conviction", "advice": "tests whether your oath survives practical pressure and imperfect footing"},
    "ranger": {"name": "Field Mentor", "skill": "instinct", "advice": "turns trail mistakes into a clearer route, sign, and weather read"},
    "thief": {"name": "Quiet Mentor", "skill": "backstab", "advice": "points out missed corners, exits, and timing without raising their voice"},
    "trader": {"name": "Exchange Mentor", "skill": "trading", "advice": "reviews your route risk, counter manners, and price memory"},
    "warrior_mage": {"name": "Range Mentor", "skill": "attunement", "advice": "forces your battle focus back into stable elemental control"},
}

GUILD_LESSONS = {
    "barbarian": {"name": "Pressure Lesson", "skill": "expertise", "text": "breaks a fight into stance, breath, and finishing force"},
    "bard": {"name": "Cadence Lesson", "skill": "bardic_lore", "text": "ties a working refrain to memory, timing, and audience read"},
    "cleric": {"name": "Doctrine Lesson", "skill": "theurgy", "text": "sets practice inside prayer, doctrine, and field resolve"},
    "empath": {"name": "Triage Lesson", "skill": "empathy", "text": "orders pain signs, calm hands, and patient attention"},
    "moon_mage": {"name": "Conjunction Lesson", "skill": "astrology", "text": "turns timing marks into a practical forecast habit"},
    "necromancer": {"name": "Sealed Lesson", "skill": "thanatology", "text": "keeps forbidden inquiry disciplined, indexed, and quiet"},
    "paladin": {"name": "Oath Lesson", "skill": "conviction", "text": "tests protection against pressure, judgment, and restraint"},
    "ranger": {"name": "Trail Lesson", "skill": "instinct", "text": "reads weather, sign, route, and likely movement together"},
    "thief": {"name": "Angle Lesson", "skill": "stealth", "text": "maps exits, blind corners, and timing before action"},
    "trader": {"name": "Route Lesson", "skill": "trading", "text": "balances price memory, risk, and contract discipline"},
    "warrior_mage": {"name": "Vector Lesson", "skill": "attunement", "text": "aligns elemental control with target line and battle tempo"},
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

GUILD_PASSIVES = {
    "barbarian": {"name": "Battle Readiness", "skill": "defending", "text": "keeps your guard braced between exchanges"},
    "bard": {"name": "Carried Cadence", "skill": "performance", "text": "keeps a useful rhythm under every action"},
    "cleric": {"name": "Steady Devotion", "skill": "theurgy", "text": "keeps devotional discipline present in small choices"},
    "empath": {"name": "Triage Awareness", "skill": "first_aid", "text": "keeps injury signs close to mind"},
    "moon_mage": {"name": "Pattern Watch", "skill": "perception", "text": "keeps subtle timing changes visible"},
    "necromancer": {"name": "Hidden Method", "skill": "thanatology", "text": "keeps forbidden study compartmentalized"},
    "paladin": {"name": "Oath Posture", "skill": "shield_usage", "text": "keeps protective habits set into stance"},
    "ranger": {"name": "Trail Sense", "skill": "outdoorsmanship", "text": "keeps terrain reads active while moving"},
    "thief": {"name": "Urban Cover", "skill": "stealth", "text": "keeps escape lines and blind spots mapped"},
    "trader": {"name": "Ledger Mind", "skill": "trading", "text": "keeps value and risk balanced"},
    "warrior_mage": {"name": "Elemental Poise", "skill": "attunement", "text": "keeps battle focus aligned with power"},
}

GUILD_DRILLS = {
    "barbarian": {"name": "Pit Exchange", "skill": "brawling", "text": "turns close pressure into controlled force"},
    "bard": {"name": "Verse Exchange", "skill": "bardic_lore", "text": "ties performance timing back to remembered lore"},
    "cleric": {"name": "Votive Cycle", "skill": "scholarship", "text": "binds formal study to devotional habit"},
    "empath": {"name": "Clinic Rotation", "skill": "empathy", "text": "pairs careful care with direct empathic attention"},
    "moon_mage": {"name": "Prediction Walk", "skill": "astrology", "text": "maps small observations onto practiced prediction"},
    "necromancer": {"name": "Sealed Recitation", "skill": "sorcery", "text": "keeps forbidden theory constrained by repetition"},
    "paladin": {"name": "Shield Line", "skill": "defending", "text": "sets protection into measured movement"},
    "ranger": {"name": "Trail Loop", "skill": "outdoorsmanship", "text": "links field signs with ranger instinct"},
    "thief": {"name": "Blind-Corner Pass", "skill": "backstab", "text": "turns quiet movement into practical angle control"},
    "trader": {"name": "Counter Ledger", "skill": "appraisal", "text": "ties market judgment to active negotiation"},
    "warrior_mage": {"name": "Spark Pattern", "skill": "targeted_magic", "text": "connects elemental reserve to aimed battle focus"},
}

GUILD_RITES = {
    "barbarian": {"name": "Circle of Iron", "skill": "expertise", "text": "turns controlled fury into disciplined readiness"},
    "bard": {"name": "Conservatory Call", "skill": "performance", "text": "sets guild memory into a performed cadence"},
    "cleric": {"name": "Votive Keeping", "skill": "theurgy", "text": "binds devotional repetition to practical resolve"},
    "empath": {"name": "Quiet Ward", "skill": "empathy", "text": "centers care before it becomes crisis"},
    "moon_mage": {"name": "Measured Conjunction", "skill": "astrology", "text": "matches observation with careful prediction"},
    "necromancer": {"name": "Sealed Formula", "skill": "thanatology", "text": "keeps dangerous study ordered and private"},
    "paladin": {"name": "Vigil Oath", "skill": "conviction", "text": "sets protection into repeated oath practice"},
    "ranger": {"name": "Path Memory", "skill": "instinct", "text": "lays trail signs into reflex and recall"},
    "thief": {"name": "Shadow Ledger", "skill": "stealth", "text": "counts exits, angles, and silence before movement"},
    "trader": {"name": "Market Rite", "skill": "trading", "text": "ties negotiation discipline to practical accounting"},
    "warrior_mage": {"name": "Elemental Binding", "skill": "summoning", "text": "contains force before directing it outward"},
}

GUILD_CAPSTONES = {
    "barbarian": {"name": "Tenth-Circle Roar", "skill": "tactics", "text": "sets battlefield authority into a finished Circle 10 form"},
    "bard": {"name": "Master Refrain", "skill": "bardic_lore", "text": "braids performance and remembered lore into a finished refrain"},
    "cleric": {"name": "Consecrated Charge", "skill": "scholarship", "text": "binds doctrine and devotion into a durable charge"},
    "empath": {"name": "Whole-Patient Vigil", "skill": "first_aid", "text": "joins care, diagnosis, and resolve into a complete practice"},
    "moon_mage": {"name": "Tenth Sign", "skill": "perception", "text": "ties prediction to the visible moment with careful certainty"},
    "necromancer": {"name": "Closed Thesis", "skill": "sorcery", "text": "seals dangerous theory behind a disciplined final proof"},
    "paladin": {"name": "Shielded Charge", "skill": "defending", "text": "anchors oath, shield, and line discipline into one form"},
    "ranger": {"name": "Known Trail", "skill": "outdoorsmanship", "text": "turns every sign along the trail into practiced certainty"},
    "thief": {"name": "Perfect Angle", "skill": "backstab", "text": "sets silence, timing, and escape into one clean approach"},
    "trader": {"name": "Master Ledger", "skill": "appraisal", "text": "balances risk, value, and route memory into expert judgment"},
    "warrior_mage": {"name": "Elemental Line", "skill": "targeted_magic", "text": "joins summoned force to aimed battle control"},
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


def milestone_skill_for_guild_circle(guild_id, circle):
    """Return the skill reinforced by a guild's current Circle milestone."""

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(circle or 1)))
    if guild_id not in GUILDS:
        return "athletics"
    if circle >= MAX_SUPPORTED_CIRCLE and guild_id in GUILD_CAPSTONES:
        return GUILD_CAPSTONES[guild_id]["skill"]
    if circle >= 5 and guild_id in GUILD_RITES:
        return GUILD_RITES[guild_id]["skill"]
    if circle == 4 and guild_id in GUILD_DRILLS:
        return GUILD_DRILLS[guild_id]["skill"]
    if circle == 3 and guild_id in GUILD_PASSIVES:
        return GUILD_PASSIVES[guild_id]["skill"]
    if circle == 2 and guild_id in GUILD_TECHNIQUES:
        return GUILD_TECHNIQUES[guild_id]["skill"]
    return primary_skill_for_guild(guild_id)


def guild_title(guild_id, circle):
    """Return a clean-room guild title for the current Circle."""

    if guild_id == "commoner" or guild_id not in GUILDS:
        return "Unaffiliated Commoner"
    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(circle or 1)))
    title_base = GUILD_TITLE_BASES.get(guild_id, "Guild")
    rank = GUILD_TITLE_RANKS.get(circle, f"Circle {circle}")
    return f"{rank} {title_base}"


def guild_title_ladder(guild_id, circle):
    """Return visible guild titles through the current Circle."""

    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You have no guild title yet. Visit a registrar and use `join guild`."]
    max_circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(circle or 1)))
    lines = [f"{GUILDS[guild_id]} titles through Circle {max_circle}:"]
    for step in range(1, max_circle + 1):
        marker = "current" if step == max_circle else "earned"
        lines.append(f"- Circle {step}: {guild_title(guild_id, step)} ({marker}).")
    if max_circle >= MAX_SUPPORTED_CIRCLE:
        lines.append(f"Current title: {guild_title(guild_id, max_circle)}. Circle {MAX_SUPPORTED_CIRCLE} is the current supported title cap.")
    else:
        lines.append(f"Current title: {guild_title(guild_id, max_circle)}. Use `circle status` to work toward the next title.")
    return lines


def experience_summary(character_state):
    """Return a compact progression/experience summary for command users."""

    guild_id = character_state.get("guild_id") or "commoner"
    guild_name = character_state.get("guild_name") or GUILDS.get(guild_id, "Unaffiliated")
    circle = int(character_state.get("circle") or 1)
    skills = character_state.setdefault("skills", build_starter_skills())
    total_ranks = total_skill_ranks(skills)
    primary_skill_id = primary_skill_for_guild(guild_id)
    primary_skill = skills.get(primary_skill_id, {"name": SKILLS.get(primary_skill_id, primary_skill_id), "rank": 0, "pool": 0})
    lines = [
        f"Experience summary: {guild_name}, Circle {circle}.",
        f"Title: {guild_title(guild_id, circle)}.",
        f"Total skill ranks: {total_ranks}.",
        f"Primary skill: {primary_skill['name']} rank {primary_skill.get('rank', 0)}, pool {primary_skill.get('pool', 0)}/5.",
    ]
    if guild_id == "commoner":
        lines.append("Next step: join a guild before Circle advancement.")
        return lines
    if circle >= MAX_SUPPORTED_CIRCLE:
        boon_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
        capstone_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
        claimed_boons = set(character_state.get("guild_boons") or [])
        claimed_capstones = set(character_state.get("guild_capstones") or [])
        lines.append(f"Circle {MAX_SUPPORTED_CIRCLE} is the current supported cap.")
        if boon_key not in claimed_boons:
            lines.append("Next step: use `boon` at your guild registrar.")
        elif capstone_key not in claimed_capstones:
            lines.append("Next step: use `capstone` at your guild registrar.")
        else:
            lines.append("Next step: continue training, shops, fieldcraft, and hunting.")
        return lines

    requirement = next_circle_requirement(circle)
    primary_rank = int(primary_skill.get("rank", 0) or 0)
    lines.append(f"Next Circle {requirement['next_circle']}: total ranks {total_ranks}/{requirement['total_ranks']}; {primary_skill['name']} {primary_rank}/{requirement['primary_rank']}.")
    if total_ranks >= requirement["total_ranks"] and primary_rank >= requirement["primary_rank"]:
        lines.append("Next step: stand before your guild registrar and use `circle`.")
    else:
        lines.append("Next step: train at your guild registrar, then check `circle status`.")
    return lines


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
    lines = [f"{guild_name} abilities through Circle {max_circle}:", f"Current title: {guild_title(guild_id, max_circle)}."]
    for step in range(1, max_circle + 1):
        lines.append(f"- Circle {step}: {theme}; {guild_circle_perk(guild_id, step)}.")
    if guild_id in GUILD_SIGNATURES:
        signature = GUILD_SIGNATURES[guild_id]
        lines.append(f"Guild signature: {signature['name']} supports {SKILLS[signature['skill']]}. Use `signature` anywhere after joining.")
    if guild_id in GUILD_MENTORS:
        mentor = GUILD_MENTORS[guild_id]
        lines.append(f"Registrar mentor: {mentor['name']} supports {SKILLS[mentor['skill']]}. Use `mentor` at your registrar.")
    if guild_id in GUILD_LESSONS:
        lesson = GUILD_LESSONS[guild_id]
        lines.append(f"Registrar lesson: {lesson['name']} supports {SKILLS[lesson['skill']]}. Use `lesson` at your registrar.")
    if guild_id in GUILD_BOONS:
        boon = GUILD_BOONS[guild_id]
        lines.append(f"Registrar boon: {boon['name']} supports {SKILLS[boon['skill']]}. Use `boon` at your registrar once per Circle.")
    if guild_id in GUILD_PASSIVES:
        passive = GUILD_PASSIVES[guild_id]
        lines.append(f"Passive training: {passive['name']} supports {SKILLS[passive['skill']]}. Use `passive` to reinforce it.")
    if guild_id in GUILD_DRILLS:
        drill = GUILD_DRILLS[guild_id]
        lines.append(f"Registrar drill: {drill['name']} supports {SKILLS[drill['skill']]}. Use `drill` at your registrar.")
    if guild_id in GUILD_RITES and max_circle >= 5:
        rite = GUILD_RITES[guild_id]
        lines.append(f"Circle rite: {rite['name']} supports {SKILLS[rite['skill']]}. Use `rite` at your registrar from Circle 5.")
    if guild_id in GUILD_CAPSTONES and max_circle >= MAX_SUPPORTED_CIRCLE:
        capstone = GUILD_CAPSTONES[guild_id]
        lines.append(f"Circle 10 capstone: {capstone['name']} supports {SKILLS[capstone['skill']]}. Use `capstone` at your registrar.")
    if max_circle >= MAX_SUPPORTED_CIRCLE:
        lines.append(f"Circle {MAX_SUPPORTED_CIRCLE} is the current supported ability cap.")
    else:
        lines.append("Use `circle status` to see what is needed for the next unlock.")
    return lines


def guild_history_summary(character_state):
    """Return earned Circle milestones and claimed guild rewards for a character."""

    guild_id = character_state.get("guild_id") or "commoner"
    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You have no guild history yet. Visit a registrar and use `join guild`."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    claimed_boons = set(character_state.get("guild_boons") or [])
    claimed_capstones = set(character_state.get("guild_capstones") or [])
    lines = [
        f"{GUILDS[guild_id]} history through Circle {circle}:",
        f"Current title: {guild_title(guild_id, circle)}.",
        "Earned Circle milestones:",
    ]
    for step in range(1, circle + 1):
        skill_id = milestone_skill_for_guild_circle(guild_id, step)
        skill_name = SKILLS.get(skill_id, skill_id)
        lines.append(f"- Circle {step}: {guild_circle_perk(guild_id, step)}; reinforces {skill_name}.")

    if guild_id in GUILD_BOONS:
        boon = GUILD_BOONS[guild_id]
        for step in range(1, circle + 1):
            reward_key = f"{guild_id}:{step}"
            marker = "claimed" if reward_key in claimed_boons else "unclaimed"
            lines.append(f"- Circle {step} boon: {boon['name']} ({SKILLS[boon['skill']]}) is {marker}.")
    if circle >= MAX_SUPPORTED_CIRCLE and guild_id in GUILD_CAPSTONES:
        capstone = GUILD_CAPSTONES[guild_id]
        reward_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
        marker = "claimed" if reward_key in claimed_capstones else "unclaimed"
        lines.append(f"- Circle {MAX_SUPPORTED_CIRCLE} capstone: {capstone['name']} ({SKILLS[capstone['skill']]}) is {marker}.")

    lines.append("Use `guild path`, `abilities`, `title`, and `experience` for next-step guidance.")
    return lines


def guild_path_summary(character_state):
    """Return a concise Circle-aware guild action plan for the current character."""

    guild_id = character_state.get("guild_id") or "commoner"
    if guild_id == "commoner" or guild_id not in GUILDS:
        return [
            "You have no guild path yet.",
            "Next step: visit a guild registrar in Crossing and use `join guild`.",
        ]
    room_guild_id = character_state.get("room_guild_id")
    registrar_room_id = registrar_room_for_guild(guild_id)
    if room_guild_id != guild_id:
        return [
            f"{GUILDS[guild_id]} path guidance is clearest at your own registrar.",
            f"Registrar: {registrar_room_id or 'unknown'}.",
            "Next step: return to your guild registrar, then use `guild path` again.",
        ]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    primary_skill = skills.get(primary_skill_id, {"name": SKILLS.get(primary_skill_id, primary_skill_id), "rank": 0})
    milestone = guild_circle_perk(guild_id, circle)
    lines = [
        f"{GUILDS[guild_id]} path at Circle {circle}.",
        f"Current title: {guild_title(guild_id, circle)}.",
        f"Current milestone: {milestone}.",
        f"Primary training: {primary_skill['name']} rank {primary_skill.get('rank', 0)}.",
        "Core loop: train, study, mentor, lesson, signature, focus, technique, passive, drill, circle status, circle.",
    ]
    if circle >= 5:
        rite = GUILD_RITES.get(guild_id)
        if rite:
            lines.append(f"Circle 5+ rite: use `rite` for {rite['name']} ({SKILLS[rite['skill']]}).")
    else:
        lines.append("Circle 5 rite is not open yet; keep training and circling.")

    boon_key = f"{guild_id}:{circle}"
    claimed_boons = set(character_state.get("guild_boons") or [])
    if boon_key not in claimed_boons:
        boon = GUILD_BOONS.get(guild_id)
        if boon:
            lines.append(f"Available boon: use `boon` for {boon['name']} ({SKILLS[boon['skill']]}).")
    elif circle < MAX_SUPPORTED_CIRCLE:
        lines.append("Circle boon claimed; continue training toward the next Circle.")

    capstone_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
    claimed_capstones = set(character_state.get("guild_capstones") or [])
    if circle >= MAX_SUPPORTED_CIRCLE:
        capstone = GUILD_CAPSTONES.get(guild_id)
        if capstone_key not in claimed_capstones and capstone:
            lines.append(f"Circle 10 capstone available: use `capstone` for {capstone['name']} ({SKILLS[capstone['skill']]}).")
        else:
            lines.append("Circle 10 capstone claimed; continue shops, hunting, fieldcraft, and skill training.")
    else:
        lines.append("Next step: use `circle status` to check requirements, then `train` and `circle`.")
    return lines


def guild_plan_summary(character_state):
    """Return a full Circle 1-10 guild plan for player-facing progression."""

    guild_id = character_state.get("guild_id") or "commoner"
    if guild_id == "commoner" or guild_id not in GUILDS:
        return [
            "You have no guild plan yet.",
            "Next step: visit a guild registrar in Crossing and use `join guild`.",
        ]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    registrar_room_id = registrar_room_for_guild(guild_id) or "unknown"
    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    primary_skill = skills.get(primary_skill_id, {"name": SKILLS.get(primary_skill_id, primary_skill_id), "rank": 0})
    lines = [
        f"{GUILDS[guild_id]} Circle plan through Circle {MAX_SUPPORTED_CIRCLE}:",
        f"Current Circle: {circle}. Current title: {guild_title(guild_id, circle)}.",
        f"Registrar: {registrar_room_id}. Primary training: {primary_skill['name']} rank {primary_skill.get('rank', 0)}.",
        "Circle ladder:",
    ]
    for step in range(1, MAX_SUPPORTED_CIRCLE + 1):
        skill_id = milestone_skill_for_guild_circle(guild_id, step)
        marker = "current" if step == circle else "earned" if step < circle else "locked"
        lines.append(f"- Circle {step}: {guild_circle_perk(guild_id, step)}; trains {SKILLS.get(skill_id, skill_id)} ({marker}).")

    mentor = GUILD_MENTORS.get(guild_id)
    lesson = GUILD_LESSONS.get(guild_id)
    signature = GUILD_SIGNATURES.get(guild_id)
    if mentor:
        lines.append(f"Registrar mentor: use `mentor` for {mentor['name']} ({SKILLS[mentor['skill']]}).")
    if lesson:
        lines.append(f"Registrar lesson: use `lesson` for {lesson['name']} ({SKILLS[lesson['skill']]}).")
    if signature:
        lines.append(f"Anywhere signature: use `signature` for {signature['name']} ({SKILLS[signature['skill']]}).")
    lines.append("Registrar actions: train, study, mentor, lesson, perk, milestone, drill, practice, rite, boon, capstone, circle status, circle.")
    if circle >= MAX_SUPPORTED_CIRCLE:
        lines.append(f"Circle {MAX_SUPPORTED_CIRCLE} is the current supported plan cap; continue guild rewards, shops, fieldcraft, and hunting.")
    else:
        requirement = next_circle_requirement(circle)
        lines.append(f"Next Circle {requirement['next_circle']}: total ranks {requirement['total_ranks']}; primary rank {requirement['primary_rank']}.")
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


def use_guild_signature(character_state):
    """Apply an always-available Circle-scaled guild identity action."""

    guild_id = character_state.get("guild_id") or "commoner"
    signature = GUILD_SIGNATURES.get(guild_id)
    if not signature:
        return ["You need to join a guild before using a guild signature."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    support_skill_id = signature["skill"]
    primary_skill = skills.get(primary_skill_id)
    support_skill = skills.get(support_skill_id)
    if not primary_skill:
        return [f"{signature['name']} cannot find {primary_skill_id} training."]
    if not support_skill:
        return [f"{signature['name']} cannot find {support_skill_id} training."]

    primary_pulse = 1 + ((circle - 1) // 5)
    support_pulse = 1 + ((circle - 1) // 3)
    events = apply_skill_pool_gain(skills, primary_skill_id, primary_pulse)
    events.extend(apply_skill_pool_gain(skills, support_skill_id, support_pulse))
    events.append(
        f"{signature['name']} {signature['text']}, training {primary_skill['name']} by {primary_pulse} and {support_skill['name']} by {support_pulse}."
    )
    events.append("Guild signatures are always-available Circle-scaled identity practice; use `abilities` for the full Circle list.")
    return events


def use_guild_mentor(character_state):
    """Ask a guild mentor for registrar-gated Circle-aware guidance and training."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    mentor = GUILD_MENTORS.get(guild_id)
    if not mentor:
        return ["You need to join a guild before asking a guild mentor."]
    if room_guild_id != guild_id:
        return ["Guild mentors work from your own registrar. Use `guilds` or `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    milestone_skill_id = milestone_skill_for_guild_circle(guild_id, circle)
    mentor_skill_id = mentor["skill"]
    milestone_skill = skills.get(milestone_skill_id)
    mentor_skill = skills.get(mentor_skill_id)
    if not milestone_skill:
        return [f"{mentor['name']} cannot find {milestone_skill_id} training."]
    if not mentor_skill:
        return [f"{mentor['name']} cannot find {mentor_skill_id} training."]

    milestone_pulse = 1 + ((circle - 1) // 4)
    mentor_pulse = 1 + ((circle - 1) // 5)
    events = apply_skill_pool_gain(skills, milestone_skill_id, milestone_pulse)
    events.extend(apply_skill_pool_gain(skills, mentor_skill_id, mentor_pulse))
    events.append(
        f"{mentor['name']} {mentor['advice']}, reinforcing Circle {circle} {milestone_skill['name']} by {milestone_pulse} and {mentor_skill['name']} by {mentor_pulse}."
    )
    events.append("Guild mentors are registrar NPC guidance for the current Circle band; use `guild path` for the full loop.")
    return events


def use_guild_lesson(character_state):
    """Run a registrar-gated guild lesson that trains lesson and milestone skills."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    lesson = GUILD_LESSONS.get(guild_id)
    if not lesson:
        return ["You need to join a guild before taking guild lessons."]
    if room_guild_id != guild_id:
        return ["Guild lessons require your own registrar. Use `guilds` or `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    milestone_skill_id = milestone_skill_for_guild_circle(guild_id, circle)
    lesson_skill_id = lesson["skill"]
    milestone_skill = skills.get(milestone_skill_id)
    lesson_skill = skills.get(lesson_skill_id)
    if not milestone_skill:
        return [f"{lesson['name']} cannot find {milestone_skill_id} training."]
    if not lesson_skill:
        return [f"{lesson['name']} cannot find {lesson_skill_id} training."]

    milestone_pulse = 1 + ((circle - 1) // 5)
    lesson_pulse = 2 + ((circle - 1) // 4)
    events = apply_skill_pool_gain(skills, milestone_skill_id, milestone_pulse)
    events.extend(apply_skill_pool_gain(skills, lesson_skill_id, lesson_pulse))
    events.append(
        f"{lesson['name']} {lesson['text']}, reinforcing Circle {circle} {milestone_skill['name']} by {milestone_pulse} and {lesson_skill['name']} by {lesson_pulse}."
    )
    events.append("Guild lessons are registrar-gated Circle-scaled instruction; use `guild plan` for the full Circle 1-10 route.")
    return events


def use_guild_milestone(character_state):
    """Practice the current named Circle milestone at the character's own registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You need to join a guild before practicing guild milestones."]
    if room_guild_id != guild_id:
        return ["Guild milestone practice requires your own registrar. Use `guilds` or `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    skill_id = milestone_skill_for_guild_circle(guild_id, circle)
    skill = skills.get(skill_id)
    if not skill:
        return [f"Your Circle {circle} milestone cannot find {skill_id} training."]
    pulse = 1 + ((circle - 1) // 3)
    milestone = guild_circle_perk(guild_id, circle)
    events = apply_skill_pool_gain(skills, skill_id, pulse)
    events.append(f"You practice {milestone}, reinforcing {skill['name']} by {pulse}.")
    events.append("Use `guild`, `abilities`, or `title` to review your current Circle identity.")
    return events


def use_guild_perk(character_state):
    """Invoke the character's current earned Circle perk at their registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    if guild_id == "commoner" or guild_id not in GUILDS:
        return ["You need to join a guild before using Circle perks."]
    if room_guild_id != guild_id:
        return ["Circle perk practice requires your own registrar. Use `guilds` or `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    skill_id = milestone_skill_for_guild_circle(guild_id, circle)
    skill = skills.get(skill_id)
    if not skill:
        return [f"Your Circle {circle} perk cannot find {skill_id} training."]

    perk_name = GUILD_CIRCLE_PERK_NAMES[guild_id][circle - 1]
    pulse = 2 + ((circle - 1) // 4)
    events = apply_skill_pool_gain(skills, skill_id, pulse)
    events.append(f"You invoke {perk_name}, applying your Circle {circle} {GUILDS[guild_id]} perk to {skill['name']} by {pulse}.")
    events.append("Use `guild history` to review earned perks and `milestone` for formal milestone practice.")
    return events


def use_guild_passive(character_state):
    """Reinforce a guild's passive Circle-scaled training identity."""

    guild_id = character_state.get("guild_id") or "commoner"
    passive = GUILD_PASSIVES.get(guild_id)
    if not passive:
        return ["You have no guild passive training yet. Visit a registrar and use `join guild`."]
    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    skill_id = passive["skill"]
    skill = skills.get(skill_id)
    if not skill:
        return [f"{passive['name']} cannot find {skill_id} training."]
    pulse = 1 + ((circle - 1) // 4)
    events = apply_skill_pool_gain(skills, skill_id, pulse)
    events.append(f"{passive['name']} {passive['text']}, reinforcing {skill['name']} by {pulse}.")
    events.append("This is passive guild identity training; use `abilities` to review the full Circle list.")
    return events


def use_guild_drill(character_state):
    """Run a registrar-gated guild drill that trains primary and support skills."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    drill = GUILD_DRILLS.get(guild_id)
    if not drill:
        return ["You need to join a guild before using guild drills."]
    if room_guild_id != guild_id:
        return ["Guild drills require your own registrar. Use `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    support_skill_id = drill["skill"]
    primary_skill = skills.get(primary_skill_id)
    support_skill = skills.get(support_skill_id)
    if not primary_skill:
        return [f"{drill['name']} cannot find {primary_skill_id} training."]
    if not support_skill:
        return [f"{drill['name']} cannot find {support_skill_id} training."]

    primary_pulse = 1 + ((circle - 1) // 5)
    support_pulse = 1 + ((circle - 1) // 3)
    events = apply_skill_pool_gain(skills, primary_skill_id, primary_pulse)
    events.extend(apply_skill_pool_gain(skills, support_skill_id, support_pulse))
    events.append(
        f"{drill['name']} {drill['text']}, training {primary_skill['name']} by {primary_pulse} and {support_skill['name']} by {support_pulse}."
    )
    events.append("Registrar drills are guild-specific Circle practice for the current level-10 progression band.")
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


def use_guild_rite(character_state):
    """Perform a Circle 5+ guild rite at the character's own registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    rite = GUILD_RITES.get(guild_id)
    if not rite:
        return ["You need to join a guild before performing a guild rite."]
    if room_guild_id != guild_id:
        return ["Guild rites require your own registrar. Use `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    if circle < 5:
        return ["Guild rites open at Circle 5. Keep training and circling with your registrar."]

    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    rite_skill_id = rite["skill"]
    primary_skill = skills.get(primary_skill_id)
    rite_skill = skills.get(rite_skill_id)
    if not primary_skill:
        return [f"{rite['name']} cannot find {primary_skill_id} training."]
    if not rite_skill:
        return [f"{rite['name']} cannot find {rite_skill_id} training."]

    primary_pulse = 1 + ((circle - 1) // 6)
    rite_pulse = 2 + ((circle - 1) // 4)
    events = apply_skill_pool_gain(skills, primary_skill_id, primary_pulse)
    events.extend(apply_skill_pool_gain(skills, rite_skill_id, rite_pulse))
    events.append(
        f"{rite['name']} {rite['text']}, training {primary_skill['name']} by {primary_pulse} and {rite_skill['name']} by {rite_pulse}."
    )
    events.append("Guild rites are Circle 5+ registrar exercises for deeper guild identity.")
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


def use_guild_capstone(character_state):
    """Claim a persistent Circle 10 guild capstone at the character's own registrar."""

    guild_id = character_state.get("guild_id") or "commoner"
    room_guild_id = character_state.get("room_guild_id")
    capstone = GUILD_CAPSTONES.get(guild_id)
    if not capstone:
        return ["You need to join a guild before claiming a guild capstone."]
    if room_guild_id != guild_id:
        return ["Guild capstones require your own registrar. Use `circle status` to find the right room."]

    circle = min(MAX_SUPPORTED_CIRCLE, max(1, int(character_state.get("circle") or 1)))
    if circle < MAX_SUPPORTED_CIRCLE:
        return [f"Guild capstones open at Circle {MAX_SUPPORTED_CIRCLE}. Keep training and circling with your registrar."]

    capstone_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
    claimed = list(character_state.get("guild_capstones") or [])
    if capstone_key in claimed:
        return [f"{capstone['name']} for Circle {MAX_SUPPORTED_CIRCLE} is already claimed."]

    skills = character_state.setdefault("skills", build_starter_skills())
    primary_skill_id = primary_skill_for_guild(guild_id)
    capstone_skill_id = capstone["skill"]
    primary_skill = skills.get(primary_skill_id)
    capstone_skill = skills.get(capstone_skill_id)
    if not primary_skill:
        return [f"{capstone['name']} cannot find {primary_skill_id} training."]
    if not capstone_skill:
        return [f"{capstone['name']} cannot find {capstone_skill_id} training."]

    events = apply_skill_pool_gain(skills, primary_skill_id, 3)
    events.extend(apply_skill_pool_gain(skills, capstone_skill_id, 4))
    claimed.append(capstone_key)
    character_state["guild_capstones"] = claimed
    events.append(
        f"{capstone['name']} {capstone['text']}, completing Circle {MAX_SUPPORTED_CIRCLE} practice for {primary_skill['name']} and {capstone_skill['name']}."
    )
    events.append("This capstone is now recorded on your guild progression.")
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
        boon_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
        capstone_key = f"{guild_id}:{MAX_SUPPORTED_CIRCLE}"
        claimed_boons = set(character_state.get("guild_boons") or [])
        claimed_capstones = set(character_state.get("guild_capstones") or [])
        if boon_key not in claimed_boons:
            next_step = "Next step: stand before your guild registrar and use `boon`."
        elif capstone_key not in claimed_capstones:
            next_step = "Next step: stand before your guild registrar and use `capstone`."
        else:
            next_step = "Next step: continue training skills or test Crossing shops and hunting rooms."
        return [
            f"You are Circle {circle} in {guild_name}.",
            f"Circle {MAX_SUPPORTED_CIRCLE} is the current supported cap for this Evennia port.",
            f"Current milestone: {guild_circle_perk(guild_id, circle)}.",
            location_hint,
            next_step,
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
