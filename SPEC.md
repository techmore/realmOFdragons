Here's a strong starting template for your SPEC.md.
Copy this into your repo as SPEC.md and treat it as a living document. Update it constantly as you play DragonRealms and observe new behaviors. The more precise and example-rich you make it, the better Codex can implement matching mechanics.

DragonRealms Clean-Room Clone - Master Specification
Project Goal: Build a fully playable, open-source MUD that captures the observable feel and mechanics of DragonRealms (Elanthia) through legitimate play and documentation only. No proprietary code, packets, or binaries.
Core Philosophy

Skill-based, not level-based (circles earned via experience).
Deep, verb-driven commands.
Complex combat with stance, balance, position, and maneuvers.
Guild-specific abilities layered on a shared core.
Rich world with rooms, items, crafting, magic, economy, and RP focus.

1. Technical Foundation

Server: Evennia (Python) – recommended for rapid prototyping of MUD features.
Protocol: Telnet + optional web client.
Persistence: Evennia’s object model (rooms, characters, items, scripts).
Multiplayer: Real-time, concurrent players, basic instancing if needed later.

2. Character Creation & Basics

Races: Human, Elf, Dwarf, Halfling, Gor'Tog, Prydaen, S'Kra Mur, Rakash, etc. (with racial abilities).
Attributes: Strength, Stamina, Reflex, Agility, Discipline, Intelligence, Wisdom, Charisma.
Starting as Commoner → Join one of 11 guilds.
Skills trained through use (experience pulses, mindstate).
Experience types: Combat, Magic, Lore, Survival, etc.

3. Core Commands & Verbs
Document exact input → output patterns you observe.
Examples to log:

look, go north, inventory, appraise <item>, get, drop, wear, remove
Movement: advance, retreat, circle
General: verb (lists available verbs), analyze, study, etc.

4. Combat System (Highest Priority – Very Unique)
This is the heart of DragonRealms.

Ranges: Missile / Pole / Melee
Stance: (offensive/defensive/evasive/etc.) – affects balance and damage
Balance & Position:
Balance levels: incredibly balanced → solidly balanced → off balance → hopelessly unbalanced
Position: overwhelming advantage ↔ no advantage ↔ opponent dominating

Maneuvers: Special attacks tied to weapons/skills (e.g., bash, slice, jab, guild-specific ones)
Fatigue / Stamina drain
RT (Roundtime) and balance recovery
Multi-opponent handling, positioning, hiding/ambush, etc.

Observation Template (add entries like this):
textCommand: stance defensive
Response: You drop into a defensive stance.

Command: attack orc
Response: [exact round output, balance changes, damage messages, RT]
5. Magic System

Prepare / Cast model for most guilds
Mana types, harness, cambrinth, etc.
Spellbooks, sigils, lunar magic (Moon Mages), elemental (Warrior Mages), etc.
Debuffs, buffs, healing (Empaths transfer wounds)

6. Guilds (Implement Core + One Guild Deeply First)
List of guilds: Barbarian, Bard, Cleric, Empath, Moon Mage, Necromancer, Paladin, Ranger, Thief, Trader, Warrior Mage.
For each guild, document:

Signature abilities
Key verbs/commands
Training paths

Recommendation: Start with Warrior (simple combat) or Commoner core, then add one magic guild.
7. World & Rooms

Room descriptions (long + short)
Exits, hidden exits, lighting, weather
NPCs, creatures (with behaviors, loot tables)
Navigation: roads, sailing, etc.

8. Items & Economy

Appraisal system (detailed item stats)
Crafting: Forging, Shaping, Outfitting, Alchemy, Enchanting, etc.
Multiple currencies, trading, shops, player vendors

9. Other Systems

Death & resurrection
Grouping / parties
Roleplay tools (say, whisper, emote, pose)
Housing, pets, familiars
Quests & dynamic events

10. Current Priorities (Update This Section Often)

Basic telnet server + character creation + movement
Room system + look/exits
Core combat loop (stance, balance, basic attacks)
Simple monster AI + combat engagement
Guild joining + one basic guild (e.g. Warrior)
...

Implementation Notes - 2026-05-05

Completed in the current Node/React prototype:

- Added persistent combat stance: balanced, offensive, defensive, evasive.
- Added persistent balance levels using the observed DR-style ladder:
  hopelessly unbalanced, off balance, solidly balanced, very balanced, incredibly balanced.
- Added commands:
  stance
  stance balanced
  stance offensive
  stance defensive
  stance evasive
  balance
- Stance now changes attack chance, defense chance, damage, and balance cost.
- Attacks consume balance; wait and defend recover balance.
- Combat, score, and the web UI now expose stance/balance state.

Next priority:

- Add combat range and engagement verbs: advance, retreat, range status, and range-gated attack behavior.
