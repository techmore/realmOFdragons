# Evennia Port Parity Audit

Date: 2026-05-31

Scope: current Evennia runtime parity against the SPEC success criteria for playable user creation, in-world guild joining, Circle 1-10 progression, Crossing movement, shops/NPCs, enemy spawning, and asynchronous range-based combat.

## Summary

The Evennia runtime now has direct smoke coverage for every SPEC success criterion at the current Circle 1-10 scope. The goal should remain active because "nearly identical for users up to level 10" is broader than smoke-test parity; however, the current audited baseline is strong enough to guide final polish and regression protection.

Validation command: `npm run check:evennia`

Latest expected result after this audit: compile passes and Evennia world tests pass.

## SPEC success criteria evidence

### All 11 races can create Circle 1 characters

Status: Proven by command smoke.

Evidence:
- `DRDataTests.test_canonical_race_count` verifies 11 canonical races.
- `DRAccountCreationTests.test_account_create_character_supports_all_races_as_circle_one_commoners` creates one account-side character for every race through `create character <name> = <race>`.
- `DRAccountCreationTests.test_account_created_character_persists_core_start_state_after_reload` reloads the Evennia character object from the database and verifies race, attributes, unaffiliated Circle 1 guild state, Crossing location, roster membership, starter skills, and wallet state persist.
- The all-race smoke verifies race id, race display name, race-derived attributes, `creation_complete`, `commoner` guild state, Circle 1 state, and Crossing start-room placement.

Residual risk:
- `EVENNIA_SMOKE_TRANSCRIPT.md` now provides a terminal/Telnet-style account and in-world command transcript. A live socket-level telnet client is still not part of automation.

### All 11 guilds can be joined only by visiting their registrar

Status: Proven by command smoke and unit coverage.

Evidence:
- `DRWorldTests.test_all_guild_registrars_exist` verifies 11 registrar rooms.
- `DRWorldTests.test_all_guild_registrars_are_reachable_from_town_green` verifies each registrar is reachable.
- `DRCommandSmokeTests.test_join_guild_requires_a_registrar_room_command` verifies `join guild` fails outside a registrar.
- `DRCommandSmokeTests.test_all_guilds_join_and_reach_circle_ten_through_commands` joins every guild at its registrar.
- The all-guild command smoke now asks every registrar for pre-join and post-join in-world guidance with `registrar` / `ask registrar`.
- Focused help and the generated terminal transcript now expose `registrar`, `focus`, and `technique` in the core guild progression path.
- `DRCommandSmokeTests.test_joined_characters_cannot_switch_guilds_at_other_registrars` verifies existing guild affiliation cannot be overwritten at another registrar.
- `DRGuildTests` covers registrar metadata behavior at helper level.

Residual risk:
- Registrar NPC personalities and next-step guidance are represented by room-aware text commands, not full branching conversational NPC trees.

### Every guild can progress to Circle 10 through normal commands

Status: Proven by command smoke.

Evidence:
- `DRCommandSmokeTests.test_all_guilds_join_and_reach_circle_ten_through_commands` uses `join guild`, repeated `train`, and repeated `circle` to advance every guild to Circle 10.
- The smoke verifies Circle 1 milestone unlock, Circle 10 cap, ten unlocked milestones, and final Circle 10 state for each guild.
- The all-guild smoke verifies `passive` / `guild passive` for every guild, with distinct passive identities and Circle-scaled skill progress.
- The all-guild smoke verifies `drill` / `guild drill` at each guild registrar, training both guild primary and distinct support skills through Circle-scaled practice.
- `DRCommandSmokeTests.test_circle_requires_own_guild_registrar_room_command` verifies circling is registrar-gated.
- `DRCommandSmokeTests.test_joined_training_requires_own_guild_registrar_room_command` verifies training is own-registrar-gated.
- `DRCommandSmokeTests.test_circle_status_guides_unaffiliated_and_ready_characters` verifies status guidance for unaffiliated and ready-to-circle states.

Residual risk:
- Requirements and ability themes are clean-room/prototype requirements, not a full recreation of every original guild-specific DR requirement.

