import assert from 'node:assert/strict';
import type { CharacterRecord, SkillState } from '../src/storage.js';
import {
  addAmmo,
  addRecoverableAmmo,
  buildAmmoStatusEvents,
  buildEquipmentSummary,
  buildInventoryEquipmentEvents,
  buildItemDetailEvents,
  buildItemDetails,
  canWieldItem,
  canWearItem,
  clearLoadedAmmo,
  consumeAmmo,
  countAmmo,
  displayNameFromCode,
  findHeldWeapon,
  findItemDetailForRequest,
  findInventoryIndex,
  findWornIndex,
  formatAmmoPouch,
  formatEquipmentModifiers,
  formatEquipmentSlots,
  formatLoadedAmmo,
  formatRecoverableAmmo,
  getLoadedAmmo,
  holdInventoryItem,
  parseHeldItemRequest,
  prepareRangedFire,
  recoverAmmunition,
  reloadRangedWeapon,
  removeWornInventoryItem,
  resolveAvailableHandSlot,
  resolveHandSlot,
  resolveItemDetail,
  resolveRangedAmmoRecovery,
  stowHeldItem,
  validateAttackRange,
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
assert.equal(countAmmo(unit, 'itm-sting-arrow'), 4);
assert.equal(formatAmmoPouch(unit), 'itm-sting-arrow x4');

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

const ammoUnit = character({ inventory: ['itm-sting-arrow'], ammoPouch: { 'itm-sting-arrow': 2 } });
assert.equal(countAmmo(ammoUnit, 'itm-sting-arrow'), 3);
assert.equal(consumeAmmo(ammoUnit, 'itm-sting-arrow'), true);
assert.equal(ammoUnit.ammoPouch['itm-sting-arrow'], 1);
assert.equal(consumeAmmo(ammoUnit, 'itm-sting-arrow'), true);
assert.equal(ammoUnit.ammoPouch['itm-sting-arrow'], undefined);
assert.equal(consumeAmmo(ammoUnit, 'itm-sting-arrow'), true);
assert.equal(ammoUnit.inventory.includes('itm-sting-arrow'), false);
assert.equal(consumeAmmo(ammoUnit, 'itm-sting-arrow'), false);
addAmmo(ammoUnit, 'itm-sting-arrow', 5);
assert.equal(ammoUnit.ammoPouch['itm-sting-arrow'], 5);

const loadedUnit = character({ hands: { left: null, right: 'itm-practice-bow' }, loadedAmmo: {}, recoverableAmmo: { 'itm-sting-arrow': 2 } });
const heldWeapon = findHeldWeapon(loadedUnit, marksmanRoom);
assert.equal(heldWeapon?.code, 'itm-practice-bow');
const loadedReload = reloadRangedWeapon(loadedUnit, marksmanRoom);
assert.equal(loadedReload.success, true);
assert.deepEqual(loadedReload.events, ['You load practice arrow into practice bow. 3 remain in your quiver.']);
assert.equal(getLoadedAmmo(loadedUnit, heldWeapon!), 'itm-sting-arrow');
assert.equal(formatLoadedAmmo(loadedUnit), 'itm-practice-bow: itm-sting-arrow');
assert.equal(formatRecoverableAmmo(loadedUnit), 'itm-sting-arrow x2');
const alreadyLoaded = reloadRangedWeapon(loadedUnit, marksmanRoom);
assert.equal(alreadyLoaded.success, false);
assert.deepEqual(alreadyLoaded.events, ['practice bow is already loaded with itm-sting-arrow.']);
assert.deepEqual(buildAmmoStatusEvents(loadedUnit, marksmanRoom), [
  'Ammo pouch: itm-sting-arrow x3.',
  'Loaded: itm-practice-bow: itm-sting-arrow.',
  'Recoverable: itm-sting-arrow x2.',
  'practice bow uses practice arrow (itm-sting-arrow); 3 ready in your quiver.',
  'practice bow is loaded with itm-sting-arrow.',
]);
const firedShot = prepareRangedFire(loadedUnit, heldWeapon);
assert.equal(firedShot.success, true);
assert.equal(firedShot.consumedAmmo, 'itm-sting-arrow');
assert.deepEqual(firedShot.events, ['You loose loaded practice arrow. 3 remain in your quiver.']);
assert.equal(getLoadedAmmo(loadedUnit, heldWeapon!), undefined);
clearLoadedAmmo(loadedUnit, heldWeapon!);
assert.equal(getLoadedAmmo(loadedUnit, heldWeapon!), undefined);
assert.equal(formatLoadedAmmo(loadedUnit), 'none');
assert.equal(findHeldWeapon(character({ hands: { left: 'repair cloth', right: null } }), marksmanRoom), undefined);
assert.deepEqual(buildAmmoStatusEvents(character({ hands: { left: 'repair cloth', right: null } }), marksmanRoom), [
  'Ammo pouch: itm-sting-arrow x4.',
  'Loaded: none.',
  'Recoverable: none.',
  'No ranged weapon is currently in hand.',
]);
assert.deepEqual(prepareRangedFire(character({ hands: { left: null, right: 'training sword' } }), undefined).events, ['You need a ranged weapon in hand to fire or shoot.']);
const unloadedFireUnit = character({ hands: { left: null, right: 'itm-practice-bow' }, loadedAmmo: {}, ammoPouch: { 'itm-sting-arrow': 1 } });
assert.deepEqual(prepareRangedFire(unloadedFireUnit, findHeldWeapon(unloadedFireUnit, marksmanRoom)).events, ['practice bow is not loaded. Use reload before fire or shoot.']);
const emptyFireUnit = character({ hands: { left: null, right: 'itm-practice-bow' }, loadedAmmo: {}, ammoPouch: {}, inventory: [] });
assert.deepEqual(prepareRangedFire(emptyFireUnit, findHeldWeapon(emptyFireUnit, marksmanRoom)).events, ['Your quiver is empty: you need practice arrow (itm-sting-arrow) to use practice bow.']);
assert.deepEqual(validateAttackRange(heldWeapon, 'missile'), { success: true, events: [] });
assert.deepEqual(validateAttackRange(heldWeapon, 'melee'), {
  success: false,
  events: ['You are too close to use practice bow. Retreat to pole or missile range first.'],
});
assert.deepEqual(validateAttackRange(starterSword, 'missile'), {
  success: false,
  events: ['You are too far away to strike. Current range: missile range.', 'Advance to melee range first.'],
});
assert.deepEqual(validateAttackRange(undefined, 'pole'), {
  success: false,
  events: ['You are too far away to strike. Current range: pole range.', 'Advance to melee range first.'],
});
const noWeaponReload = reloadRangedWeapon(character({ hands: { left: null, right: 'training sword' } }), marksmanRoom);
assert.equal(noWeaponReload.success, false);
assert.deepEqual(noWeaponReload.events, ['You need a ranged weapon in hand to reload.']);
const emptyReload = reloadRangedWeapon(character({ hands: { left: null, right: 'itm-practice-bow' }, ammoPouch: {}, inventory: [] }), marksmanRoom);
assert.equal(emptyReload.success, false);
assert.deepEqual(emptyReload.events, ['Your quiver is empty: you need practice arrow (itm-sting-arrow) to use practice bow.']);

const recoverableUnit = character({ ammoPouch: {}, inventory: [], recoverableAmmo: {} });
addRecoverableAmmo(recoverableUnit, 'itm-sting-arrow', 2);
addRecoverableAmmo(recoverableUnit, 'damaged-itm-sting-arrow', 1);
assert.equal(formatRecoverableAmmo(recoverableUnit), 'itm-sting-arrow x2, damaged-itm-sting-arrow x1');
const recoveredAmmo = recoverAmmunition(recoverableUnit);
assert.equal(recoveredAmmo.success, true);
assert.deepEqual(recoveredAmmo.events, [
  'You recover 2 sting arrow into your ammo pouch.',
  'You recover 1 damaged itm sting arrow as broken ammunition.',
]);
assert.equal(recoverableUnit.ammoPouch['itm-sting-arrow'], 2);
assert.deepEqual(recoverableUnit.inventory, ['damaged-itm-sting-arrow']);
assert.deepEqual(recoverableUnit.recoverableAmmo, {});
assert.deepEqual(recoverAmmunition(character({ recoverableAmmo: {} })).events, ['You find no recoverable ammunition.']);

const lostRecovery = resolveRangedAmmoRecovery(character({ recoverableAmmo: {} }), 'itm-sting-arrow', 'practice arrow', 19);
assert.equal(lostRecovery.outcome, 'lost');
assert.deepEqual(lostRecovery.events, ['practice arrow splinters beyond recovery.']);
const damagedRecoveryUnit = character({ recoverableAmmo: {} });
const damagedRecovery = resolveRangedAmmoRecovery(damagedRecoveryUnit, 'itm-sting-arrow', 'practice arrow', 20);
assert.equal(damagedRecovery.outcome, 'damaged');
assert.deepEqual(damagedRecovery.events, ['practice arrow is damaged and may be recovered only as broken ammunition after the fight.']);
assert.equal(damagedRecoveryUnit.recoverableAmmo?.['damaged-itm-sting-arrow'], 1);
const intactRecoveryUnit = character({ recoverableAmmo: {} });
const intactRecovery = resolveRangedAmmoRecovery(intactRecoveryUnit, 'itm-sting-arrow', 'practice arrow', 55);
assert.equal(intactRecovery.outcome, 'intact');
assert.deepEqual(intactRecovery.events, ['practice arrow may be recovered after the fight.']);
assert.equal(intactRecoveryUnit.recoverableAmmo?.['itm-sting-arrow'], 1);

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
