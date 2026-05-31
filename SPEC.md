DragonRealms Clean-Room Clone - Master Specification

## Authoritative Goal

Build a clean-room, text-first DragonRealms-inspired MUD on Evennia that reaches feature parity with the current prototype, then surpasses it.

Core target:

Create a playable multi-user MUD where players create accounts, choose canonical DragonRealms-style races, enter Crossing as unaffiliated characters, join guilds in-world, train skills, advance through Circles, explore shops and hunting areas, and fight enemies through asynchronous range-based combat.

Immediate priorities:

1. Make Evennia the primary runtime.
2. Port races, skills, guilds, and Circle 1-10 progression.
3. Build the Crossing room graph with text movement.
4. Add guild registrars and in-world `join guild`.
5. Add shops, NPC dialogue, inventory, hands, and wallet.
6. Add enemies, `scan`, `target`, `advance`, `retreat`, `range`, and combat maneuvers.
7. Preserve a command-first MUD interface in both terminal/Telnet and browser webclient.

Success criteria:

- All 11 races can create Circle 1 characters.
- All 11 guilds can be joined only by visiting their registrar.
- Every guild can progress to Circle 10 through normal commands.
- Crossing can be walked room-to-room.
- Shops/NPCs work with buy/sell/dialogue.
- Enemies spawn in Crossing hunting rooms.
- Combat is asynchronous, range-based, and skill-driven.
- Evennia smoke tests prove the above automatically.

Strategic rule:

The existing Node/React prototype is now a reference implementation, not the target runtime. New production gameplay should move into Evennia unless there is a strong reason not to.

## Current Status

Authoritative current priority for agents and automation. Historical `Next priority` entries below are implementation-log breadcrumbs and may be stale.

Completed current slice:

