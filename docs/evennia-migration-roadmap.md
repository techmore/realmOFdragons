# Evennia Migration Roadmap

## Decision

Pivot the runtime to Evennia while preserving the current Node/React prototype as a working reference until feature parity is reached.

## Authoritative app goal

Build a clean-room, text-first DragonRealms-inspired MUD on Evennia that reaches feature parity with the current prototype, then surpasses it.

Core target:

Create a playable multi-user MUD where players create accounts, choose canonical DragonRealms-style races, enter Crossing as unaffiliated characters, join guilds in-world, train skills, advance through Circles, explore shops and hunting areas, and fight enemies through asynchronous range-based combat.

Success criteria:

- All 11 races can create Circle 1 characters.
- All 11 guilds can be joined only by visiting their registrar.
- Every guild can progress to Circle 10 through normal commands.
- Crossing can be walked room-to-room.
- Shops/NPCs work with buy/sell/dialogue.
- Enemies spawn in Crossing hunting rooms.
- Combat is asynchronous, range-based, and skill-driven.
- Evennia smoke tests prove the above automatically.

## Capability fit

Evennia covers the platform concerns:

- Multi-user accounts and character puppeting.
- Rooms, exits, commands, objects, scripts, sessions, locks, permissions.
- Django-backed persistence and admin.
- Browser webclient over WebSockets plus traditional MUD/Telnet access.
- Python extension points for custom game systems.

Custom systems still required:

- Clean-room race selection and stat generation.
- In-world guild joining.
- Skill pools, ranks, circle requirements, and guild primary skills.
- Crossing map, shops, NPCs, inventory, equipment, and economy.
- Enemy spawning, engagement range, balance/roundtime, asynchronous combat.
- Smoke tests for command-level gameplay parity.

## Migration phases

0. `Audit and validation`
   - Maintain a committed audit report for feature-parity blockers.
   - Run `npm run check:evennia` for Evennia migration slices.
   - Keep legacy prototype checks available for regression comparison, but prioritize Evennia implementation.

1. `Foundation`
   - Initialize Evennia project.
   - Add pinned Python requirements.
   - Add DR data modules and core text commands.

2. `Identity`
   - Override character creation.
   - Race selection only at creation.
   - Multiple characters per account.
   - Score output mirrors current prototype.
   - Current status: new characters start with unchosen race and incomplete creation state; `create character <race>` / `race <race>` completes creation as unaffiliated Circle 1, and `join guild` is blocked until creation is complete.
   - Current next blocker: race choice is still command-driven after default Evennia object creation, not a dedicated account-level character creation menu.

3. `Crossing`
   - Port room graph and exits.
   - Add deterministic room ids as aliases/attributes.
   - Port `look`, `survey`, `exits`, and movement smoke coverage.

4. `Guilds and progression`
   - Add registrar rooms.
   - Implement `join guild`.
   - Implement `skills`, `train`, `circle`, skill pools, and Circle 1-10 requirements.
   - Current status: command smoke builds Crossing, walks actual Room/Exit paths to every guild registrar, joins all 11 guilds, and advances each guild to Circle 10 through `train`/`circle`.

5. `Economy`
   - Port item catalog, shops, NPC dialogue, wallet, buy/sell, hands, inventory, and equipment.
   - Current status: initial shop data, in-room shopkeeper NPC objects, shopkeeper dialogue, object-backed `buy`/`get` item ownership, `shop`, `shop talk`, `sell`, `inventory`, `hands`, `wield`, `wear`, `equipment`, wallet mutation, pack inventory, and hand display are implemented with command smoke.
   - Current next blocker: stock refresh is not modeled, Crossing shop coverage is still sparse, and item/equipment behavior is still minimal.

6. `Combat`
   - Port enemies and room deployments.
   - Implement `scan`, `target`, `advance`, `retreat`, `range`, `stance`, `attack`, `jab`, `bash`, `defend`, `flee`.
   - Use Evennia Scripts/tickers for asynchronous pressure and roundtime-like behavior.
   - Current status: initial Crossing enemy deployments build real enemy NPC objects, and command smoke covers `scan`, `target`, `range`, `advance`, `retreat`, `stance`, deterministic `jab`/`attack`, `bash`, `defend`, `flee`, roundtime blocking, manual `wait`/`recover`, damage, health, stance-modified enemy retaliation, lootable corpse objects, physical item drops, `get`, basic `wield`/`wear`/`equipment`, corpse decay Script hooks, manual respawn, respawn Script hooks, recovery Script hooks, automatic combat pressure Script lifecycle, balance mutation, and enemy defeat cleanup.
   - Current next blocker: object drops are still sparse and deeper asynchronous combat Scripts remain limited.

7. `Client`
   - Start with Evennia's built-in webclient.
   - Later customize web templates/CSS to match the desired MUD terminal style.
   - Keep commands as the primary interaction model.

## Cutover rule

Do not retire the Node prototype until the Evennia implementation passes equivalents for:

- All 11 races create at Circle 1.
- All 11 guilds join in-world and reach Circle 10.
- Crossing map traversal.
- All shops/NPC transactions.
- All Crossing enemies spawn and can be fought.
- Browser client and text command smoke tests.
