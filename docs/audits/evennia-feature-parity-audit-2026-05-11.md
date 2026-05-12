# Evennia Feature-Parity Audit - 2026-05-11

## Summary

The repository is correctly pivoted toward Evennia, but the Evennia runtime is still at the foundation/progression stage. The legacy Node/React prototype remains far ahead in world content, shop/economy, enemies, combat, scripts, browser UX, and smoke telemetry.

The highest-value path is to make Evennia validation first-class, then port feature slices in this order: race-only character creation, Crossing rooms/exits, guild registrars/joining, Circle 1-10 smoke, shops, enemies, and asynchronous combat.

## Severity legend

- `P0`: Blocks Evennia feature parity or reliable migration.
- `P1`: High-impact gap that should be handled soon.
- `P2`: Useful improvement after core parity work.

## Findings

### P0 - Evennia has no automated top-level check command

Subsystem: developer workflow / validation

Evidence:

- The root `package.json` has `agent:check` for the legacy Node/React prototype but no Evennia equivalent.
- Evennia validation currently requires manually knowing to run Python compile checks plus `evennia test --settings settings.py world`.

Recommendation:

- Add a root `check:evennia` command that compiles Evennia modules and runs Evennia tests from `evennia-game/`.
- Make future migration slices run this command before commit.

Status:

- Implemented in this audit slice via `scripts/check-evennia.mjs` and `npm run check:evennia`.

### P0 - Character creation is not yet DragonRealms-compatible

Subsystem: identity / accounts / character creation

Evidence:

- `evennia-game/typeclasses/characters.py` initializes default Human/commoner state after object creation.
- There is no Evennia command/menu flow requiring users to choose one of the 11 canonical races.
- The success criteria require all 11 races to create Circle 1 characters.

Recommendation:

- Override Evennia's character creation flow or add a first-login creation menu.
- Enforce race-only selection at creation.
- Reject guild-at-creation and start every character as `commoner` / `Unaffiliated` / Circle 1.
- Add Evennia tests for all 11 races.

Status:

- Partially implemented after this audit: added `race` / `choose race` command and pure identity tests proving all 11 canonical races can be selected only while unaffiliated at Circle 1.
- Remaining work: wire this into Evennia's account/character creation flow so race selection is required before normal play.

### P0 - Crossing map is not ported to Evennia

Subsystem: world / rooms / exits

Evidence:

- `evennia-game/world/dr_data.py` has race/guild/skill data only.
- There are no Crossing room fixtures, deterministic room ids, exits, guild rooms, shops, or hunting rooms in Evennia.
- The legacy prototype already has room/pathfinding coverage and Crossing traversal smoke.

Recommendation:

- Add a Crossing data module with room ids, titles, descriptions, exits, and metadata.
- Add an idempotent Evennia world builder command/script.
- Add tests for room count, critical route connectivity, and deterministic aliases.

Status:

- Implemented after this audit: added `world.dr_world` with Crossing room ids, exits, all 11 guild registrar rooms, hunting rooms, graph validation, registrar lookup, pathfinding tests, and an idempotent Evennia database world builder that creates actual Room/Exit objects.
- Remaining work: add richer room metadata for shops/NPCs/forage once those systems are ported.

### P0 - Guild registrars and in-world joining are missing in Evennia

Subsystem: guilds / progression

Evidence:

- `evennia-game/world/dr_progression.py` supports guild primary skills if `guild_id` is already set.
- No Evennia room currently marks a registrar.
- No `join guild` command exists in Evennia.
- The success criteria require guilds to be joined only by visiting registrars.

Recommendation:

- Add registrar metadata to Crossing room data.
- Add `join guild` command that only succeeds in registrar rooms.
- Add tests for no-registrar rejection and all 11 canonical guild joins.

Status:

- Partially implemented after this audit: Crossing registrar rooms now carry guild metadata, `join guild` exists in Evennia, and helper tests prove no-registrar rejection plus all 11 canonical guild joins.
- Remaining work: add command-level Evennia smoke that walks to every registrar room and joins through the real Room/Exit database objects.

### P1 - Circle 1-10 progression exists only as pure helper logic

Subsystem: progression / smoke tests

Evidence:

- `train` and `circle` commands exist, and pure tests cover Circle 2.
- There is not yet an Evennia command-smoke that drives all 11 guilds to Circle 10 at registrar rooms.

Recommendation:

- After registrar rooms exist, add an Evennia smoke test that joins each guild, trains through text commands, and circles to 10.
- Keep the prototype threshold for now so the smoke stays fast.

### P1 - Shops, NPCs, inventory, hands, and wallet are not ported

Subsystem: economy / objects

Evidence:

- Evennia character state has a wallet attribute.
- There are no Evennia item prototypes, shop rooms, shopkeeper NPCs, inventory/hands commands, buy/sell commands, or stock/dialogue helpers.
- The legacy prototype has focused shop NPC and damaged ammo smoke coverage.

Recommendation:

- Port item/shop data after world/guild rooms are built.
- Model shopkeepers as Evennia objects/NPCs and item inventory as Evennia objects or Attribute-backed prototypes.
- Add buy/sell/dialogue tests matching the prototype smoke expectations.

### P1 - Enemies and asynchronous range combat are not ported

Subsystem: combat / scripts

Evidence:

- The Evennia implementation has no target data, enemy objects, combat state, range commands, stance, balance, or Scripts/tickers.
- The success criteria explicitly require asynchronous range-based combat.

Recommendation:

- Port enemy deployments after Crossing hunting rooms exist.
- Use Evennia Scripts/tickers for enemy pressure and roundtime-like updates.
- Add `scan`, `target`, `advance`, `retreat`, `range`, `stance`, `attack`, `jab`, `bash`, `defend`, and `flee` in thin tested slices.

### P1 - Data parity is manual and duplicated

Subsystem: migration architecture / data

Evidence:

- Skill, guild, and race data now exist in both TypeScript and Python.
- There is no generated shared source or parity check comparing the two catalogs.

Recommendation:

- Create a migration parity test or generator that compares canonical ids/counts between the legacy prototype and Evennia data.
- Long term, prefer a neutral data format exported into both runtimes during migration.

### P2 - Documentation still contains large legacy implementation history

Subsystem: documentation / agent guidance

Evidence:

- `SPEC.md` is authoritative but very long and still contains extensive historical Node implementation logs.
- The top goal is clear, but current next steps can be hard for agents to isolate.

Recommendation:

- Keep the top authoritative goal and current status.
- Move older Node history into an archive once Evennia reaches core identity/world parity.

## Recommended next implementation order

1. Add Evennia validation to root workflow. Done in this audit slice.
2. Add race-only Evennia character creation/selection tests.
3. Add Crossing room data and idempotent world builder.
4. Add guild registrar metadata and `join guild`.
5. Add all-guild Circle 10 Evennia smoke.
6. Port shops/NPCs/items.
7. Port enemies and asynchronous range combat.