- Added command-first Dragon Realms help surfaces: account-side `account help` / `drhelp` and in-character `drhelp` / `commands`.
- Help text now summarizes account creation, race selection, guild/circle progression, shops, inventory, and async combat commands, with account and character smoke coverage.
- Crossing world build now initializes `shop_stock` and `shop_last_refresh` metadata on every shop room, so stock exists before the first shop command.
- Builder idempotency now preserves mutated room stock/refresh state across rebuilds, with smoke coverage for initial stock metadata and preservation after mutation.
- Shop sell restocking now avoids duplicate stock entries, keeping `shop stock` as a clean catalog-style listing.
- Updated economy smoke to prove selling an already-listed torch preserves unique stock order.
- Selling an item now returns it to the current room-backed shop stock when that shop normally carries the item.
- Expanded economy smoke to prove selling a torch restocks the provisioner counter after the item object is removed from the character.
- Shop purchases now decrement room-backed shop stock, and empty/missing stock blocks repeat purchases until `shop refresh` restocks the counter.
- Expanded shop smoke to prove buying removes an item from stock, repeat buying the depleted item fails, and manual refresh restores stock.
- Added room-backed shop stock helpers plus `shop stock` and `shop refresh` commands for explicit NPC shop inventory/refresh state.
- Shop listings and purchases now read current room stock metadata, with smoke coverage proving stock display, manual refresh, and buy/sell flow continue to work.
- Enemy pressure and retaliation now incapacitate characters at zero health, clear engagement, stop combat pressure, and prevent targeting, advancing, attacking, defending, or fleeing while down.
- Added `revive` / `stand` command to recover from incapacitation at half health with balanced posture.
- Added async combat smoke proving enemy pressure can incapacitate a character, stop pressure scripts, block retargeting, and recover through `revive`.
- `RecoveryScript` now stops and deletes itself once roundtime reaches zero, preventing stale async recovery tickers from accumulating on balanced characters.
- Added smoke coverage for both direct recovery ticks and command-created recovery scripts cleaning themselves up after recovery.
- Combat maneuvers now attach a deduplicated persistent `RecoveryScript` whenever `jab`, `bash`, or `flee` creates roundtime.
- Added smoke coverage proving attacks and flee start automatic recovery and repeated maneuvers do not duplicate recovery scripts.
- Account-side character creation now validates names before object creation: names must be 3-30 characters, start with a letter, and use only letters, spaces, apostrophes, or hyphens.
- Added account smoke coverage proving too-short, non-letter-starting, and punctuation-invalid character names are rejected.
- Account-side character creation now rejects duplicate playable character names on the same account case-insensitively before creating an Evennia object.
- Added account smoke coverage proving duplicate roster creation does not add a second character or mutate the original race.
- Added account-prompt `characters` / `roster` command for listing all playable characters on an account with race, guild, Circle, and location.
- Added account smoke coverage for empty roster feedback, single-character roster display, alias display, and multiple-character accounts.
- Added `circle status` / `circle check` / `circle requirements` modes for reading Circle requirements and milestones without attempting advancement.
- Added all-guild smoke coverage proving `circle status` is safe and does not mutate Circle state before training.
- Added an explicit Circle 10 support boundary so the Evennia port does not silently advance into unimplemented higher-circle progression.
- `circle` now reports the current Circle 10 cap with preserved guild milestone state, and command smoke verifies all guilds remain capped at Circle 10.
- Added progression unit coverage proving overqualified characters at Circle 10 stay at Circle 10 and retain ten unlocked guild milestones.
- Guild training is now room-aware: joined characters must train at their own guild registrar, with clear rejection from ordinary rooms or other guildhalls.
- Added command smoke proving Barbarian training fails from Town Green and a Bard registrar, then succeeds at the Barbarian registrar.
- Added progression unit coverage for matching and mismatched guild training room metadata.
- Circle advancement now requires standing at the character's own guild registrar room; non-registrar rooms and other guild registrars report clear command feedback.
- Added command smoke proving a Barbarian cannot circle from Town Green or a Bard registrar, then can advance at the Barbarian registrar.
- Added progression unit coverage for missing and mismatched registrar metadata during Circle advancement.
- Added text-first `combat` / `prompt` status command summarizing health, balance, roundtime, stance, engagement range, and enemy vitality.
- Extended combat movement smoke to display combat prompt state during and after engagement.
- Added command-first combat appraisal with `appraise <enemy id>`, `appraise target`, and `assess` alias for enemy vitality, aggression, range, loot signs, and description.
- Extended combat movement smoke to appraise visible and targeted enemies while preserving existing scan/target/range/advance/retreat behavior.
- Added text-first `guild`, `perks`, and `milestones` commands for inspecting guild identity and unlocked Circle milestones.
- Added all-guild command smoke that checks guild milestone display immediately after joining and again at Circle 10.
- Added clean-room guild Circle 1-10 milestone data for every canonical guild and surfaced the current milestone in `circle` status.
- Joining a guild now unlocks the Circle 1 guild milestone, and advancing Circles persists unlocked guild milestones through Circle 10.
- Expanded all-guild Circle 10 command smoke to verify each guild accumulates ten milestone unlocks by Circle 10.
- Added original-style pre-guild attribute reroll support with `reroll attributes`, `reroll attributes <seed>`, and aliases for `roll attributes` / `roll stats`.
- Attribute rerolls vary the selected race baseline by a small deterministic range for tests and are blocked after guild joining or Circle advancement.
- Added smoke/unit coverage for seeded race rerolls, command-level rerolling before guild joining, and reroll rejection after guild affiliation.
- Added text-first `attributes`, `stats`, and `stat <attribute>` commands so players can inspect race-derived stats directly from the MUD command interface.
- Wired the attribute command into the Evennia character command set and smoke coverage for newly created characters.
- Combat damage now derives from character attributes and weapon skill rank: `jab` uses agility plus Small Edged, while `bash` uses strength plus Brawling.
- Combat maneuvers now feed skill pools for the relevant attack skill plus Tactics, making Crossing combat contribute to level-10 progression state instead of only mutating enemy vitality.
- Added smoke coverage proving race attributes and weapon skill rank modify combat damage and that combat maneuvers award skill-pool progress.
- Added race-derived starting attributes for all 11 canonical races using the public DR attribute order: strength, reflex, agility, charisma, discipline, wisdom, intelligence, and stamina.
- Race selection now applies mechanical starting attributes during both account-prompt creation and in-character creation, and `score` displays the current attribute spread.
- Added smoke coverage proving account-created characters receive race-specific attributes and that all canonical race choices populate the expected starting attributes.
- Added account-prompt `create character <name> = <race>` support for creating a playable Evennia character before entering the world.
- Account-side creation builds Crossing if needed, places the new character at Town Green, selects one canonical race, marks creation complete, and keeps the character unaffiliated at Circle 1.
- Added Evennia database smoke proving account-level character creation attaches a race-selected commoner to the account roster at the Crossing start room.
- Added command-first `create character` flow for first-login character creation: it lists canonical races or completes race selection with `create character <race>`.
- `create character <race>` keeps the character unaffiliated at Circle 1 and explicitly reports entry into Crossing before any guild joining.
- Updated creation smoke to use `create character`, prove incomplete creation cannot join guilds, and prove registrar joining works after creation.
- Made Evennia character creation state explicit: new characters start with race unchosen and `creation_complete = False`.
- `race <race>` now completes creation for one of the 11 canonical races, while keeping the character unaffiliated and Circle 1.
- `join guild` now rejects incomplete characters until race creation is complete; smoke coverage proves race must be chosen before registrar joining.
- Promoted shop purchases and room pickups into physical Evennia `Item` objects carried by the character.
- Updated sell/wield/wear/get flows to require and preserve object-backed item ownership while still maintaining the current pack/hands/equipment summaries.
- Added smoke coverage proving bought, wielded, worn, picked-up, and sold items have corresponding physical object state.
- Added first equipment-backed item handling with `wield`, `wear`, and `equipment` / `equip` commands.
- Added character worn-equipment state while preserving left/right hands and pack inventory.
- Added smoke coverage for buying gear, wielding a practice blade, wearing a leather shield, and rendering equipment state.
- Added physical loot item objects for corpse item loot and a command-first `get <item id>` pickup path.
- `loot corpse` now pays coin and spills item objects into the room; items enter pack inventory only after `get`.
- Added smoke coverage proving corpse-contained item objects, room item drops after looting, and pickup into inventory.
- Added `CorpseDecayScript` and attached it to newly created combat corpses.
- Added smoke coverage proving unlooted corpses carry a decay Script and are removed when the decay Script ticks.
- Added lootable corpse objects for defeated enemies instead of direct reward transfer on collapse.
- Added `loot corpse` command that transfers corpse trias and item ids into wallet/inventory, then removes the corpse.
- Added smoke coverage proving defeat creates a corpse with loot metadata and rewards are only transferred after `loot corpse`.
- Added command-first `bash`, `defend`, and `flee` combat maneuvers.
- `bash` provides a heavier melee attack with longer roundtime, enemy retaliation, loot on defeat, and pressure cleanup.
- `defend` recovers balance/roundtime while setting defensive stance; `flee` breaks engagement and stops pressure Scripts.
- Added smoke coverage for bash damage/roundtime, defend recovery, and flee pressure cleanup.
- Added automatic combat pressure Script lifecycle: targeting starts one pressure Script, repeated targeting does not duplicate it, retreat cleanup stops it, and enemy defeat stops it.
- Added smoke coverage for pressure Script attach/deduplication/cleanup during target, retreat, defeat, and retarget-after-respawn flows.
- Added `CombatPressureScript` as the first timed enemy pressure hook for engaged characters.
- Added combat pressure helper logic that applies stance-modified enemy damage at pole/melee range, ignores distant targets, and breaks engagement if the enemy is gone.
- Added smoke coverage proving a database-backed combat pressure Script damages an engaged character and respects defensive stance mitigation.
- Added Evennia `RecoveryScript` and `RoomRespawnScript` typeclasses as the first Script/ticker foundation for async combat systems.
- Updated the Crossing builder to attach room respawn scripts to configured hunting rooms idempotently.
- Added smoke coverage proving recovery scripts clear roundtime/balance and room respawn scripts recreate missing enemies through the existing respawn helper.
- Added deterministic room enemy respawn helper for configured Crossing hunting-room targets.
- Fixed enemy scanning/targeting to use actual in-room enemy NPCs only, so defeated enemies stay absent until respawn.
- Added builder-only `respawn` / `repop` command and smoke coverage for defeat, empty room enemy list, respawn, and retargeting.
- Added deterministic enemy loot tables for current Crossing enemy templates.
- Added defeat rewards that immediately grant trias to the wallet and item ids to pack inventory.
- Added smoke coverage proving enemy defeat awards currency and loot without triggering retaliation after collapse.
- Added deterministic enemy melee pressure after non-lethal player attacks, with stance-modified retaliation damage.
- Added character `health` / `max_health` state plus `health` / `vitals` command output.
- Added smoke coverage proving offensive stance takes heavier retaliation, defensive stance reduces retaliation, health mutates, and defeated enemies stop retaliating.
- Added Evennia combat stance state and the `stance` command for viewing or selecting `balanced`, `offensive`, or `defensive`.
- Added deterministic roundtime state to characters: `jab`/`attack` now sets recovery, repeat attacks are blocked during roundtime, and `wait` / `recover` clears one recovery pulse.
- Added command smoke proving stance selection, roundtime blocking, recovery, and continued enemy defeat flow.
- Added deterministic Evennia `jab` combat as the first damaging attack command, with `attack` as a command alias.
- Added melee-range gating, enemy vitality mutation, character balance mutation, enemy defeat cleanup, and command smoke for defeating a Crossing enemy.
- Updated enemy scanning/targeting to prefer actual in-room enemy NPCs so defeated enemies stop appearing until a future respawn system recreates them.
- Added Evennia enemy deployment data for the current Crossing hunting rooms.
- Added builder-created in-room enemy NPC objects with deterministic enemy ids, vitality, aggression, and descriptions.
- Added command-first combat engagement verbs: `scan`, `target`, `range`, `advance`, and `retreat`.
- Added Evennia smoke proving a character can walk to a Crossing hunting room, scan, target an enemy, advance from missile to pole to melee, retreat back out, and break engagement.
- Promoted initial Evennia shopkeepers from metadata-only entries into actual in-room NPC objects created by the Crossing world builder.
- Added shop room metadata to built Crossing rooms and idempotent shopkeeper creation/update counts to `drbuild crossing`.
- Added Evennia database smoke proving every configured shop room contains exactly one shopkeeper NPC with the expected room/shop metadata.
- Added Evennia-side Crossing economy data for three initial shop counters, shopkeepers, dialogue, and stock catalogs.
- Added command-first Evennia economy verbs: `shop`, `shop talk`, `buy`, `sell`, `inventory`, and `hands`.
- Added Attribute-backed wallet, pack inventory, and left/right hand state to Evennia characters so economy smoke can stabilize before item-object promotion.
- Added Evennia command smoke proving a character can view a shop, hear shopkeeper dialogue, buy an item into inventory, inspect inventory/hands, sell the item back, and mutate wallet state correctly.
- Added Evennia command-level smoke that builds the Crossing database world, walks actual Room/Exit objects to every guild registrar, joins all 11 canonical guilds with `join guild`, and reaches Circle 10 through `train`/`circle` commands.
- Added a command smoke guard proving `join guild` fails outside registrar rooms, preserving in-world guild joining.
- Updated the Evennia audit and roadmap to mark all-guild command-level Circle 10 progression smoke implemented and promote shops/NPCs/items as the next migration blocker.
- Added Evennia guild helper logic for in-world registrar joining.
- Added Evennia `join guild` command that reads guild registrar metadata from the current room.
- Added Evennia tests proving no-registrar rejection, all 11 canonical guild joins, already-joined rejection, and unknown registrar rejection.
- Updated the feature-parity audit to mark guild joining partially implemented and identify command-level registrar walking smoke as remaining work.
- Added an idempotent Evennia Crossing world builder that creates/updates actual Room and Exit objects from `world.dr_world`.
- Crossing rooms now carry deterministic room id aliases plus `dr_room_id`, `guild`, and `targets` Attributes for later systems.
- Added builder command `drbuild crossing` and wired initial setup to build the Crossing database world.
- Added Evennia database tests proving Crossing rooms/exits are created, rebuilds are idempotent, and guild/hunting metadata is stored.
- Added Evennia Crossing room graph data with deterministic room ids, town routes, hunting rooms, and all 11 guild registrar rooms.
- Added Evennia world helpers for graph validation, guild registrar lookup, and shortest pathfinding.
- Added Evennia tests proving the Crossing graph is valid, all guild registrars exist, all registrars are reachable from Town Green, and hunting rooms are reachable.
- Updated the feature-parity audit to mark Crossing data/route work partially implemented and identify the Evennia database world builder as remaining work.
- Added Evennia identity helpers for canonical race normalization and race selection.
- Added Evennia `race` / `choose race` command for choosing one of the 11 canonical races while unaffiliated at Circle 1.
- Added Evennia tests proving all 11 races can be selected as unaffiliated Circle 1 characters, invalid races are rejected, and race changes are blocked after guild join or Circle advancement.
- Updated the feature-parity audit to mark race selection partially implemented and identify required creation-flow integration as remaining work.
- Added a structured Evennia feature-parity audit at `docs/audits/evennia-feature-parity-audit-2026-05-11.md`.
- Added `npm run check:evennia` as a root validation command for Evennia compile checks and Evennia world tests.
- Updated the Evennia roadmap to make audit/validation an explicit migration phase before additional feature ports.
- Added Evennia-side pure progression helpers for skill-name normalization, guild primary skill lookup, training, skill pool gains, Circle requirements, and Circle advancement.
- Added Evennia text commands `train`, `train <skill>`, and `circle` to the character command set.
- Added Evennia tests covering 67-skill catalog counts, DragonRealms skillset counts, guild primary skills, spaced skill-name resolution, legacy `scouting` alias, training rank-up, commoner Circle rejection, and Circle 2 advancement.
- Began the Evennia migration by initializing `evennia-game/` as the new target runtime while preserving the Node/React prototype as a regression reference.
- Added `requirements-evennia.txt` pinned to Evennia 5.0.1 plus `setuptools` for the Python 3.13 launcher compatibility path.
- Added Evennia-side clean-room data for DragonRealms races, guilds, 67 skills, skillsets, and guild primary skills.
- Added Evennia Character initialization for race, guild, circle, wallet, and skill state.
- Added initial Evennia text commands `score`, `skills`, and `skills <skillset>`.
- Added `docs/evennia-migration-roadmap.md` and `evennia-game/README-DR-MIGRATION.md` documenting the pivot, capability fit, and cutover criteria.
- Corrected the skill audit: the previous pass missed that guild skills must appear inside their real DragonRealms skillsets, not only under a separate guild overlay.
- Skillset views now match Elanthipedia counts: Armor 7, Weapon 19, Magic 12, Survival 12, and Lore 13.
- Added `Mechanical Lore` as a legacy Lore skill record because Elanthipedia still lists it in the Lore skillset/category, while keeping the source note that it is obsolete/no-longer-modern training.
- `skills guild` remains available as an overlay for guild-only skills, but `skills armor|weapon|magic|survival|lore` now show the correct DragonRealms skillset membership.
- Audited the active skill catalog against Elanthipedia's current skill category and skillset pages: the implementation was missing one current active skill, Ranger `Instinct`.
- Replaced the stale Ranger guild skill name `Scouting` with current `Instinct`; `train scouting` remains accepted as a clean compatibility alias that trains `Instinct`.
- Confirmed `Mechanical Lore` is listed by Elanthipedia but explicitly obsolete/no longer learnable, so it is documented as intentionally not active in the trainable catalog.
- Added canonical skill-family metadata for guild, armor, weapon, magic, survival, lore, and compatibility skills.
- The text command `skills` now shows known skill families before the full list, and `skills <family>` filters to one family with rank/pool details.
- Training now accepts spaced skill names such as `train bardic lore` and `train primary magic`, resolving them to the canonical skill IDs.
- Progression unit coverage now verifies family counts, family aliases, unknown-family output, spaced skill-name resolution, and spaced-name training.
- Replaced the prototype 13-skill starter set with a 66-skill clean-room catalog covering guild, armor, weapon, magic, survival, and lore skill families.
- Added DragonRealms-style guild specialty skills as default guild-primary training targets: Expertise, Bardic Lore, Theurgy, Empathy, Astrology, Thanatology, Conviction, Scouting, Backstab, Trading, and Summoning.
- Kept legacy `melee`, `missile`, `survival`, and `magic` compatibility skills so current combat, forage, and smoke-test command plumbing remains stable while the richer skill families are integrated.
- Simplified prototype skill rank-up pacing to a fixed 5-pulse threshold so Circle 10 smoke coverage remains prompt-driven but fast enough for continuous agent checks.
- Updated progression unit coverage for the expanded starter catalog, guild-primary circle requirements, skill-shape repair, and training decisions.
- Added deterministic shop NPC presentation, dialogue, and stock refresh metadata for every shop through shared economy helpers.
- The `shop` command now includes NPC and stock lines, and new `shop talk` / `shop stock` commands expose shopkeeper dialogue and stock refresh status.
- Added focused `smoke:shop-npcs` coverage that walks every Crossing shop, verifies NPC metadata/dialogue/stock output, and completes a buy/sell transaction.
- Added a read-only `/v1/world/targets` endpoint for deployed enemy templates, filterable by town, with room/title/vitality/aggression metadata.
- Added focused `smoke:enemies` coverage that walks to every Crossing enemy deployment and verifies `scan`, structured targets, `target <enemy>`, and `appraise <enemy>` output.
- Local agent telemetry now runs focused Crossing enemy deployment smoke and reports enemy deployment and room counts.
- Added focused API smoke coverage proving each canonical DragonRealms guild can be joined in-world at its registrar and advanced to Circle 10 from that registrar.
- Added `npm --prefix server run smoke:guild-circle10` and local agent telemetry execution for per-guild Circle 10 verification.
- Extracted enemy pressure and melee retaliation formatting into pure combat helpers with unit coverage for advancing/holding range pressure, hit health output, hard-hit output, and missed strikes.
- The Express enemy pressure and retaliation paths now delegate enemy-facing event text to combat-owned formatting while retaining route-local rolls, damage mitigation, health mutation, evasion gain, and attack timing.
- Extracted combat `jab`/`bash` maneuver formatting into pure combat helpers with unit coverage for range-gated failures, hit/miss output, damage normalization, and collapse text.
- The Express maneuver resolver now delegates jab/bash event text to combat-owned formatting while retaining route-local mutation, skill gain, balance, cooldown, loot, and retaliation.
- Extracted combat `circle` command formatting into pure combat helpers with unit coverage for missile-range rejection and normalized position/balance success output.
- The Express combat `circle` branch now delegates circle-specific event text to combat-owned formatting while retaining route-local mutation, skill gain, cooldown, and enemy pressure.
- Extracted combat `range` command formatting into pure combat helpers with unit coverage for unengaged characters, engaged melee targets, and malformed stored range fallback.
- The Express `range` command now delegates distance text to combat-owned formatting.
- Extracted combat status command formatting into pure combat helpers with unit coverage for idle equipment/stance summaries, normalized fallback values, and engaged target status output.
- The Express `combat` command now delegates combat status text to combat-owned formatting while passing equipment summaries and held weapon state from the item module.
- Extracted target detail/appraisal formatting into pure combat helpers with unit coverage for missing target prompts, unseen targets, unengaged targets, engaged ranged targets, and engaged melee targets.
- The Express `target`/target-appraisal path now delegates combat target detail text to combat-owned formatting while retaining route-local room enemy lookup.
- Extracted room target listing and scan event formatting into pure combat helpers with unit coverage for empty rooms, multiple targets, and API target summaries.
- The Express room target payloads and `scan` output now use combat-owned target mapping and scan formatting while retaining route-local enemy lookup.
- Extracted room look formatting into pure world helpers with unit coverage for sparse rooms and forage/target-enhanced rooms.
- The Express `look` command now passes enemy scan output into the world-owned look formatter instead of constructing room text inline.
- Extracted room survey formatting into pure world helpers with unit coverage for sparse rooms and rooms with forage, shops, registrar text, and targets.
- The Express `survey`/`search` commands now pass registrar display text and target names into the world-owned survey formatter.
- Extracted pathfinding into pure world helpers with unit coverage for same-room routes, reachable exits, reverse traversal, unreachable rooms, and unknown destinations.
- The `/v1/world/path` route now uses world-owned pathfinding instead of an Express-local BFS helper.
- Extracted movement command direction normalization and movement decision/output into pure world helpers with unit coverage for aliases, `go` prefixes, successful movement, broken exits, and unknown commands.
- The Express movement handler now applies world-owned movement decisions while retaining route-local room mutation, athletics gain, cooldown, and persistence.
- Extracted `shop sell` command decision/output into pure economy helpers with unit coverage for no shop, missing code, not carried, shop refusal, carried inventory sales, damaged ammo salvage, and ammo-pouch single-shot sales.
- The Express `shop sell` command now uses economy-owned sell decisions while retaining route-local wallet, inventory, hand, ammo, cooldown, and skill mutations.
- Extracted `shop buy` command decision/output into pure economy helpers with unit coverage for missing code, no shop, not found, unaffordable, inventory delivery, and bundled ammo delivery.
- The Express `shop buy` command now uses economy-owned buy decisions while retaining route-local wallet, inventory, ammo, cooldown, and skill mutations.
- Extracted `shop` command list formatting into pure economy helpers with unit coverage for no-shop fallback and catalog item rows.
- The Express `shop` command now uses economy-owned shop list formatting before appending the current wallet line.
- Extracted roll profile command formatting into pure race helpers with unit coverage for populated traces, empty traces, and invalid profile versions.
- The Express `roll` command now delegates race-roll metadata summary text to the race module.
- Extracted `score` and `skills` command summary formatting into pure progression helpers with unit coverage for skill rows, modern fixed stat mode, and classic random stat mode labels.
- The Express command handler now delegates score/skills event construction to progression while passing in preformatted wallet, stance, and balance labels.
- Extracted guild registrar display labels into pure progression helpers with unit coverage for no registrar, canonical guild labels, and unknown fallback labels.
- `survey` now renders guild registrar text from progression-owned formatting instead of resolving guild display names inline in the Express command module.
- Extracted guild join/no-registrar decision and guild identity output into pure progression helpers with unit coverage for empty rooms, canonical DR guilds, legacy tutorial guilds, and unknown fallback labels.
- `join guild` now applies the guild identity returned by progression instead of resolving registrar state inline in the command handler.
- Extracted starter skill construction, guild display-name normalization, circle floor normalization, and skill shape repair into pure progression helpers.
- Progression unit coverage now verifies starter skill construction, malformed guild/circle/skill repair, idempotent normalization, and guild display-name correction.
- Character creation and shape repair now import progression-owned starter skills and normalization instead of keeping progression shape rules in the Express route module.
- Removed the remaining route-local `grantSkillPool` adapter.
- Server command handling now calls the progression `applySkillPoolGain` helper directly for training, forage, combat, movement, rest, and trading skill awards.
- Extracted skill pool gain and rank-up mutation into a pure progression helper.
- Progression unit coverage now verifies pool accumulation, rank-up event output, minimum gain normalization, and unknown-skill no-op behavior.
- All route-local skill awards now use the progression helper directly.
- Extracted training room eligibility, target skill selection, primary-skill detection, and skill gain decisions into pure progression helpers.
- Progression unit coverage now verifies train rejection outside training rooms, default guild-primary training, off-primary training, athletics-only gain behavior, and unknown-skill rejection.
- The Express command handler now delegates training decisions to progression and only applies the returned skill gains.
- Extracted circle status text and circle advancement decision output into pure progression helpers.
- Progression unit coverage now verifies circle status formatting plus non-advancing and advancing circle decisions.
- The Express command handler now delegates circle status and circle increment decisions to the progression module while retaining health recalculation after advancement.
- Extracted circle advancement request gating into a pure progression helper.
- Progression unit coverage now verifies commoners cannot circle, joined characters must stand at their own registrar, missing registrar data fails closed, and valid registrar requests pass.
- The Express command handler now delegates non-combat circle advancement gating to the progression module.
- Removed stale template language that recommended Evennia/Python, Telnet-first play, and Evennia persistence.
- SPEC now names the current authoritative prototype stack: Node.js/Express server, React web client, REST command API, file-backed prototype persistence, and TypeScript world fixtures.
- SPEC now names the intended next architecture steps: extract transport-agnostic game-core modules, add Postgres for mutable account/character state after schemas stabilize, and add WebSocket gameplay sessions for live play.
- Circle advancement now requires the character to belong to a guild and stand at that guild's registrar room.
- Progression smoke now verifies a Barbarian cannot advance circles from Crossing Town Green and must return to the Barbarian registrar.
- Local telemetry now reports guild-registrar-gated circle advancement coverage.
- Focused race smoke now rejects non-DragonRealms race rerolls.
- Focused race smoke now joins a character to the Barbarian Guild, rerolls through every canonical DragonRealms race, and verifies each reroll preserves guild identity and Circle 1.
- Local telemetry now reports non-DragonRealms reroll rejection and canonical race reroll guild/circle preservation.
- Focused race smoke now rejects a non-DragonRealms `Orc` character creation request.
- Focused race smoke now creates one character for every canonical DragonRealms race and verifies each starts Circle 1, commoner, unaffiliated, modern-fixed, and with fixed racial stats.
- Local telemetry now reports non-DragonRealms race rejection and canonical race creation Circle 1 coverage.
- Added a focused `races` API smoke suite for `/v1/races`.
- Added `npm --prefix server run smoke:races` for direct canonical race endpoint validation.
- Local agent telemetry now runs focused race smoke and reports canonical race count plus fixed stat table coverage.
- Focused race smoke asserts exactly the canonical DragonRealms race IDs are exposed, every race has the 8 fixed stat fields, and private classic-random roll data stays hidden.
- Added a focused `guilds` API smoke suite for `/v1/world/guilds`.
- Added `npm --prefix server run smoke:guilds` for direct canonical guild endpoint validation.
- Local agent telemetry now runs focused guild smoke and reports endpoint canonical count coverage.
- Focused guild smoke asserts exactly the canonical DragonRealms guild IDs are exposed and every guild has a Crossing registrar room id.
- Agent telemetry now has explicit canonical DragonRealms guild identity rows for exactly 11 covered guilds, zero prototype guilds exposed, and successful registrar joins.
- Coverage summary JSON now promotes canonical guild and prototype-guild counts so reports show guild identity drift directly.
- Agent check coverage shape now fails if canonical guild count, no-prototype-guild exposure, or registrar-join coverage disappears.
- Agent telemetry now has explicit rows for DragonRealms race selection, unaffiliated character creation, guild-at-creation rejection, in-world guild joining, and all 121 race/guild Circle 1 combinations.
- Coverage summary JSON now promotes race/guild matrix counts so reports show 11 races, 11 guilds, and 121 Circle 1 combinations directly.
- Agent check coverage shape now fails if the DragonRealms race/guild creation rules disappear from smoke telemetry.
- Static UI smoke now renders a legacy classic-random character fixture and verifies the web character panel shows stat mode without old prototype role labels.
- Browser smoke now seeds legacy race-roll metadata through the test fixture endpoint, refreshes the live UI through `score`, and verifies `Classic random roll` is visible without `Berserker`/`Frontline`.
- Local telemetry now reports static and browser coverage for legacy race stat mode visibility and hidden prototype race role labels.
- Test fixtures now support controlled legacy race-roll metadata seeding for API smoke coverage.
- API smoke now verifies legacy modern stored metadata normalizes to `modern_fixed` / `Modern fixed racial start` through `/v1/test/characters/:id/state`.
- API smoke now verifies explicit legacy classic-random stored metadata keeps classic mode while hiding old prototype role labels from API-visible score output.
- Added stored character race-roll metadata normalization for old file-backed prototype role titles.
- Modern fixed stored characters are normalized to `modern_fixed` / `Modern fixed racial start` when loaded.
- Classic-random stored characters keep explicit classic mode but migrate old role trace wording to private test-profile wording.
- Race unit coverage now verifies legacy modern and legacy classic metadata migration.
- Private classic-random role labels are now explicitly marked as non-default test profiles.
- Classic-random roll traces now say `Private classic-random test profile selected` instead of exposing archetype language.
- Race unit coverage now asserts classic-random labels/traces remain private test-profile language.
- Public race descriptions now use DragonRealms-clean fixed-stat summaries instead of prototype archetype language.
- Unit and API smoke coverage now reject prototype wording in public race descriptions.
- Character creation API now rejects `guild`/`guildId` payloads; guilds must be joined in-world at a registrar.
- Smoke coverage now asserts new characters start `commoner`/`Unaffiliated` and only gain guild identity after travel plus `join guild`.
- Web character creation now explicitly says guilds are joined in-world after travelling to a registrar.
- Public `/v1/races` no longer exposes prototype random-roll roles or stat modifiers during normal DragonRealms character creation.
- Web character panels and reroll logs now show stat generation mode instead of prototype role labels.
- The `score` command now reports race plus fixed/classic stat mode without surfacing prototype archetype labels.
- Unit and static UI fixtures now use modern fixed racial start metadata and canonical DragonRealms guild identities.
- Added `unit:races` coverage for the exact fixed starting stat table for all 11 DragonRealms races.
- Unit coverage now verifies modern fixed rolls return exact fixed base/final stats and classic random remains explicit opt-in.
- API smoke now verifies `/v1/races`, character creation, reroll, and race/guild matrix stats all match fixed racial starts.
- Static frontend smoke now uses canonical DragonRealms guild identity in its fixture data.
- `/v1/races` now exposes modern fixed starting stats for each DragonRealms race.
- Web character creation now states that it uses DragonRealms modern fixed racial starting stats.
- The web race panel now shows the selected race's fixed starting stat table.
- The web HUD and creation log now surface the selected character's stat generation mode.
- Character creation now defaults to DragonRealms-style modern fixed racial starting stats instead of prototype random rolls.
- Classic random racial rolling remains available only through explicit `statMode: "classic_random"` API input for future nostalgia/testing workflows.
- Race reroll and race/guild matrix smoke now assert modern fixed stat generation.
- Removed residual non-DragonRealms guild IDs from progression skill mapping and unit coverage.
- Added a focused `race-guild-matrix` API smoke suite that creates every DragonRealms race against every canonical DragonRealms guild.
- Full API smoke now verifies 121 race/guild Circle 1 combinations across 11 races and 11 guilds.
- Added an `npm --prefix server run smoke:race-guild-matrix` command for targeted race/guild validation.
- Normalized prototype-only Fighter, Mage, Scout, and Rogue halls into non-guild tutorial/support halls while preserving routes and shops.
- `/v1/world/guilds` now exposes only the canonical DragonRealms-style 11 guild identities.
- The web quick guild route buttons now list only canonical guilds; tutorial/support halls remain reachable through movement and tour routing.
- Added smoke telemetry that verifies all implemented race rerolls remain Circle 1 during character creation coverage.
- Progression smoke now distinguishes canonical DragonRealms-style guild coverage from extra prototype guild halls.
- Canonical guild smoke coverage now requires Barbarian, Bard, Cleric, Empath, Moon Mage, Necromancer, Paladin, Ranger, Thief, Trader, and Warrior Mage to be present and joinable at Circle 1 before training.
- Added an `ammoPouch` quantity map to character state for stacked ammunition.
- Practice arrow shop purchases now add bundled ammo counts instead of one inventory row per shot.
- Ammo item metadata exposes quantity and bundle size.
- Inventory and web UI now show ammo counts separately from regular inventory.
- Ranged attacks consume from the ammo pouch first and report remaining ammo.
- Added persistent loaded-ammo state for ranged weapons.
- Added passive `ammo`/`quiver` status and active `reload`.
- Ranged `fire`/`shoot` now require a loaded shot and report empty-quiver/unloaded states.
- Web controls and character panels now expose ammo readiness.
- Smoke telemetry now tracks ranged reload readiness.
- Shop resale now supports selling one shot from an ammo pouch stack when the local shop stocks that ammo.
- Economy smoke telemetry now verifies ammo stack resale and remaining pouch counts.
- Fired ranged ammunition now becomes recoverable after combat.
- Added `recover arrows`/`recover ammo` scavenging to move recoverable arrows back into ammo pouch stacks.
- Web ammo readiness now shows recoverable ammunition.
- Smoke telemetry now tracks ammo recovery scavenging.
- Ranged shots now resolve deterministic recovery outcomes: intact, damaged, or lost.
- Damaged arrows can be scavenged as broken ammunition inventory rather than usable ammo.
- Smoke telemetry now tracks damaged/lost ammo outcome coverage.
- Damaged recovered arrows now appraise as salvage with broken-ammunition descriptions.
- Shops that stock the matching intact ammunition can buy damaged arrows for scrap value.
- Economy smoke telemetry now tracks damaged ammo appraisal and resale coverage.
- Added focused `smoke:damaged-ammo` coverage for damaged ammo item details and resale.
- Local agent telemetry now runs the focused damaged-ammo smoke before the full API smoke.
- Browser smoke now seeds damaged recovered ammunition through fixtures and verifies the item details panel renders salvage metadata.
- Frontend telemetry now tracks browser damaged-ammo item detail visibility.
- Browser smoke now sells damaged ammunition through the inventory panel from the ammo shop.
- Frontend telemetry now tracks browser damaged-ammo inventory-sale coverage.
- Inventory now explains that selling requires a local shop when carried-item sell controls are disabled outside shops.
- Static and browser smoke now verify the disabled sell hint before damaged ammunition is sold at the ammo shop.
- Inventory rows now show shop-aware sell eligibility hints for stocked goods, unstored carried items, and damaged ammunition salvage.
- Browser telemetry now verifies the shop-aware damaged salvage hint before selling recovered broken ammunition.
- Ammo pouch rows now expose shop-aware `sell one` buttons for stacked ammunition when the local shop stocks the ammo.
- Browser smoke buys a practice-arrow bundle and sells one shot from the ammo pouch through the UI.
- Browser smoke now verifies the visible ammo pouch count decreases after a UI sale.
- Static and browser smoke now verify ammo pouch sale controls explain and disable sales outside shop rooms.
- Ammo pouch rows now display ammunition catalog names, bundle sizes, and estimated single-shot resale value when item details are available.
- Static and browser smoke now verify ammo pouch metadata presentation.
- Frontend shop/economy presentation now uses shared helper logic for carried items and ammo-pouch stacks.
- Inventory and ammo pouch sell hints now show consistent estimated resale text from one pricing model.
- Static frontend smoke now exercises shop/economy helper edge cases directly: stocked carried goods, damaged salvage, ammo pouch resale, unknown ammo, and no-shop rooms.
- Coverage shape validation now requires the static shop/economy helper cases to pass.
- Added `ARCHITECTURE.md` documenting the current Node/React prototype constraints, the portable game-core boundary, REST/WebSocket split, Postgres direction, and conditions for a future Go server.
- Extracted pure server shop/economy sale helpers into `server/src/economy.ts`.
- Added unit coverage for backend shop sale matching, damaged ammo sale mapping, inventory resale, and ammo pouch resale.
- Extracted server item detail resolution into `server/src/items.ts`.
- Added unit coverage for starter gear, shop ranged gear, ammo pouch quantities, damaged ammo salvage, forage items, unknown gear, and item detail list composition.
- Extracted pure shop buy matching, affordability, and purchase delivery decisions into `server/src/economy.ts`.
- Expanded economy unit coverage for buy-by-name lookup, no damaged-item buy matching, affordability, ammo-bundle delivery, and inventory delivery.
- Extracted pure inventory/equipment request helpers into `server/src/items.ts`.
- Expanded item unit coverage for inventory lookup, worn lookup, hand-slot resolution, available hand selection, and wearable classification.
- Extracted inventory/equipment mutation helpers for hold, stow, wear, and remove into `server/src/items.ts`.
- Expanded item unit coverage for successful and failed hand/equipment state transitions.
- Extracted hold/wield item request parsing and wieldable item validation into `server/src/items.ts`.
- Expanded item unit coverage for optional hand-slot parsing and weapon/ranged wieldability classification.
- Extracted equipment summary calculation, equipment modifier formatting, and inventory event formatting into `server/src/items.ts`.
- Expanded item unit coverage for equipment totals, slot formatting, and inventory/equipment command event presentation.
- Extracted item detail request matching and appraisal event formatting into `server/src/items.ts`.
- Expanded item unit coverage for appraise matching by code/name, hyphenated names, damaged ammunition descriptions, and missing item failures.
- Extracted held weapon resolution, ammo counting/consumption, loaded-ammo state helpers, ammo status formatting, and ammo addition into `server/src/items.ts`.
- Expanded item unit coverage for held weapon detection, loaded ammo lifecycle, ammo pouch consumption priority, inventory fallback consumption, and ammo status strings.
- Extracted recoverable ammunition addition, deterministic ranged recovery outcome/event formatting, and recoverable ammunition collection into `server/src/items.ts`.
- Expanded item unit coverage for intact, damaged, and lost ranged recovery outcomes plus recover-arrows pouch/inventory mutation.
- Extracted reload command decisions, loaded-ammo mutation, ammo consumption, and reload event formatting into `server/src/items.ts`.
- Expanded item unit coverage for successful reloads, already-loaded failures, missing-ranged-weapon failures, and empty-quiver failures.
- Extracted ammo status command event formatting and ranged fire readiness decisions into `server/src/items.ts`.
- Expanded item unit coverage for ammo status with and without ranged weapons, loaded fire consumption, unloaded fire failures, empty-quiver fire failures, and missing-ranged-weapon fire failures.
- Extracted attack range validation and range failure event formatting into `server/src/items.ts`.
- Expanded item unit coverage for valid ranged attacks, ranged-too-close failures, melee-too-far failures, and unarmed range failures.
- Extracted weapon attack opening event formatting and unarmed fallback messaging into `server/src/items.ts`.
- Expanded item unit coverage for ranged weapon, melee weapon, and unarmed attack opening text.
- Extracted attack hit, miss, target HP, advantage shift, and collapse event formatting into `server/src/combat.ts`.
- Expanded combat unit coverage for nonlethal hits, lethal hits, and misses.
- Extracted attack cycle wait status/event formatting and target-vanished event formatting into `server/src/combat.ts`.
- Expanded combat unit coverage for ready/not-ready attack cycles and target-vanished messaging.
- Extracted post-attack position/balance event formatting and attack cooldown selection into `server/src/combat.ts`.
- Expanded combat unit coverage for post-attack status text and low/high aggression cooldown thresholds.