### Crossing can be walked room-to-room

Status: Proven by command smoke and graph validation.

Evidence:
- `DRWorldTests.test_crossing_world_graph_is_valid` validates the room graph.
- `DRWorldTests.test_hunting_rooms_are_reachable_from_town_green` verifies hunting reachability.
- `DRWorldBuilderTests.test_build_crossing_world_creates_rooms_and_exits` verifies built room/exits.
- `DRWorldBuilderTests.test_built_crossing_exits_have_mud_direction_aliases` verifies direction aliases.
- `DRCommandSmokeTests.test_direction_alias_commands_move_through_crossing` verifies alias command movement.
- `DRCommandSmokeTests.test_command_exits_can_walk_to_every_crossing_room` walks from Town Green to every configured Crossing room using actual exit commands.

Residual risk:
- The Crossing graph is a clean-room scaffold, not a complete original Crossing map.

### Shops/NPCs work with buy/sell/dialogue

Status: Proven across every configured shop.

Evidence:
- `DRWorldBuilderTests.test_built_shopkeeper_npcs` verifies shopkeeper NPCs and stock metadata.
- `DRCommandSmokeTests.test_shop_buy_sell_inventory_and_hands_commands` verifies representative buy/sell/inventory/hands flow.
- `DRCommandSmokeTests.test_shopkeepers_reject_untraded_items_and_missing_carried_items` verifies keeper refusal behavior.
- `DRCommandSmokeTests.test_all_configured_shops_support_dialogue_buy_sell_and_refresh` visits every configured shop and verifies overview, dialogue, stock display, buy, sell, stock depletion, carried item objects, restock, and refresh.
- `DRCommandSmokeTests.test_shop_tasks_reward_travel_and_trade_skills` verifies shopkeeper task request/status/completion, destination checks, coin rewards, and Trading/Appraisal/Athletics progress.
- `DRCommandSmokeTests.test_forage_creates_gatherable_and_trains_survival_skills` verifies trail foraging creates physical `wild_herbs`, supports pickup/sale, and feeds Outdoorsmanship/Perception.
- `DRCommandSmokeTests.test_forage_creates_gatherable_and_trains_survival_skills` also verifies item appraisal for gathered goods and Appraisal progress.
- `DRCommandSmokeTests.test_wield_wear_and_equipment_commands` verifies bought gear can be wielded/worn.
- `DRCommandSmokeTests.test_wield_wear_and_equipment_commands` also verifies gear repair condition tracking and Shield Usage/Light Armor progress.

Residual risk:
- Shop inventories are intentionally small beginner inventories.
- Beginner economy breadth now includes a Drainage Trail Peddler and Culvert Cache near the expanded hunting path with field bandage stock, but shops remain starter-scale.
- `field_bandage` now has command-level `use` behavior that restores health and consumes the physical item object.
- `tend` / `treat` now provide command-first wound care aliases that default to a carried `field_bandage`.
- Enemy pressure can now inflict a visible bleeding wound state with its own async ticker, and `field_bandage` stops it while restoring health and feeding First Aid progress.

### Enemies spawn in Crossing hunting rooms

Status: Proven by builder and command smoke.

Evidence:
- `DRWorldBuilderTests.test_built_enemy_npcs` verifies each configured target spawns as an enemy NPC.
- `DRWorldBuilderTests.test_built_hunting_rooms_have_respawn_scripts` verifies respawn scripts on hunting rooms.
- `DRCommandSmokeTests.test_room_status_commands_describe_text_navigation_context` verifies hunting room target metadata.
- `DRCommandSmokeTests.test_all_crossing_enemies_can_be_fought_through_command_loop` walks to every hunting room and fights every configured enemy.
- `DRCommandSmokeTests.test_recovery_and_respawn_scripts_tick_existing_helpers` verifies respawn script behavior.
- The Silted Canal Edge/Marsh Spider and Old Orchard Verge/Orchard Crow extend the beginner path and are covered by all-room movement, all-enemy combat, respawn, shop, and forage smoke.

