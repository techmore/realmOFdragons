import assert from 'node:assert/strict';
import {
  STANCE_PROFILES,
  applyBalanceChange,
  buildCombatCircleRangeFailureEvents,
  buildCombatCircleSuccessEvents,
  buildCombatManeuverCollapseEvents,
  buildCombatManeuverHitEvents,
  buildCombatManeuverMissEvents,
  buildCombatManeuverRangeFailureEvents,
  buildCombatRangeEvents,
  buildCombatStatusEvents,
  buildPostAttackStatusEvents,
  buildRoomTargetsFromTemplates,
  buildTargetDetailEvents,
  buildTargetScanEvents,
  buildTargetVanishedEvents,
  formatAdvantage,
  formatBalance,
  formatRange,
  normalizeAdvantage,
  normalizeBalance,
  normalizeRange,
  normalizeStance,
  resolveAttackOutcome,
  resolveAttackCycleStatus,
  resolveAttackCooldownMs,
  shiftAdvantageValue,
  shiftCombatRange,
} from '../src/combat.js';

assert.equal(normalizeRange('missile'), 'missile');
assert.equal(normalizeRange('pole'), 'pole');
assert.equal(normalizeRange('melee'), 'melee');
assert.equal(normalizeRange('bad-range'), 'missile');
assert.equal(formatRange('missile'), 'missile range');
assert.equal(formatRange('pole'), 'pole range');
assert.equal(formatRange('melee'), 'melee range');

assert.equal(shiftCombatRange('missile', 'advance'), 'pole');
assert.equal(shiftCombatRange('pole', 'advance'), 'melee');
assert.equal(shiftCombatRange('melee', 'advance'), 'melee');
assert.equal(shiftCombatRange('melee', 'retreat'), 'pole');
assert.equal(shiftCombatRange('pole', 'retreat'), 'missile');
assert.equal(shiftCombatRange('missile', 'retreat'), 'missile');

assert.equal(normalizeAdvantage(-99), -2);
assert.equal(normalizeAdvantage(-1.2), -2);
assert.equal(normalizeAdvantage(0), 0);
assert.equal(normalizeAdvantage(2), 2);
assert.equal(normalizeAdvantage(99), 2);
assert.equal(shiftAdvantageValue(1, 4), 2);
assert.equal(shiftAdvantageValue(-1, -4), -2);
assert.equal(formatAdvantage(-2), 'your opponent has overwhelming advantage');
assert.equal(formatAdvantage(0), 'neither combatant has advantage');
assert.equal(formatAdvantage(2), 'you have overwhelming advantage');

assert.equal(normalizeBalance(-1), 0);
assert.equal(normalizeBalance(0), 0);
assert.equal(normalizeBalance(2.9), 2);
assert.equal(normalizeBalance(99), 4);
assert.equal(applyBalanceChange(2, 2), 4);
assert.equal(applyBalanceChange(2, -4), 0);
assert.equal(formatBalance(0), 'hopelessly unbalanced');
assert.equal(formatBalance(4), 'incredibly balanced');

assert.equal(normalizeStance('balanced'), 'balanced');
assert.equal(normalizeStance('offensive'), 'offensive');
assert.equal(normalizeStance('defensive'), 'defensive');
assert.equal(normalizeStance('evasive'), 'evasive');
assert.equal(normalizeStance('unknown'), 'balanced');
assert.equal(STANCE_PROFILES.offensive.attack > STANCE_PROFILES.balanced.attack, true);
assert.equal(STANCE_PROFILES.defensive.defense > STANCE_PROFILES.balanced.defense, true);
assert.equal(STANCE_PROFILES.evasive.defense > STANCE_PROFILES.defensive.defense, true);
assert.equal(STANCE_PROFILES.offensive.cost > STANCE_PROFILES.balanced.cost, true);

