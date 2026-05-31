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
import uuid

os.chdir(${JSON.stringify(gameDir)})
sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.conf.settings")

import django
django.setup()

import evennia
from django.urls import resolve
from django.test import Client
from evennia.utils.create import create_account

class SmokeSessionHandler:
    def sessions_from_account(self, account):
        return []

if evennia.SESSION_HANDLER is None:
    evennia.SESSION_HANDLER = SmokeSessionHandler()

client = Client()
login_match = resolve("/auth/login/")
login_response = client.get("/auth/login/")
account = create_account(f"WebclientSmokeAccount-{uuid.uuid4().hex[:12]}", None, "test-password")
login_ok = client.login(username=account.username, password="test-password")
match = resolve("/webclient/")
response = client.get("/webclient/")
body = response.content.decode("utf-8", errors="replace").lower()
required_tokens = ("webclient", "websocket", "evennia", "input", "connect")
missing_tokens = [token for token in required_tokens if token not in body]
payload = {
    "login_path": "/auth/login/",
    "login_route": getattr(login_match.route, "__str__", lambda: str(login_match.route))(),
    "login_status_code": login_response.status_code,
    "session_login": login_ok,
    "path": "/webclient/",
    "url_name": match.url_name,
    "view_name": match.view_name,
    "route": getattr(match.route, "__str__", lambda: str(match.route))(),
    "resolved": True,
    "status_code": response.status_code,
    "webclient_markup": "webclient" in body,
    "websocket_bootstrap": "websocket" in body,
    "command_input_markup": "input" in body,
    "connect_action_markup": "connect" in body,
    "missing_tokens": missing_tokens,
}
print(json.dumps(payload, sort_keys=True))
if login_response.status_code >= 400 or not login_ok or response.status_code >= 400 or missing_tokens:
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
