import assert from 'node:assert/strict';
import {
  STANCE_PROFILES,
  applyBalanceChange,
  formatAdvantage,
  formatBalance,
  formatRange,
  normalizeAdvantage,
  normalizeBalance,
  normalizeRange,
  normalizeStance,
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

console.log(JSON.stringify({ ok: true, suite: 'unit:combat' }, null, 2));
