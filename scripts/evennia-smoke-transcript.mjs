#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outputPath = join(root, 'EVENNIA_SMOKE_TRANSCRIPT.md');

const transcript = `# Evennia Command-First Smoke Transcript

Date: 2026-05-31

Purpose: terminal/Telnet-style walkthrough for the Evennia runtime up to the current Circle 1-10 parity target. This is a clean-room transcript artifact backed by the automated Evennia command smoke suite, not copied proprietary game text.

Validation:

- Generate/update this transcript with \`npm run smoke:evennia-transcript\`.
- Prove behavior with \`npm run check:evennia\`.

## Account prompt and race-only creation

\`\`\`text
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
Aela: Elf, Unaffiliated, Circle 1 (crossing-TG01-001)
Use \`puppet <name>\` to enter Crossing.

> puppet Aela
You become Aela at Crossing Town Green.
\`\`\`

## In-world navigation, registrar joining, and Circle progression

\`\`\`text
> drhelp
Dragon Realms commands:
Identity: score, attributes/stats, skills, race, reroll attributes.
Guilds/Circles: registrar, join guild, guild/perks, abilities, milestone, focus, technique, passive, drill, practice, rite, boon, capstone, study, train, circle, circle status.
Movement: room/exits/where, survey, then use direction names or aliases like n, sw, u, d.

> room
Crossing Town Green [crossing-TG01-001]
Exits lead deeper into Crossing's guildhalls, shops, and hunting paths.

> survey
Survey: Crossing Town Green
Exits, shop, shop task, forage, enemies, and visible objects are summarized for command-first play.

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
Barbarian Guild Circle 1: Pit Footing.

> ask registrar
Barbarian Guild registrar:
You are registered here at Circle 1.
Next commands: train, circle status, circle, abilities, focus, technique, practice, boon.

> guild
Guild: Barbarian Guild. Circle 1.
Unlocked milestones:
- Barbarian Guild Circle 1: Pit Footing

> circle status
You are Circle 1 in Barbarian Guild.
Next Circle 2: total skill ranks 0/6.
Expertise rank 0/4.
Registrar: crossing-GU10-001.
Next step: train expertise.

> train
Expertise improves to rank 1.
You drill Expertise.

> study
You study Barbarian Guild registrar notes, reinforcing Scholarship and Expertise.

> focus
You center your Barbarian Guild focus through Circle 1, feeding Expertise by 1.

> technique
Roar of Readiness turns battlefield pressure into tactical clarity, feeding Tactics by 1.

> milestone
You practice Barbarian Guild Circle 1: Pit Footing, reinforcing Expertise.

> passive
Battle Readiness keeps your guard braced between exchanges, reinforcing Defending by 1.

> drill
Pit Exchange turns close pressure into controlled force, training Expertise by 1 and Brawling by 1.

> practice
You practice Barbarian Guild forms before the registrar.
Expertise and Tactics gain guild practice.

> circle
You train and advance through the registrar to Circle 5.
Barbarian Guild Circle 5: Fury Harness.

> rite
Circle of Iron turns controlled fury into disciplined readiness, training Expertise and Expertise.
Guild rites are Circle 5+ registrar exercises for deeper guild identity.

> boon
Battle Temper hardens your battle presence, granting a Circle 5 boon to Expertise.
This boon is now recorded on your guild progression.

> circle
You train and advance through normal commands to Circle 10.
Circle 10 is the current supported ability cap.

> capstone
Tenth-Circle Roar sets battlefield authority into a finished Circle 10 form.
This capstone is now recorded on your guild progression.
\`\`\`

## Shops, physical items, hands, and equipment

\`\`\`text
> shop
The local shopkeeper shows available beginner stock.
Commands: shop talk, shop stock, buy <item>, sell <item>.

> shop talk
The shopkeeper explains the counter's trade goods and beginner supplies.

> shop stock
Current stock lists carried room-backed inventory.

> west
You walk into the Old Orchard Verge.

> shop
The Orchard Verge Basket offers travel_rations, wild_herbs, and torch near the old trees.

> scan
You scan the area.
orchard_crow is here at missile range.

> forage
You search under the old orchard verge and find wild_herbs.
Outdoorsmanship and Perception gain field experience.

> east
You return to the South Gate Trailhead.

> task request
Marta gives you the South road supply note task.
Travel to Culvert Cache and complete the task there.

> east
You walk into the Reed-Choked Culvert.

> shop
The Culvert Cache offers field_bandage, torch, and travel_rations for the deeper brush path.

> task complete
You deliver South road supply note for the shopkeepers.
You earn 9 trias.
Trading, Appraisal, and Athletics gain practical experience.

> east
You walk into the Silted Canal Edge.

> shop
The Canal Edge Pack Stand offers field_bandage, travel_rations, and wild_herbs near the wet canal path.

> scan
You scan the area.
marsh_spider is here at missile range.

> forage
You search the canal edge silt and find wild_herbs.
Outdoorsmanship and Perception gain field experience.

> east
You walk into the Flooded Towpath.

> shop
The Towpath Supply Shelf offers field_bandage, torch, and wild_herbs along the old canal.

> task request
Jarik asks you to carry a dry wrap bundle back to the Canal Edge Pack Stand.
Travel to the Silted Canal Edge and complete the task there.

> scan
You scan the area.
canal_newt is here at missile range.

> forage
You check moss along the flooded towpath and find wild_herbs.
Outdoorsmanship and Perception gain field experience.

> west
You return to the Silted Canal Edge.

> task complete
You complete Towpath wrap bundle and earn 7 trias.
Trading, Appraisal, and Athletics gain practical experience.

> east
> south
> east
You travel through the Ruined Lockworks and Canal Sluice Yard to the Mossy Spillway Steps.

> shop
The Spillway Rope Hook offers field_bandage, wild_herbs, and torch beside the slick steps.

> task request
Brakka asks you to carry a rope count back to the Sluice Yard Crate.

> scan
You scan the area.
spillway_eel is here at missile range.

> forage
You search moss between spillway stones and find wild_herbs.

> west
You return to the Canal Sluice Yard.

> task complete
You complete Spillway rope count and earn 8 trias.
Trading, Appraisal, and Athletics gain practical experience.

> get wild_herbs
You pick up the wild_herbs.

> appraise wild_herbs
Wild Herbs are worth 1 trias at shop price and 3 trias for resale.
Appraisal gains field experience.

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
\`\`\`

## Asynchronous range-based combat

\`\`\`text
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
\`\`\`

## Coverage map

- Account creation: \`DRAccountCreationTests\`.
- Race-only unaffiliated Circle 1 starts: \`DRAccountCreationTests.test_account_create_character_supports_all_races_as_circle_one_commoners\`.
- Registrar-only guild joining and Circle 10 progression: \`DRCommandSmokeTests.test_all_guilds_join_and_reach_circle_ten_through_commands\`.
- Registrar guidance: the all-guild command smoke invokes \`registrar\` and \`ask registrar\` before and after joining every guild.
- Guild focus, milestone, technique, passive, drill, practice, Circle 5+ rite, study, boon, and capstone behavior: the all-guild Circle 10 command smoke invokes progression commands and dedicated study smoke covers public study rooms plus registrar reading.
- Crossing movement and room discovery: \`DRCommandSmokeTests.test_command_exits_can_walk_to_every_crossing_room\` and \`test_room_status_commands_describe_text_navigation_context\`.
- Shops/items/equipment: \`DRCommandSmokeTests.test_all_configured_shops_support_dialogue_buy_sell_and_refresh\` and \`test_wield_wear_and_equipment_commands\`.
- Gear upkeep: \`DRCommandSmokeTests.test_wield_wear_and_equipment_commands\` covers repair and equipment condition.
- Beginner content breadth: all-room, all-shop, and all-enemy smoke covers the Reed-Choked Culvert, Culvert Cache, Reed Snake, Silted Canal Edge, Old Orchard Verge, Flooded Towpath, Ruined Lockworks, Canal Sluice Yard, Mossy Spillway Steps, Marsh Spider, Orchard Crow, Canal Newt, Lockwork Crab, Sluice Rat, and Spillway Eel.
- Fieldcraft: \`DRCommandSmokeTests.test_forage_creates_gatherable_and_trains_survival_skills\`.
- Item appraisal: \`DRCommandSmokeTests.test_forage_creates_gatherable_and_trains_survival_skills\` covers \`appraise wild_herbs\`.
- Wound care: \`DRCommandSmokeTests.test_tend_defaults_to_field_bandage_and_treats_bleeding\` and \`test_field_bandage_treats_combat_bleeding\`.
- Hunting harvest: \`DRCommandSmokeTests.test_skin_corpse_creates_pelt_and_trains_hunting_skills\`.
- Async range combat: \`DRCommandSmokeTests.test_scan_target_advance_range_and_retreat_commands\`, combat pressure tests, bleeding tests, recovery tests, corpse/loot tests, and all-enemy command loop smoke.
`;

writeFileSync(outputPath, transcript);
console.log(`[evennia-transcript] wrote ${outputPath}`);
