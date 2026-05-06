#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const mode = process.argv[2] ?? 'ci';
const telemetryDir = process.env.DR_TELEMETRY_DIR ?? 'artifacts/telemetry';

const baseSteps = [
  { name: 'build', command: 'npm', args: ['run', 'build'] },
  { name: 'unit-tests', command: 'npm', args: ['run', 'test:unit'] },
  { name: 'frontend-ui-smoke', command: 'npm', args: ['run', 'smoke:ui'] },
];

const ciSteps = [
  ...baseSteps,
  { name: 'browser-smoke', command: 'node', args: ['scripts/with-test-app.mjs', 'npm', 'run', 'smoke:browser'] },
  { name: 'api-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', 'run', 'smoke:api'] },
];

const localSteps = [
  ...baseSteps,
  { name: 'browser-smoke', command: 'node', args: ['scripts/with-test-app.mjs', 'npm', 'run', 'smoke:browser'] },
  { name: 'api-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', 'run', 'smoke:api'] },
  { name: 'git-status', command: 'node', args: ['scripts/agent-check.mjs'] },
];

const steps = mode === 'local' ? localSteps : ciSteps;

function tail(text, maxLength = 12000) {
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function markdownSummary(results) {
  const lines = [
    '# Realm of Dragons Check Telemetry',
    '',
    `Mode: ${mode}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Step | Status | Duration ms | Command |',
    '| --- | --- | ---: | --- |',
  ];

  for (const result of results) {
    const status = result.exitCode === 0 ? 'pass' : 'fail';
    lines.push(`| ${result.name} | ${status} | ${result.durationMs} | \`${result.commandLine}\` |`);
  }

  lines.push('');
  for (const result of results) {
    lines.push(`## ${result.name}`);
    lines.push('');
    lines.push(`Exit code: ${result.exitCode}`);
    lines.push(`Duration: ${result.durationMs}ms`);
    if (result.stdoutTail) {
      lines.push('');
      lines.push('### stdout tail');
      lines.push('');
      lines.push('```text');
      lines.push(result.stdoutTail);
      lines.push('```');
    }
    if (result.stderrTail) {
      lines.push('');
      lines.push('### stderr tail');
      lines.push('');
      lines.push('```text');
      lines.push(result.stderrTail);
      lines.push('```');
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function runStep(step) {
  const startedAt = Date.now();
  const commandLine = [step.command, ...step.args].join(' ');
  let stdout = '';
  let stderr = '';

  console.log(`\n[telemetry] starting ${step.name}: ${commandLine}`);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on('exit', (code) => resolve(code ?? 1));
  });

  const finishedAt = Date.now();
  const result = {
    name: step.name,
    commandLine,
    exitCode,
    ok: exitCode === 0,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  };

  console.log(`[telemetry] finished ${step.name}: exit ${exitCode}, ${result.durationMs}ms`);
  return result;
}

mkdirSync(telemetryDir, { recursive: true });

const results = [];
for (const step of steps) {
  const result = await runStep(step);
  results.push(result);
  writeFileSync(join(telemetryDir, `${step.name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  if (result.exitCode !== 0) break;
}

const summary = {
  ok: results.every((result) => result.exitCode === 0) && results.length === steps.length,
  mode,
  generatedAt: new Date().toISOString(),
  telemetryDir,
  steps: results,
};

writeFileSync(join(telemetryDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(join(telemetryDir, 'summary.md'), markdownSummary(results));

console.log(`\n[telemetry] wrote ${join(telemetryDir, 'summary.json')}`);
console.log(`[telemetry] wrote ${join(telemetryDir, 'summary.md')}`);

if (!summary.ok) process.exit(1);
