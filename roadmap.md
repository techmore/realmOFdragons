# Dragon Realms Clean-Room Rebuild — Project Scope and Roadmap

## 0) Scope decision (clean-room)

This project is a **clean-room, inspiration-driven** implementation, not a clone and not a copy of any existing server/client code or proprietary assets.

- We will only design from public knowledge, user-facing behavior docs, and your own gameplay goals.
- We do not reuse internal Simutronics protocol internals, proprietary parser code, item databases, or text assets.
- The repository scope starts with a playable, secure, testable web+API platform that captures DragonRealms-like systems, not binary compatibility.

## 1) Core product goal

Deliver a modern web-first client + secure API backend that supports:

- Multiple accounts and multiple characters per account.
- Secure authentication and session handling (TLS transport, token/session hardening, encrypted secrets).
- Keyboard-first D-pad/numpad movement in an immediate, low-latency UI.
- Town movement/travel with The Crossing as the launch hub.
- Shops and local-commerce (buy/sell/price checks) in market areas.
- All races playable with configurable race stat profiles.
- All guilds and circle progression.
- Combat with tactical action timing (roundtime-style asynchronous flow, not strict turn-only).
- Milestone target: all races should be able to reach at least Circle 10 in Crossing.

## 2) What this should model from Dragon Realms references

- DR is command-driven and MUD-like with textual rooms, movement verbs, shops, and extensive systems.
- Character growth is by **circles** (the term used instead of level) with circling mechanics.
- Combat includes attack/defense maneuvers and action lockout timers (“roundtime”).
- Towns expose localized direction help and localized shops/task landmarks.
- Guilds/races are defined as explicit archetype systems with distinct trade-offs.

## 3) Recommended technical stack

**Recommended stack (pragmatic default):**

- **Backend API**: `Node.js + TypeScript + Express` (your current success path) for speed and team familiarity.
- **Real-time transport**: `WebSocket` (Socket.IO or ws) for command/execution streams.
- **Persistence**: `PostgreSQL` for durable state, `Redis` for session/action queues.
- PostgreSQL is preferred over SQLite for this game because we need concurrent multi-user sessions, strict transactional safety, and relational integrity across combat/state/shop/progression systems.
- **Auth & security**: `JWT` access + refresh rotation, `argon2` password hashing, optional TOTP/WebAuthn later.
- **Frontend**: `React + TypeScript + Vite`.
- **Client deployment**: web-first initially; optional desktop wrapper later.

Why this over Telnet:

- Better transport security and explicit identity controls.
- Cleaner multi-account/multicharacter session management.
- Deterministic API boundaries for observability, abuse prevention, and testability.

### API-first transport decision

Telnet is intentionally not a target transport. We will use:

- HTTPS REST endpoints for authenticated state operations.
- WebSocket event stream for real-time command echoes and room prompt updates.
- Signed, rotating access and refresh tokens.

That gives us deterministic input validation, replay protection, role scoping, and secure multi-device login flows.

## 4) Architecture blueprint (high level)

- **Gateway API**
  - `/v1/auth/*`, `/v1/accounts/*`, `/v1/characters/*`, `/v1/world/*`, `/v1/combat/*`.
- **World Service**
  - Data-driven zones/rooms/shops/creatures; Crossing + nearby routes first.
- **Session/State Service**
  - Active sockets, selected character, command throttling, anti-cheat gates.
- **Combat Service**
  - Per-actor action queues with RT/cooldowns, stamina/balance-like state, range states, and event logs.
- **Commerce Service**
  - Shops, inventory, buy/sell/price checks, currency handling.
- **Progression Service**
  - Circle requirements, guild progression templates, training and skill growth.
- **Audit + Security**
  - IP/device/session anomaly tracking, signed command envelopes, immutable audit logs, rate limits.

### Data and documentation pipeline

- Store every gameplay source you’re using (wiki notes, hand-curated docs) in a `docs/reference/` folder with explicit derivation notes.
- Build clean-room data tables for races/guilds/combat terms from those references.
- Require spec-review for any balance/numeric change before merge.
- Add regression tests that validate the intended behavior from your own rule docs.

## 5) Data model outline (v1)

Location IDs use an encoded UUID-like code where:

- first segment = town (`crossing`)
- second segment = square (`TG01`, `IN02`, etc.)
- third segment = local tile index (`001`, `002`, etc.)

Examples:

- `crossing-TG01-001` => town `crossing`, square `TG01`, tile `001`
- `crossing-IN02-001` => town `crossing`, square `IN02`, tile `001`

- `users`, `accounts`, `characters`
- `character_sessions`, `login_events`, `security_devices`
- `race_definitions`, `guild_definitions`, `skills`, `skill_progress`, `guild_progress`
- `circles`, `circle_requirements`
- `zones`, `rooms`, `room_exits`, `area_events`
- `shops`, `shop_items`, `shop_transactions`, `currency`
- `combat_states`, `combat_actions`, `combat_event_log`

Crossing-specific data completeness and seed scope are tracked in:

- [data-content-plan.md](/Users/techmore/projects/cleanroom-dragonrealms/data-content-plan.md)

## 6) Roadmap

### Phase 0 — Discovery & rulesheet (2–3 weeks)

- Finalize clean-room interpretation policy.
- Define v1 command grammar and canonical gameplay API.
- Normalize stat model, race trait tables, and guild frameworks.
- Draft rules documents for combat timing, economy, progression, and movement.
- Define test harness that validates your own intended rule behavior.
- Add a **race-variability mode** option for deterministic vs plus/minus variant race stats.

### Phase 1 — Secure account foundation (2 weeks)

- Multi-account identity and auth.
- Password and token hardening, audit trail, rate limits.
- Character inventory and safe character-switch flow.
- Per-character active session constraints and optional “active device” policy.

### Phase 2 — Crossing-only world MVP (3–5 weeks)

- Implement graph model for Crossing and adjacent entry points.
- Direction parser and D-pad/numpad mapping (8-direction + custom exits).
- REST + WS command stream.
- Basic room descriptions, exits, and movement latency handling.

### Phase 3 — Commerce MVP (2–4 weeks)

- Local shop and market entities.
- Buy/sell/price checks, shop restock hooks.
- Wallet/inventory persistence, bank/vault abstraction.
- Directions helper for major town wayfinding points.

### Phase 4 — Races, Guilds, Circles (4–6 weeks)

- Implement all planned races.
- Implement guild role templates and guild skills.
- Implement circle progression with explicit requirements and manual circling.
- Validate each race can reach Circle 10 in Crossing by v1 acceptance test.

### Phase 5 — Asynchronous combat core (4–6 weeks)

- Action readiness model with RT and cooldown.
- Maneuver and defensive model (stance, offhand, range) as a gameplay layer.
- Combat event stream + replay for QA and balancing.
- Encounter/loot loop with creature tables for Crossing-adjacent hunting.

### Phase 6 — Stabilization and scale (ongoing)

- Anti-exploit controls, load/performance tuning, and telemetry.
- Tooling for balancing (simulators, combat seeds, skill diff reports).
- Accessibility and input audits for keyboard/touch.

## 7) Risks / assumptions

- This is not a server-level clone; exact historical mechanics may diverge.
- Numerical parity requires explicit target benchmarks and continuous tuning.
- Multi-character economy, legal policy, and moderation controls need early product decisions.
- Real-money or equivalent flows should include clear anti-fraud and compliance boundaries.

## 8) Next immediate actions

1. Seed clean-room source index and game design spec docs.
2. Scaffold API + auth service.
3. Add websocket command channel + movement command baseline.
4. Add Crossing zone seed + first NPC shop interaction.
