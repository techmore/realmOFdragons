#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync('node', ['scripts/agent-prompt.mjs'], {
  encoding: 'utf8',
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const prompt = result.stdout;
const expectedPriority =
  'Add a short `npm run agent:prompt` smoke assertion to the local check path so prompt generation regressions are caught before autonomous follow-up work starts.';

if (!prompt.includes('Current next priority:')) {
  throw new Error('Expected generated agent prompt to include the current priority header.');
}

if (!prompt.includes(expectedPriority)) {
  throw new Error('Expected generated agent prompt to use the Current Status priority from SPEC.md.');
}

if (!prompt.includes('Historical `Next priority` entries below are implementation-log breadcrumbs')) {
  throw new Error('Expected generated agent prompt to include the Current Status stale-priority warning.');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      suite: 'agent:prompt-smoke',
      currentStatusPriorityChecked: true,
    },
    null,
    2,
  ),
);