Current next priority:

- Continue replacing remaining gameplay click affordances with typed command workflows, then add persisted text script presets for route/combat drills.

### 2026-05-09 Update - Text-First MUD UI Correction

- Converted gameplay panels from click-first action buttons to command reference text so players interact through the MUD prompt.
- Added typed client helper commands for existing route/drill flows: `ui guild tour`, `ui enemy loop`, `ui combat verify`, and `ui combat drill`.
- Updated browser smoke to use typed commands for `range`, `verb`, `survey`, `scan`, `target`, and `advance` instead of clicking gameplay buttons.

### 2026-05-09 Update - Web UI Safe Combat Drill

- Added a web UI `safe combat drill` action that routes to the first loaded Crossing enemy target, records checkpoint transcript lines, runs `look`, `scan`, `target`, `advance`, `range`, and `combat`, then cleans up with `retreat`, `recover arrows`, and final `combat` status.
- The drill uses the existing route/pathfinder and command runner, including roundtime waits between commands, so it behaves like a normal player-driven command sequence.
- Extended browser smoke coverage to assert the `safe combat drill` route action is visible after login and character creation.

### 2026-05-09 Update - Web UI Enemy Routing Actions

- Added a web UI `enemy deployment loop` route action that walks to every loaded Crossing enemy deployment room, runs `scan`, opens target details, and appraises each target.
- Added a web UI `start manual combat verification` action that routes to the first available enemy if needed, scans, targets it, advances, and leaves the player ready to manually run `range`, `combat`, `jab`, `bash`, `attack`, or `retreat`.
- Added a `Known Enemies` route catalog so the UI lists every loaded Crossing enemy room and target next to the existing guild/shop route helpers.
- Extended browser smoke coverage to assert the enemy route actions and known enemy catalog are visible after login and character creation.