assert.deepEqual(resolveAttackOutcome('forage wolf-cub', 12, 5, { hit: true, roll: 88, threshold: 42 }), {
  targetHp: 7,
  collapsed: false,
  advantageShift: 1,
  events: ['You hit forage wolf-cub for 5 (88/42).'],
});
assert.deepEqual(resolveAttackOutcome('forage wolf-cub', 4, 5, { hit: true, roll: 88, threshold: 42 }), {
  targetHp: 0,
  collapsed: true,
  advantageShift: 1,
  events: ['You hit forage wolf-cub for 5 (88/42).', 'forage wolf-cub collapses.'],
});
assert.deepEqual(resolveAttackOutcome('forage wolf-cub', 12, 0, { hit: false, roll: 12, threshold: 42 }), {
  targetHp: 12,
  collapsed: false,
  advantageShift: -1,
  events: ['You miss forage wolf-cub.'],
});
assert.deepEqual(resolveAttackCycleStatus(1_500, 1_000), {
  ready: false,
  remainingMs: 500,
  events: ['Your target is still in the attack cycle (500ms).'],
});
assert.deepEqual(resolveAttackCycleStatus(1_000, 1_500), {
  ready: true,
  remainingMs: 0,
  events: [],
});
assert.deepEqual(buildTargetVanishedEvents(), ['Your target vanished from the world.']);
assert.deepEqual(buildPostAttackStatusEvents(1, 3), ['Position: you have the edge.', 'Balance: very balanced.']);
assert.equal(resolveAttackCooldownMs(59), 650);
assert.equal(resolveAttackCooldownMs(60), 900);
assert.deepEqual(buildCombatStatusEvents(
  { stance: 'offensive', balance: 3 },
  { totalArmor: 1, totalEvasionPenalty: -1, totalAttackModifier: 2 },
  'armor +1, evasion penalty -1, attack modifier +2',
  { name: 'short sword', weaponRange: 'melee' },
), [
  'You are not in combat.',
  'Stance: offensive stance. Balance: very balanced.',
  'Equipment: armor +1, evasion penalty -1, attack modifier +2.',
  'Weapon: short sword (melee).',
]);
assert.deepEqual(buildCombatStatusEvents(
  { stance: 'bad-stance', balance: 99 },
  { totalArmor: 0, totalEvasionPenalty: 0, totalAttackModifier: 0 },
  'armor +0, evasion penalty +0, attack modifier +0',
  undefined,
), [
  'You are not in combat.',
  'Stance: balanced stance. Balance: incredibly balanced.',
  'Equipment: armor +0, evasion penalty +0, attack modifier +0.',
  'Weapon: unarmed (melee).',
]);
assert.deepEqual(buildCombatStatusEvents(
  {
    stance: 'balanced',
    balance: 2,
    roundtimeMs: 450,
    combat: {
      targetName: 'test rat',
      targetHp: 4,
      targetMaxHp: 8,
      range: 'pole',
      advantage: 1,
    },
  },
  { totalArmor: 1, totalEvasionPenalty: -1, totalAttackModifier: 2 },
  'unused idle equipment label',
  { name: 'practice bow', weaponRange: 'missile' },
), [
  'Combat target: test rat',
  'Target HP: 4/8',
  'Range: pole range',
  'Position: you have the edge',
  'Stance: balanced stance. Balance: solidly balanced.',
  'Equipment: armor 1, evasion penalty -1, attack modifier 2.',
  'Weapon: practice bow (missile).',
  'Ready in: 450ms',
]);
assert.deepEqual(buildCombatRangeEvents(undefined), ['You are not engaged with a target.']);
assert.deepEqual(buildCombatRangeEvents({
  targetName: 'test goblin',
  targetHp: 7,
  targetMaxHp: 12,
  range: 'melee',
  advantage: 0,
}), ['You are at melee range from test goblin.']);
assert.deepEqual(buildCombatRangeEvents({
  targetName: 'test rat',
  targetHp: 4,
  targetMaxHp: 8,
  range: 'bad-range',
  advantage: 0,
}), ['You are at missile range from test rat.']);
assert.deepEqual(buildCombatCircleRangeFailureEvents(), ['You are too far away to circle your target.']);
assert.deepEqual(buildCombatCircleSuccessEvents(1, 3), [
  'You circle for a better angle. Position: you have the edge.',
  'Balance: very balanced.',
]);
assert.deepEqual(buildCombatCircleSuccessEvents(99, 99), [
  'You circle for a better angle. Position: you have overwhelming advantage.',
  'Balance: incredibly balanced.',
]);
assert.deepEqual(buildCombatManeuverRangeFailureEvents('bash', 'pole'), ['You need melee range to bash. Current range: pole range.']);
assert.deepEqual(buildCombatManeuverRangeFailureEvents('jab', 'missile'), ['You are too far away to jab. Current range: missile range.']);
assert.deepEqual(buildCombatManeuverRangeFailureEvents('jab', 'bad-range'), ['You are too far away to jab. Current range: missile range.']);
assert.deepEqual(buildCombatManeuverHitEvents('jab', 'test rat', 3.9, { hit: true, roll: 22, threshold: 61 }), [
  'You jab test rat for 3 (22/61).',
]);
assert.deepEqual(buildCombatManeuverHitEvents('bash', 'test goblin', -4, { hit: true, roll: 18, threshold: 44 }), [
  'You bash test goblin for 0 (18/44).',
]);
assert.deepEqual(buildCombatManeuverMissEvents('bash'), ['You fail to land your bash.']);
assert.deepEqual(buildCombatManeuverCollapseEvents('test goblin'), ['test goblin collapses.']);

