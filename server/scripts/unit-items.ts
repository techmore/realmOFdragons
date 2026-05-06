import assert from 'node:assert/strict';
import type { CharacterRecord, SkillState } from '../src/storage.js';
import { buildItemDetails, displayNameFromCode, resolveItemDetail } from '../src/items.js';
import { worldRooms } from '../src/world.js';

function skill(name: string, rank = 0, pool = 0): SkillState {
  return { name, rank, pool };
}

function character(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-items',
    accountId: 'acct-items',
    name: 'Items',
    race: 'human',
    raceDisplayName: 'Human',
    role: 'baseline',
    roleTitle: 'Baseline',
    guildId: 'fighter',
    guildName: 'Fighter Guild',
    circle: 1,
    skills: { melee: skill('Melee') },
    roomId: 'crossing-MA01-002',
    stats: {
      strength: 10,
      reflex: 10,
      agility: 10,
      discipline: 10,
      stamina: 10,
      wisdom: 10,
      intelligence: 10,
      charisma: 10,
    },
    health: { current: 40, max: 40 },
    wallet: { plat: 0, trias: 0, lucan: 0, silk: 0 },
    rollTrace: [],
    rollProfileVersion: 1,
    createdAt: new Date(0).toISOString(),
    inventory: ['training sword', 'damaged-itm-sting-arrow', 'foraged-fieldherb'],
    ammoPouch: { 'itm-sting-arrow': 4 },
    hands: { left: null, right: null },
    stance: 'balanced',
    balance: 4,
    roundtimeMs: 0,
    ...overrides,
  };
}

const marksmanRoom = worldRooms['crossing-MA01-002'];
const forageRoom = worldRooms['crossing-RV02-002'];
const unit = character();

assert.equal(displayNameFromCode('damaged-itm-sting-arrow'), 'damaged itm sting arrow');
assert.equal(displayNameFromCode('foraged-fieldherb'), 'fieldherb');

const starterSword = resolveItemDetail('training sword', marksmanRoom, unit);
assert.equal(starterSword.name, 'training sword');
assert.equal(starterSword.source, 'starter');
assert.equal(starterSword.category, 'weapon');
assert.equal(starterSword.weaponRange, 'melee');
assert.equal(starterSword.carried, true);

const bow = resolveItemDetail('itm-practice-bow', marksmanRoom, unit);
assert.equal(bow.name, 'practice bow');
assert.equal(bow.source, 'shop');
assert.equal(bow.category, 'ranged');
assert.deepEqual(bow.validAttackRanges, ['missile', 'pole']);
assert.equal(bow.ammoCode, 'itm-sting-arrow');

const ammo = resolveItemDetail('itm-sting-arrow', marksmanRoom, unit);
assert.equal(ammo.name, 'practice arrow');
assert.equal(ammo.category, 'ammo');
assert.equal(ammo.bundleSize, 5);
assert.equal(ammo.quantity, 4);
assert.equal(ammo.carried, true);
assert.equal(ammo.shopAvailable, true);

const damaged = resolveItemDetail('damaged-itm-sting-arrow', marksmanRoom, unit);
assert.equal(damaged.name, 'damaged practice arrow');
assert.equal(damaged.category, 'salvage');
assert.equal(damaged.source, 'loot');
assert.equal(damaged.value, 1);
assert.equal(damaged.description.includes('broken ranged ammunition'), true);

const forage = resolveItemDetail('foraged-fieldherb', forageRoom, unit);
assert.equal(forage.name, 'field herb bundle');
assert.equal(forage.source, 'forage');
assert.equal(forage.category, 'forage');
assert.equal(forage.value, 1);

const unknown = resolveItemDetail('itm-mystery-widget', marksmanRoom, unit);
assert.equal(unknown.name, 'mystery widget');
assert.equal(unknown.source, 'unknown');
assert.equal(unknown.category, 'gear');

const details = buildItemDetails(unit, marksmanRoom);
assert.equal(details.some((entry) => entry.code === 'training sword'), true);
assert.equal(details.some((entry) => entry.code === 'itm-sting-arrow'), true);
assert.equal(details.some((entry) => entry.code === 'itm-practice-bow'), true);

console.log(JSON.stringify({ ok: true, suite: 'unit:items' }, null, 2));
