#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const venvPython = join(root, '.venv-evennia', 'bin', 'python');
const venvEvennia = join(root, '.venv-evennia', 'bin', 'evennia');

function run(label, command, args, options = {}) {
  console.log(`[evennia-check] ${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(venvPython) || !existsSync(venvEvennia)) {
  console.error('[evennia-check] missing .venv-evennia. Run: python3.13 -m venv .venv-evennia && . .venv-evennia/bin/activate && python -m pip install -r requirements-evennia.txt');
  process.exit(1);
}

run('compile', venvPython, ['-m', 'compileall', 'evennia-game/commands', 'evennia-game/typeclasses', 'evennia-game/world']);
run('tests', venvEvennia, ['test', '--settings', 'settings.py', 'world'], { cwd: join(root, 'evennia-game') });
run('webclient route smoke', 'node', ['scripts/evennia-webclient-smoke.mjs']);