const targetTemplates = [
  { id: 'test-rat', name: 'test rat', maxHp: 8, aggression: 30 },
  { id: 'test-goblin', name: 'test goblin', maxHp: 12, aggression: 55 },
];
assert.deepEqual(buildRoomTargetsFromTemplates(targetTemplates), [
  { id: 'test-rat', name: 'test rat', vitality: 8, aggression: 30 },
  { id: 'test-goblin', name: 'test goblin', vitality: 12, aggression: 55 },
]);
assert.deepEqual(buildTargetScanEvents([]), ['You scan the area and find no immediate targets.']);
assert.deepEqual(buildTargetScanEvents(targetTemplates), [
  'You scan the area and notice:',
  'Vitality estimates how long a target can stay in the fight; aggression estimates how quickly it presses or attacks.',
  ' - test rat (8 vitality, aggression 30)',
  ' - test goblin (12 vitality, aggression 55)',
]);

assert.deepEqual(buildTargetDetailEvents(undefined, '', undefined), ['Target what? Use target <name> or appraise <target>.']);
assert.deepEqual(buildTargetDetailEvents(undefined, 'missing rat', undefined), ['You do not see missing rat here. Use scan to list immediate targets.']);
assert.deepEqual(buildTargetDetailEvents(targetTemplates[0], 'test rat', undefined), [
  'Target: test rat',
  'Vitality: 8 baseline.',
  'Aggression: 30.',
  'Range: not yet engaged.',
  'Suggested next verb: advance test rat.',
]);
assert.deepEqual(buildTargetDetailEvents(targetTemplates[0], 'test rat', {
  targetId: 'test-rat',
  targetName: 'test rat',
  targetHp: 5,
  targetMaxHp: 8,
  range: 'pole',
}), [
  'Target: test rat',
  'Vitality: 5/8.',
  'Aggression: 30.',
  'Range: pole range.',
  'Suggested next verb: advance.',
]);
assert.equal(buildTargetDetailEvents(targetTemplates[0], 'test rat', {
  targetId: 'test-rat',
  targetName: 'test rat',
  targetHp: 5,
  targetMaxHp: 8,
  range: 'melee',
})[4], 'Suggested next verb: attack test rat.');

console.log(JSON.stringify({ ok: true, suite: 'unit:combat', roomTargetListingChecked: true, targetDetailFormattingChecked: true, combatStatusChecked: true, combatRangeChecked: true, combatCircleChecked: true, combatManeuverChecked: true }, null, 2));
