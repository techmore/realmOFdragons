# Autonomous Agent Probe Loop

This repo supports bounded Codex work cycles. The goal is not an infinite unsafe daemon; it is repeated, reviewable increments.

## Commands

- `npm run build`: build server and frontend.
- `npm run smoke:api`: run the live REST API smoke flow from `server/scripts/smoke-api.ts`.
- `npm run agent:check`: run builds, API smoke coverage, and print git/remote status.
- `npm run agent:prompt`: print the next Codex prompt from `SPEC.md` and `AGENTS.md`.

## Recommended cycle

1. Start the API server in another terminal:

   ```bash
   npm --prefix server run dev
   ```

2. Ask Codex to continue using:

   ```bash
   npm run agent:prompt
   ```

3. Codex should implement one small slice, run:

   ```bash
   npm run agent:check
   ```

4. If clean, Codex updates `SPEC.md`, commits, and pushes.

## Current guardrails

- `agent:check` requires the server API to be reachable at `http://localhost:4000`.
- Runtime data in `server/data/*.json` is ignored.
- The loop should prefer feature-sized commits over long unreviewed changes.
- Pushes require the configured remote `origin`.

## Future automation target

A later daemon can call `npm run agent:prompt`, submit that prompt to Codex, wait for completion, run `npm run agent:check`, and request a review pass before committing.
