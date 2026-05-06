import type { CharacterRecord, EquipmentSlot, EquipmentSlots } from './storage.js';
import { type Room, type RoomShopItem, worldRooms } from './world.js';
import type { CombatRangeName } from './combat.js';
import { isDamagedAmmoCode, originalAmmoCodeFromDamaged } from './economy.js';

export type ItemDetail = {
  code: string;
  name: string;
  category: string;
  description: string;
  value: number;
  currency: keyof CharacterRecord['wallet'];
  source: 'starter' | 'shop' | 'forage' | 'loot' | 'unknown';
  slot?: EquipmentSlot;
  armor: number;
  evasionPenalty: number;
  attackModifier: number;
  weaponRange?: 'melee' | 'ranged';
  validAttackRanges?: CombatRangeName[];
  trainingSkill?: string;
  ammoCode?: string;
  ammoName?: string;
  bundleSize?: number;
  quantity?: number;
  carried: boolean;
  shopAvailable: boolean;
};

export type HandSlotName = 'left' | 'right';

export type HeldItemRequest = {
  requestedItem: string;
  requestedSlot: HandSlotName | '';
  hasExplicitSlot: boolean;
};

export type EquipmentSummary = {
  slots: EquipmentSlots;
  totalArmor: number;
  totalEvasionPenalty: number;
  totalAttackModifier: number;
};

export type AmmoRecoveryOutcome = 'lost' | 'damaged' | 'intact';

export type RangedFireReadinessResult = ItemMutationResult & {
  consumedAmmo?: string;
};

export const STARTER_ITEM_DETAILS: Record<string, Omit<ItemDetail, 'carried' | 'shopAvailable'>> = {
  'leather backpack': {
    code: 'leather backpack',
    name: 'leather backpack',
    category: 'container',
    description: 'A plain leather pack issued to new adventurers.',
    value: 1,
    currency: 'trias',
    source: 'starter',
    slot: 'back',
    armor: 0,
    evasionPenalty: 0,
    attackModifier: 0,
  },
  'repair cloth': {
    code: 'repair cloth',
    name: 'repair cloth',
    category: 'utility',
    description: 'A square of sturdy cloth useful for wiping down beginner gear.',
    value: 1,
    currency: 'trias',
    source: 'starter',
    slot: 'belt',
    armor: 0,
    evasionPenalty: 0,
    attackModifier: 0,
  },
  'training sword': {
    code: 'training sword',
    name: 'training sword',
    category: 'weapon',
    description: 'A dull-edged practice blade balanced for new combat drills.',
    value: 2,
    currency: 'trias',
    source: 'starter',
    armor: 0,
    evasionPenalty: 0,
    attackModifier: 1,
    weaponRange: 'melee',
    validAttackRanges: ['melee'],
    trainingSkill: 'melee',
  },
};

export function countAmmo(character: CharacterRecord, code: string): number {
  return Math.max(0, Math.floor(character.ammoPouch?.[code] ?? 0)) + character.inventory.filter((item) => item === code).length;
}

export function addAmmo(character: CharacterRecord, code: string, count: number): void {
  character.ammoPouch = character.ammoPouch ?? {};
  character.ammoPouch[code] = Math.max(0, Math.floor(character.ammoPouch[code] ?? 0)) + Math.max(0, Math.floor(count));
}

export function addRecoverableAmmo(character: CharacterRecord, code: string, count: number): void {
  character.recoverableAmmo = character.recoverableAmmo ?? {};
  character.recoverableAmmo[code] =
    Math.max(0, Math.floor(character.recoverableAmmo[code] ?? 0)) + Math.max(0, Math.floor(count));
}

export function damagedAmmoCode(code: string): string {
  return `damaged-${code}`;
}

export function consumeAmmo(character: CharacterRecord, code: string): boolean {
  if ((character.ammoPouch?.[code] ?? 0) > 0) {
    character.ammoPouch![code] -= 1;
    if (character.ammoPouch![code] <= 0) delete character.ammoPouch![code];
    return true;
  }
  const inventoryIndex = character.inventory.findIndex((item) => item === code);
  if (inventoryIndex >= 0) {
    character.inventory.splice(inventoryIndex, 1);
    return true;
  }
  return false;
}

