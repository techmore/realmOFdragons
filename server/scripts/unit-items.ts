import assert from 'node:assert/strict';
import type { CharacterRecord, SkillState } from '../src/storage.js';
import {
  buildEquipmentSummary,
  buildInventoryEquipmentEvents,
  buildItemDetailEvents,
  buildItemDetails,
  canWieldItem,
  canWearItem,
  displayNameFromCode,
  findItemDetailForRequest,
  findInventoryIndex,
  findWornIndex,
  formatEquipmentModifiers,
  formatEquipmentSlots,
  holdInventoryItem,
  parseHeldItemRequest,
  removeWornInventoryItem,
  resolveAvailableHandSlot,
  resolveHandSlot,
  resolveItemDetail,
  stowHeldItem,
  wearCarriedItem,
} from '../src/items.js';
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

assert.equal(findInventoryIndex(unit, 'training sword'), 0);
assert.equal(findInventoryIndex(unit, 'training-sword'), 0);
assert.equal(findInventoryIndex(unit, 'missing sword'), -1);
assert.equal(findWornIndex(character({ worn: ['leather backpack'] }), 'leather-backpack'), 0);
assert.equal(resolveHandSlot(character({ hands: { left: 'training sword', right: null } }), 'training sword'), 'left');
assert.equal(resolveHandSlot(unit, 'right hand'), 'right');
assert.equal(resolveAvailableHandSlot(unit), 'right');
assert.equal(resolveAvailableHandSlot(character({ hands: { left: 'training sword', right: 'itm-practice-bow' } })), undefined);
assert.equal(resolveAvailableHandSlot(unit, 'left'), 'left');

const starterSword = resolveItemDetail('training sword', marksmanRoom, unit);
assert.equal(starterSword.name, 'training sword');
assert.equal(starterSword.source, 'starter');
assert.equal(starterSword.category, 'weapon');
assert.equal(starterSword.weaponRange, 'melee');
assert.equal(starterSword.carried, true);
assert.equal(canWearItem(starterSword), false);
assert.equal(canWieldItem(starterSword), true);

const backpack = resolveItemDetail('leather backpack', marksmanRoom, character({ inventory: ['leather backpack'] }));
assert.equal(backpack.slot, 'back');
assert.equal(canWearItem(backpack), true);
assert.equal(canWieldItem(backpack), false);

const bow = resolveItemDetail('itm-practice-bow', marksmanRoom, unit);
assert.equal(bow.name, 'practice bow');
assert.equal(bow.source, 'shop');
assert.equal(bow.category, 'ranged');
assert.deepEqual(bow.validAttackRanges, ['missile', 'pole']);
assert.equal(bow.ammoCode, 'itm-sting-arrow');
assert.equal(canWieldItem(bow), true);

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

assert.equal(findItemDetailForRequest(unit, marksmanRoom, 'training sword')?.code, 'training sword');
assert.equal(findItemDetailForRequest(unit, marksmanRoom, 'practice-bow')?.code, 'itm-practice-bow');
assert.equal(findItemDetailForRequest(unit, marksmanRoom, '')?.code, undefined);
assert.deepEqual(buildItemDetailEvents(unit, marksmanRoom, 'practice bow').slice(0, 4), [
  'Item: practice bow',
  'Code: itm-practice-bow.',
  'Category: ranged. Source: shop.',
  'Slot: held/carried only. Armor 0. Evasion penalty 0. Attack modifier 2.',
]);
assert.equal(buildItemDetailEvents(unit, marksmanRoom, 'damaged-itm-sting-arrow').some((entry) => entry.includes('broken ranged ammunition')), true);
assert.deepEqual(buildItemDetailEvents(unit, marksmanRoom, 'missing bauble'), ['You cannot find an item matching "missing bauble". Use inventory or shop to list known items.']);

assert.deepEqual(parseHeldItemRequest('training sword left'), {
  requestedItem: 'training sword',
  requestedSlot: 'left',
  hasExplicitSlot: true,
});
assert.deepEqual(parseHeldItemRequest('  practice bow   right  '), {
  requestedItem: 'practice bow',
  requestedSlot: 'right',
  hasExplicitSlot: true,
});
assert.deepEqual(parseHeldItemRequest('training sword'), {
  requestedItem: 'training sword',
  requestedSlot: '',
  hasExplicitSlot: false,
});

const holdUnit = character();
const held = holdInventoryItem(holdUnit, marksmanRoom, 'training sword');
assert.equal(held.success, true);
assert.deepEqual(held.events, ['You hold training sword in your right hand.']);
assert.equal(holdUnit.inventory.includes('training sword'), false);
assert.equal(holdUnit.hands.right, 'training sword');