### 2026-05-09 Update - Web UI Enemy and Combat Verification Panels

- Added Crossing enemy deployment status to the web UI `Goal Verification` panel using the `/v1/world/targets?town=crossing` catalog.
- Added combat readiness status to the web UI, including current local targets, engagement range/advantage, and direct `scan`, `range`, and `combat` controls.
- Extended static UI smoke coverage to assert the enemy deployment list, combat readiness summary, local target visibility, and live engagement text.
- Extended browser smoke coverage to assert that enemy deployment and combat readiness verification panels are visible after login and character creation.

### 2026-05-07 Update - Web UI Goal Verification Panels

- Added a web UI `Goal Verification` panel that surfaces canonical DragonRealms guild readiness for in-world joining, circle requirements, perks, and Circle 10 smoke verification.
- Added shop NPC verification details to room/status panels, including visible shopkeeper identity, role, stock refresh metadata, and direct `shop talk` / `shop stock` controls.
- Extended static UI smoke coverage to assert guild Circle 10 verification text, shop NPC verification text, shopkeeper fallback identity, stock refresh text, and the new shop NPC command buttons.
- Extended browser smoke coverage to confirm the verification panels are visible in the loaded game, then interact with a Crossing shop NPC using `shop talk`, `shop stock`, and a purchase.