export function getLoadedAmmo(character: CharacterRecord, weapon: ItemDetail): string | undefined {
  return character.loadedAmmo?.[weapon.code];
}

export function setLoadedAmmo(character: CharacterRecord, weapon: ItemDetail, ammoCode: string): void {
  character.loadedAmmo = character.loadedAmmo ?? {};
  character.loadedAmmo[weapon.code] = ammoCode;
}

export function clearLoadedAmmo(character: CharacterRecord, weapon: ItemDetail): void {
  if (!character.loadedAmmo) return;
  delete character.loadedAmmo[weapon.code];
}

export function formatAmmoPouch(character: CharacterRecord): string {
  return Object.entries(character.ammoPouch ?? {}).map(([code, count]) => `${code} x${count}`).join(', ') || 'none';
}

export function formatLoadedAmmo(character: CharacterRecord): string {
  return Object.entries(character.loadedAmmo ?? {}).map(([weaponCode, ammoCode]) => `${weaponCode}: ${ammoCode}`).join(', ') || 'none';
}

export function formatRecoverableAmmo(character: CharacterRecord): string {
  return Object.entries(character.recoverableAmmo ?? {}).map(([code, count]) => `${code} x${count}`).join(', ') || 'none';
}

export function resolveRangedAmmoRecovery(
  character: CharacterRecord,
  ammoCode: string,
  ammoName: string,
  recoveryRoll: number,
): { outcome: AmmoRecoveryOutcome; events: string[] } {
  const normalizedRoll = Math.max(0, Math.floor(recoveryRoll)) % 100;
  if (normalizedRoll < 20) {
    return { outcome: 'lost', events: [`${ammoName} splinters beyond recovery.`] };
  }
  if (normalizedRoll < 55) {
    addRecoverableAmmo(character, damagedAmmoCode(ammoCode), 1);
    return { outcome: 'damaged', events: [`${ammoName} is damaged and may be recovered only as broken ammunition after the fight.`] };
  }
  addRecoverableAmmo(character, ammoCode, 1);
  return { outcome: 'intact', events: [`${ammoName} may be recovered after the fight.`] };
}

function inferItemCategory(code: string, name: string): string {
  const text = `${code} ${name}`.toLowerCase();
  if (text.includes('arrow')) return 'ammo';
  if (text.includes('bow')) return 'ranged';
  if (text.includes('knife') || text.includes('mace') || text.includes('sword') || text.includes('scraper')) return 'weapon';
  if (text.includes('glove') || text.includes('salve')) return 'armor';
  if (text.includes('herb') || text.includes('bark') || text.includes('root') || text.includes('grass')) return 'forage';
  if (text.includes('rope') || text.includes('snare')) return 'utility';
  if (text.includes('ration')) return 'provision';
  if (text.includes('fang')) return 'trophy';
  return 'gear';
}

export function displayNameFromCode(code: string): string {
  return code
    .replace(/^damaged-/, 'damaged ')
    .replace(/^itm-/, '')
    .replace(/^foraged-/, '')
    .replace(/-/g, ' ')
    .trim();
}