const holdLeftUnit = character();
const heldLeft = holdInventoryItem(holdLeftUnit, marksmanRoom, 'training sword', 'left');
assert.equal(heldLeft.success, true);
assert.equal(holdLeftUnit.hands.left, 'training sword');

const fullHands = holdInventoryItem(character({ hands: { left: 'repair cloth', right: 'itm-practice-bow' } }), marksmanRoom, 'training sword');
assert.equal(fullHands.success, false);
assert.deepEqual(fullHands.events, ['Both hands are full. Stow something first.']);

const stowUnit = character({ inventory: [], hands: { left: null, right: 'training sword' } });
const stowed = stowHeldItem(stowUnit, marksmanRoom, 'training sword');
assert.equal(stowed.success, true);
assert.deepEqual(stowed.events, ['You stow training sword from your right hand.']);
assert.equal(stowUnit.hands.right, null);
assert.equal(stowUnit.inventory.includes('training sword'), true);

const wearUnit = character({ inventory: ['leather backpack'], equipment: {}, worn: [] });
const worn = wearCarriedItem(wearUnit, marksmanRoom, 'leather backpack');
assert.equal(worn.success, true);
assert.deepEqual(worn.events, ['You wear leather backpack on your back slot.']);
assert.equal(wearUnit.inventory.includes('leather backpack'), false);
assert.equal(wearUnit.worn?.includes('leather backpack'), true);
assert.equal(wearUnit.equipment?.back, 'leather backpack');

const handWearUnit = character({ inventory: [], hands: { left: 'repair cloth', right: null }, equipment: {}, worn: [] });
const handWorn = wearCarriedItem(handWearUnit, marksmanRoom, 'repair cloth');
assert.equal(handWorn.success, true);
assert.equal(handWearUnit.hands.left, null);
assert.equal(handWearUnit.equipment?.belt, 'repair cloth');

const invalidWear = wearCarriedItem(character(), marksmanRoom, 'training sword');
assert.equal(invalidWear.success, false);
assert.deepEqual(invalidWear.events, ['training sword is not something you can wear yet.']);

const occupiedWear = wearCarriedItem(character({ inventory: ['leather backpack'], equipment: { back: 'leather backpack' }, worn: ['leather backpack'] }), marksmanRoom, 'leather backpack');
assert.equal(occupiedWear.success, false);
assert.deepEqual(occupiedWear.events, ['Your back slot is already occupied by leather backpack.']);

const removeUnit = character({ inventory: [], worn: ['leather backpack'], equipment: { back: 'leather backpack' } });
const removed = removeWornInventoryItem(removeUnit, marksmanRoom, 'leather backpack');
assert.equal(removed.success, true);
assert.deepEqual(removed.events, ['You remove leather backpack and place it in your inventory.']);
assert.equal(removeUnit.worn?.includes('leather backpack'), false);
assert.equal(removeUnit.inventory.includes('leather backpack'), true);
assert.equal(removeUnit.equipment?.back, undefined);

const missingRemove = removeWornInventoryItem(character(), marksmanRoom, 'leather backpack');
assert.equal(missingRemove.success, false);
assert.deepEqual(missingRemove.events, ['You are not wearing "leather backpack".']);

const equipmentSummary = buildEquipmentSummary(character({
  inventory: ['foraged-fieldherb'],
  hands: { left: null, right: 'training sword' },
  equipment: { back: 'leather backpack', belt: 'repair cloth' },
}), marksmanRoom);
assert.deepEqual(equipmentSummary.slots, { back: 'leather backpack', belt: 'repair cloth' });
assert.equal(equipmentSummary.totalArmor, 0);
assert.equal(equipmentSummary.totalEvasionPenalty, 0);
assert.equal(equipmentSummary.totalAttackModifier, 1);
assert.equal(formatEquipmentSlots(equipmentSummary.slots), 'back: leather backpack, belt: repair cloth');
assert.equal(formatEquipmentModifiers(equipmentSummary), 'armor 0, evasion penalty 0, attack modifier 1');
assert.deepEqual(
  buildInventoryEquipmentEvents(character({ inventory: ['training sword'], equipment: { back: 'leather backpack' } }), equipmentSummary, 'practice arrow x4', 'none', 'none'),
  [
    'You are carrying 1 item(s).',
    ' - training sword',
    'Ammo: practice arrow x4.',
    'Loaded: none.',
    'Recoverable: none.',
    'Equipment slots: back: leather backpack, belt: repair cloth.',
    'Equipment modifiers: armor 0, evasion penalty 0, attack modifier 1.',
  ],
);

console.log(JSON.stringify({ ok: true, suite: 'unit:items' }, null, 2));
