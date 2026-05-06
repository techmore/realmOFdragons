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