export function normalizeItemRequest(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function findInventoryIndex(character: CharacterRecord, requestedItem: string): number {
  const normalized = normalizeItemRequest(requestedItem);
  return character.inventory.findIndex((item) => {
    const code = normalizeItemRequest(item);
    return code === normalized || code.replace(/\s+/g, '-') === normalized;
  });
}

export function findWornIndex(character: CharacterRecord, requestedItem: string): number {
  const normalized = normalizeItemRequest(requestedItem);
  return (character.worn ?? []).findIndex((item) => {
    const code = normalizeItemRequest(item);
    return code === normalized || code.replace(/\s+/g, '-') === normalized;
  });
}

export function resolveHandSlot(character: CharacterRecord, requested: string): HandSlotName | undefined {
  const normalized = normalizeItemRequest(requested);
  if (normalized === 'left' || normalized === 'left hand') return 'left';
  if (normalized === 'right' || normalized === 'right hand') return 'right';
  if (character.hands.left && normalizeItemRequest(character.hands.left) === normalized) return 'left';
  if (character.hands.right && normalizeItemRequest(character.hands.right) === normalized) return 'right';
  return undefined;
}

export function resolveAvailableHandSlot(character: CharacterRecord, requestedSlot = ''): HandSlotName | undefined {
  if (requestedSlot === 'left' || requestedSlot === 'right') return requestedSlot;
  if (character.hands.right === null) return 'right';
  if (character.hands.left === null) return 'left';
  return undefined;
}

export function canWearItem(detail: ItemDetail): boolean {
  return Boolean(detail.slot) && ['armor', 'container', 'utility'].includes(detail.category);
}

export function canWieldItem(detail: ItemDetail): boolean {
  return ['weapon', 'ranged'].includes(detail.category);
}

export function parseHeldItemRequest(raw: string): HeldItemRequest {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const requestedSlot = parts.at(-1);
  const hasExplicitSlot = requestedSlot === 'left' || requestedSlot === 'right';
  return {
    requestedItem: hasExplicitSlot ? parts.slice(0, -1).join(' ') : parts.join(' '),
    requestedSlot: hasExplicitSlot ? requestedSlot : '',
    hasExplicitSlot,
  };
}

export type ItemMutationResult = {
  success: boolean;
  events: string[];
};

function itemMutation(success: boolean, events: string[]): ItemMutationResult {
  return { success, events };
}

export function holdInventoryItem(character: CharacterRecord, room: Room, requestedItem: string, requestedSlot = ''): ItemMutationResult {
  const inventoryIndex = findInventoryIndex(character, requestedItem);
  if (inventoryIndex < 0) {
    return itemMutation(false, [`You are not carrying "${requestedItem}" in your inventory.`]);
  }
  const slot = resolveAvailableHandSlot(character, requestedSlot);
  if (!slot) {
    return itemMutation(false, ['Both hands are full. Stow something first.']);
  }
  if (character.hands[slot]) {
    return itemMutation(false, [`Your ${slot} hand is already holding ${character.hands[slot]}.`]);
  }
  const [itemCode] = character.inventory.splice(inventoryIndex, 1);
  character.hands[slot] = itemCode;
  const detail = resolveItemDetail(itemCode, room, character);
  return itemMutation(true, [`You hold ${detail.name} in your ${slot} hand.`]);
}

export function stowHeldItem(character: CharacterRecord, room: Room, requestedItem: string): ItemMutationResult {
  const slot = resolveHandSlot(character, requestedItem);
  if (!slot || !character.hands[slot]) {
    return itemMutation(false, [`You are not holding "${requestedItem}".`]);
  }
  const itemCode = character.hands[slot]!;
  character.hands[slot] = null;
  character.inventory.push(itemCode);
  const detail = resolveItemDetail(itemCode, room, character);
  return itemMutation(true, [`You stow ${detail.name} from your ${slot} hand.`]);
}

export function wearCarriedItem(character: CharacterRecord, room: Room, requestedItem: string): ItemMutationResult {
  const inventoryIndex = findInventoryIndex(character, requestedItem);
  const handSlot = resolveHandSlot(character, requestedItem);
  const itemCode = inventoryIndex >= 0 ? character.inventory[inventoryIndex] : handSlot ? character.hands[handSlot] : undefined;
  if (!itemCode) {
    return itemMutation(false, [`You are not carrying "${requestedItem}".`]);
  }
  const detail = resolveItemDetail(itemCode, room, character);
  if (!canWearItem(detail)) {
    return itemMutation(false, [`${detail.name} is not something you can wear yet.`]);
  }
  const equipmentSlot = detail.slot;
  if (!equipmentSlot) {
    return itemMutation(false, [`${detail.name} is not something you can wear yet.`]);
  }
  character.equipment = character.equipment ?? {};
  if (character.equipment[equipmentSlot]) {
    const current = resolveItemDetail(character.equipment[equipmentSlot]!, room, character);
    return itemMutation(false, [`Your ${equipmentSlot} slot is already occupied by ${current.name}.`]);
  }
  if (inventoryIndex >= 0) {
    character.inventory.splice(inventoryIndex, 1);
  } else if (handSlot) {
    character.hands[handSlot] = null;
  }
  character.worn = character.worn ?? [];
  if (!character.worn.includes(itemCode)) {
    character.worn.push(itemCode);
  }
  character.equipment[equipmentSlot] = itemCode;
  return itemMutation(true, [`You wear ${detail.name} on your ${equipmentSlot} slot.`]);
}

export function removeWornInventoryItem(character: CharacterRecord, room: Room, requestedItem: string): ItemMutationResult {
  const wornIndex = findWornIndex(character, requestedItem);
  if (wornIndex < 0) {
    return itemMutation(false, [`You are not wearing "${requestedItem}".`]);
  }
  const [itemCode] = character.worn!.splice(wornIndex, 1);
  character.equipment = character.equipment ?? {};
  for (const [slot, equippedCode] of Object.entries(character.equipment)) {
    if (equippedCode === itemCode) {
      delete character.equipment[slot as EquipmentSlot];
    }
  }
  character.inventory.push(itemCode);
  const detail = resolveItemDetail(itemCode, room, character);
  return itemMutation(true, [`You remove ${detail.name} and place it in your inventory.`]);
}

export function recoverAmmunition(character: CharacterRecord): ItemMutationResult {
  const recoverableEntries = Object.entries(character.recoverableAmmo ?? {}).filter(([, count]) => count > 0);
  if (!recoverableEntries.length) {
    return itemMutation(false, ['You find no recoverable ammunition.']);
  }
  const events: string[] = [];
  for (const [ammoCode, count] of recoverableEntries) {
    const normalizedCount = Math.max(0, Math.floor(count));
    if (isDamagedAmmoCode(ammoCode)) {
      for (let index = 0; index < normalizedCount; index += 1) {
        character.inventory.push(ammoCode);
      }
      events.push(`You recover ${normalizedCount} ${displayNameFromCode(ammoCode)} as broken ammunition.`);
    } else {
      addAmmo(character, ammoCode, normalizedCount);
      events.push(`You recover ${normalizedCount} ${displayNameFromCode(ammoCode)} into your ammo pouch.`);
    }
    delete character.recoverableAmmo![ammoCode];
  }
  return itemMutation(true, events);
}

export function reloadRangedWeapon(character: CharacterRecord, room: Room): ItemMutationResult {
  const weapon = findHeldWeapon(character, room);
  if (weapon?.weaponRange !== 'ranged') {
    return itemMutation(false, ['You need a ranged weapon in hand to reload.']);
  }
  const ammoCode = weapon.ammoCode ?? 'itm-sting-arrow';
  const ammoName = weapon.ammoName ?? 'practice arrow';
  const loaded = getLoadedAmmo(character, weapon);
  if (loaded) {
    return itemMutation(false, [`${weapon.name} is already loaded with ${loaded}.`]);
  }
  if (countAmmo(character, ammoCode) <= 0) {
    return itemMutation(false, [`Your quiver is empty: you need ${ammoName} (${ammoCode}) to use ${weapon.name}.`]);
  }
  consumeAmmo(character, ammoCode);
  setLoadedAmmo(character, weapon, ammoCode);
  return itemMutation(true, [`You load ${ammoName} into ${weapon.name}. ${countAmmo(character, ammoCode)} remain in your quiver.`]);
}

export function buildAmmoStatusEvents(character: CharacterRecord, room: Room): string[] {
  const weapon = findHeldWeapon(character, room);
  const events = [
    `Ammo pouch: ${formatAmmoPouch(character)}.`,
    `Loaded: ${formatLoadedAmmo(character)}.`,
    `Recoverable: ${formatRecoverableAmmo(character)}.`,
  ];
  if (weapon?.weaponRange === 'ranged') {
    const ammoCode = weapon.ammoCode ?? 'itm-sting-arrow';
    const loaded = getLoadedAmmo(character, weapon);
    events.push(`${weapon.name} uses ${weapon.ammoName ?? 'practice arrow'} (${ammoCode}); ${countAmmo(character, ammoCode)} ready in your quiver.`);
    events.push(loaded ? `${weapon.name} is loaded with ${loaded}.` : `${weapon.name} is not loaded. Use reload before fire or shoot.`);
  } else {
    events.push('No ranged weapon is currently in hand.');
  }
  return events;
}

export function prepareRangedFire(character: CharacterRecord, weapon: ItemDetail | undefined): RangedFireReadinessResult {
  if (weapon?.weaponRange !== 'ranged') {
    return { success: false, events: ['You need a ranged weapon in hand to fire or shoot.'] };
  }
  const ammoCode = weapon.ammoCode ?? 'itm-sting-arrow';
  const loaded = getLoadedAmmo(character, weapon);
  if (loaded !== ammoCode) {
    if (countAmmo(character, ammoCode) <= 0) {
      return {
        success: false,
        events: [`Your quiver is empty: you need ${weapon.ammoName ?? 'practice arrow'} (${ammoCode}) to use ${weapon.name}.`],
      };
    }
    return { success: false, events: [`${weapon.name} is not loaded. Use reload before fire or shoot.`] };
  }
  clearLoadedAmmo(character, weapon);
  return {
    success: true,
    consumedAmmo: ammoCode,
    events: [`You loose loaded ${weapon.ammoName ?? ammoCode}. ${countAmmo(character, ammoCode)} remain in your quiver.`],
  };
}

export function buildEquipmentSummary(character: CharacterRecord, room?: Room, rooms: Record<string, Room> = worldRooms): EquipmentSummary {
  const slots = character.equipment ?? {};
  const summary: EquipmentSummary = {
    slots,
    totalArmor: 0,
    totalEvasionPenalty: 0,
    totalAttackModifier: 0,
  };
  const detailRoom = room ?? rooms[character.roomId] ?? rooms['crossing-TG01-001'];
  for (const itemCode of Object.values(slots)) {
    if (!itemCode) continue;
    const detail = resolveItemDetail(itemCode, detailRoom, character, rooms);
    summary.totalArmor += detail.armor;
    summary.totalEvasionPenalty += detail.evasionPenalty;
    summary.totalAttackModifier += detail.attackModifier;
  }
  for (const itemCode of [character.hands.left, character.hands.right]) {
    if (!itemCode) continue;
    const detail = resolveItemDetail(itemCode, detailRoom, character, rooms);
    summary.totalAttackModifier += detail.attackModifier;
  }
  return summary;
}

export function formatEquipmentSlots(slots: EquipmentSlots): string {
  return Object.entries(slots).map(([slot, item]) => `${slot}: ${item}`).join(', ') || 'none';
}

export function formatEquipmentModifiers(summary: EquipmentSummary): string {
  return `armor ${summary.totalArmor}, evasion penalty ${summary.totalEvasionPenalty}, attack modifier ${summary.totalAttackModifier}`;
}

export function buildInventoryEquipmentEvents(
  character: CharacterRecord,
  summary: EquipmentSummary,
  ammoStatus: string,
  loadedStatus: string,
  recoverableStatus: string,
): string[] {
  return [
    `You are carrying ${character.inventory.length} item(s).`,
    ...character.inventory.map((item) => ` - ${item}`),
    `Ammo: ${ammoStatus}.`,
    `Loaded: ${loadedStatus}.`,
    `Recoverable: ${recoverableStatus}.`,
    `Equipment slots: ${formatEquipmentSlots(summary.slots)}.`,
    `Equipment modifiers: ${formatEquipmentModifiers(summary)}.`,
  ];
}

export function findItemDetailForRequest(character: CharacterRecord, room: Room, requestedItem: string): ItemDetail | undefined {
  const normalized = requestedItem.toLowerCase().trim();
  if (!normalized) return undefined;
  return buildItemDetails(character, room).find((item) => {
    const code = item.code.toLowerCase();
    const name = item.name.toLowerCase();
    return code === normalized || name === normalized || code.replace(/\s+/g, '-') === normalized || name.replace(/\s+/g, '-') === normalized;
  });
}

export function buildItemDetailEvents(character: CharacterRecord, room: Room, requestedItem: string): string[] {
  const item = findItemDetailForRequest(character, room, requestedItem);
  if (!item) {
    return [`You cannot find an item matching "${requestedItem}". Use inventory or shop to list known items.`];
  }
  return [
    `Item: ${item.name}`,
    `Code: ${item.code}.`,
    `Category: ${item.category}. Source: ${item.source}.`,
    `Slot: ${item.slot ?? 'held/carried only'}. Armor ${item.armor}. Evasion penalty ${item.evasionPenalty}. Attack modifier ${item.attackModifier}.`,
    `Weapon range: ${item.weaponRange ?? 'none'}. Valid attack ranges: ${item.validAttackRanges?.join(', ') ?? 'none'}. Training skill: ${item.trainingSkill ?? 'none'}.`,
    `Ammo: ${item.ammoCode ? `${item.ammoName} (${item.ammoCode})` : 'none'}.`,
    `Quantity: ${item.quantity ?? 1}. Bundle size: ${item.bundleSize ?? 1}.`,
    `Value: ${item.value} ${item.currency}.`,
    `Carried: ${item.carried ? 'yes' : 'no'}. Shop available here: ${item.shopAvailable ? 'yes' : 'no'}.`,
    item.description,
  ];
}

export function findHeldWeapon(character: CharacterRecord, room?: Room, rooms: Record<string, Room> = worldRooms): ItemDetail | undefined {
  const detailRoom = room ?? rooms[character.roomId] ?? rooms['crossing-TG01-001'];
  for (const itemCode of [character.hands.right, character.hands.left]) {
    if (!itemCode) continue;
    const detail = resolveItemDetail(itemCode, detailRoom, character, rooms);
    if (canWieldItem(detail)) return detail;
  }
  return undefined;
}

function findShopItem(code: string, rooms: Record<string, Room> = worldRooms): RoomShopItem | undefined {
  const lowered = code.toLowerCase();
  for (const room of Object.values(rooms)) {
    const item = room.shop?.items.find((entry) => entry.code.toLowerCase() === lowered || entry.name.toLowerCase() === lowered);
    if (item) return item;
  }
  return undefined;
}

function findForageItem(code: string, rooms: Record<string, Room> = worldRooms): { code: string; name: string; difficulty: number } | undefined {
  const lowered = code.toLowerCase();
  for (const room of Object.values(rooms)) {
    const item = room.forage?.items.find((entry) => entry.code.toLowerCase() === lowered || entry.name.toLowerCase() === lowered);
    if (item) return { ...item, difficulty: room.forage?.difficulty ?? 1 };
  }
  return undefined;
}

function inferEquipmentStats(code: string, name: string, category: string): Pick<ItemDetail, 'slot' | 'armor' | 'evasionPenalty' | 'attackModifier'> {
  const text = `${code} ${name}`.toLowerCase();
  if (category === 'weapon' || category === 'ranged') {
    return { armor: 0, evasionPenalty: 0, attackModifier: text.includes('training') ? 1 : 2 };
  }
  if (text.includes('glove')) {
    return { slot: 'hands', armor: 1, evasionPenalty: 1, attackModifier: 0 };
  }
  if (category === 'armor') {
    return { slot: 'body', armor: 1, evasionPenalty: 1, attackModifier: 0 };
  }
  if (category === 'container') {
    return { slot: 'back', armor: 0, evasionPenalty: 0, attackModifier: 0 };
  }
  if (category === 'utility') {
    return { slot: 'belt', armor: 0, evasionPenalty: 0, attackModifier: 0 };
  }
  return { armor: 0, evasionPenalty: 0, attackModifier: 0 };
}

function inferWeaponProfile(code: string, name: string, category: string): Pick<ItemDetail, 'weaponRange' | 'validAttackRanges' | 'trainingSkill' | 'ammoCode' | 'ammoName'> {
  const text = `${code} ${name}`.toLowerCase();
  if (category === 'ranged' || text.includes('bow')) {
    return {
      weaponRange: 'ranged',
      validAttackRanges: ['missile', 'pole'],
      trainingSkill: 'missile',
      ammoCode: 'itm-sting-arrow',
      ammoName: 'practice arrow',
    };
  }
  if (category === 'weapon') {
    return { weaponRange: 'melee', validAttackRanges: ['melee'], trainingSkill: 'melee' };
  }
  return {};
}

export function resolveItemDetail(code: string, room: Room, character: CharacterRecord, rooms: Record<string, Room> = worldRooms): ItemDetail {
  const damagedAmmo = isDamagedAmmoCode(code);
  const originalAmmoCode = damagedAmmo ? originalAmmoCodeFromDamaged(code) : code;
  const starter = STARTER_ITEM_DETAILS[code.toLowerCase()];
  const shopItem = findShopItem(originalAmmoCode, rooms);
  const forageItem = findForageItem(code, rooms);
  const name = damagedAmmo
    ? `damaged ${shopItem?.name ?? displayNameFromCode(originalAmmoCode)}`
    : starter?.name ?? shopItem?.name ?? forageItem?.name ?? displayNameFromCode(code);
  const category = damagedAmmo ? 'salvage' : starter?.category ?? inferItemCategory(code, name);
  const source = damagedAmmo ? 'loot' : starter?.source ?? (shopItem ? 'shop' : forageItem ? 'forage' : code.toLowerCase().includes('fang') ? 'loot' : 'unknown');
  const value = damagedAmmo ? 1 : starter?.value ?? shopItem?.price ?? Math.max(1, forageItem?.difficulty ?? 1);
  const currency = starter?.currency ?? shopItem?.currency ?? 'trias';

  return {
    code,
    name,
    category,
    description:
      starter?.description ??
      (damagedAmmo
        ? `${name} is broken ranged ammunition. It cannot be fired, but an ammunition seller may buy it for scrap.`
        : source === 'shop'
        ? `${name} is cataloged shop gear suitable for early Crossing play.`
        : source === 'forage'
          ? `${name} is a simple foraged material found near the Crossing.`
          : source === 'loot'
            ? `${name} is a beginner hunting trophy.`
            : `${name} has not been fully cataloged yet.`),
    value,
    currency,
    source,
    ...inferEquipmentStats(code, name, category),
    ...inferWeaponProfile(code, name, category),
    bundleSize: category === 'ammo' ? 5 : undefined,
    quantity: category === 'ammo' ? countAmmo(character, code) : undefined,
    carried: character.inventory.includes(code) || (character.worn ?? []).includes(code) || character.hands.left === code || character.hands.right === code || countAmmo(character, code) > 0,
    shopAvailable: Boolean(room.shop?.items.some((entry) => entry.code === code)),
  };
}

export function buildItemDetails(character: CharacterRecord, room: Room, rooms: Record<string, Room> = worldRooms): ItemDetail[] {
  const details = new Map<string, ItemDetail>();
  for (const itemCode of [...character.inventory, ...(character.worn ?? []), character.hands.left, character.hands.right].filter(Boolean) as string[]) {
    details.set(itemCode, resolveItemDetail(itemCode, room, character, rooms));
  }
  for (const itemCode of Object.keys(character.ammoPouch ?? {})) {
    details.set(itemCode, resolveItemDetail(itemCode, room, character, rooms));
  }
  for (const item of room.shop?.items ?? []) {
    details.set(item.code, resolveItemDetail(item.code, room, character, rooms));
  }
  return [...details.values()].sort((left, right) => left.name.localeCompare(right.name));
}
