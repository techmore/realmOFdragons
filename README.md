# Realm of Dragons

Clean-room DragonRealms-inspired MUD prototype with a Node/Express API, React web client, file-backed prototype persistence, command smoke coverage, and local telemetry reports.

## Run the app

Install dependencies once:

```sh
npm install
npm --prefix server install
npm --prefix frontend install
```

Run the API:

```sh
npm --prefix server run dev
```

Run the web UI:

```sh
npm --prefix frontend run dev -- --host 127.0.0.1 --port 4200
```

Open the UI at `http://127.0.0.1:4200`.

## Standard checks

Run the full local agent check:

```sh
npm run agent:check
```

This runs build, unit tests, static UI smoke, browser smoke, focused target smoke, full API smoke, and git status telemetry.

Run the CI-shaped check:

```sh
npm run ci:check
```

This omits local-only git status and runs the checks used by GitHub Actions.

## Focused smoke scripts

API smoke suites run against a live test server. Use `scripts/with-test-server.mjs` when running them from the repo root:

```sh
node scripts/with-test-server.mjs npm --prefix server run smoke:targets
node scripts/with-test-server.mjs npm --prefix server run smoke:combat
node scripts/with-test-server.mjs npm --prefix server run smoke:economy
node scripts/with-test-server.mjs npm --prefix server run smoke:progression
node scripts/with-test-server.mjs npm --prefix server run smoke:identity
node scripts/with-test-server.mjs npm --prefix server run smoke:scripts
node scripts/with-test-server.mjs npm --prefix server run smoke:api
```

The focused `smoke:targets` suite is the fastest target-regression path. It covers `scan`, structured room target payloads, `help targets`, `target <name>`, `appraise <target>`, engagement, and bare `target` range details.

Browser smoke runs against both the API and web UI:

```sh
node scripts/with-test-app.mjs npm run smoke:browser
```

Static UI smoke does not need a server:

```sh
npm run smoke:ui
```

## Telemetry artifacts

`npm run agent:check` and `npm run ci:check` write ignored telemetry files under `artifacts/telemetry`.

Primary artifacts:

- `summary.json`: complete step results with command lines, exit codes, durations, and output tails.
- `summary.md`: human-readable check report with step status, gameplay coverage booleans, and gameplay counts.
- `coverage-summary.json`: compact machine-readable coverage summary for agents and trend tooling.
- `<step>.json`: per-step telemetry for build, tests, smokes, and git status.

Coverage fields currently distinguish broad combat coverage from target-specific coverage:

- `gameplay.scanChecked`
- `gameplay.structuredTargetsChecked`
- `gameplay.targetDetailsChecked`
- `gameplay.focusedTargetSmokeChecked`
- `frontend.browserTargetDetailsClicked`

Use these fields when reviewing whether a report proves target discovery, target metadata, typed target details, and web target-detail affordances all ran.

## Current command reference

Core information:

- `help`: list available commands.
- `help scan` or `help targets`: explain target discovery and target metadata.
- `look`: show the current room, prompts, exits, shop presence, and visible local targets.
- `exits`: list current room exits.
- `score`: show character identity, circle, stance, balance, health, room, wallet, and combat summary.
- `skills`: show skill ranks and learning pools.
- `inventory` or `inv`: show carried items.
- `balance`: show current balance and stance label.
- `range`: show current combat range if engaged.
- `combat`: show target, target HP, range, advantage, stance, and balance.

Movement:

- `north`, `south`, `east`, `west`, `n`, `s`, `e`, `w`: move through visible exits.
- `go <direction>`: movement alias.
- `enter`, `exit`, `up`, `down`, `ne`, `nw`, `se`, `sw`: supported where the room graph defines those exits.
- Web UI numpad and D-pad controls send the same movement commands.

Target discovery and inspection:

- `scan`: list immediate room targets with vitality and aggression.
- `target`: inspect the active combat target.
- `target <name>`: inspect a visible room target.
- `appraise <target>`: alias for target inspection.
- Target details report vitality, aggression, current range, and suggested next verb.

Beginner combat:

- `stance`: show current stance.
- `stance balanced`, `stance offensive`, `stance defensive`, `stance evasive`: change combat stance.
- `advance` or `advance <target>`: engage or close range toward a target.
- `retreat`: open range from an engaged target.
- `attack` or `attack <target>`: attack once in melee range.
- `circle`: improve position/advantage while engaged; outside combat it checks circle advancement.
- `jab`: faster maneuver usable at pole or melee range.
- `bash`: heavier melee-only maneuver.
- `defend`: guard and recover footing.
- `flee`: break combat.
- `wait <ms>`: wait through roundtime and allow recovery/pressure ticks.
- `rest`: recover health, including from incapacitation.

Progression:

- `train`: train the guild primary skill or a default starter skill.
- `train <skill>`: train a named skill such as `melee`, `evasion`, `tactics`, or `scholarship`.
- `circle`: attempt to advance to the next circle when requirements are met.
- `join guild`: join the guild associated with the current guild room.

Shops and economy:

- `shop`: show the local shop catalog if the room has a shop.
- `shop buy <code>`: buy an item by catalog code.
- `shop sell <code>`: sell an inventory item by code.
- Wallet output currently uses `plat`, `trias`, `lucan`, and `silk`.
