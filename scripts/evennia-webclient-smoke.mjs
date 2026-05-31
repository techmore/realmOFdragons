#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gameDir = join(root, 'evennia-game');
const venvPython = join(root, '.venv-evennia', 'bin', 'python');

if (!existsSync(venvPython)) {
  console.error('[evennia-webclient-smoke] missing .venv-evennia python.');
  process.exit(1);
}

const code = `
import json
import os
import sys

os.chdir(${JSON.stringify(gameDir)})
sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.conf.settings")

import django
django.setup()

from django.urls import resolve
from django.test import Client

match = resolve("/webclient/")
response = Client().get("/webclient/")
body = response.content.decode("utf-8", errors="replace").lower()
payload = {
    "path": "/webclient/",
    "url_name": match.url_name,
    "view_name": match.view_name,
    "route": getattr(match.route, "__str__", lambda: str(match.route))(),
    "resolved": True,
    "status_code": response.status_code,
    "webclient_markup": "webclient" in body,
}
print(json.dumps(payload, sort_keys=True))
if response.status_code >= 400 or "webclient" not in body:
    raise SystemExit(1)
`;

const result = spawnSync(venvPython, ['-c', code], {
  cwd: gameDir,
  encoding: 'utf8',
  env: { ...process.env },
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
