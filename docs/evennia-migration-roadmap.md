# Evennia Migration Roadmap

## Decision

Pivot the runtime to Evennia while preserving the current Node/React prototype as a working reference until feature parity is reached.

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

1. `Foundation`
   - Initialize Evennia project.
   - Add pinned Python requirements.
   - Add DR data modules and core text commands.

2. `Identity`
   - Override character creation.
   - Race selection only at creation.
   - Multiple characters per account.
   - Score output mirrors current prototype.

3. `Crossing`
   - Port room graph and exits.
   - Add deterministic room ids as aliases/attributes.
   - Port `look`, `survey`, `exits`, and movement smoke coverage.

4. `Guilds and progression`
   - Add registrar rooms.
   - Implement `join guild`.
   - Implement `skills`, `train`, `circle`, skill pools, and Circle 1-10 requirements.

5. `Economy`
   - Port item catalog, shops, NPC dialogue, wallet, buy/sell, hands, inventory, and equipment.

6. `Combat`
   - Port enemies and room deployments.
   - Implement `scan`, `target`, `advance`, `retreat`, `range`, `stance`, `attack`, `jab`, `bash`, `defend`, `flee`.
   - Use Evennia Scripts/tickers for asynchronous pressure and roundtime-like behavior.

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