Residual risk:
- Spawn variety is limited to the current beginner enemy set.
- Beginner combat breadth now includes Root-Tangled Drainage, Reed-Choked Culvert, Silted Canal Edge, Old Orchard Verge, Ditch Rat, Reed Snake, Marsh Spider, and Orchard Crow additions, but Crossing remains a compact clean-room scaffold.

### Combat is asynchronous, range-based, and skill-driven

Status: Proven by command and script smoke.

Evidence:
- `DRCommandSmokeTests.test_scan_target_advance_range_and_retreat_commands` verifies `scan`, `target`, `range`, `advance`, `retreat`, pressure scripts, and combat status.
- `DRCommandSmokeTests.test_jab_requires_melee_and_defeats_enemy` verifies melee gating, roundtime, recovery, skill-pool gains, corpse creation, loot, and cleanup.
- `DRCommandSmokeTests.test_skin_corpse_creates_pelt_and_trains_hunting_skills` verifies post-combat corpse skinning, pelt creation, duplicate prevention, pickup, and Skinning/Outdoorsmanship progress.
- `DRCommandSmokeTests.test_race_attributes_and_weapon_skill_modify_combat_damage` verifies attribute and skill-rank damage effects.
- `DRCommandSmokeTests.test_combat_pressure_script_damages_engaged_character` verifies async enemy pressure.
- `DRCommandSmokeTests.test_field_bandage_treats_combat_bleeding` and bleeding guidance smoke verify wound response suggestions and treatment.
- `DRCommandSmokeTests.test_enemy_pressure_incapacitation_and_revive` verifies incapacitation/revive behavior.
- `DRCommandSmokeTests.test_bash_defend_and_flee_commands` verifies bash, defend, flee, roundtime, and pressure cleanup.
- `DRCommandSmokeTests.test_combat_maneuvers_deduplicate_recovery_scripts` verifies recovery script deduplication.
- `DRCommandSmokeTests.test_all_crossing_enemies_can_be_fought_through_command_loop` verifies every enemy can be fought through range-based command combat and awards skill pools.

Residual risk:
- Combat is a clean-room asynchronous model with beginner mechanics, not a full original DR combat simulation.

### Evennia smoke tests prove the above automatically

Status: Proven by automated test command.

Evidence:
- `npm run check:evennia` compiles Evennia command/typeclass/world modules and runs `evennia test --settings settings.py world`.
- `npm run check:evennia` also runs `scripts/evennia-webclient-smoke.mjs`, proving the Evennia Django `/webclient/` route resolves through the local webclient URL configuration and renders a webclient page through Django's test client.
- The current suite contains command and builder smoke for all criteria above.

Residual risk:
- `EVENNIA_SMOKE_TRANSCRIPT.md` covers the terminal-style command path, and `npm run check:evennia` proves command behavior plus webclient route/render availability. Full live-browser login/playthrough automation is still not represented in this audit.

## Highest remaining parity risks

- Original-map fidelity: current Crossing is an expanding clean-room scaffold with canonical-style districts, hunting/shop/guild affordances, and beginner supply placement, not a full original Crossing clone.
- Guild-specific flavor: all guilds now expose Circle 1-10 ability summaries, shared primary-skill `focus`, distinct `technique` support-skill behavior, registrar-gated `drill` and `practice`, and once-per-Circle persistent `boon` rewards, but these are clean-room mechanics rather than full original guild ability systems.
- Study/read now gives non-combat Scholarship progress in study halls and reinforces guild primary learning at a character's own registrar.
- Browser webclient parity: command-first runtime is Evennia-backed, a generated terminal-style transcript exists, and the Evennia `/webclient/` route/render path is smoke-tested; full live-browser login/playthrough polish may still live in the legacy frontend.
- Persistence/security hardening: Evennia account creation now has database reload smoke for core start state, but this audit did not do a broader security review beyond command behavior.

## Next recommended work

1. Add live Evennia browser login/playthrough smoke if tooling is available.
2. Expand guild-specific Circle 1-10 passive perks beyond the first `boon` implementation into deeper per-guild command behavior.
3. Expand beginner content breadth beyond the current clean-room Crossing scaffold.
