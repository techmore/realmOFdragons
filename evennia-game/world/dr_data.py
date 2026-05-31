"""
Clean-room DragonRealms-inspired static data for the Evennia migration.

Source policy:
- Use public documentation and observed gameplay descriptions only.
- Do not copy proprietary game text, packets, or binaries.
- Keep this module data-only so command/typeclass systems can import it safely.
"""

RACES = {
    "dwarf": "Dwarf",
    "elf": "Elf",
    "elothean": "Elothean",
    "gnome": "Gnome",
    "gor_tog": "Gor'Tog",
    "halfling": "Halfling",
    "human": "Human",
    "kaldar": "Kaldar",
    "prydaen": "Prydaen",
    "rakash": "Rakash",
    "s_raeth": "S'Kra Mur",
}

ATTRIBUTES = (
    "strength",
    "reflex",
    "agility",
    "charisma",
    "discipline",
    "wisdom",
    "intelligence",
    "stamina",
)

RACE_STARTING_ATTRIBUTES = {
    "dwarf": {"strength": 10, "reflex": 8, "agility": 8, "charisma": 10, "discipline": 12, "wisdom": 10, "intelligence": 10, "stamina": 12},
    "elf": {"strength": 8, "reflex": 12, "agility": 12, "charisma": 12, "discipline": 8, "wisdom": 10, "intelligence": 10, "stamina": 8},
    "elothean": {"strength": 8, "reflex": 12, "agility": 10, "charisma": 10, "discipline": 10, "wisdom": 12, "intelligence": 12, "stamina": 6},
    "gnome": {"strength": 4, "reflex": 14, "agility": 12, "charisma": 10, "discipline": 10, "wisdom": 10, "intelligence": 14, "stamina": 6},
    "gor_tog": {"strength": 16, "reflex": 8, "agility": 10, "charisma": 10, "discipline": 10, "wisdom": 6, "intelligence": 6, "stamina": 14},
    "halfling": {"strength": 6, "reflex": 12, "agility": 14, "charisma": 10, "discipline": 8, "wisdom": 8, "intelligence": 10, "stamina": 12},
    "human": {"strength": 10, "reflex": 10, "agility": 10, "charisma": 10, "discipline": 10, "wisdom": 10, "intelligence": 10, "stamina": 10},
    "kaldar": {"strength": 12, "reflex": 10, "agility": 10, "charisma": 12, "discipline": 10, "wisdom": 8, "intelligence": 8, "stamina": 10},
    "prydaen": {"strength": 10, "reflex": 14, "agility": 10, "charisma": 12, "discipline": 8, "wisdom": 6, "intelligence": 10, "stamina": 10},
    "rakash": {"strength": 10, "reflex": 12, "agility": 8, "charisma": 10, "discipline": 12, "wisdom": 8, "intelligence": 6, "stamina": 14},
    "s_raeth": {"strength": 12, "reflex": 12, "agility": 10, "charisma": 10, "discipline": 10, "wisdom": 8, "intelligence": 8, "stamina": 10},
}

GUILDS = {
    "barbarian": "Barbarian Guild",
    "bard": "Bard Guild",
    "cleric": "Cleric Guild",
    "empath": "Empath Guild",
    "moon_mage": "Moon Mage Guild",
    "necromancer": "Necromancer Guild",
    "paladin": "Paladin Guild",
    "ranger": "Ranger Guild",
    "thief": "Thief Guild",
    "trader": "Trader Guild",
    "warrior_mage": "Warrior Mage Guild",
}

