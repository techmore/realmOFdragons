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
  { name: 'race-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:races'] },
  { name: 'guild-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:guilds'] },
  { name: 'guild-circle10-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:guild-circle10'] },
  { name: 'target-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:targets'] },
  { name: 'enemy-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:enemies'] },
  { name: 'damaged-ammo-smoke', command: 'node', args: ['scripts/with-test-server.mjs', 'npm', '--prefix', 'server', 'run', 'smoke:damaged-ammo'] },
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
    lines.push(`| Focused Crossing enemy deployment smoke | ${coverage.gameplay.focusedEnemySmokeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Verb discovery command | ${coverage.gameplay.verbDiscoveryChecked ? 'yes' : 'no'} |`);
    lines.push(`| Static command discovery note | ${coverage.frontend.staticCommandDiscoveryChecked ? 'yes' : 'no'} |`);
    lines.push(`| Browser command discovery note | ${coverage.frontend.browserCommandDiscoveryVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser room affordance panel | ${coverage.frontend.browserRoomAffordancePanelVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser survey action | ${coverage.frontend.browserSurveyClicked ? 'yes' : 'no'} |`);
    lines.push(`| Browser script discovery note | ${coverage.frontend.browserScriptDiscoveryVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser script preset save | ${coverage.frontend.browserScriptPresetSaved ? 'yes' : 'no'} |`);
    lines.push(`| Static legacy race stat mode | ${coverage.frontend.staticLegacyRaceStatModeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Static prototype race role labels hidden | ${coverage.frontend.staticPrototypeRaceRoleLabelsHidden ? 'yes' : 'no'} |`);
    lines.push(`| Browser legacy race stat mode | ${coverage.frontend.browserLegacyRaceStatModeVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser prototype race role labels hidden | ${coverage.frontend.browserPrototypeRaceRoleLabelsHidden ? 'yes' : 'no'} |`);
    lines.push(`| Browser damaged ammo item details | ${coverage.frontend.browserDamagedAmmoItemDetailsVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser damaged ammo inventory sale | ${coverage.frontend.browserDamagedAmmoSoldFromInventory ? 'yes' : 'no'} |`);
    lines.push(`| Browser disabled sell hint | ${coverage.frontend.browserDisabledSellHintVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser shop-aware sell hint | ${coverage.frontend.browserShopAwareSellHintVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser ammo pouch sale action | ${coverage.frontend.browserAmmoPouchSellClicked ? 'yes' : 'no'} |`);
    lines.push(`| Browser ammo pouch remaining count | ${coverage.frontend.browserAmmoPouchRemainingVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser ammo pouch disabled hint | ${coverage.frontend.browserAmmoPouchDisabledHintVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser ammo pouch metadata | ${coverage.frontend.browserAmmoPouchMetadataVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser shared economy hints | ${coverage.frontend.browserSharedEconomyHintVisible ? 'yes' : 'no'} |`);
    lines.push(`| Browser target details action | ${coverage.frontend.browserTargetDetailsClicked ? 'yes' : 'no'} |`);
    lines.push(`| Browser verb discovery action | ${coverage.frontend.browserVerbDiscoveryClicked ? 'yes' : 'no'} |`);
    lines.push(`| Agent prompt current status | ${coverage.gameplay.agentPromptCurrentStatusChecked ? 'yes' : 'no'} |`);
    lines.push(`| Race selected during creation/reroll | ${coverage.gameplay.drRaceSelectionChecked ? 'yes' : 'no'} |`);
    lines.push(`| Focused race endpoint smoke | ${coverage.gameplay.focusedRaceEndpointSmokeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Race endpoint hides private roll data | ${coverage.gameplay.drRaceEndpointPrivateRollDataHidden ? 'yes' : 'no'} |`);
    lines.push(`| Non-DR race creation rejected | ${coverage.gameplay.drInvalidRaceCreationRejected ? 'yes' : 'no'} |`);
    lines.push(`| Canonical race creation Circle 1 | ${coverage.gameplay.drCanonicalRaceCreationCircleOneChecked ? 'yes' : 'no'} |`);
    lines.push(`| Non-DR race reroll rejected | ${coverage.gameplay.drInvalidRaceRerollRejected ? 'yes' : 'no'} |`);
    lines.push(`| Canonical race reroll preserves guild/circle | ${coverage.gameplay.drCanonicalRaceRerollPreservesGuildCircle ? 'yes' : 'no'} |`);
    lines.push(`| New characters start unaffiliated | ${coverage.gameplay.drCreationStartsUnaffiliatedChecked ? 'yes' : 'no'} |`);
    lines.push(`| Guild rejected during character creation | ${coverage.gameplay.drGuildCreationRejected ? 'yes' : 'no'} |`);
    lines.push(`| Guild joined in-world only | ${coverage.gameplay.drGuildJoinedInWorldOnlyChecked ? 'yes' : 'no'} |`);
    lines.push(`| Circle advancement requires guild registrar | ${coverage.gameplay.circleRequiresGuildRegistrar ? 'yes' : 'no'} |`);
    lines.push(`| All DR race/guild Circle 1 combinations | ${coverage.gameplay.drRaceGuildCircleOneMatrixChecked ? 'yes' : 'no'} |`);
    lines.push(`| Exactly 11 canonical DR guilds covered | ${coverage.gameplay.drCanonicalGuildCountChecked ? 'yes' : 'no'} |`);
    lines.push(`| No prototype guilds exposed | ${coverage.gameplay.drNoPrototypeGuildsExposed ? 'yes' : 'no'} |`);
    lines.push(`| Canonical registrar joins covered | ${coverage.gameplay.drCanonicalRegistrarJoinsChecked ? 'yes' : 'no'} |`);
    lines.push(`| Focused guild endpoint smoke | ${coverage.gameplay.focusedGuildEndpointSmokeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Focused guild Circle 10 smoke | ${coverage.gameplay.focusedGuildCircleTenSmokeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Script create/run/delete lifecycle | ${coverage.gameplay.scriptLifecycleChecked ? 'yes' : 'no'} |`);
    lines.push(`| Shop economy | ${coverage.gameplay.shopEconomyChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ammo stack resale | ${coverage.gameplay.ammoSellChecked ? 'yes' : 'no'} |`);
    lines.push(`| Damaged ammo economy | ${coverage.gameplay.damagedAmmoEconomyChecked ? 'yes' : 'no'} |`);
    lines.push(`| Focused damaged ammo smoke | ${coverage.gameplay.focusedDamagedAmmoSmokeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Structured item details | ${coverage.gameplay.itemDetailsChecked ? 'yes' : 'no'} |`);
    lines.push(`| Starter equipment verbs | ${coverage.gameplay.equipmentChecked ? 'yes' : 'no'} |`);
    lines.push(`| Structured equipment slots | ${coverage.gameplay.equipmentSlotsChecked ? 'yes' : 'no'} |`);
    lines.push(`| Weapon-aware attack output | ${coverage.gameplay.weaponAttackChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ranged weapon range gating | ${coverage.gameplay.rangedWeaponRangeChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ranged alias ammo handling | ${coverage.gameplay.rangedAliasAmmoChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ammo bundle pouch handling | ${coverage.gameplay.ammoBundleChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ranged reload readiness | ${coverage.gameplay.rangedReloadChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ammo recovery scavenging | ${coverage.gameplay.ammoRecoveryChecked ? 'yes' : 'no'} |`);
    lines.push(`| Ammo damaged/lost outcomes | ${coverage.gameplay.ammoDamageLossChecked ? 'yes' : 'no'} |`);
    lines.push(`| Browser item detail panel | ${coverage.frontend.browserItemDetailsVisible ? 'yes' : 'no'} |`);
    lines.push('');
    lines.push('## Gameplay Counts');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | ---: |');
    lines.push(`| Races rolled | ${coverage.gameplay.racesRolled} |`);
    lines.push(`| Focused race endpoint canonical count | ${coverage.gameplay.focusedRaceEndpointCanonicalCount} |`);
    lines.push(`| Focused race endpoint fixed stat tables | ${coverage.gameplay.focusedRaceEndpointFixedStatTablesChecked} |`);
    lines.push(`| Canonical race creations checked | ${coverage.gameplay.raceCreationCanonicalCircleOneChecked} |`);
    lines.push(`| Canonical race rerolls checked | ${coverage.gameplay.raceRerollCanonicalGuildCirclePreserved} |`);
    lines.push(`| Circle 1 races checked | ${coverage.gameplay.circleOneRacesChecked} |`);
    lines.push(`| Race/guild Circle 1 combinations | ${coverage.gameplay.raceGuildMatrixChecked} |`);
    lines.push(`| DR races in matrix | ${coverage.gameplay.raceGuildMatrixRaceCount} |`);
    lines.push(`| DR guilds in matrix | ${coverage.gameplay.raceGuildMatrixGuildCount} |`);
    lines.push(`| Canonical guilds checked | ${coverage.gameplay.canonicalGuildsCheckedCount} |`);
    lines.push(`| Prototype guilds exposed | ${coverage.gameplay.extraPrototypeGuildsCount} |`);
    lines.push(`| Focused guild endpoint canonical count | ${coverage.gameplay.focusedGuildEndpointCanonicalCount} |`);
    lines.push(`| Focused guild Circle 10 count | ${coverage.gameplay.focusedGuildCircleTenChecked} |`);
    lines.push(`| Guild rooms walked | ${coverage.gameplay.guildRoomsWalked} |`);
    lines.push(`| Focused Crossing enemies checked | ${coverage.gameplay.focusedEnemyDeploymentsChecked} |`);
    lines.push(`| Focused Crossing enemy rooms checked | ${coverage.gameplay.focusedEnemyRoomsChecked} |`);
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
  const racePayload = parseLastJsonObject(byName.get('race-smoke')?.stdoutTail ?? '') ?? {};
  const guildPayload = parseLastJsonObject(byName.get('guild-smoke')?.stdoutTail ?? '') ?? {};
  const guildCirclePayload = parseLastJsonObject(byName.get('guild-circle10-smoke')?.stdoutTail ?? '') ?? {};
  const targetPayload = parseLastJsonObject(byName.get('target-smoke')?.stdoutTail ?? '') ?? {};
  const enemyPayload = parseLastJsonObject(byName.get('enemy-smoke')?.stdoutTail ?? '') ?? {};
  const damagedAmmoPayload = parseLastJsonObject(byName.get('damaged-ammo-smoke')?.stdoutTail ?? '') ?? {};
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
  const staticUiPayload = parseLastJsonObject(byName.get('frontend-ui-smoke')?.stdoutTail ?? '') ?? {};

  return {
    ok: results.every((result) => result.exitCode === 0),
    mode,
    generatedAt: new Date().toISOString(),
    durationsMs: Object.fromEntries(results.map((result) => [result.name, result.durationMs])),
    gameplay: {
      racesRolled: apiPayload.racesRolled ?? 0,
      focusedRaceEndpointCanonicalCount: racePayload.raceEndpointCanonicalCount ?? apiPayload.raceEndpointCanonicalCount ?? 0,
      focusedRaceEndpointFixedStatTablesChecked: racePayload.raceEndpointFixedStatTablesChecked ?? apiPayload.raceEndpointFixedStatTablesChecked ?? 0,
      raceCreationCanonicalCircleOneChecked: racePayload.raceCreationCanonicalCircleOneChecked ?? apiPayload.raceCreationCanonicalCircleOneChecked ?? 0,
      raceRerollCanonicalGuildCirclePreserved: racePayload.raceRerollCanonicalGuildCirclePreserved ?? apiPayload.raceRerollCanonicalGuildCirclePreserved ?? 0,
      circleOneRacesChecked: apiPayload.circleOneRacesChecked ?? 0,
      raceGuildMatrixChecked: apiPayload.raceGuildMatrixChecked ?? 0,
      raceGuildMatrixRaceCount: apiPayload.raceGuildMatrixRaceCount ?? 0,
      raceGuildMatrixGuildCount: apiPayload.raceGuildMatrixGuildCount ?? 0,
      canonicalGuildsCheckedCount: Array.isArray(apiPayload.canonicalGuildsChecked) ? apiPayload.canonicalGuildsChecked.length : 0,
      extraPrototypeGuildsCount: Array.isArray(apiPayload.extraPrototypeGuilds) ? apiPayload.extraPrototypeGuilds.length : 0,
      focusedGuildEndpointCanonicalCount: guildPayload.guildEndpointCanonicalCount ?? apiPayload.guildEndpointCanonicalCount ?? 0,
      focusedGuildCircleTenChecked: guildCirclePayload.guildCircleTenChecked ?? apiPayload.guildCircleTenChecked ?? 0,
      focusedGuildCircleTenAllCanonical: (guildCirclePayload.guildCircleTenAllCanonical ?? apiPayload.guildCircleTenAllCanonical) === true,
      focusedGuildCircleTenRegistrarChecked: (guildCirclePayload.guildCircleTenRegistrarChecked ?? apiPayload.guildCircleTenRegistrarChecked) === true,
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
      circleRequiresGuildRegistrar: apiPayload.circleRequiresGuildRegistrar === true,
      shopEconomyChecked: apiPayload.shopEconomyChecked === true,
      ammoSellChecked: apiPayload.ammoSellChecked === true,
      damagedAmmoEconomyChecked: apiPayload.damagedAmmoEconomyChecked === true,
      focusedDamagedAmmoSmokeChecked: damagedAmmoPayload.damagedAmmoFocusedChecked === true,
      itemDetailsChecked: apiPayload.itemDetailsChecked === true,
      equipmentChecked: apiPayload.equipmentChecked === true,
      equipmentSlotsChecked: apiPayload.equipmentSlotsChecked === true,
      weaponAttackChecked: apiPayload.weaponAttackChecked === true,
      rangedWeaponRangeChecked: apiPayload.rangedWeaponRangeChecked === true,
      rangedAliasAmmoChecked: apiPayload.rangedAliasAmmoChecked === true,
      ammoBundleChecked: apiPayload.ammoBundleChecked === true,
      rangedReloadChecked: apiPayload.rangedReloadChecked === true,
      ammoRecoveryChecked: apiPayload.ammoRecoveryChecked === true,
      ammoDamageLossChecked: apiPayload.ammoDamageLossChecked === true,
      combatChecked: apiPayload.combatChecked === true,
      surveyChecked: apiPayload.surveyChecked === true,
      forageChecked: apiPayload.forageChecked === true,
      scanChecked: apiPayload.scanChecked === true,
      structuredTargetsChecked: apiPayload.structuredTargetsChecked === true,
      targetDetailsChecked: apiPayload.targetDetailsChecked === true,
      focusedTargetSmokeChecked: targetPayload.targetDetailsChecked === true,
      focusedEnemyDeploymentsChecked: enemyPayload.crossingEnemyDeploymentsChecked ?? apiPayload.crossingEnemyDeploymentsChecked ?? 0,
      focusedEnemyRoomsChecked: enemyPayload.crossingEnemyRoomsChecked ?? apiPayload.crossingEnemyRoomsChecked ?? 0,
      focusedEnemySmokeChecked:
        (enemyPayload.crossingEnemyScanChecked ?? apiPayload.crossingEnemyScanChecked) === true &&
        (enemyPayload.crossingEnemyTargetDetailsChecked ?? apiPayload.crossingEnemyTargetDetailsChecked) === true &&
        (enemyPayload.crossingEnemyAppraisalChecked ?? apiPayload.crossingEnemyAppraisalChecked) === true &&
        (enemyPayload.crossingEnemyDeploymentsChecked ?? apiPayload.crossingEnemyDeploymentsChecked ?? 0) >= 1,
      verbDiscoveryChecked: targetPayload.verbDiscoveryChecked === true,
      agentPromptCurrentStatusChecked: agentPromptPayload.currentStatusPriorityChecked === true,
      drRaceSelectionChecked: (apiPayload.racesRolled ?? 0) === 11 && (apiPayload.fixedRaceStatsChecked ?? 0) === 11,
      focusedRaceEndpointSmokeChecked:
        (racePayload.raceEndpointChecked ?? apiPayload.raceEndpointChecked) === true &&
        (racePayload.raceEndpointCanonicalCount ?? apiPayload.raceEndpointCanonicalCount) === 11 &&
        (racePayload.raceEndpointFixedStatTablesChecked ?? apiPayload.raceEndpointFixedStatTablesChecked) === 11 &&
        (racePayload.raceEndpointOnlyCanonical ?? apiPayload.raceEndpointOnlyCanonical) === true,
      drRaceEndpointPrivateRollDataHidden: (racePayload.raceEndpointPrivateRollDataHidden ?? apiPayload.raceEndpointPrivateRollDataHidden) === true,
      drInvalidRaceCreationRejected: (racePayload.invalidRaceCreationRejected ?? apiPayload.invalidRaceCreationRejected) === true,
      drCanonicalRaceCreationCircleOneChecked: (racePayload.raceCreationCanonicalCircleOneChecked ?? apiPayload.raceCreationCanonicalCircleOneChecked) === 11,
      drInvalidRaceRerollRejected: (racePayload.invalidRaceRerollRejected ?? apiPayload.invalidRaceRerollRejected) === true,
      drCanonicalRaceRerollPreservesGuildCircle: (racePayload.raceRerollCanonicalGuildCirclePreserved ?? apiPayload.raceRerollCanonicalGuildCirclePreserved) === 11,
      drCreationStartsUnaffiliatedChecked: apiPayload.creationStartsUnaffiliated === true,
      drGuildCreationRejected: apiPayload.guildCreationRejected === true,
      drGuildJoinedInWorldOnlyChecked: apiPayload.raceGuildMatrixStartsCommoner === true && (apiPayload.guildRoomsWalked ?? 0) === 11,
      drRaceGuildCircleOneMatrixChecked:
        apiPayload.raceGuildMatrixChecked === 121 &&
        apiPayload.raceGuildMatrixRaceCount === 11 &&
        apiPayload.raceGuildMatrixGuildCount === 11 &&
        apiPayload.raceGuildMatrixCircle === 1,
      drCanonicalGuildCountChecked:
        Array.isArray(apiPayload.canonicalGuildsChecked) &&
        apiPayload.canonicalGuildsChecked.length === 11 &&
        apiPayload.canonicalGuildRoomsWalked === 11,
      drNoPrototypeGuildsExposed: Array.isArray(apiPayload.extraPrototypeGuilds) && apiPayload.extraPrototypeGuilds.length === 0,
      drCanonicalRegistrarJoinsChecked:
        Array.isArray(apiPayload.canonicalGuildsChecked) &&
        apiPayload.canonicalGuildsChecked.length === 11 &&
        apiPayload.guildRoomsWalked === 11,
      focusedGuildEndpointSmokeChecked:
        (guildPayload.guildEndpointChecked ?? apiPayload.guildEndpointChecked) === true &&
        (guildPayload.guildEndpointCanonicalCount ?? apiPayload.guildEndpointCanonicalCount) === 11 &&
        (guildPayload.guildEndpointRegistrarRoomsChecked ?? apiPayload.guildEndpointRegistrarRoomsChecked) === 11 &&
        (guildPayload.guildEndpointOnlyCanonical ?? apiPayload.guildEndpointOnlyCanonical) === true,
      focusedGuildCircleTenSmokeChecked:
        (guildCirclePayload.guildCircleTenChecked ?? apiPayload.guildCircleTenChecked) === 11 &&
        (guildCirclePayload.guildCircleTenAllCanonical ?? apiPayload.guildCircleTenAllCanonical) === true &&
        (guildCirclePayload.guildCircleTenRegistrarChecked ?? apiPayload.guildCircleTenRegistrarChecked) === true,
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
      staticShopEconomyHelperCasesChecked: staticUiPayload.shopEconomyHelperCasesChecked === true,
      staticLegacyRaceStatModeChecked: staticUiPayload.legacyRaceStatModeChecked === true,
      staticPrototypeRaceRoleLabelsHidden: staticUiPayload.prototypeRaceRoleLabelsHidden === true,
      browserSmoke: byName.has('browser-smoke') ? byName.get('browser-smoke')?.exitCode === 0 : null,
      browser: browserPayload.browser ?? null,
      browserAccountCreated: Boolean(browserPayload.account),
      browserCommandCount: browserPayload.commandCount ?? 0,
      browserSurveyClicked: browserPayload.surveyClicked === true,
      browserRoomAffordancePanelVisible: browserPayload.roomAffordancePanelVisible === true,
      browserItemDetailsVisible: browserPayload.itemDetailsVisible === true,
      browserDamagedAmmoItemDetailsVisible: browserPayload.damagedAmmoItemDetailsVisible === true,
      browserDamagedAmmoSoldFromInventory: browserPayload.damagedAmmoSoldFromInventory === true,
      browserDisabledSellHintVisible: browserPayload.disabledSellHintVisible === true,
      browserShopAwareSellHintVisible: browserPayload.shopAwareSellHintVisible === true,
      browserAmmoPouchSellClicked: browserPayload.ammoPouchSellClicked === true,
      browserAmmoPouchRemainingVisible: browserPayload.ammoPouchRemainingVisible === true,
      browserAmmoPouchDisabledHintVisible: browserPayload.ammoPouchDisabledHintVisible === true,
      browserAmmoPouchMetadataVisible: browserPayload.ammoPouchMetadataVisible === true,
      browserSharedEconomyHintVisible: browserPayload.sharedEconomyHintVisible === true,
      browserTargetDetailsClicked: browserPayload.targetDetailsClicked === true,
      browserVerbDiscoveryClicked: browserPayload.verbDiscoveryClicked === true,
      browserCommandDiscoveryVisible: browserPayload.commandDiscoveryVisible === true,
      browserScriptDiscoveryVisible: browserPayload.scriptDiscoveryVisible === true,
      browserScriptPresetSaved: browserPayload.scriptPresetSaved === true,
      browserLegacyRaceStatModeVisible: browserPayload.legacyRaceStatModeVisible === true,
      browserPrototypeRaceRoleLabelsHidden: browserPayload.prototypeRaceRoleLabelsHidden === true,
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
  expect(coverage.frontend.staticShopEconomyHelperCasesChecked === true, 'frontend.staticShopEconomyHelperCasesChecked');
  expect(coverage.frontend.staticLegacyRaceStatModeChecked === true, 'frontend.staticLegacyRaceStatModeChecked');
  expect(coverage.frontend.staticPrototypeRaceRoleLabelsHidden === true, 'frontend.staticPrototypeRaceRoleLabelsHidden');
  expect(coverage.frontend.browserSmoke === true, 'frontend.browserSmoke');
  expect(coverage.frontend.browserScriptPresetSaved === true, 'frontend.browserScriptPresetSaved');
  expect(coverage.frontend.browserLegacyRaceStatModeVisible === true, 'frontend.browserLegacyRaceStatModeVisible');
  expect(coverage.frontend.browserPrototypeRaceRoleLabelsHidden === true, 'frontend.browserPrototypeRaceRoleLabelsHidden');
  expect(coverage.frontend.browserDamagedAmmoItemDetailsVisible === true, 'frontend.browserDamagedAmmoItemDetailsVisible');
  expect(coverage.frontend.browserDamagedAmmoSoldFromInventory === true, 'frontend.browserDamagedAmmoSoldFromInventory');
  expect(coverage.frontend.browserDisabledSellHintVisible === true, 'frontend.browserDisabledSellHintVisible');
  expect(coverage.frontend.browserShopAwareSellHintVisible === true, 'frontend.browserShopAwareSellHintVisible');
  expect(coverage.frontend.browserAmmoPouchSellClicked === true, 'frontend.browserAmmoPouchSellClicked');
  expect(coverage.frontend.browserAmmoPouchRemainingVisible === true, 'frontend.browserAmmoPouchRemainingVisible');
  expect(coverage.frontend.browserAmmoPouchDisabledHintVisible === true, 'frontend.browserAmmoPouchDisabledHintVisible');
  expect(coverage.frontend.browserAmmoPouchMetadataVisible === true, 'frontend.browserAmmoPouchMetadataVisible');
  expect(coverage.frontend.browserSharedEconomyHintVisible === true, 'frontend.browserSharedEconomyHintVisible');
  expect(coverage.scripts.focusedSmoke === true, 'scripts.focusedSmoke');
  expect(coverage.scripts.lifecycle === true, 'scripts.lifecycle');
  expect(coverage.scripts.created === true, 'scripts.created');
  expect(coverage.scripts.ran === true, 'scripts.ran');
  expect(coverage.scripts.deleted === true, 'scripts.deleted');
  expect(coverage.scripts.steps > 0, 'scripts.steps');
  expect(coverage.gameplay.combatChecked === true, 'gameplay.combatChecked');
  expect(coverage.gameplay.shopEconomyChecked === true, 'gameplay.shopEconomyChecked');
  expect(coverage.gameplay.ammoSellChecked === true, 'gameplay.ammoSellChecked');
  expect(coverage.gameplay.damagedAmmoEconomyChecked === true, 'gameplay.damagedAmmoEconomyChecked');
  expect(coverage.gameplay.itemDetailsChecked === true, 'gameplay.itemDetailsChecked');
  expect(coverage.gameplay.equipmentChecked === true, 'gameplay.equipmentChecked');
  expect(coverage.gameplay.equipmentSlotsChecked === true, 'gameplay.equipmentSlotsChecked');
  expect(coverage.gameplay.weaponAttackChecked === true, 'gameplay.weaponAttackChecked');
  expect(coverage.gameplay.rangedWeaponRangeChecked === true, 'gameplay.rangedWeaponRangeChecked');
  expect(coverage.gameplay.rangedAliasAmmoChecked === true, 'gameplay.rangedAliasAmmoChecked');
  expect(coverage.gameplay.ammoBundleChecked === true, 'gameplay.ammoBundleChecked');
  expect(coverage.gameplay.rangedReloadChecked === true, 'gameplay.rangedReloadChecked');
  expect(coverage.gameplay.ammoRecoveryChecked === true, 'gameplay.ammoRecoveryChecked');
  expect(coverage.gameplay.ammoDamageLossChecked === true, 'gameplay.ammoDamageLossChecked');
  expect(coverage.gameplay.scriptLifecycleChecked === true, 'gameplay.scriptLifecycleChecked');
  expect(coverage.gameplay.circleRequiresGuildRegistrar === true, 'gameplay.circleRequiresGuildRegistrar');
  expect(coverage.gameplay.drRaceSelectionChecked === true, 'gameplay.drRaceSelectionChecked');
  expect(coverage.gameplay.drCreationStartsUnaffiliatedChecked === true, 'gameplay.drCreationStartsUnaffiliatedChecked');
  expect(coverage.gameplay.drGuildCreationRejected === true, 'gameplay.drGuildCreationRejected');
  expect(coverage.gameplay.drGuildJoinedInWorldOnlyChecked === true, 'gameplay.drGuildJoinedInWorldOnlyChecked');
  expect(coverage.gameplay.drRaceGuildCircleOneMatrixChecked === true, 'gameplay.drRaceGuildCircleOneMatrixChecked');
  expect(coverage.gameplay.drCanonicalGuildCountChecked === true, 'gameplay.drCanonicalGuildCountChecked');
  expect(coverage.gameplay.drNoPrototypeGuildsExposed === true, 'gameplay.drNoPrototypeGuildsExposed');
  expect(coverage.gameplay.drCanonicalRegistrarJoinsChecked === true, 'gameplay.drCanonicalRegistrarJoinsChecked');

  if (mode === 'local') {
    expect(coverage.gameplay.focusedTargetSmokeChecked === true, 'gameplay.focusedTargetSmokeChecked');
    expect(coverage.gameplay.focusedRaceEndpointSmokeChecked === true, 'gameplay.focusedRaceEndpointSmokeChecked');
    expect(coverage.gameplay.drRaceEndpointPrivateRollDataHidden === true, 'gameplay.drRaceEndpointPrivateRollDataHidden');
    expect(coverage.gameplay.drInvalidRaceCreationRejected === true, 'gameplay.drInvalidRaceCreationRejected');
    expect(coverage.gameplay.drCanonicalRaceCreationCircleOneChecked === true, 'gameplay.drCanonicalRaceCreationCircleOneChecked');
    expect(coverage.gameplay.drInvalidRaceRerollRejected === true, 'gameplay.drInvalidRaceRerollRejected');
    expect(coverage.gameplay.drCanonicalRaceRerollPreservesGuildCircle === true, 'gameplay.drCanonicalRaceRerollPreservesGuildCircle');
    expect(coverage.gameplay.focusedGuildEndpointSmokeChecked === true, 'gameplay.focusedGuildEndpointSmokeChecked');
    expect(coverage.gameplay.focusedDamagedAmmoSmokeChecked === true, 'gameplay.focusedDamagedAmmoSmokeChecked');
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
