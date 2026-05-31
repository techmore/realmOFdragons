# Evennia Command-First Smoke Transcript

Date: 2026-05-31

Purpose: terminal/Telnet-style walkthrough for the Evennia runtime up to the current Circle 1-10 parity target. This is a clean-room transcript artifact backed by the automated Evennia command smoke suite, not copied proprietary game text.

Validation:

- Generate/update this transcript with `npm run smoke:evennia-transcript`.
- Prove behavior with `npm run check:evennia`.

## Account prompt and race-only creation

```text
> account help
Dragon Realms account commands:
create character <name> = <race> - create an unaffiliated Circle 1 character.
characters / roster - list playable characters on this account.
puppet <name> - enter Crossing as that character.
Guilds are joined in-world after puppeting; do not choose a guild at account creation.

> characters
No characters yet.
Usage: create character <name> = <race name>

> create character Aela = Elf
Aela enters Crossing as an unaffiliated Circle 1 Elf.

> roster
Characters:
Aela: Elf, Unaffiliated, Circle 1 (crossing-TG-001)
Use `puppet <name>` to enter Crossing.

> puppet Aela
You become Aela at Crossing Town Green.
```

## In-world navigation, registrar joining, and Circle progression

```text
> drhelp
Dragon Realms commands:
Identity: score, attributes/stats, skills, race, reroll attributes.
Guilds/Circles: registrar, join guild, guild/perks, abilities, focus, technique, practice, boon, train, circle, circle status.
Movement: room/exits/where, then use direction names or aliases like n, sw, u, d.

> room
Crossing Town Green [crossing-TG-001]
Exits lead deeper into Crossing's guildhalls, shops, and hunting paths.

> n
You walk north through Crossing.

> registrar
Barbarian Guild registrar:
The registrar studies your stance before speaking.
Primary training: expertise.
Signature technique: Roar of Readiness.
You are not registered with a guild.
Next commands: join guild, guild, train, circle status.

> join guild
You join the Barbarian Guild.
Barbarian Guild Circle 1 recognition.

> ask registrar
Barbarian Guild registrar:
You are registered here at Circle 1.
Next commands: train, circle status, circle, abilities, focus, technique, practice, boon.

> guild
Guild: Barbarian Guild. Circle 1.
Unlocked milestones:
- Barbarian Guild Circle 1 recognition

> circle status
You are Circle 1 in Barbarian Guild.
Next Circle 2: total skill ranks 0/6.
Expertise rank 0/4.
Registrar: crossing-GU10-001.
Next step: train expertise.

> train
Expertise improves to rank 1.
You drill Expertise.

> focus
You center your Barbarian Guild focus through Circle 1, feeding Expertise by 1.

> technique
Roar of Readiness turns battlefield pressure into tactical clarity, feeding Tactics by 1.

> practice
You practice Barbarian Guild forms before the registrar.
Expertise and Tactics gain guild practice.

> boon
Battle Temper hardens your battle presence, granting a Circle 1 boon to Expertise.
This boon is now recorded on your guild progression.

> circle
You are Circle 1 in Barbarian Guild.
You advance to Circle 2.
Barbarian Guild Circle 2 recognition.
```

## Shops, physical items, hands, and equipment

```text
> shop
The local shopkeeper shows available beginner stock.
Commands: shop talk, shop stock, buy <item>, sell <item>.

> shop talk
The shopkeeper explains the counter's trade goods and beginner supplies.

> shop stock
Current stock lists carried room-backed inventory.

> east
You walk into the Reed-Choked Culvert.

> shop
The Culvert Cache offers field_bandage, torch, and travel_rations for the deeper brush path.

> forage
You part the reeds around the culvert and find wild_herbs.
Outdoorsmanship and Perception gain field experience.

> get wild_herbs
You pick up the wild_herbs.

> buy field_bandage
You buy a field bandage.

> buy practice blade
You buy a practice blade.

> inventory
You are carrying a practice blade.

> wield practice blade
You wield a practice blade.

> buy leather_shield
You buy a leather shield and hold it in your left hand.

> wear leather_shield
You wear the leather shield from your left hand.

> repair leather_shield
You repair the leather shield, improving its condition to maintained.
Shield Usage and Light Armor gain maintenance practice.

> equipment
Right hand: practice blade.
Worn: leather shield, condition: maintained.

> sell practice blade
You sell a practice blade.

> sell wild_herbs
You sell gathered wild herbs at the provisioner counter.
```

## Asynchronous range-based combat

```text
> scan
You scan the area.
reed_snake is here at missile range.

> target reed_snake
You target reed_snake at missile range.
Enemy pressure begins ticking asynchronously.

> range
You are at missile range from reed_snake.

> advance
You advance to pole range.

> advance
You advance to melee range.

> combat
Health, balance, roundtime, stance, wounds, target, range, and enemy vitality are shown.

> jab
You jab at wolf_cub with agility and Small Edged behind the strike.
Small Edged and Tactics gain field experience.
Roundtime begins.

> wait
Roundtime eases.

> combat
Wounds: bleeding.
Suggested next command: tend.

> tend
You bind the wound with a field bandage.
The bleeding stops.
First Aid gains field experience.

> bash
You bash wolf_cub with strength and Brawling behind the strike.
The enemy collapses.
A lootable corpse remains.

> skin corpse
You skin the corpse and prepare a rough_pelt.
Skinning and Outdoorsmanship gain field experience.

> get rough_pelt
You pick up the rough_pelt.

> loot corpse
You search the corpse and recover coins or beginner loot.

> get <item id>
You pick up the dropped item.
```

## Coverage map

- Account creation: `DRAccountCreationTests`.
- Race-only unaffiliated Circle 1 starts: `DRAccountCreationTests.test_account_create_character_supports_all_races_as_circle_one_commoners`.
- Registrar-only guild joining and Circle 10 progression: `DRCommandSmokeTests.test_all_guilds_join_and_reach_circle_ten_through_commands`.
- Registrar guidance: the all-guild command smoke invokes `registrar` and `ask registrar` before and after joining every guild.
- Guild focus, technique, practice, and boon behavior: the all-guild Circle 10 command smoke invokes `focus`, `guild focus`, `technique`, `guild technique`, `practice`, `guild practice`, `boon`, and `guild boon`.
- Crossing movement: `DRCommandSmokeTests.test_command_exits_can_walk_to_every_crossing_room`.
- Shops/items/equipment: `DRCommandSmokeTests.test_all_configured_shops_support_dialogue_buy_sell_and_refresh` and `test_wield_wear_and_equipment_commands`.
- Gear upkeep: `DRCommandSmokeTests.test_wield_wear_and_equipment_commands` covers repair and equipment condition.
- Beginner content breadth: all-room, all-shop, and all-enemy smoke covers the Reed-Choked Culvert, Culvert Cache, and Reed Snake.
- Fieldcraft: `DRCommandSmokeTests.test_forage_creates_gatherable_and_trains_survival_skills`.
- Wound care: `DRCommandSmokeTests.test_tend_defaults_to_field_bandage_and_treats_bleeding` and `test_field_bandage_treats_combat_bleeding`.
- Hunting harvest: `DRCommandSmokeTests.test_skin_corpse_creates_pelt_and_trains_hunting_skills`.
- Async range combat: `DRCommandSmokeTests.test_scan_target_advance_range_and_retreat_commands`, combat pressure tests, bleeding tests, recovery tests, corpse/loot tests, and all-enemy command loop smoke.
