import type { CharacterRecord, EquipmentSlot } from './storage.js';
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

function countItemAmmo(character: CharacterRecord, code: string): number {
  return Math.max(0, Math.floor(character.ammoPouch?.[code] ?? 0)) + character.inventory.filter((item) => item === code).length;
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
    quantity: category === 'ammo' ? countItemAmmo(character, code) : undefined,
    carried: character.inventory.includes(code) || (character.worn ?? []).includes(code) || character.hands.left === code || character.hands.right === code || countItemAmmo(character, code) > 0,
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
