# Clean-Room DR Server (v1 scaffold)

This is the API/WebSocket baseline for the new build.

## Run

```bash
cd /Users/techmore/projects/cleanroom-dragonrealms/server
npm install
npm run dev
```

Data is currently persisted to JSON files in `server/data` for local single-instance development:

- `accounts.json`
- `characters.json`
- `sessions.json`

## Endpoints

- `POST /v1/auth/register` — create an account
- `POST /v1/auth/login` — issue access/refresh tokens
- `POST /v1/auth/refresh` — rotate refresh token
- `POST /v1/characters` — create character for authenticated account
- `GET /v1/characters/:characterId` — read character profile
- `GET /v1/characters/:characterId/state` — read character + room snapshot
- `POST /v1/command` — submit command (`look`, `inventory`, movement, shop buys, `exits`, etc.)
- `GET /v1/world/rooms/:roomId` — inspect room data
- `GET /health` — health check

## WebSocket

`ws://localhost:4000/ws?token=<JWT>&characterId=<CHARACTER_ID>`

Send JSON payloads:

```json
{ "characterId": "<character_id>", "command": "look" }
```

## Security posture

- File-based persistence is the active local-storage layer in this phase.
- JWT-based auth for API and websocket.
- Refresh token rotation plus short expiry.
- Planned production layer: PostgreSQL + Redis (sessions/queues), proper key management, TLS termination.