SKILLS = {
    "empathy": "Empathy",
    "astrology": "Astrology",
    "expertise": "Expertise",
    "instinct": "Instinct",
    "backstab": "Backstab",
    "summoning": "Summoning",
    "bardic_lore": "Bardic Lore",
    "conviction": "Conviction",
    "theurgy": "Theurgy",
    "thanatology": "Thanatology",
    "trading": "Trading",
    "shield_usage": "Shield Usage",
    "light_armor": "Light Armor",
    "chain_armor": "Chain Armor",
    "brigandine": "Brigandine",
    "plate_armor": "Plate Armor",
    "defending": "Defending",
    "parry_ability": "Parry Ability",
    "small_edged": "Small Edged",
    "large_edged": "Large Edged",
    "twohanded_edged": "Twohanded Edged",
    "small_blunt": "Small Blunt",
    "large_blunt": "Large Blunt",
    "twohanded_blunt": "Twohanded Blunt",
    "polearms": "Polearms",
    "staves": "Staves",
    "bows": "Bows",
    "crossbows": "Crossbows",
    "slings": "Slings",
    "light_thrown": "Light Thrown",
    "heavy_thrown": "Heavy Thrown",
    "brawling": "Brawling",
    "offhand_weapon": "Offhand Weapon",
    "melee_mastery": "Melee Mastery",
    "missile_mastery": "Missile Mastery",
    "primary_magic": "Primary Magic",
    "arcana": "Arcana",
    "attunement": "Attunement",
    "augmentation": "Augmentation",
    "debilitation": "Debilitation",
    "targeted_magic": "Targeted Magic",
    "utility": "Utility",
    "warding": "Warding",
    "sorcery": "Sorcery",
    "evasion": "Evasion",
    "athletics": "Athletics",
    "perception": "Perception",
    "stealth": "Stealth",
    "locksmithing": "Locksmithing",
    "thievery": "Thievery",
    "first_aid": "First Aid",
    "outdoorsmanship": "Outdoorsmanship",
    "skinning": "Skinning",
    "alchemy": "Alchemy",
    "appraisal": "Appraisal",
    "enchanting": "Enchanting",
    "engineering": "Engineering",
    "forging": "Forging",
    "mechanical_lore": "Mechanical Lore",
    "outfitting": "Outfitting",
    "performance": "Performance",
    "scholarship": "Scholarship",
    "tactics": "Tactics",
    "melee": "Melee",
    "missile": "Missile",
    "survival": "Survival",
    "magic": "Magic",
}

SKILLSETS = {
    "armor": ("shield_usage", "light_armor", "chain_armor", "brigandine", "plate_armor", "defending", "conviction"),
    "weapon": (
        "expertise",
        "parry_ability",
        "small_edged",
        "large_edged",
        "twohanded_edged",
        "small_blunt",
        "large_blunt",
        "twohanded_blunt",
        "polearms",
        "staves",
        "bows",
        "crossbows",
        "slings",
        "light_thrown",
        "heavy_thrown",
        "brawling",
        "offhand_weapon",
        "melee_mastery",
        "missile_mastery",
    ),
    "magic": (
        "primary_magic",
        "arcana",
        "attunement",
        "augmentation",
        "debilitation",
        "targeted_magic",
        "utility",
        "warding",
        "sorcery",
        "astrology",
        "summoning",
        "theurgy",
    ),
    "survival": (
        "evasion",
        "athletics",
        "perception",
        "stealth",
        "locksmithing",
        "thievery",
        "first_aid",
        "outdoorsmanship",
        "skinning",
        "backstab",
        "instinct",
        "thanatology",
    ),
    "lore": (
        "alchemy",
        "appraisal",
        "enchanting",
        "engineering",
        "forging",
        "mechanical_lore",
        "outfitting",
        "performance",
        "scholarship",
        "tactics",
        "bardic_lore",
        "empathy",
        "trading",
    ),
    "guild": (
        "empathy",
        "astrology",
        "expertise",
        "instinct",
        "backstab",
        "summoning",
        "bardic_lore",
        "conviction",
        "theurgy",
        "thanatology",
        "trading",
    ),
}

GUILD_PRIMARY_SKILLS = {
    "barbarian": "expertise",
    "bard": "bardic_lore",
    "cleric": "theurgy",
    "empath": "empathy",
    "moon_mage": "astrology",
    "necromancer": "thanatology",
    "paladin": "conviction",
    "ranger": "instinct",
    "thief": "backstab",
    "trader": "trading",
    "warrior_mage": "summoning",
}


def build_starter_skills():
    """Return a fresh Evennia-Attribute-safe skill mapping."""

    return {skill_id: {"name": name, "rank": 0, "pool": 0} for skill_id, name in SKILLS.items()}


def build_starter_attributes(race_id=None):
    """Return a fresh attribute mapping for the selected race or neutral human baseline."""

    source = RACE_STARTING_ATTRIBUTES.get(race_id, RACE_STARTING_ATTRIBUTES["human"])
    return dict(source)
