#!/usr/bin/env node
import { spawn } from 'node:child_process';

const command = process.argv[2];
const args = process.argv.slice(3);
const port = process.env.DR_TEST_PORT ?? '4100';
const baseUrl = `http://localhost:${port}`;

if (!command) {
  console.error('Usage: node scripts/with-test-server.mjs <command> [...args]');
  process.exit(1);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for test server at ${baseUrl}`);
}

const server = spawn('npm', ['--prefix', 'server', 'run', 'dev'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: port,
    DR_TEST_FIXTURES: '1',
  },
});

server.stdout.on('data', (chunk) => process.stdout.write(`[test-server] ${chunk}`));
server.stderr.on('data', (chunk) => process.stderr.write(`[test-server] ${chunk}`));

let exitCode = 1;

try {
  await waitForHealth();
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DR_API_BASE_URL: baseUrl,
    },
  });

  exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  server.kill('SIGTERM');
}

process.exit(exitCode);
