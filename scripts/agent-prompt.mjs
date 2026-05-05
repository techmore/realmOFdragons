#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const spec = readFileSync('SPEC.md', 'utf8');
const agents = readFileSync('AGENTS.md', 'utf8');

const nextPriority = [...spec.matchAll(/Next priority:\n\n- ([^\n]+)/g)].at(-1)?.[1] ?? 'Read SPEC.md and pick the next unfinished priority.';

const prompt = `Take over this repo as the lead developer for a clean-room DragonRealms clone.

Read SPEC.md and AGENTS.md, then implement the next smallest safe slice.

Current next priority:
${nextPriority}

Required loop:
1. Plan the smallest incremental change.
2. Implement it.
3. Run: npm run agent:check
4. Fix failures.
5. Update SPEC.md with completed work and the next priority.
6. Review your own diff for regressions.
7. Commit with a clear message.
8. Push if a remote exists.

Do not use copyrighted DragonRealms source text. Keep implementation clean-room and mechanically inspired only.

--- AGENTS.md ---
${agents}
--- SPEC.md ---
${spec}`;

console.log(prompt);
