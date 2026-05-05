# Data and Content Completeness Plan

## 1) Yes: PostgreSQL is the right call

We should standardize on PostgreSQL for this project:

- Multi-account + multi-character concurrency
- Complex relational data (characters ↔ guilds ↔ skills ↔ circles ↔ shops ↔ rooms)
- Better transaction safety for combat, commerce, and progression
- Better indexing/search for world graph + creature lookups
- Easier evolution as content grows

Use SQLite only for temporary local prototypes if needed, but not as the primary database.

## 2) Required content domains (v1 scope)

We need explicit, versioned content registries (not hard-coded behavior):

- **Races**
- **Skills**
- **Statistics + modifiers**
- **Races/guild abilities**
- **NPCs (at least Crossing ambient fauna/critters as encounter seed)**
- **Stores and shop inventories (Crossing-only starter catalog)**
- **Room/zone graph (Crossing map seed)**

## 3) “All races” requirement

For a first playable build, define `all_races` as:

- **Player races**
  - Human
  - Elf
  - Dwarf
  - Elothean
  - Gor'Tog
  - Halfling (Olvi)
  - S'Kra Mur
  - Rakash
  - Prydaen
  - Gnome
  - Kaldar
- **Encounter/NPC races (starter scope)**
  - Gorbesh, Ocular, Luethra, Shaerek, Nirejis, and other frequently encountered monster lineage entries from reference material.

We keep a flag on each race row:

- `race_category` = `player | npc | both`
- `playable` boolean
- `combat_bias` JSONB for weighted encounter behavior

## 4) Skills plan (not “all-at-once”)

We should do **master taxonomy + growth path**, not just a one-off list:

- Core skill domains (movement, combat, magic, survival, social, trade)
- Base skill set seeded at start
- Guild skill trees added with clear gating rules
- Derived/ability skills separated from base stats

Schema pattern:

- `skills`
  - `slug`, `name`, `category`, `domain`, `is_base`, `is_guild_only`, `is_ability`
- `skill_trees`
  - parent/child prerequisites and point requirements
- `character_skills`
  - current ranks and caps

## 5) Stats and modifiers model

Use formula tables instead of fixed values to support clean-room changes and future balancing.

- `stats` baseline columns
  - strength, reflex, agility, charisma, discipline, wisdom, intelligence, stamina
- `stat_modifiers`
  - `race_mod`, `guild_mod`, `status_mod`, `buff_mod`, `debuff_mod`, `temporary_mod`
  - source/expiry + stacking rules

A character’s effective stat =

- base starting stat + race mod + guild mod + skill-derived mod + transient modifiers.

## 6) Enemy/enounter plan

For crossing-ready gameplay:

- Seed `creature_species` with a small set of Crossing-area critters.
- Each species entry includes:
  - level band
  - attack style (melee/ranged/magic)
  - loot profile
  - behavior tags
- `encounter_tables` by room/zone with weighted rolls

## 7) NPC store plan

Crossing starter shopping should include three layers:

- **Core utility stores**: general supplies
- **Combat stores**: basic weapons/armor/ranged gear
- **Specialty guild-near stores**: guild-relevant materials

Store schema:

- `shops`
- `shop_sections`
- `shop_items` (supply, price, currency, condition, stock)
- `shop_transactions`

## 8) Crossing map plan

Crossing map is required as first navigable region.

- Build room graph from public map references and community pages as seed material.
- Store both:
  - logical graph edges (`rooms`/`room_exits`)
  - display labels + short path names for D-pad movement
- Start with Crossing + immediate adjacent areas for enterability:
  - Crossing town sections
  - safe streets
  - entry points toward training and hunting starts
- Add `movement_mode` on exits (`n/s/e/w/ne/nw/u/d/jump/door/hidden` etc.) so keyboard mapping remains stable.

## 9) What I can build next

I can add `db-schema.md` and SQL migrations next, with all tables above represented explicitly and seeded with:

- all player races
- starter skill taxonomy
- Crossing room graph v1
- starter Crossing shops/inventory
- initial encounter tables for low-level hunting flow
