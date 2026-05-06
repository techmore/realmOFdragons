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
  { name: 'script-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:scripts'] },
  { name: 'api-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', 'run', 'smoke:api'] },
];

const localSteps = [
  ...baseSteps,
  { name: 'browser-smoke', command: 'node', args: ['scripts/with-test-app.mjs', 'npm', 'run', 'smoke:browser'] },
  { name: 'target-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:targets'] },
  { name: 'script-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:scripts'] },
  { name: 'api-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', 'run', 'smoke:api'] },
  { name: 'agent-prompt-smoke', command: 'npm', args: ['run', 'smoke:agent-prompt'] },
  { name: 'git-status', command: 'node', args: ['scripts/agent-check.mjs'] },
];

const steps = mode === 'local' ? localSteps : ciSteps;

function tail(text, maxLength = 12000) {
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function markdownSummary(results, coverage) {
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

  if (coverage) {
    lines.push('');
    lines.push('## Gameplay Coverage');
    lines.push('');
    lines.push('| Area | Covered |');
    lines.push('| --- | --- |');
    lines.push(`| Combat smoke | ${coverage.gameplay.combatChecked ? 'yes' : 'no'} |`);
    lines.push(`| Survey discovery command | ${coverage.gameplay.surveyChecked ? 'yes' : 'no'} |`);
    lines.push(`| Forage survival command | ${coverage.gameplay.forageChecked ? 'yes' : 'no'} |`);
    lines.push(`| Scan visibility | ${coverage.gameplay.scanChecked ? 'yes' : 'no'} |`);
    lines.push(`| Structured targets | ${coverage.gameplay.structuredTargetsChecked ? 'yes' : 'no'} |`);
    lines.push(`| Target details command | ${coverage.gameplay.targetDetailsChecked ? 'yes' : 'no'} |`);
    lines.push(`| Focused target smoke | ${coverage.gameplay.focusedTargetSmokeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Verb discovery command | ${coverage.gameplay.verbDiscoveryChecked ? 'yes' : 'no'} |`);
    lines.push(`| Static command discovery note | ${coverage.frontend.staticCommandDiscoveryChecked ? 'yes' : 'no'} |`);
    lines.push(`| Browser command discovery note | ${coverage.frontend.browserCommandDiscoveryVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser script discovery note | ${coverage.frontend.browserScriptDiscoveryVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser script preset save | ${coverage.frontend.browserScriptPresetSaved ? 'yes' : 'no'} |`);
    lines.push(`| Browser target details action | ${coverage.frontend.browserTargetDetailsClicked ? 'yes' : 'no'} |`);
    lines.push(`| Browser verb discovery action | ${coverage.frontend.browserVerbDiscoveryClicked ? 'yes' : 'no'} |`);
    lines.push(`| Agent prompt current status | ${coverage.gameplay.agentPromptCurrentStatusChecked ? 'yes' : 'no'} |`);
    lines.push(`| Script create/run/delete lifecycle | ${coverage.gameplay.scriptLifecycleChecked ? 'yes' : 'no'} |`);
    lines.push(`| Shop economy | ${coverage.gameplay.shopEconomyChecked ? 'yes' : 'no'} |`);
    lines.push('');
    lines.push('## Gameplay Counts');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | ---: |');
    lines.push(`| Races rolled | ${coverage.gameplay.racesRolled} |`);
    lines.push(`| Guild rooms walked | ${coverage.gameplay.guildRoomsWalked} |`);
    lines.push(`| Shop rooms walked | ${coverage.gameplay.shopRoomsWalked} |`);
    lines.push(`| Circle reached | ${coverage.gameplay.circleReached} |`);
    lines.push(`| Browser command count | ${coverage.frontend.browserCommandCount} |`);

    lines.push('');
    lines.push('## Script Coverage');
    lines.push('');
    lines.push('| Area | Covered |');
    lines.push('| --- | --- |');
    lines.push(`| API script create | ${coverage.scripts.created ? 'yes' : 'no'} |`);
    lines.push(`| API script run | ${coverage.scripts.ran ? 'yes' : 'no'} |`);
    lines.push(`| API script delete | ${coverage.scripts.deleted ? 'yes' : 'no'} |`);
    lines.push(`| API script lifecycle | ${coverage.scripts.lifecycle ? 'yes' : 'no'} |`);
    lines.push(`| Focused script smoke | ${coverage.scripts.focusedSmoke ? 'yes' : 'no'} |`);
    lines.push(`| Browser preset save | ${coverage.scripts.browserPresetSaved ? 'yes' : 'no'} |`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | ---: |');
    lines.push(`| API script run steps | ${coverage.scripts.steps} |`);
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

function parseLastJsonObject(text) {
  const candidates = text.match(/\{[\s\S]*?\n\}/g) ?? [];
  for (const candidate of candidates.reverse()) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

function coverageSummary(results) {
  const byName = new Map(results.map((result) => [result.name, result]));
  const apiPayload = parseLastJsonObject(byName.get('api-smoke')?.stdoutTail ?? '') ?? {};
  const targetPayload = parseLastJsonObject(byName.get('target-smoke')?.stdoutTail ?? '') ?? {};
  const scriptPayload = parseLastJsonObject(byName.get('script-smoke')?.stdoutTail ?? '') ?? {};
  const browserPayload = parseLastJsonObject(byName.get('browser-smoke')?.stdoutTail ?? '') ?? {};
  const agentPromptPayload = parseLastJsonObject(byName.get('agent-prompt-smoke')?.stdoutTail ?? '') ?? {};
  const unitPayloads = (byName.get('unit-tests')?.stdoutTail.match(/\{[\s\S]*?\n\}/g) ?? [])
    .map((candidate) => {
      try {
        return JSON.parse(candidate);
      } catch {
        return undefined;
      }
    })
    .filter(Boolean);

  return {
    ok: results.every((result) => result.exitCode === 0),
    mode,
    generatedAt: new Date().toISOString(),
    durationsMs: Object.fromEntries(results.map((result) => [result.name, result.durationMs])),
    gameplay: {
      racesRolled: apiPayload.racesRolled ?? 0,
      guildRoomsWalked: apiPayload.guildRoomsWalked ?? 0,
      shopRoomsWalked: apiPayload.shopRoomsWalked ?? 0,
      circleReached: apiPayload.circleReached ?? 0,
      scriptSteps: scriptPayload.scriptSteps ?? apiPayload.scriptSteps ?? 0,
      scriptCreatedChecked: (scriptPayload.scriptCreatedChecked ?? apiPayload.scriptCreatedChecked) === true,
      scriptRunChecked: (scriptPayload.scriptRunChecked ?? apiPayload.scriptRunChecked) === true,
      scriptDeletedChecked: (scriptPayload.scriptDeletedChecked ?? apiPayload.scriptDeletedChecked) === true,
      scriptLifecycleChecked:
        (scriptPayload.scriptCreatedChecked ?? apiPayload.scriptCreatedChecked) === true &&
        (scriptPayload.scriptRunChecked ?? apiPayload.scriptRunChecked) === true &&
        (scriptPayload.scriptDeletedChecked ?? apiPayload.scriptDeletedChecked) === true,
      shopEconomyChecked: apiPayload.shopEconomyChecked === true,
      combatChecked: apiPayload.combatChecked === true,
      surveyChecked: apiPayload.surveyChecked === true,
      forageChecked: apiPayload.forageChecked === true,
      scanChecked: apiPayload.scanChecked === true,
      structuredTargetsChecked: apiPayload.structuredTargetsChecked === true,
      targetDetailsChecked: apiPayload.targetDetailsChecked === true,
      focusedTargetSmokeChecked: targetPayload.targetDetailsChecked === true,
      verbDiscoveryChecked: targetPayload.verbDiscoveryChecked === true,
      agentPromptCurrentStatusChecked: agentPromptPayload.currentStatusPriorityChecked === true,
      finalRoom: apiPayload.finalRoom ?? null,
      finalCombatActive: Boolean(apiPayload.finalCombat),
    },
    scripts: {
      steps: scriptPayload.scriptSteps ?? apiPayload.scriptSteps ?? 0,
      created: (scriptPayload.scriptCreatedChecked ?? apiPayload.scriptCreatedChecked) === true,
      ran: (scriptPayload.scriptRunChecked ?? apiPayload.scriptRunChecked) === true,
      deleted: (scriptPayload.scriptDeletedChecked ?? apiPayload.scriptDeletedChecked) === true,
      lifecycle:
        (scriptPayload.scriptCreatedChecked ?? apiPayload.scriptCreatedChecked) === true &&
        (scriptPayload.scriptRunChecked ?? apiPayload.scriptRunChecked) === true &&
        (scriptPayload.scriptDeletedChecked ?? apiPayload.scriptDeletedChecked) === true,
      focusedSmoke: byName.get('script-smoke')?.exitCode === 0 && scriptPayload.scriptRunChecked === true,
      browserPresetSaved: browserPayload.scriptPresetSaved === true,
    },
    frontend: {
      staticUiSmoke: byName.get('frontend-ui-smoke')?.exitCode === 0,
      staticCommandDiscoveryChecked: byName.get('frontend-ui-smoke')?.exitCode === 0,
      browserSmoke: byName.has('browser-smoke') ? byName.get('browser-smoke')?.exitCode === 0 : null,
      browser: browserPayload.browser ?? null,
      browserAccountCreated: Boolean(browserPayload.account),
      browserCommandCount: browserPayload.commandCount ?? 0,
      browserTargetDetailsClicked: browserPayload.targetDetailsClicked === true,
      browserVerbDiscoveryClicked: browserPayload.verbDiscoveryClicked === true,
      browserCommandDiscoveryVisible: browserPayload.commandDiscoveryVisible === true,
      browserScriptDiscoveryVisible: browserPayload.scriptDiscoveryVisible === true,
      browserScriptPresetSaved: browserPayload.scriptPresetSaved === true,
    },
    unitSuites: unitPayloads.map((payload) => payload.suite),
  };
}

function assertCoverageShape(coverage) {
  const missing = [];
  const expect = (condition, label) => {
    if (!condition) missing.push(label);
  };

  expect(Boolean(coverage.gameplay), 'gameplay section');
  expect(Boolean(coverage.scripts), 'scripts section');
  expect(Boolean(coverage.frontend), 'frontend section');
  expect(typeof coverage.durationsMs === 'object' && coverage.durationsMs !== null, 'durationsMs section');
  expect(Array.isArray(coverage.unitSuites), 'unitSuites array');

  expect(coverage.frontend.staticUiSmoke === true, 'frontend.staticUiSmoke');
  expect(coverage.frontend.browserSmoke === true, 'frontend.browserSmoke');
  expect(coverage.frontend.browserScriptPresetSaved === true, 'frontend.browserScriptPresetSaved');
  expect(coverage.scripts.focusedSmoke === true, 'scripts.focusedSmoke');
  expect(coverage.scripts.lifecycle === true, 'scripts.lifecycle');
  expect(coverage.scripts.created === true, 'scripts.created');
  expect(coverage.scripts.ran === true, 'scripts.ran');
  expect(coverage.scripts.deleted === true, 'scripts.deleted');
  expect(coverage.scripts.steps > 0, 'scripts.steps');
  expect(coverage.gameplay.combatChecked === true, 'gameplay.combatChecked');
  expect(coverage.gameplay.shopEconomyChecked === true, 'gameplay.shopEconomyChecked');
  expect(coverage.gameplay.scriptLifecycleChecked === true, 'gameplay.scriptLifecycleChecked');

  if (mode === 'local') {
    expect(coverage.gameplay.focusedTargetSmokeChecked === true, 'gameplay.focusedTargetSmokeChecked');
    expect(coverage.gameplay.agentPromptCurrentStatusChecked === true, 'gameplay.agentPromptCurrentStatusChecked');
  }

  if (missing.length) {
    throw new Error(`Coverage summary missing expected successful-run fields: ${missing.join(', ')}`);
  }
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
const coverage = coverageSummary(results);
if (summary.ok) assertCoverageShape(coverage);
writeFileSync(join(telemetryDir, 'summary.md'), markdownSummary(results, coverage));
writeFileSync(join(telemetryDir, 'coverage-summary.json'), `${JSON.stringify(coverage, null, 2)}\n`);

console.log(`\n[telemetry] wrote ${join(telemetryDir, 'summary.json')}`);
console.log(`[telemetry] wrote ${join(telemetryDir, 'summary.md')}`);
console.log(`[telemetry] wrote ${join(telemetryDir, 'coverage-summary.json')}`);

if (!summary.ok) process.exit(1);