Core Philosophy

Skill-based, not level-based (circles earned via experience).
Deep, verb-driven commands.
Complex combat with stance, balance, position, and maneuvers.
Guild-specific abilities layered on a shared core.
Rich world with rooms, items, crafting, magic, economy, and RP focus.

1. Technical Foundation

Current prototype stack:

- Server: Node.js and Express.
- Client: React web UI with a MUD-style command log and structured panels.
- Protocol now: REST account/management API plus request/response command API.
- Persistence now: file-backed prototype storage for accounts, sessions, characters, and scripts.
- World content now: source-controlled TypeScript fixtures for rooms, exits, shops, races, guilds, items, targets, and beginner progression.
- Smoke/telemetry now: unit tests, API smoke, focused race/guild/target/economy/script smoke, static UI smoke, browser smoke, and coverage-shape validation.

Near-term architecture direction:

- Keep Node/Express and React while mechanics are changing quickly.
- Continue extracting game behavior out of Express routes into transport-agnostic pure helpers.
- Keep REST for account, character, script, world catalog, and fixture/admin flows.
- Add WebSocket gameplay sessions for live command/event streaming once command results are stable.
- Move mutable player/account state to Postgres after the character, inventory, skill, script, and session schemas stabilize.
- Keep world definitions source-controlled until maps, shops, items, races, guilds, and beginner content stop changing every slice.

Longer-term runtime direction:

- Go remains a possible future authoritative server runtime, but only after game-core boundaries, persistence repositories, and WebSocket event contracts are explicit.
- Do not rewrite the server yet; stabilize mechanics and contracts first.

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

Implementation Notes - 2026-05-05, Combat Range

Completed in the current Node/React prototype:

- Added persistent combat range on active encounters: missile, pole, melee.
- New combat starts at missile range.
- Added commands:
  range
  advance
  advance <target>
  retreat
- Basic melee attack is now range-gated and requires melee range.
- Advance closes distance missile -> pole -> melee and costs balance.
- Retreat opens distance melee -> pole -> missile and recovers balance.
- Combat status and the web UI now expose current range.

Next priority:

- Add simple monster AI pressure during range changes: creatures should try to close or strike based on range/aggression, so advance/retreat becomes tactical rather than static.

Implementation Notes - 2026-05-05, Monster Range Pressure

Completed in the current Node/React prototype:

- Creatures now apply pressure during combat waits and range changes.
- At missile/pole range, creatures can press inward based on aggression.
- At melee range, creatures can strike when their attack timer is ready.
- Retreat can recover balance but no longer guarantees distance if the creature presses in.
- Advance and wait can now trigger enemy positioning pressure.

Next priority:

- Add explicit combat position/advantage state and maneuvers, starting with simple `circle`, `jab`, and `bash` verbs gated by range/balance.

Implementation Notes - 2026-05-05, Advantage And Maneuvers

Completed in the current Node/React prototype:

- Added active combat advantage state from -2 to +2.
- Combat output now reports position advantage.
- `circle` is now a combat positioning maneuver while engaged, and remains a circle-progress command when not in combat.
- Added `jab` and `bash` maneuvers.
- `jab` works from pole or melee range and is easier to land.
- `bash` requires melee range, hits harder, and costs more balance.
- Advantage now affects basic attack and maneuver accuracy.
- Basic attacks and maneuvers shift advantage on hit/miss.

Next priority:

- Add command-oriented tests for combat flows and move smoke tests out of ad hoc shell snippets into reusable project scripts.

Implementation Notes - 2026-05-05, API Smoke Coverage

Completed in the current Node/React prototype:

- Added `npm run smoke:api` in the server package.
- The smoke script exercises the real REST API instead of local implementation internals.
- Coverage includes health check, account registration, login, character creation, and rerolling through every configured race.
- Coverage includes saved script creation and script execution.
- Coverage includes path-driven walking to every configured guild room.
- Coverage includes path-driven walking to every configured shop room and checking local shop output.
- Coverage includes entering the Crossing hunting area and running range, advance, circle, jab, and bash combat commands.

Next priority:

- Expand command-oriented coverage into repeatable assertions for character advancement through circle 10, including guild joins, XP pools, training commands, and combat recovery/death edge cases.

Implementation Notes - 2026-05-05, Circle 10 Progression Smoke

Completed in the current Node/React prototype:

- Expanded `npm run smoke:api` to join every configured guild while walking guild rooms.
- The smoke script returns to the first guild and advances through the live command loop to Circle 10.
- Circle advancement uses normal `train`, `wait`, and `circle` commands instead of direct state mutation.
- The script asserts training output and final circle state, making character progression regressions easier to catch.

Next priority:

- Split broad smoke coverage into faster focused command suites, starting with combat recovery/death edge cases and shop buy/sell economy assertions.

Implementation Notes - 2026-05-05, Economy And Combat Recovery Smoke

Completed in the current Node/React prototype:

- Expanded `npm run smoke:api` with a shop economy assertion.
- The smoke script now buys one catalog item, verifies inventory growth, sells it back, and verifies inventory removal.
- Hardened path walking in the smoke harness so command roundtime is cleared before route steps.
- Expanded combat command coverage with `defend` and `flee`.
- The smoke script verifies `flee` clears active combat, then re-enters combat for continued maneuver checks.

Next priority:

- Add deterministic death/incapacitation command coverage. This likely needs a test-only fixture route or local command runner so the suite can create near-death combat state without relying on random monster damage.

Implementation Notes - 2026-05-05, Deterministic Incapacitation Smoke

Completed in the current Node/React prototype:

- Added a fixture-only API route guarded by `DR_TEST_FIXTURES=1`.
- Added a repo-level test-server harness that runs smoke coverage against an isolated server on port 4100 with fixtures enabled.
- Updated `npm run agent:check` to start the isolated fixture server, run API smoke, and shut it down.
- Expanded `npm run smoke:api` to set a character to 0 health deterministically, verify normal commands are blocked while incapacitated, and verify `rest` recovers health.

Next priority:

- Split the monolithic API smoke script into focused command suites so route coverage, economy coverage, progression coverage, and combat coverage can run independently and fail with tighter diagnostics.

Implementation Notes - 2026-05-05, Focused API Smoke Suites

Completed in the current Node/React prototype:

- Refactored `server/scripts/smoke-api.ts` from one linear flow into shared setup plus named suites.
- `npm run smoke:api` still runs the full end-to-end coverage path.
- Added focused server smoke commands:
  `smoke:identity`
  `smoke:scripts`
  `smoke:progression`
  `smoke:economy`
  `smoke:combat`
- Focused suites create isolated accounts/characters and fail closer to the affected feature area.
- The full suite still validates the complete identity, scripts, progression, economy, combat, and incapacitation flow.

Next priority:

- Add first real unit-level command tests by extracting pure combat/progression helpers or adding a local in-process command harness, so failures do not all require HTTP smoke setup.

Implementation Notes - 2026-05-05, Unit-Level Progression Tests

Completed in the current Node/React prototype:

- Extracted pure progression helpers into `server/src/progression.ts`.
- Added `npm --prefix server run test:unit` with direct TypeScript assertions for guild primary skill mapping, total skill ranks, circle requirements, and circle eligibility.
- Updated root `npm run test:unit`.
- Updated `npm run agent:check` to run unit tests before the isolated API smoke suite.

Next priority:

- Extract combat math/range helpers into a pure module and add unit coverage for range shifting, advantage bounds, and stance/balance effects.

Implementation Notes - 2026-05-05, Unit-Level Combat Tests

Completed in the current Node/React prototype:

- Extracted pure combat helpers into `server/src/combat.ts`.
- Added unit assertions for range normalization/formatting/shifting.
- Added unit assertions for advantage normalization, advantage bounds, and advantage labels.
- Added unit assertions for balance normalization, balance changes, and balance labels.
- Added unit assertions for stance normalization and stance profile tradeoffs.
- Refactored the API command loop to use the extracted combat helpers.

Next priority:

- Add focused frontend smoke or component-level checks for command input, quick commands, inventory/hands display, and combat status rendering.

Implementation Notes - 2026-05-05, Frontend UI Smoke

Completed in the current Node/React prototype:

- Extracted `GameStatusPanels` from the main React app so core MUD UI state can be rendered directly.
- Added `npm --prefix frontend run smoke:ui`.
- Added static render assertions for room prompts/exits, shop buy controls, quick commands, D-pad controls, character stats, hands, inventory, and combat status.
- Updated root `npm run smoke:ui`.
- Updated `npm run agent:check` to run frontend UI smoke before API smoke.

Next priority:

- Improve frontend command/input coverage by adding a small browser-level smoke for login, character creation, command submission, and D-pad/keyboard navigation against the isolated fixture server.

Implementation Notes - 2026-05-05, Browser-Level Frontend Smoke

Completed in the current Node/React prototype:

- Made the frontend API base configurable with `VITE_API_BASE`.
- Added `npm --prefix frontend run smoke:browser`.
- Added a repo-level test app harness that starts an isolated fixture API server and Vite dev server together.
- Browser smoke uses local Chrome through Playwright Core.
- Browser coverage registers an account, logs in, creates a character, submits a typed `look` command, clicks the `range` quick command, and uses numpad movement.
- Updated `npm run agent:check` to run browser smoke before API smoke.

Next priority:

- Add GitHub Actions CI for build, unit tests, frontend static smoke, and API smoke with fixture server; browser smoke can be optional or macOS-only because it depends on local Chrome.

Implementation Notes - 2026-05-05, GitHub Actions CI

Completed in the current Node/React prototype:

- Added `npm run ci:check` as a Linux-safe CI entrypoint.
- CI coverage includes server build, frontend build, server unit tests, frontend static UI smoke, and API smoke through the fixture server harness.
- Added `.github/workflows/ci.yml` for pushes to `main` and pull requests.
- CI intentionally excludes browser smoke for now because the current browser script targets local Chrome; browser smoke remains part of local `npm run agent:check`.

Next priority:

- Add first gameplay content expansion beyond Crossing smoke coverage: additional beginner hunting rooms, enemy templates, and shop inventory variety while keeping all tests deterministic.

Implementation Notes - 2026-05-05, Beginner Hunting Content Expansion

Completed in the current Node/React prototype:

- Added two new Crossing outskirts hunting rooms:
  `crossing-RV02-004` Muddy Beetle Bend
  `crossing-RV02-005` Low Ridge Rabbit Run
- Added deterministic exits connecting the new rooms to the existing beginner hunting loop.
- Added two new beginner enemy templates:
  muddy shell beetle
  ridge hare
- Added two new small shop inventories for foraging/survival flavor.
- Existing API smoke path-walking now covers the new shop rooms automatically through `/v1/world/shops`.

Next priority:

- Add scan/target visibility to the web UI controls and browser smoke so players can discover enemies from both command input and quick actions.

Implementation Notes - 2026-05-05, Web UI Scan Visibility

Completed in the current Node/React prototype:

- Added `scan` to the web quick command controls.
- Added static UI smoke coverage for the `scan` control.
- Expanded browser smoke to navigate from town green to the beginner hunting fork using numpad movement.
- Browser smoke now clicks the `scan` quick command and verifies `forage wolf-cub` target visibility in the terminal log.
- Browser smoke command count telemetry increased to 7.

Next priority:

- Add a first target-selection affordance in the UI: when scan output identifies local enemies, expose an easy `advance <target>` / `attack <target>` action without requiring manual typing.

Implementation Notes - 2026-05-05, UI Target Action Affordance

Completed in the current Node/React prototype:

- Frontend now parses standardized scan target lines from command output.
- Last-seen local targets are shown in a `Visible Targets` section.
- Each visible target gets quick `advance <target>` and `attack <target>` actions.
- Target actions clear when the character changes rooms.
- Static UI smoke verifies the visible-target action controls.
- Browser smoke now scans the beginner hunting fork, sees `forage wolf-cub`, clicks the target-specific `advance` action, and verifies combat engagement output.

Next priority:

- Add server-provided structured room target data to command responses so the UI no longer has to parse scan text.

Implementation Notes - 2026-05-05, Structured Room Targets

Completed in the current Node/React prototype:

- Command responses now include a structured `targets` array.
- Character state, script run, and fixture state responses include structured room targets.
- Target records include id, name, baseline vitality, and aggression.
- Frontend target actions now use server-provided targets instead of parsing scan text.
- API smoke verifies structured targets for wolf-cub, beetle, and hare hunting rooms.

Next priority:

- Render target vitality/aggression metadata in the web UI target affordance, and add browser/static smoke assertions for that richer target display.

Implementation Notes - 2026-05-05, Target Metadata UI

Completed in the current Node/React prototype:

- Frontend stores full structured room target records instead of target names.
- Visible target actions now display target vitality and aggression metadata.
- `advance <target>` and `attack <target>` actions continue to use target names from structured API data.
- Static UI smoke asserts the target metadata display.
- Browser smoke asserts `forage wolf-cub` vitality/aggression metadata before clicking target-specific advance.

Next priority:

- Add a lightweight target details panel or command output that explains what vitality/aggression mean for beginner players.

Implementation Notes - 2026-05-31, Evennia Direction Aliases

Completed in the Evennia runtime:

- Crossing exits now receive classic MUD direction aliases during world build (`n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`, `u`, `d`).
- Evennia smoke coverage now verifies both built exit aliases and command-level alias movement through Town Green.

Next priority:

- Continue command-first Evennia parity by expanding text movement/status feedback and reducing any remaining browser-first assumptions.

Implementation Notes - 2026-05-31, Evennia Room Status Command

Completed in the Evennia runtime:

- Added a DR-specific `room` command with `exits` and `where` aliases for command-first room context.
- Room status now reports room title, description, room ID, exits with MUD aliases, guild registrar metadata, shop metadata, enemies, and visible non-exit objects.
- Updated help text and smoke coverage so text navigation context is exercised from Town Green and a beginner hunting room.

Next priority:

- Expand beginner hunting-room text feedback around enemy difficulty, engagement range, and safe recovery commands.

Implementation Notes - 2026-05-31, Evennia Focused Command Help

Completed in the Evennia runtime:

- Added focused `help room`, `help scan`, `help targets`, `help target`, and `help combat` branches to the DR command help.
- Help now explains text movement aliases, scan/appraise target discovery, range-band engagement, melee attack gating, roundtime recovery, stance, flee, and revive commands.
- Added smoke coverage for the focused help topics so command-first discovery stays available without browser/UI controls.

Next priority:

- Add richer enemy difficulty labels and suggested next commands directly to `scan`, `appraise`, and combat prompt output.

Implementation Notes - 2026-05-31, Evennia Combat Guidance Output

Completed in the Evennia runtime:

- `scan` now labels enemies with beginner difficulty bands and suggests `appraise <enemy id>` or `target <enemy id>`.
- `appraise` now reports enemy difficulty and suggests the next command based on whether the enemy is unengaged, at range, in melee, recovering, or the player is incapacitated.
- `combat`/`prompt` now includes suggested next commands for idle, ranged, melee, recovering, gone-target, and incapacitated states.
- Smoke coverage now asserts the guidance appears during scan, appraise, ranged engagement, and melee engagement.

Next priority:

- Continue tightening combat parity by adding a command-level way to inspect active enemy stats and recovery state after each maneuver.

Implementation Notes - 2026-05-31, Evennia Post-Maneuver Combat State

Completed in the Evennia runtime:

- Non-lethal `jab` and `bash` results now append a command-first combat state block with health, balance, roundtime, stance, condition, engagement range, enemy vitality, and suggested next command.
- Lethal `jab` and `bash` results now suggest `loot corpse` after collapse/loot preview output.
- Smoke coverage now asserts post-maneuver output exposes recovery roundtime, active enemy vitality, and the next recommended command.

Next priority:

- Audit remaining level-10 parity gaps around guild progression visibility, shop/NPC interactions, and account/character login flow.

Implementation Notes - 2026-05-31, Evennia Circle Status Guidance

Completed in the Evennia runtime:

- `circle status` now guides unaffiliated characters toward visiting a guild registrar and using `join guild`.
- Joined characters now see their registrar room id, total-rank remaining count, primary-skill remaining count, and an actionable next step.
- Ready-to-circle characters are told to use `circle` when already at their registrar, or to return to their registrar otherwise.
- Circle 10 capped characters now get a cap explanation plus a next step to continue training or test Crossing systems.
- Smoke coverage now verifies registrar guidance, train/circle guidance, unaffiliated guidance, and Circle 10 cap guidance across all guilds.

Next priority:

- Improve shop/NPC interaction parity by adding clearer text affordances for shopkeepers, dialogue, accepted stock, and failed transactions.

Implementation Notes - 2026-05-31, Evennia Shopkeeper Affordances

Completed in the Evennia runtime:

- Shop overview now advertises `shop talk`, `shop stock`, `buy <item>`, and `sell <item>` directly in text.
- Shopkeepers now list accepted stock in both shop overview and dialogue output.
- Empty/unknown buy attempts now report available stock instead of only a terse failure.
- Selling is now shop-specific: keepers reject items outside their accepted stock and failed sell attempts point players back to inventory, hands, and equipment.
- Smoke coverage now verifies shop affordances, stock guidance, dialogue trade lists, unavailable buy feedback, and shopkeeper sell refusal.

Next priority:

- Audit account/character flow parity around roster use, puppeting expectations, and clean-room login documentation.

Implementation Notes - 2026-05-31, Evennia Account Flow Guidance

Completed in the Evennia runtime:

- Account help now explicitly describes `puppet <name>` and states that guilds are joined in-world rather than during account creation.
- Added reusable account roster text that shows character race, guild, Circle, room title, room id, and the next step to puppet, inspect `room`, and `join guild`.
- Empty roster output now explains the `create character <name> = <race name>` flow and reinforces in-world guild joining.
- Account creation success output now gives the exact `puppet <name>` command and the next in-world command path.
- Smoke coverage now verifies account help and roster guidance for empty and created-character accounts.

Next priority:

- Run a completion-oriented Evennia parity audit against SPEC success criteria and close the highest-risk missing item found.

Implementation Notes - 2026-05-31, Evennia Race Creation Audit Coverage

Completed in the Evennia runtime:

- Added command-level account smoke proving every one of the 11 canonical races can create an unaffiliated Circle 1 character through `create character <name> = <race>`.
- The smoke verifies race id, race display name, race-derived attributes, `creation_complete`, commoner guild state, Circle 1 state, and Crossing start room placement for every race.
- This closes the weakest audit evidence for the SPEC success criterion "All 11 races can create Circle 1 characters."

Next priority:

- Continue the SPEC completion audit by checking whether remaining success criteria are proven broadly enough or need additional command-level smoke coverage.

Implementation Notes - 2026-05-31, Evennia Full Crossing Command Walk Coverage

Completed in the Evennia runtime:

- Added command-level smoke proving a player can walk from Town Green to every configured Crossing room using actual exit commands.
- The smoke resets to Town Green, follows the graph path to each room, executes each direction as a command, and verifies the final room id.
- This strengthens evidence for the SPEC success criterion "Crossing can be walked room-to-room" beyond static graph reachability.

Next priority:

- Continue the SPEC completion audit by checking enemy spawn and async combat criteria for broad enough command/script coverage.

Implementation Notes - 2026-05-31, Evennia All-Enemy Command Combat Coverage

Completed in the Evennia runtime:

- Added command-level smoke that walks to every configured Crossing hunting room and fights every configured enemy spawn through `scan`, `target`, `advance`, `bash`, and `wait`.
- The smoke verifies targeting, missile-to-melee range movement, active combat pressure scripts, enemy defeat, corpse creation, pressure cleanup, and combat skill-pool gains.
- This strengthens evidence for the SPEC success criteria "Enemies spawn in Crossing hunting rooms" and "Combat is asynchronous, range-based, and skill-driven."

Next priority:

- Continue the SPEC completion audit by checking whether shop/NPC coverage exercises every configured shop, not just representative shops.

Implementation Notes - 2026-05-06, Current Status Priority Index

Completed in the current Node/React prototype:

- Added an authoritative `Current Status` block near the top of `SPEC.md`.
- Marked historical `Next priority` entries as implementation-log breadcrumbs that may be stale.
- Updated `scripts/agent-prompt.mjs` to prefer `Current Status` current priority before falling back to the last historical `Next priority`.

Next priority:

- Add a short `npm run agent:prompt` smoke assertion to the local check path so prompt generation regressions are caught before autonomous follow-up work starts.

Implementation Notes - 2026-05-06, Agent Prompt Smoke

Completed in the current Node/React prototype:

- Added `scripts/smoke-agent-prompt.mjs`.
- Added `npm run smoke:agent-prompt`.
- `npm run agent:check` now runs `agent-prompt-smoke` before git status.
- Prompt smoke asserts that generated autonomous prompts use the `Current Status` priority and include the stale-priority warning.
- Coverage telemetry now reports `agentPromptCurrentStatusChecked`.

Next priority:

- Add command-line documentation for the new `smoke:agent-prompt` script and the `agent-prompt-smoke` telemetry row.

Implementation Notes - 2026-05-06, Agent Prompt Smoke Documentation

Completed in the current Node/React prototype:

- README now documents `npm run smoke:agent-prompt`.
- README now explains that agent prompt smoke validates `SPEC.md` `Current Status` priority selection.
- README now states that `agent:check` includes agent prompt smoke.
- README telemetry coverage field list now includes `gameplay.agentPromptCurrentStatusChecked`, static/browser command discovery, and browser verb discovery fields.

Next priority:

- Add a small UI affordance or README note for saved scripts/macros so players can discover the existing scripting system without digging through implementation details.

Implementation Notes - 2026-05-06, Script Discovery UI Docs And Telemetry

Completed in the current Node/React prototype:

- Added a Scripts panel note explaining scripts as reusable command macros.
- Browser smoke verifies the scripts/macros note and a preset load button.
- Browser smoke now reports `scriptDiscoveryVisible`.
- Coverage summary and Markdown telemetry now report browser script discovery visibility.
- README now documents saved scripts/macros, preset loading, command editing, save/run flow, pace, and continue-on-error behavior.

Next priority:

- Add a focused browser or API smoke action that loads a script preset, saves it, and verifies the saved script appears in the UI/API.

Implementation Notes - 2026-05-06, Browser Script Preset Save Smoke

Completed in the current Node/React prototype:

- Browser smoke loads the Crossing Guild Tour preset.
- Browser smoke renames and saves the preset as an account script.
- Browser smoke verifies the terminal save message and saved script visibility in the UI.
- Browser smoke now reports `scriptPresetSaved`.
- Coverage summary, Markdown telemetry, and README coverage fields now include browser script preset save coverage.

Next priority:

- Add API smoke coverage for script deletion or script run result telemetry so saved script lifecycle coverage includes create, run, and delete.

Implementation Notes - 2026-05-06, Script Lifecycle API Smoke

Completed in the current Node/React prototype:

- API script smoke now creates a script, runs it, lists scripts, deletes it, and verifies removal from the script list.
- API smoke now reports `scriptCreatedChecked`, `scriptRunChecked`, and `scriptDeletedChecked`.
- Coverage summary now derives `scriptLifecycleChecked`.
- Markdown telemetry now includes Script create/run/delete lifecycle coverage.
- README coverage fields now document script lifecycle coverage.

Next priority:

- Add a focused `scripts` telemetry row to Markdown/count summaries so script lifecycle coverage is easier to distinguish from general API smoke.

Implementation Notes - 2026-05-06, Script Coverage Telemetry Section

Completed in the current Node/React prototype:

- Markdown telemetry now includes a dedicated Script Coverage section.
- Script Coverage reports API create, run, delete, full lifecycle, browser preset save, and API script run step count.
- `coverage-summary.json` now includes a structured `scripts` block with `steps`, `created`, `ran`, `deleted`, `lifecycle`, and `browserPresetSaved`.
- README documents the script-specific coverage summary fields.

Next priority:

- Add focused script lifecycle coverage to CI telemetry, not just local `agent:check`, or document why local-only browser script coverage remains local.

Implementation Notes - 2026-05-06, Focused Script Smoke In CI Telemetry

Completed in the current Node/React prototype:

- `npm run ci:check` now runs focused `script-smoke` before full API smoke.
- `npm run agent:check` also runs focused `script-smoke` for parity.
- Script coverage summary now prefers the focused script smoke payload, falling back to full API smoke when needed.
- Markdown telemetry now reports Focused script smoke.
- README documents `smoke:scripts` and `scripts.focusedSmoke`.

Next priority:

- Add focused script smoke telemetry to CI documentation and verify the GitHub workflow artifact description matches the expanded check set.

Implementation Notes - 2026-05-06, CI Script Telemetry Documentation

Completed in the current Node/React prototype:

- README now states that `npm run ci:check` includes focused script smoke.
- README documents focused `smoke:scripts` as the fastest script-regression path.
- README documents the GitHub Actions telemetry artifact as `check-telemetry-build-unit-browser-script-api`.
- GitHub workflow step names now explicitly mention browser smoke, script smoke, and API smoke.
- GitHub telemetry artifact name now matches the expanded check set.

Next priority:

- Add a small CI smoke assertion or documentation note for `coverage-summary.json` consumers so automation can fail fast when expected coverage sections are missing.

Implementation Notes - 2026-05-06, Coverage Summary Shape Assertion

Completed in the current Node/React prototype:

- `scripts/run-checks.mjs` now validates coverage summary shape before writing final telemetry on successful runs.
- Required sections include `gameplay`, `scripts`, `frontend`, `durationsMs`, and `unitSuites`.
- Required success fields include script lifecycle coverage, browser script preset save coverage, core combat/economy coverage, and local-only focused target/agent prompt coverage when running `agent:check`.
- README now documents that successful local/CI checks fail fast if expected coverage sections or critical fields are missing.

Next priority:

- Add a small unit-style telemetry validation fixture so coverage shape validation can be tested without running the full smoke suite.

Implementation Notes - 2026-05-06, Beginner Forage Command

Completed in the current Node/React prototype:

- Added `forage` as an active survival command in Crossing outskirts and beginner hunting rooms.
- Foraging adds a room-appropriate found item to inventory and grants Survival learning.
- `verb`, `help`, and web quick controls now expose `forage`.
- Static UI smoke verifies the forage quick control.
- API smoke verifies forage output and inventory gain before beginner combat coverage.
- Coverage telemetry now reports `forageChecked`.
- README documents `forage` in the command reference.

Next priority:

- Add a small foraging result table or room-specific forage metadata to the world model so finds are data-driven instead of hardcoded in command logic.

Implementation Notes - 2026-05-06, Data Driven Forage Rooms

Completed in the current Node/React prototype:

- Added `RoomForage` and `RoomForageItem` metadata to the world model.
- Crossing outskirts and beginner hunting rooms now define forage difficulty and found item tables.
- The `forage` command now reads `room.forage` metadata instead of hardcoded room IDs.
- Survival learning gain is based on forage difficulty.

Next priority:

- Expose forage availability in `look` or room payloads so players can discover forageable rooms without trial-and-error.

Implementation Notes - 2026-05-06, Forage Discovery In Room Output

Completed in the current Node/React prototype:

- `look` now reports forage availability, difficulty, and possible finds in forageable rooms.
- Room payloads expose `forage` metadata to clients.
- The web Room panel now renders a Forage section with difficulty and possible finds.
- Static UI smoke verifies the Forage panel.
- API smoke verifies `look` forage output and room forage metadata.

Next priority:

- Add a dedicated `survey` or `search` discovery command that summarizes room affordances: exits, forage, shop, targets, and guild registrar.

Implementation Notes - 2026-05-06, Room Survey Command

Completed in the current Node/React prototype:

- Added passive `survey` and `search` commands.
- Survey output summarizes room exits, forage availability, shop, guild registrar, and immediate targets.
- `help`, `verb`, and web quick controls now expose `survey`.
- API smoke verifies survey header, exits, forage summary, and target summary in the beginner hunting fork.
- Coverage telemetry now reports `surveyChecked`.

Next priority:

- Add `survey` command coverage to README command reference and browser smoke telemetry.

Implementation Notes - 2026-05-06, Survey Browser And Docs Coverage

Completed in the current Node/React prototype:

- README command reference now documents `survey` and `search`.
- Browser smoke clicks the web `survey` quick control in Brushline Forage Fork.
- Browser smoke verifies survey header, forage summary, and target summary output.
- Browser telemetry now reports `surveyClicked`.

Next priority:

- Add a lightweight room-affordance panel in the web UI that mirrors survey results without requiring command output parsing.

Implementation Notes - 2026-05-06, Command Discovery Telemetry

Completed in the current Node/React prototype:

- Browser smoke now reports `commandDiscoveryVisible` for the always-visible command note.
- Coverage summary now exposes `staticCommandDiscoveryChecked` and `browserCommandDiscoveryVisible`.
- Markdown telemetry now includes Static command discovery note and Browser command discovery note rows.

Next priority:

- Replace stale repeated `Next priority` sections in `SPEC.md` with a single current priority block or add a short current-status index so future automation does not pick old tasks.

Implementation Notes - 2026-05-06, Web Command Discovery Note

Completed in the current Node/React prototype:

- Added an always-visible command discovery note near the web controls.
- The note introduces `verb`, `help scan`, and `target <name>` before the player clicks any command.
- Static UI smoke verifies the discovery text.
- Browser smoke verifies the discovery text after login.

Next priority:

- Add command discovery telemetry fields for the static discovery note so reports distinguish always-visible command guidance from clicked `verb` discovery coverage.

Implementation Notes - 2026-05-05, Web Target Details Action

Completed in the current Node/React prototype:

- Added a `details` button to each visible target in the web UI.
- The web details action sends the canonical `target <name>` command instead of duplicating target logic client-side.
- Static UI smoke verifies the new details affordance.
- Browser smoke clicks target details and verifies the suggested next verb before advancing.

Next priority:

- Add target details telemetry to the local coverage summary so reports distinguish scan visibility, structured target payloads, and target-detail command/UI coverage.

Implementation Notes - 2026-05-05, Target Details Telemetry

Completed in the current Node/React prototype:

- API smoke now reports `structuredTargetsChecked` and `targetDetailsChecked`.
- Browser smoke now reports `targetDetailsClicked` when the web details affordance is exercised.
- Coverage summary now exposes structured target, target details, and browser target-details booleans separately from generic scan/combat coverage.

Next priority:

- Add a small target-details section to the generated Markdown telemetry report so human review can see gameplay coverage booleans without opening JSON.

Implementation Notes - 2026-05-05, Markdown Gameplay Coverage

Completed in the current Node/React prototype:

- `artifacts/telemetry/summary.md` now includes a Gameplay Coverage table.
- The Markdown summary calls out combat smoke, scan visibility, structured targets, target details command, browser target-details action, and shop economy coverage.
- The Markdown summary also includes key gameplay counts: races rolled, guild rooms walked, shop rooms walked, circle reached, and browser command count.

Next priority:

- Add a focused target-details smoke suite mode so `npm --prefix server run smoke:api combat` can be split further into fast target inspection coverage without running full progression/economy.

Implementation Notes - 2026-05-05, Focused Target Smoke Suite

Completed in the current Node/React prototype:

- Added a `targets` API smoke suite.
- Added `npm --prefix server run smoke:targets`.
- The focused suite covers scan visibility, structured targets, `help targets`, `target <name>`, `appraise <target>`, engagement, and bare `target` range details.
- The focused suite reports scan, structured target, and target-details coverage booleans.

Next priority:

- Add the focused `targets` smoke suite to telemetry as a separate optional/local step or targeted npm script documentation, so target regressions can be checked without running the full all-suite path.

Implementation Notes - 2026-05-05, Focused Target Telemetry Step

Completed in the current Node/React prototype:

- `npm run agent:check` now runs `target-smoke` as a separate local telemetry step before the full API smoke.
- Coverage summary now reports `focusedTargetSmokeChecked`.
- Markdown telemetry now includes Focused target smoke in the Gameplay Coverage table.

Next priority:

- Add command documentation for focused smoke scripts and telemetry artifacts in `README.md` or a development section so future agents/users know how to run target-only checks.

Implementation Notes - 2026-05-05, Developer Smoke Documentation

Completed in the current Node/React prototype:

- Added a root `README.md`.
- Documented local app startup commands for the server and web UI.
- Documented standard `agent:check` and `ci:check` flows.
- Documented focused API smoke suites, including the fast `smoke:targets` regression path.
- Documented telemetry artifacts and the target-specific coverage fields.

Next priority:

- Add a lightweight command reference to `README.md` for the current in-game verbs, especially target discovery, movement, inventory, shops, progression, and beginner combat.

Implementation Notes - 2026-05-05, README Command Reference

Completed in the current Node/React prototype:

- Added a current command reference to `README.md`.
- Documented information commands, movement, target discovery, target inspection, beginner combat, progression, and shops/economy.
- Clarified that web UI numpad and D-pad controls send the same movement verbs.

Next priority:

- Add a server-side `verb` command that returns grouped command hints matching the README command reference, so players can discover verbs in-game instead of relying on documentation.

Implementation Notes - 2026-05-05, Verb Discovery Command

Completed in the current Node/React prototype:

- Added passive `verb` and `verbs` commands.
- `verb` returns grouped hints for info, movement, targets, combat, progression, and shops.
- General `help` now advertises `verb`.
- Focused target smoke verifies the verb header and target verb group.

Next priority:

- Add a web quick-control button for `verb` and browser/static smoke coverage so players can discover grouped command hints from the UI.

Implementation Notes - 2026-05-05, Web Verb Discovery

Completed in the current Node/React prototype:

- Added `verb` to the web quick controls.
- Static UI smoke verifies the `verb` button is rendered.
- Browser smoke clicks `verb` and verifies grouped command discovery output, including the target command group.
- Browser command telemetry now counts the additional `verb` interaction.

Next priority:

- Add telemetry fields for verb discovery coverage from focused target smoke and browser smoke, then surface them in coverage summary and Markdown telemetry.

Implementation Notes - 2026-05-05, Verb Discovery Telemetry

Completed in the current Node/React prototype:

- Focused target smoke now reports `verbDiscoveryChecked`.
- Browser smoke now reports `verbDiscoveryClicked`.
- Coverage summary exposes verb discovery command and browser action coverage.
- Markdown telemetry includes Verb discovery command and Browser verb discovery action rows.

Next priority:

- Add a small command-discovery section to the web UI near controls that explains `verb`, `help scan`, and `target <name>` without requiring a first command click.

Implementation Notes - 2026-05-05, Target Details Command

Completed in the current Node/React prototype:

- Added passive `target` and `target <name>` commands.
- Added `appraise <target>` as an alias for target inspection.
- Target details report vitality, aggression, current engagement range, and a suggested next verb.
- Target inspection works both before engagement for room targets and during combat for the active target.
- API smoke verifies target details before engagement and range details after engagement.

Next priority:

- Surface target details in the web UI with a one-click details action and browser/static smoke coverage, while keeping typed `target <name>` as the canonical command.

Implementation Notes - 2026-05-05, Scan Help Branch

Completed in the current Node/React prototype:

- Added `help scan` and `help targets` as command-specific beginner guidance.
- General `help` now advertises `help scan`.
- Scan help explains target discovery, vitality, aggression, range checks, advancing, and melee attack gating.
- API smoke verifies the scan help branch alongside structured target metadata.

Next priority:

- Add a compact in-game target details command, such as `target <name>` or `appraise <target>`, that reports one selected target's vitality, aggression, engagement range, and suggested next verb.

Implementation Notes - 2026-05-05, Target Metadata Guidance

Completed in the current Node/React prototype:

- `scan` output now explains vitality and aggression in beginner-facing language.
- The web `Visible Targets` panel now includes the same lightweight guidance.
- API smoke verifies the scan guidance text.
- Static UI smoke verifies the target guidance panel text.
- Browser smoke verifies both terminal scan guidance and web target guidance.

Next priority:

- Add target metadata guidance to help text and documentation, including `help scan` or a short command-specific help branch.

Implementation Notes - 2026-05-05, Enemy Visibility Commands

Completed in the current Node/React prototype:

- Added passive `scan` command.
- `scan` lists local beginner targets with baseline vitality and aggression.
- Hunting-room `look` output now includes available local targets.
- API smoke now verifies target visibility in Willow Tract, Muddy Beetle Bend, and Low Ridge Rabbit Run.
- Coverage telemetry now tracks `scanChecked`.

Next priority:

- Add scan/target visibility to the web UI controls and browser smoke so players can discover enemies from both command input and quick actions.

Implementation Notes - 2026-05-05, Telemetry Coverage Summary

Completed in the current Node/React prototype:

- Added `artifacts/telemetry/coverage-summary.json`.
- Coverage summary includes check durations, unit suite names, browser source, browser command count, and gameplay counts from API smoke.
- Gameplay coverage tracks races rolled, guild rooms walked, shop rooms walked, circle reached, script steps, shop economy coverage, combat coverage, final room, and final combat state.
- Browser smoke now reports command count for trend telemetry.

Next priority:

- Add first gameplay content expansion beyond Crossing smoke coverage: additional beginner hunting rooms, enemy templates, and shop inventory variety while keeping all tests deterministic.

Implementation Notes - 2026-05-05, CI Browser Smoke

Completed in the current Node/React prototype:

- Browser smoke now uses `CHROME_PATH` when provided and falls back to Playwright-managed Chromium otherwise.
- Added Playwright browser installation to GitHub Actions.
- Added browser smoke to `npm run ci:check`, so CI now covers login, registration, character creation, typed commands, quick commands, and numpad movement.
- Browser telemetry reports whether it used system Chrome or Playwright Chromium.

Next priority:

- Add telemetry trend artifacts for gameplay coverage counts: races, guild rooms, shop rooms, circle reached, browser command count, and smoke durations in a compact machine-readable summary.

Implementation Notes - 2026-05-05, Check Telemetry Artifacts

Completed in the current Node/React prototype:

- Added `scripts/run-checks.mjs` to run CI/local checks with structured telemetry.
- `npm run ci:check` now records build, unit, UI smoke, and API smoke step telemetry.
- `npm run agent:check` now records local build, unit, UI smoke, browser smoke, API smoke, and git status telemetry.
- Telemetry includes command lines, exit codes, durations, output tails, and a Markdown summary.
- GitHub Actions now uploads `artifacts/telemetry` as the `check-telemetry` artifact.

Next priority:

- Add a lightweight target details panel or command output that explains what vitality/aggression mean for beginner players.
