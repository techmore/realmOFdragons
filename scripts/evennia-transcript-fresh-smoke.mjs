#!/usr/bin/env node
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const expectedPath = join(root, 'EVENNIA_SMOKE_TRANSCRIPT.md');
const generatedPath = join(tmpdir(), `evennia-smoke-transcript-${process.pid}.md`);

const result = spawnSync('node', ['scripts/evennia-smoke-transcript.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    EVENNIA_TRANSCRIPT_OUTPUT: generatedPath,
  },
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const expected = readFileSync(expectedPath, 'utf8');
const generated = readFileSync(generatedPath, 'utf8');
rmSync(generatedPath, { force: true });

if (expected !== generated) {
  console.error('[evennia-transcript-fresh] EVENNIA_SMOKE_TRANSCRIPT.md is stale. Run: npm run smoke:evennia-transcript');
  process.exit(1);
}

console.log('[evennia-transcript-fresh] transcript is current.');
