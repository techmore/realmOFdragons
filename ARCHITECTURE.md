# Realm of Dragons Architecture Notes

This project is currently a fast clean-room prototype. The stack is intentionally optimized for learning mechanics, building a usable web client, and creating repeatable smoke coverage before we commit to a production runtime.

## Current stack

- Server: Node.js and Express.
- Client: React web UI.
- Persistence: file-backed prototype storage.
- Realtime model: request/response command API with browser and API smoke coverage.
- World data: TypeScript-defined room, shop, target, item, and command fixtures.

This is the right stack for the current phase because iteration speed matters more than final runtime shape. It lets us validate DragonRealms-inspired mechanics, account flows, character state, scripts, shops, movement, and combat affordances quickly.

## Current constraints

- The Express app still owns too much authoritative game behavior.
- File persistence is useful for development, but it is not a production persistence model.
- Browser smoke proves the UI and command loop, but the game server should not depend on browser behavior.
- Shop, item, combat, progression, and room mechanics need to keep moving toward pure functions and explicit data contracts.
- The API currently behaves like the game session transport; later, live gameplay should move to a WebSocket event stream.

## Portable game-core boundary

The game core should be portable enough that a future server runtime can reuse the same behavior or port it mechanically.

Keep these inside the game core:

- Command parsing into canonical intents.
- Room movement and exit resolution.
- Combat range, balance, stance, advantage, damage, recovery, and roundtime rules.
- Character progression, skills, guild requirements, and circle checks.
- Inventory, equipment, ammo pouch, recoverable ammo, and shop economy rules.
- Script command execution semantics.
- Structured command results and events.

Keep these outside the game core:

- HTTP routing.
- Authentication and refresh-token storage.
- WebSocket session management.
- React rendering.
- Browser-only affordance logic.
- File or database persistence implementation details.

The boundary should look like:

```text
transport request
  -> auth/session layer
  -> load account/character/world state
  -> game core command execution
  -> persist state changes
  -> structured command result/events
  -> transport response or WebSocket event stream
```

## Target protocol shape

Use REST for account and management flows:

- Register, login, refresh.
- Character list, create, reroll, select.
- Script CRUD.
- World catalog reads.
- Admin/test fixture endpoints.

Use WebSocket for live play:

- Client sends canonical command text or structured command intents.
- Server returns ordered event frames.
- Server remains authoritative for roundtime, combat ticks, movement, inventory, and wallet state.
- Client renders structured state and event logs without parsing terminal text.

Terminal-style text remains useful for feel, but it should be an output of structured command results, not the only source of truth.

## Persistence direction

Move mutable player state to Postgres when the data model stabilizes.

Good Postgres candidates:

- Accounts and refresh sessions.
- Characters and selected character state.
- Skills, stats, guild, circle, wallet.
- Inventory, worn equipment, hands, ammo pouch, loaded ammo, recoverable ammo.
- Scripts/macros.
- Audit/event logs and smoke telemetry history.

Keep world content versioned as source-controlled data as long as practical:

- Rooms and exits.
- Shop catalogs.
- Race and guild definitions.
- Enemy templates.
- Item definitions.
- Beginner progression fixtures.

World data can later be imported into Postgres, but source-controlled fixtures are better while the rules and geography are still changing quickly.

## Go server option

Go is a strong candidate for the eventual authoritative game server because it offers:

- Stable long-running service behavior.
- Simple concurrency for sessions and timers.
- Low memory usage.
- Single-binary deployment.
- Strong typing without heavy runtime overhead.

Do not rewrite into Go yet. First, make the Node prototype portable:

- Extract pure game helpers.
- Expand unit-style smoke coverage around command behavior.
- Keep API responses structured.
- Remove Express assumptions from game mechanics.
- Define the WebSocket event contract.
- Move persistence behind repositories/interfaces.

Once those boundaries are explicit, a Go port becomes a controlled implementation project instead of a speculative rewrite.

## Recommended staged path

1. Continue using Node/Express and React for rapid mechanics work.
2. Extract mechanics from route handlers into pure modules.
3. Add focused tests/smokes for each pure module.
4. Introduce repository boundaries around persistence.
5. Add Postgres for mutable player/account state.
6. Add WebSocket gameplay sessions while keeping REST for management.
7. Reassess whether the authoritative server should remain Node or move to Go.

## Design rule

Every new feature should be implementable behind a transport-agnostic command contract. If a mechanic only works because it knows about Express, React, browser locators, or file storage, it is not ready for the long-term architecture.
