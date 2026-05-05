#!/usr/bin/env node
import { spawn } from 'node:child_process';

const command = process.argv[2];
const args = process.argv.slice(3);
const apiPort = process.env.DR_TEST_PORT ?? '4100';
const webPort = process.env.DR_WEB_TEST_PORT ?? '4200';
const apiBase = `http://localhost:${apiPort}`;
const webBase = `http://localhost:${webPort}`;

if (!command) {
  console.error('Usage: node scripts/with-test-app.mjs <command> [...args]');
  process.exit(1);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Process is still starting.
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const server = spawn('npm', ['--prefix', 'server', 'run', 'dev'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: apiPort,
    DR_TEST_FIXTURES: '1',
  },
});

const frontend = spawn('npm', ['--prefix', 'frontend', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', webPort], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VITE_API_BASE: `${apiBase}/v1`,
  },
});

server.stdout.on('data', (chunk) => process.stdout.write(`[test-server] ${chunk}`));
server.stderr.on('data', (chunk) => process.stderr.write(`[test-server] ${chunk}`));
frontend.stdout.on('data', (chunk) => process.stdout.write(`[test-web] ${chunk}`));
frontend.stderr.on('data', (chunk) => process.stderr.write(`[test-web] ${chunk}`));

let exitCode = 1;

try {
  await waitForUrl(`${apiBase}/health`);
  await waitForUrl(webBase);
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DR_API_BASE_URL: apiBase,
      DR_WEB_BASE_URL: webBase,
    },
  });

  exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  frontend.kill('SIGTERM');
  server.kill('SIGTERM');
}

process.exit(exitCode);
