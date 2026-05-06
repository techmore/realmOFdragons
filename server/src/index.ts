import argon2 from 'argon2';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  Room,
  RoomId,
  guilds,
  resolveMovementDecision,
  worldRooms,
} from './world.js';
import { FileStorage, LoginSession, AccountRecord, CharacterRecord, ScriptRecord } from './storage.js';
import {
  buildRollProfileEvents,
  getAllRaces,
  isValidRace,
  normalizeStoredRaceRollMetadata,
  normalizeStatGenerationMode,
  resolveRace,
  rollCharacterForRace,
  type RaceRollResult,
  type StatGenerationMode,
  type StatBlock,
} from './races.js';
import {
  applySkillPoolGain,
  buildCircleStatus,
  buildGuildRegistrarDisplay,
  buildScoreSummaryEvents,
  buildSkillSummaryEvents,
  buildStarterSkills,
  ensureProgressionShape,
  nextCircleRequirement,
  primarySkillForGuild,
  resolveCircleAdvancement,
  resolveCircleAdvancementRequest,
  resolveGuildJoinDecision,
  resolveTrainingDecision,
  totalSkillRanks,
} from './progression.js';
import {
  STANCE_PROFILES,
  type CombatRangeName,
  type StanceName,
  applyBalanceChange,
  formatAdvantage,
  formatBalance,
  formatRange,
  normalizeAdvantage,
  normalizeBalance,
  normalizeRange,
  normalizeStance,
  buildPostAttackStatusEvents,
  buildTargetVanishedEvents,
  resolveAttackCooldownMs,
  resolveAttackOutcome,
  resolveAttackCycleStatus,
  shiftAdvantageValue,
  shiftCombatRange,
} from './combat.js';
import {
  estimateAmmoPouchSalePrice,
  estimateInventorySalePrice,
  findLocalShopSaleItem,
  isDamagedAmmoCode,
  listShopItems,
  originalAmmoCodeFromDamaged,
  resolveShopBuyDecision,
  resolveShopSellDecision,
} from './economy.js';
import {
  addAmmo,
  buildAttackOpeningEvents,
  buildEquipmentSummary,
  buildAmmoStatusEvents,
  buildInventoryEquipmentEvents,
  buildItemDetailEvents,
  buildItemDetails,
  canWieldItem,
  consumeAmmo,
  countAmmo,
  displayNameFromCode,
  findItemDetailForRequest,
  findHeldWeapon,
  formatAmmoPouch,
  formatEquipmentModifiers,
  formatLoadedAmmo,
  formatRecoverableAmmo,
  holdInventoryItem,
  parseHeldItemRequest,
  prepareRangedFire,
  recoverAmmunition,
  reloadRangedWeapon,
  removeWornInventoryItem,
  resolveRangedAmmoRecovery,
  stowHeldItem,
  validateAttackRange,
  wearCarriedItem,
  resolveItemDetail,
  type ItemDetail,
} from './items.js';
import { WebSocketServer, WebSocket } from 'ws';

type TokenClaims = {
  sub: string;
  tid: string;
  characterId?: string;
};

interface AuthenticatedRequest extends Request {
  auth?: TokenClaims;
}

interface CommandResult {
  character: Pick<
  CharacterRecord,
  | 'id'
  | 'name'
  | 'race'
  | 'raceDisplayName'
  | 'role'
  | 'roleTitle'
  | 'guildId'
  | 'guildName'
  | 'circle'
  | 'skills'
  | 'roomId'
  | 'health'
  | 'hands'
  | 'inventory'
  | 'ammoPouch'
  | 'loadedAmmo'
  | 'recoverableAmmo'
  | 'worn'
  | 'equipment'
  | 'roundtimeMs'
  | 'combat'
  | 'stance'
  | 'balance'
  | 'stats'
  > & {
    rollProfileVersion: number;
    statGenerationMode: CharacterRecord['statGenerationMode'];
    wallet: CharacterRecord['wallet'];
  };
  room: Room;
  events: string[];
  targets: RoomTarget[];
  itemDetails: ItemDetail[];
}

type RoomTarget = {
  id: string;
  name: string;
  vitality: number;
  aggression: number;
};

type SocketState = {
  characterId?: string;
  accountId: string;
};

type ScriptRunStep = {
  index: number;
  command: string;
  events: string[];
  roomId?: string;
  error?: string;
};

type ScriptPreset = {
  id: string;
  name: string;
  description: string;
  commands: string[];
};

type EnemyTemplate = {
  id: string;
  roomId: string;
  name: string;
  maxHp: number;
  attack: number;
  damageMin: number;
  damageMax: number;
  aggression: number;
};

type CharacterCombatSnapshot = {
  targetId: string;
  targetName: string;
  targetHp: number;
  targetMaxHp: number;
  defendUntil: number;
  nextAttackAt: number;
  range: CombatRangeName;
  advantage: number;
};

const MAX_SCRIPT_INPUT_COMMANDS = 200;
const MAX_SCRIPT_RUNTIME_STEPS = 800;
const MAX_REPEAT_COUNT = 100;
const STARTING_WALLET = Object.freeze({
  plat: 40,
  trias: 80,
  lucan: 0,
  silk: 0,
});

const SCRIPT_PRESETS: ScriptPreset[] = [
  {
    id: 'preset-crossing-guilds',
    name: 'Crossing Guild Tour',
    description: 'Visit all Crossing guild halls and check shop inventories.',
    commands: [
      '# Crossing Guild Tour',
      'look',
      'ne',
      'shop',
      'sw',
      'nw',
      'shop',
      'se',
      'se',
      'shop',
      'nw',
      'sw',
      'shop',
      'ne',
      'u',
      'shop',
      'down',
    ],
  },
  {
    id: 'preset-crossing-crossing-town-loop',
    name: 'Crossing Town Market Sweep',
    description: 'Traverse major nearby locations and check each shop encounter.',
    commands: [
      '# Crossing Town Market Sweep',
      'look',
      'e',
      'shop',
      'w',
      'n',
      'enter',
      'shop',
      'exit',
      's',
      's',
      'e',
      'shop',
      'wait 150',
      'w',
      'look',
    ],
  },
];

const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: 'rv-wolf-cub',
    roomId: 'crossing-RV02-002',
    name: 'forage wolf-cub',
    maxHp: 10,
    attack: 4,
    damageMin: 1,
    damageMax: 3,
    aggression: 55,
  },
  {
    id: 'rv-boarlet',
    roomId: 'crossing-RV02-003',
    name: 'brushline boarlet',
    maxHp: 12,
    attack: 6,
    damageMin: 1,
    damageMax: 4,
    aggression: 62,
  },
  {
    id: 'rv-mud-beetle',
    roomId: 'crossing-RV02-004',
    name: 'muddy shell beetle',
    maxHp: 14,
    attack: 5,
    damageMin: 1,
    damageMax: 3,
    aggression: 48,
  },
  {
    id: 'rv-ridge-hare',
    roomId: 'crossing-RV02-005',
    name: 'ridge hare',
    maxHp: 11,
    attack: 7,
    damageMin: 1,
    damageMax: 4,
    aggression: 58,
  },
];

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const storage = new FileStorage();
const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TEST_FIXTURES_ENABLED = process.env.DR_TEST_FIXTURES === '1';

const socketsByCharacter = new Map<string, Set<WebSocket>>();

app.use(cors());
app.use(express.json());

function sanitizeCharacter(character: CharacterRecord): CommandResult['character'] {
  return {
    id: character.id,
    name: character.name,
    race: character.race,
    raceDisplayName: character.raceDisplayName,
    role: character.role,
    roleTitle: character.roleTitle,
    guildId: character.guildId,
    guildName: character.guildName,
    circle: character.circle,
    skills: character.skills,
    roomId: character.roomId,
    health: character.health,
    hands: character.hands,
    inventory: character.inventory,
    ammoPouch: character.ammoPouch ?? {},
    loadedAmmo: character.loadedAmmo ?? {},
    recoverableAmmo: character.recoverableAmmo ?? {},
    worn: character.worn ?? [],
    equipment: character.equipment ?? {},
    wallet: character.wallet,
    stats: character.stats,
    rollProfileVersion: character.rollProfileVersion,
    statGenerationMode: character.statGenerationMode ?? 'modern_fixed',
    roundtimeMs: character.roundtimeMs,
    combat: character.combat,
    stance: character.stance,
    balance: character.balance,
  };
}

function normalizeWalletValue(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeWallet(
  raw: CharacterRecord['wallet'] | undefined,
): { wallet: CharacterRecord['wallet']; changed: boolean } {
  if (!raw) {
    return { wallet: { ...STARTING_WALLET }, changed: true };
  }
  const wallet = {
    plat: normalizeWalletValue(raw.plat),
    trias: normalizeWalletValue(raw.trias),
    lucan: normalizeWalletValue(raw.lucan),
    silk: normalizeWalletValue(raw.silk),
  };
  const changed =
    wallet.plat !== raw.plat ||
    wallet.trias !== raw.trias ||
    wallet.lucan !== raw.lucan ||
    wallet.silk !== raw.silk;
  return { wallet, changed };
}

function formatWallet(wallet: CharacterRecord['wallet']) {
  return `Plat ${wallet.plat}, Trias ${wallet.trias}, Lucan ${wallet.lucan}, Silk ${wallet.silk}`;
}

function spendFunds(wallet: CharacterRecord['wallet'], currency: keyof CharacterRecord['wallet'], cost: number) {
  wallet[currency] = Math.max(0, wallet[currency] - Math.max(0, Math.floor(cost)));
}

function earnFunds(wallet: CharacterRecord['wallet'], currency: keyof CharacterRecord['wallet'], amount: number) {
  wallet[currency] = Math.max(0, wallet[currency] + Math.max(0, Math.floor(amount)));
}

function normalizeAmmoPouch(character: CharacterRecord): boolean {
  let changed = false;
  if (!character.ammoPouch || typeof character.ammoPouch !== 'object') {
    character.ammoPouch = {};
    changed = true;
  }
  for (const [code, rawCount] of Object.entries(character.ammoPouch)) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count <= 0) {
      delete character.ammoPouch[code];
      changed = true;
    } else if (count !== rawCount) {
      character.ammoPouch[code] = count;
      changed = true;
    }
  }
  return changed;
}

function normalizeLoadedAmmo(character: CharacterRecord): boolean {
  let changed = false;
  if (!character.loadedAmmo || typeof character.loadedAmmo !== 'object') {
    character.loadedAmmo = {};
    changed = true;
  }
  for (const [weaponCode, ammoCode] of Object.entries(character.loadedAmmo)) {
    if (typeof ammoCode !== 'string' || ammoCode.trim().length === 0) {
      delete character.loadedAmmo[weaponCode];
      changed = true;
    }
  }
  return changed;
}

function normalizeRecoverableAmmo(character: CharacterRecord): boolean {
  let changed = false;
  if (!character.recoverableAmmo || typeof character.recoverableAmmo !== 'object') {
    character.recoverableAmmo = {};
    changed = true;
  }
  for (const [code, rawCount] of Object.entries(character.recoverableAmmo)) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count <= 0) {
      delete character.recoverableAmmo[code];
      changed = true;
    } else if (count !== rawCount) {
      character.recoverableAmmo[code] = count;
      changed = true;
    }
  }
  return changed;
}

function applyRollToCharacter(character: CharacterRecord, characterRoll: RaceRollResult) {
  character.race = characterRoll.race.toLowerCase();
  character.raceDisplayName = characterRoll.race;
  character.role = characterRoll.role;
  character.roleTitle = characterRoll.roleTitle;
  character.stats = characterRoll.finalStats;
  character.health = calculateHealth(characterRoll.finalStats, character.health?.current);
  character.rollTrace = characterRoll.trace;
  character.rollProfileVersion = characterRoll.rollProfileVersion;
  character.statGenerationMode = characterRoll.statGenerationMode;
}

function calculateHealth(stats: StatBlock, current?: number) {
  const max = Math.max(12, 22 + Math.floor(stats.stamina / 2) + Math.floor(stats.strength / 3));
  const normalizedCurrent = typeof current === 'number' ? Math.max(0, Math.min(current, max)) : max;
  return { current: normalizedCurrent, max };
}

function recoverBalance(character: CharacterRecord, amount: number) {
  character.balance = applyBalanceChange(character.balance, Math.max(0, Math.floor(amount)));
}

function reduceBalance(character: CharacterRecord, amount: number) {
  character.balance = applyBalanceChange(character.balance, -Math.max(0, Math.floor(amount)));
}

function findCombatTemplate(character: CharacterRecord) {
  if (!character.combat) return undefined;
  return ENEMY_TEMPLATES.find((entry) => entry.id === character.combat?.targetId);
}

function ensureCombatShape(character: CharacterRecord): boolean {
  if (!character.combat) return false;
  let changed = false;
  const normalizedRange = normalizeRange(character.combat.range);
  if (character.combat.range !== normalizedRange) {
    character.combat.range = normalizedRange;
    changed = true;
  }
  const normalizedAdvantage = normalizeAdvantage(character.combat.advantage);
  if (character.combat.advantage !== normalizedAdvantage) {
    character.combat.advantage = normalizedAdvantage;
    changed = true;
  }
  return changed;
}

function shiftAdvantage(character: CharacterRecord, amount: number) {
  if (!character.combat) return;
  character.combat.advantage = shiftAdvantageValue(character.combat.advantage, amount);
}

function trainCharacter(character: CharacterRecord, room: Room, requestedSkill: string, events: string[]) {
  const training = resolveTrainingDecision(character, room, requestedSkill);
  if (!training.allowed) {
    events.push(...training.events);
    return false;
  }

  for (const gain of training.gains) {
    events.push(...applySkillPoolGain(character, gain.skillId, gain.amount).events);
  }
  events.push(...training.events);
  return true;
}

function forageRoom(character: CharacterRecord, room: Room, events: string[]) {
  if (character.combat) {
    events.push('You are too engaged to forage safely.');
    return false;
  }
  const forage = room.forage;
  if (!forage?.items.length) {
    events.push('You find nothing useful to forage here.');
    return false;
  }

  const item = forage.items[randomInt(0, forage.items.length)];
  character.inventory.push(item.code);
  events.push(...applySkillPoolGain(character, 'survival', Math.max(1, forage.difficulty)).events);
  events.push(`You forage carefully and find ${item.name}.`);
  events.push(`You place ${item.code} in your pack.`);
  return true;
}

function applyMeleeRetaliation(character: CharacterRecord, template: EnemyTemplate, now: number, events: string[]) {
  if (!character.combat) return false;
  const stanceProfile = STANCE_PROFILES[character.stance];
  const balanceBonus = (character.balance - 2) * 5;
  const equipment = buildEquipmentSummary(character);
  const retaliation = evaluateToHit(
    template.attack * 8,
    -Math.floor((character.stats.discipline + character.stats.wisdom) / 5) - stanceProfile.defense - balanceBonus + equipment.totalEvasionPenalty * 4,
  );
  if (retaliation.hit) {
    const rawDamage = randomInt(template.damageMin, template.damageMax + 1);
    const defended = character.combat.defendUntil > now;
    const stanceMitigation = character.stance === 'defensive' ? 1 : character.stance === 'evasive' ? 2 : 0;
    const damage = Math.max(0, rawDamage - (defended ? 2 : 0) - stanceMitigation - equipment.totalArmor);
    events.push(`${character.combat.targetName} attacks for ${damage}.`);
    character.health.current = Math.max(0, character.health.current - damage);
    events.push(...applySkillPoolGain(character, 'evasion', defended ? 2 : 1).events);
    events.push(`You now have ${character.health.current}/${character.health.max} health.`);
    if (damage >= 6) {
      events.push('You take a hard hit.');
    }
  } else {
    events.push(`${character.combat.targetName} misses its strike.`);
  }
  character.combat.nextAttackAt = now + 900;
  return true;
}

function applyEnemyPressure(character: CharacterRecord, template: EnemyTemplate, now: number, events: string[]) {
  if (!character.combat) return false;
  const range = normalizeRange(character.combat.range);
  if (range !== 'melee') {
    const pressureRoll = randomInt(1, 101);
    if (pressureRoll <= template.aggression) {
      const nextRange = shiftCombatRange(range, 'advance');
      character.combat.range = nextRange;
      events.push(`${character.combat.targetName} presses in to ${formatRange(nextRange)}.`);
      return true;
    }
    events.push(`${character.combat.targetName} holds at ${formatRange(range)}.`);
    return false;
  }

  if (character.combat.nextAttackAt <= now) {
    return applyMeleeRetaliation(character, template, now, events);
  }
  return false;
}

function resolvePlayerManeuver(
  character: CharacterRecord,
  template: EnemyTemplate,
  maneuver: 'jab' | 'bash',
  now: number,
  events: string[],
) {
  if (!character.combat) return false;
  const range = normalizeRange(character.combat.range);
  if (maneuver === 'bash' && range !== 'melee') {
    events.push(`You need melee range to bash. Current range: ${formatRange(range)}.`);
    return false;
  }
  if (maneuver === 'jab' && range === 'missile') {
    events.push(`You are too far away to jab. Current range: ${formatRange(range)}.`);
    return false;
  }

  const stanceProfile = STANCE_PROFILES[character.stance];
  const balanceBonus = (character.balance - 2) * 5;
  const advantageBonus = normalizeAdvantage(character.combat.advantage) * 7;
  const maneuverBonus = maneuver === 'jab' ? 8 : -4;
  const equipment = buildEquipmentSummary(character);
  const playerAttack = evaluateToHit(
    character.stats.strength + character.stats.agility + character.stats.reflex,
    stanceProfile.attack + balanceBonus + advantageBonus + maneuverBonus + equipment.totalAttackModifier * 3,
  );

  if (playerAttack.hit) {
    const damage = resolveAttackDamage(
      character.stats.strength,
      character.stats.discipline + stanceProfile.damage + equipment.totalAttackModifier + (maneuver === 'bash' ? 3 : -1),
      template.damageMin,
      template.damageMax,
    );
    character.combat.targetHp = Math.max(0, character.combat.targetHp - damage);
    events.push(`You ${maneuver} ${character.combat.targetName} for ${damage} (${playerAttack.roll}/${playerAttack.threshold}).`);
    shiftAdvantage(character, maneuver === 'bash' ? 1 : 0);
    events.push(...applySkillPoolGain(character, 'melee', maneuver === 'bash' ? 3 : 2).events);
  } else {
    events.push(`You fail to land your ${maneuver}.`);
    shiftAdvantage(character, -1);
  }

  reduceBalance(character, maneuver === 'bash' ? 2 : 1);
  events.push(`Position: ${formatAdvantage(character.combat.advantage)}.`);
  events.push(`Balance: ${formatBalance(character.balance)}.`);

  if (character.combat.targetHp <= 0) {
    events.push(`${character.combat.targetName} collapses.`);
    character.inventory.push(`${character.combat.targetName} fang`);
    events.push(...applySkillPoolGain(character, 'survival', 2).events);
    clearCombat(character);
    setActionCooldown(character, 700);
    return true;
  }

  applyMeleeRetaliation(character, template, now, events);
  return true;
}

function ensureCharacterShape(character: CharacterRecord): { character: CharacterRecord; changed: boolean } {
  let changed = false;
  if (!Array.isArray(character.worn)) {
    character.worn = [];
    changed = true;
  }
  if (!character.equipment || typeof character.equipment !== 'object') {
    character.equipment = {};
    changed = true;
  }
  if (normalizeAmmoPouch(character)) {
    changed = true;
  }
  if (normalizeLoadedAmmo(character)) {
    changed = true;
  }
  if (normalizeRecoverableAmmo(character)) {
    changed = true;
  }
  if (normalizeStoredRaceRollMetadata(character)) {
    changed = true;
  }
  for (const itemCode of character.worn) {
    if (Object.values(character.equipment).includes(itemCode)) continue;
    const room = worldRooms[character.roomId] ?? worldRooms['crossing-TG01-001'];
    const slot = resolveItemDetail(itemCode, room, character).slot;
    if (slot && !character.equipment[slot]) {
      character.equipment[slot] = itemCode;
      changed = true;
    }
  }
  if (
    character.health &&
    typeof character.health.current === 'number' &&
    typeof character.health.max === 'number' &&
    character.raceDisplayName &&
    character.role &&
    character.roleTitle &&
    character.stats &&
    character.wallet &&
    character.guildId &&
    character.guildName &&
    typeof character.circle === 'number' &&
    character.skills &&
    character.stance &&
    typeof character.balance === 'number' &&
    character.rollTrace &&
    typeof character.rollProfileVersion === 'number' &&
    character.createdAt
  ) {
    const wallet = normalizeWallet(character.wallet);
    if (wallet.changed) {
      character.wallet = wallet.wallet;
      changed = true;
    }
    if (ensureProgressionShape(character)) {
      changed = true;
    }
    const stance = normalizeStance(character.stance);
    const balance = normalizeBalance(character.balance);
    if (ensureCombatShape(character)) {
      changed = true;
    }
    if (character.stance !== stance || character.balance !== balance) {
      character.stance = stance;
      character.balance = balance;
      changed = true;
    }
    return { character, changed };
  }

  const raceName = isValidRace(character.race) ? resolveRace(character.race).name : 'Human';
  const roll = rollCharacterForRace(raceName);
  applyRollToCharacter(character, roll);
  if (!character.health) {
    character.health = calculateHealth(roll.finalStats);
  }
  const normalizedWallet = normalizeWallet(character.wallet);
  if (normalizedWallet.changed) {
    character.wallet = normalizedWallet.wallet;
    changed = true;
  }
  character.createdAt = character.createdAt || new Date().toISOString();
  ensureProgressionShape(character);
  character.stance = normalizeStance(character.stance);
  character.balance = normalizeBalance(character.balance ?? 3);
  ensureCombatShape(character);
  changed = true;
  return { character, changed };
}

async function createRolledCharacter(accountId: string, name: string, raceInput: string, statMode: StatGenerationMode = 'modern_fixed'): Promise<CharacterRecord> {
  const template = resolveRace(raceInput);
  const roll = rollCharacterForRace(template.name, statMode);
  return {
    id: `char-${randomUUID()}`,
    accountId,
    name,
    race: template.name.toLowerCase(),
    raceDisplayName: template.name,
    role: roll.role,
    roleTitle: roll.roleTitle,
    guildId: 'commoner',
    guildName: 'Unaffiliated',
    circle: 1,
    skills: buildStarterSkills(),
    roomId: 'crossing-TG01-001' as RoomId,
    stats: roll.finalStats,
    health: calculateHealth(roll.finalStats),
    wallet: { ...STARTING_WALLET },
    rollTrace: roll.trace,
    rollProfileVersion: roll.rollProfileVersion,
    statGenerationMode: roll.statGenerationMode,
    createdAt: new Date().toISOString(),
    inventory: ['leather backpack', 'repair cloth'],
    ammoPouch: {},
    loadedAmmo: {},
    recoverableAmmo: {},
    worn: [],
    equipment: {},
    hands: { left: null, right: 'training sword' },
    actionCooldownUntil: undefined,
    combat: undefined,
    stance: 'balanced',
    balance: 3,
    roundtimeMs: 0,
  };
}

async function issueTokens(account: AccountRecord, character?: CharacterRecord): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}> {
  const tokenId = randomUUID();
  const accessPayload = {
    sub: account.id,
    tid: tokenId,
    characterId: character?.id,
  };
  const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = randomUUID();
  const session: LoginSession = {
    refreshToken,
    accountId: account.id,
    tokenId,
    expiresAt: Date.now() + REFRESH_TTL_MS,
    characterId: character?.id,
  };
  await storage.saveRefreshSession(session);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL,
  };
}

function authRequired(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenClaims;
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function emitToCharacter(characterId: string, event: object) {
  const sockets = socketsByCharacter.get(characterId);
  if (!sockets) return;
  const text = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(text);
    }
  }
}

function setActionCooldown(character: CharacterRecord, ms: number) {
  const normalized = Math.max(0, Math.min(2000, Math.round(ms)));
  const now = Date.now();
  character.actionCooldownUntil = now + normalized;
  character.roundtimeMs = normalized;
  if (normalized <= 0) {
    character.actionCooldownUntil = undefined;
    character.roundtimeMs = 0;
  }
}

function clearCombat(character: CharacterRecord) {
  character.combat = undefined;
}

function updateRoundtimeFromCooldown(character: CharacterRecord) {
  if (!character.actionCooldownUntil) {
    character.roundtimeMs = 0;
    return;
  }
  const remaining = character.actionCooldownUntil - Date.now();
  if (remaining <= 0) {
    character.actionCooldownUntil = undefined;
    character.roundtimeMs = 0;
    return;
  }
  character.roundtimeMs = remaining;
}

function canActNow(character: CharacterRecord) {
  updateRoundtimeFromCooldown(character);
  return character.roundtimeMs <= 0;
}

function getRoomEnemies(roomId: RoomId): EnemyTemplate[] {
  return ENEMY_TEMPLATES.filter((entry) => entry.roomId === roomId);
}

function buildRoomTargets(roomId: RoomId): RoomTarget[] {
  return getRoomEnemies(roomId).map((enemy) => ({
    id: enemy.id,
    name: enemy.name,
    vitality: enemy.maxHp,
    aggression: enemy.aggression,
  }));
}

function findRoomEnemyByName(roomId: RoomId, requestedTarget: string): EnemyTemplate | undefined {
  const normalizedTarget = requestedTarget.toLowerCase().trim();
  return getRoomEnemies(roomId).find((enemy) => enemy.name.toLowerCase() === normalizedTarget);
}

function buildCommandResult(character: CharacterRecord, room: Room, events: string[]): CommandResult {
  return {
    character: sanitizeCharacter(character),
    room,
    events,
    targets: buildRoomTargets(character.roomId),
    itemDetails: buildItemDetails(character, room),
  };
}

function findShopItem(code: string) {
  const lowered = code.toLowerCase();
  for (const room of Object.values(worldRooms)) {
    const item = room.shop?.items.find((entry) => entry.code.toLowerCase() === lowered || entry.name.toLowerCase() === lowered);
    if (item) return item;
  }
  return undefined;
}

function buildEnemyScanEvents(roomId: RoomId): string[] {
  const enemies = getRoomEnemies(roomId);
  if (!enemies.length) {
    return ['You scan the area and find no immediate targets.'];
  }

  return [
    'You scan the area and notice:',
    'Vitality estimates how long a target can stay in the fight; aggression estimates how quickly it presses or attacks.',
    ...enemies.map((enemy) => ` - ${enemy.name} (${enemy.maxHp} vitality, aggression ${enemy.aggression})`),
  ];
}

function buildTargetDetailEvents(character: CharacterRecord, requestedTarget: string): string[] {
  const combat = character.combat;
  const targetName = requestedTarget || combat?.targetName || '';
  const template = targetName ? findRoomEnemyByName(character.roomId, targetName) : undefined;

  if (!template) {
    if (targetName) {
      return [`You do not see ${targetName} here. Use scan to list immediate targets.`];
    }
    return ['Target what? Use target <name> or appraise <target>.'];
  }

  const isEngagedTarget = combat?.targetId === template.id;
  const range = isEngagedTarget ? formatRange(normalizeRange(combat.range)) : 'not yet engaged';
  const vitality = isEngagedTarget ? `${combat.targetHp}/${combat.targetMaxHp}` : `${template.maxHp} baseline`;
  const suggestedVerb = isEngagedTarget
    ? normalizeRange(combat.range) === 'melee'
      ? `attack ${template.name}`
      : 'advance'
    : `advance ${template.name}`;

  return [
    `Target: ${template.name}`,
    `Vitality: ${vitality}.`,
    `Aggression: ${template.aggression}.`,
    `Range: ${range}.`,
    `Suggested next verb: ${suggestedVerb}.`,
  ];
}

function buildVerbEvents(): string[] {
  return [
    'Verb groups:',
    'Info: help, help scan, verb, look, survey, search, exits, score, skills, inventory, ammo, balance, range, combat.',
    'Movement: north, south, east, west, n, s, e, w, go <direction>, enter, exit, up, down, ne, nw, se, sw.',
    'Targets: scan, target, target <name>, appraise <target>.',
    'Items: inventory, appraise <item>, shop, shop buy <code>, shop sell <code>.',
    'Equipment: ammo, reload, recover arrows, hold <item> [left|right], wield <item> [left|right], stow <item|left|right>, wear <item>, remove <item>.',
    'Survival: forage, inventory, train survival.',
    'Combat: stance, stance balanced, stance offensive, stance defensive, stance evasive, advance <target>, retreat, attack <target>, reload, fire, shoot, recover arrows, circle, jab, bash, defend, flee, wait <ms>, rest.',
    'Progression: train, train <skill>, circle, join guild.',
    'Shops: shop, shop buy <code>, shop sell <code>.',
  ];
}

function buildSurveyEvents(room: Room): string[] {
  const events = [`Surveying ${room.title}:`];
  events.push(`Exits: ${room.exits.map((exit) => exit.direction).join(', ') || 'none'}.`);

  if (room.forage?.items.length) {
    events.push(`Forage: difficulty ${room.forage.difficulty}; possible finds ${room.forage.items.map((item) => item.name).join(', ')}.`);
  } else {
    events.push('Forage: nothing obvious.');
  }

  if (room.shop) {
    events.push(`Shop: ${room.shop.name} (${room.shop.items.length} catalog item(s)).`);
  } else {
    events.push('Shop: none visible.');
  }

  events.push(buildGuildRegistrarDisplay(room).event);

  const enemies = getRoomEnemies(room.id);
  if (enemies.length) {
    events.push(`Targets: ${enemies.map((enemy) => enemy.name).join(', ')}.`);
  } else {
    events.push('Targets: none immediate.');
  }

  return events;
}

function buildCharacterCombat(character: CharacterRecord, requestedTarget?: string): CharacterCombatSnapshot | null {
  const enemies = getRoomEnemies(character.roomId);
  if (!enemies.length) return null;

  const target = requestedTarget ? findRoomEnemyByName(character.roomId, requestedTarget) : enemies[0];
  if (!target) return null;

  const maxHp = target.maxHp + randomInt(0, 4);
  return {
    targetId: target.id,
    targetName: target.name,
    targetHp: maxHp,
    targetMaxHp: maxHp,
    defendUntil: 0,
    nextAttackAt: 0,
    range: 'missile',
    advantage: 0,
  };
}

function findPathToRoom(startRoomId: RoomId, destinationRoomId: RoomId): string[] {
  if (startRoomId === destinationRoomId) return [];

  const startRoom = worldRooms[startRoomId];
  const destinationRoom = worldRooms[destinationRoomId];
  if (!startRoom || !destinationRoom) return [];

  const queue: RoomId[] = [startRoom.id];
  const predecessor = new Map<RoomId, { from: RoomId; command: string }>();
  const visited = new Set<RoomId>([startRoom.id]);

  while (queue.length > 0) {
    const roomId = queue.shift()!;
    const room = worldRooms[roomId];
    if (!room) continue;

    for (const exit of room.exits) {
      if (visited.has(exit.destination)) continue;
      visited.add(exit.destination);
      predecessor.set(exit.destination, { from: roomId, command: exit.direction });
      if (exit.destination === destinationRoomId) {
        const route: string[] = [];
        let cursor: RoomId | undefined = destinationRoomId;
        while (cursor && cursor !== startRoom.id) {
          const step = predecessor.get(cursor);
          if (!step) break;
          route.unshift(step.command);
          cursor = step.from;
        }
        return route;
      }
      queue.push(exit.destination);
    }
  }

  return [];
}

function buildCombatEvents(character: CharacterRecord): string[] {
  if (!character.combat) {
    const equipment = buildEquipmentSummary(character);
    return [
      'You are not in combat.',
      `Stance: ${STANCE_PROFILES[character.stance].label}. Balance: ${formatBalance(character.balance)}.`,
      `Equipment: ${formatEquipmentModifiers(equipment)}.`,
      `Weapon: ${findHeldWeapon(character)?.name ?? 'unarmed'} (${findHeldWeapon(character)?.weaponRange ?? 'melee'}).`,
    ];
  }
  const equipment = buildEquipmentSummary(character);
  return [
    `Combat target: ${character.combat.targetName}`,
    `Target HP: ${character.combat.targetHp}/${character.combat.targetMaxHp}`,
    `Range: ${formatRange(normalizeRange(character.combat.range))}`,
    `Position: ${formatAdvantage(character.combat.advantage)}`,
    `Stance: ${STANCE_PROFILES[character.stance].label}. Balance: ${formatBalance(character.balance)}.`,
    `Equipment: armor ${equipment.totalArmor}, evasion penalty ${equipment.totalEvasionPenalty}, attack modifier ${equipment.totalAttackModifier}.`,
    `Weapon: ${findHeldWeapon(character)?.name ?? 'unarmed'} (${findHeldWeapon(character)?.weaponRange ?? 'melee'}).`,
    `Ready in: ${Math.max(0, character.roundtimeMs)}ms`,
  ];
}

function evaluateToHit(stat: number, bonus: number) {
  const roll = randomInt(1, 101);
  const threshold = Math.max(10, Math.min(95, 45 + Math.floor(stat / 2) + bonus));
  return { hit: roll <= threshold, roll, threshold };
}

function resolveAttackDamage(stat: number, bonus: number, min: number, max: number) {
  const base = Math.max(0, Math.floor((stat + bonus) / 12));
  const variance = randomInt(min, max + 1);
  return Math.max(1, 1 + base + variance);
}

function parseScriptCommandLines(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry ?? '').trim())
      .filter((entry) => entry && !entry.startsWith('#'))
      .map((entry) => entry.replace(/\s+/g, ' ').trim());
  }
  const value = String(raw ?? '').trim();
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\s+/g, ' '));
}

function expandScriptCommands(rawCommands: string[]): string[] {
  const normalized = rawCommands
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/\s+/g, ' ').trim());

  const expandRange = (start: number): { commands: string[]; next: number } => {
    const output: string[] = [];
    for (let index = start; index < normalized.length; index += 1) {
      const line = normalized[index];
      const lowered = line.toLowerCase();

      if (lowered === 'end') {
        return { commands: output, next: index };
      }

      if (lowered.startsWith('repeat ')) {
        const rawCount = lowered.slice(7).trim();
        const parsedCount = Number(rawCount);
        const count = Number.isFinite(parsedCount) ? Math.max(1, Math.min(MAX_REPEAT_COUNT, Math.floor(parsedCount))) : 0;

        const body = expandRange(index + 1);
        if (count > 0 && body.commands.length) {
          for (let loop = 0; loop < count; loop += 1) {
            for (const entry of body.commands) {
              if (output.length >= MAX_SCRIPT_RUNTIME_STEPS) {
                return { commands: output, next: normalized.length };
              }
              output.push(entry);
            }
          }
        } else if (!body.commands.length) {
          output.push(line);
        }
        index = body.next;
        continue;
      }

      output.push(line);
      if (output.length >= MAX_SCRIPT_RUNTIME_STEPS) {
        return { commands: output, next: normalized.length };
      }
    }

    return { commands: output, next: normalized.length };
  };

  return expandRange(0).commands;
}

async function parseSleepCommand(command: string): Promise<number | null> {
  const normalized = command.toLowerCase().trim();
  if (!normalized.startsWith('wait ')) return null;
  const raw = normalized.slice(5).trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  const bounded = Math.min(5000, Math.max(0, Math.round(value)));
  return bounded;
}

function buildScriptRecord(accountId: string, name: string, commands: string[], description?: string): ScriptRecord {
  const now = new Date().toISOString();
  return {
    id: `script-${randomUUID()}`,
    accountId,
    name,
    description: description?.trim() || undefined,
    commands: commands.map((command) => command.trim()).filter((command) => Boolean(command)),
    createdAt: now,
    updatedAt: now,
  };
}

async function processCommand(characterId: string, rawCommand: string): Promise<CommandResult | null> {
  const character = await storage.getCharacter(characterId);
  if (!character) return null;
  const normalized = ensureCharacterShape(character);
  if (normalized.changed) {
    await storage.saveCharacter(character);
  }
  const resolvedCharacter = normalized.character;

  const command = rawCommand.toLowerCase().trim();
  const room = worldRooms[resolvedCharacter.roomId];
  if (!room) throw new Error(`Invalid room ${character.roomId}`);

  const events: string[] = [];
  let modified = false;
  const persist = async () => {
    if (modified) {
      await storage.saveCharacter(resolvedCharacter);
    }
  };
  const commandReady = canActNow(resolvedCharacter);
  const passiveCommand =
    command === 'help' ||
    command === 'help scan' ||
    command === 'help targets' ||
    command === 'verb' ||
    command === 'verbs' ||
    command === 'look' ||
    command === 'l' ||
    command === 'survey' ||
    command === 'search' ||
    command === 'scan' ||
    command === 'target' ||
    command.startsWith('target ') ||
    command.startsWith('appraise ') ||
    command === 'exits' ||
    command === 'inventory' ||
    command === 'inv' ||
    command === 'ammo' ||
    command === 'quiver' ||
    command === 'score' ||
    command === 'skills' ||
    (command === 'circle' && !resolvedCharacter.combat) ||
    command === 'balance' ||
    command === 'range' ||
    command === 'roll' ||
    command === 'shop' ||
    command === 'join guild' ||
    command === 'stance' ||
    command.startsWith('stance ');
  if (resolvedCharacter.health.current <= 0 && command !== 'rest') {
    events.push('You are incapacitated. Use rest to recover, or wait.');
    return buildCommandResult(resolvedCharacter, room, events);
  }

  const sleepMs = await parseSleepCommand(command);
  if (sleepMs !== null) {
    updateRoundtimeFromCooldown(resolvedCharacter);
    if (sleepMs > 0) {
      modified = true;
      recoverBalance(resolvedCharacter, Math.max(1, Math.floor(sleepMs / 450)));
      if (resolvedCharacter.actionCooldownUntil) {
        resolvedCharacter.actionCooldownUntil = Math.max(Date.now(), resolvedCharacter.actionCooldownUntil - sleepMs);
        updateRoundtimeFromCooldown(resolvedCharacter);
        events.push(`You wait for ${sleepMs}ms. Roundtime remaining: ${resolvedCharacter.roundtimeMs}ms. Balance: ${formatBalance(resolvedCharacter.balance)}.`);
      } else {
        events.push(`You wait for ${sleepMs}ms. Balance: ${formatBalance(resolvedCharacter.balance)}.`);
      }
      const template = findCombatTemplate(resolvedCharacter);
      if (template && applyEnemyPressure(resolvedCharacter, template, Date.now(), events)) {
        modified = true;
        if (resolvedCharacter.health.current <= 0) {
          clearCombat(resolvedCharacter);
          setActionCooldown(resolvedCharacter, 1500);
          events.push('You have fallen unconscious and can no longer act.');
        }
      }
    }
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (!commandReady && command !== 'combat' && !passiveCommand) {
    events.push(`You are still recovering from the last action (${Math.max(0, resolvedCharacter.roundtimeMs)}ms).`);
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (!command) {
    events.push('You need to enter a command.');
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'help scan' || command === 'help targets') {
    events.push(
      'Scan shows immediate room targets and their beginner combat metadata.',
      'Vitality estimates how long a target can stay in the fight; aggression estimates how quickly it presses or attacks.',
      'Use scan to list local targets, advance <target> to engage, range to check distance, and attack <target> once you are at melee range.',
    );
    events.push(`Your wallets: ${formatWallet(resolvedCharacter.wallet)}.`);
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'help') {
    events.push(
      'Commands: look, survey, search, scan, forage, help scan, verb, rest, inventory, ammo, reload, recover arrows, appraise <item|target>, hold <item>, wield <item>, stow <item>, wear <item>, remove <item>, score, skills, circle, join guild, train [skill], stance [balanced|offensive|defensive|evasive], balance, range, advance, retreat, jab, bash, exits, shop, shop buy <code>, shop sell <code>, combat, attack [target], fire, shoot, defend, flee, wait <ms>, go <direction>, <n/e/s/w>',
    );
    events.push(`Your wallets: ${formatWallet(resolvedCharacter.wallet)}.`);
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'verb' || command === 'verbs') {
    events.push(...buildVerbEvents());
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'survey' || command === 'search') {
    events.push(...buildSurveyEvents(room));
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'join guild') {
    const joinDecision = resolveGuildJoinDecision(room);
    events.push(...joinDecision.events);
    if (!joinDecision.joined) {
      return buildCommandResult(resolvedCharacter, room, events);
    }
    resolvedCharacter.guildId = joinDecision.guildId;
    resolvedCharacter.guildName = joinDecision.guildName;
    modified = true;
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'skills') {
    events.push(...buildSkillSummaryEvents(resolvedCharacter));
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'circle') {
    if (resolvedCharacter.combat) {
      if (normalizeRange(resolvedCharacter.combat.range) === 'missile') {
        events.push('You are too far away to circle your target.');
        return buildCommandResult(resolvedCharacter, room, events);
      }
      shiftAdvantage(resolvedCharacter, 1);
      recoverBalance(resolvedCharacter, 1);
      events.push(...applySkillPoolGain(resolvedCharacter, 'tactics', 2).events);
      setActionCooldown(resolvedCharacter, 500);
      modified = true;
      events.push(`You circle for a better angle. Position: ${formatAdvantage(resolvedCharacter.combat.advantage)}.`);
      events.push(`Balance: ${formatBalance(resolvedCharacter.balance)}.`);
      const template = findCombatTemplate(resolvedCharacter);
      if (template) {
        applyEnemyPressure(resolvedCharacter, template, Date.now(), events);
      }
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    const circleRequest = resolveCircleAdvancementRequest(resolvedCharacter, guilds);
    if (!circleRequest.allowed) {
      events.push(...circleRequest.events);
      return buildCommandResult(resolvedCharacter, room, events);
    }
    events.push(...buildCircleStatus(resolvedCharacter));
    const advancement = resolveCircleAdvancement(resolvedCharacter);
    if (advancement.advanced) {
      resolvedCharacter.circle = advancement.circle;
      resolvedCharacter.health = calculateHealth(resolvedCharacter.stats);
      modified = true;
      events.push(...advancement.events);
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'jab' || command === 'bash') {
    if (!resolvedCharacter.combat) {
      events.push('You are not currently in combat.');
      return buildCommandResult(resolvedCharacter, room, events);
    }
    const template = findCombatTemplate(resolvedCharacter);
    if (!template) {
      clearCombat(resolvedCharacter);
      modified = true;
      events.push('Your target vanished from the world.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    resolvePlayerManeuver(resolvedCharacter, template, command, Date.now(), events);
    if (resolvedCharacter.health.current <= 0) {
      clearCombat(resolvedCharacter);
      setActionCooldown(resolvedCharacter, 1500);
      events.push('You have fallen unconscious and can no longer act.');
    } else if (resolvedCharacter.combat) {
      setActionCooldown(resolvedCharacter, command === 'bash' ? 900 : 550);
    }
    modified = true;
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'stance' || command.startsWith('stance ')) {
    const requestedStance = command.startsWith('stance ') ? command.slice(7).trim() : '';
    if (!requestedStance) {
      events.push(`Current stance: ${STANCE_PROFILES[resolvedCharacter.stance].label}.`);
      events.push('Available stances: balanced, offensive, defensive, evasive.');
      return buildCommandResult(resolvedCharacter, room, events);
    }
    if (!(requestedStance in STANCE_PROFILES)) {
      events.push(`Unknown stance: ${requestedStance}.`);
      events.push('Available stances: balanced, offensive, defensive, evasive.');
      return buildCommandResult(resolvedCharacter, room, events);
    }
    resolvedCharacter.stance = requestedStance as StanceName;
    recoverBalance(resolvedCharacter, requestedStance === 'balanced' ? 1 : 0);
    modified = true;
    events.push(`You settle into ${STANCE_PROFILES[resolvedCharacter.stance].label}.`);
    events.push(`Balance: ${formatBalance(resolvedCharacter.balance)}.`);
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'balance') {
    events.push(`You are ${formatBalance(resolvedCharacter.balance)} in ${STANCE_PROFILES[resolvedCharacter.stance].label}.`);
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'range') {
    if (!resolvedCharacter.combat) {
      events.push('You are not engaged with a target.');
    } else {
      events.push(`You are at ${formatRange(normalizeRange(resolvedCharacter.combat.range))} from ${resolvedCharacter.combat.targetName}.`);
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'ammo' || command === 'quiver') {
    events.push(...buildAmmoStatusEvents(resolvedCharacter, room));
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'recover arrows' || command === 'recover ammo' || command === 'collect arrows') {
    if (resolvedCharacter.combat) {
      events.push('You are too engaged to recover ammunition safely.');
      return buildCommandResult(resolvedCharacter, room, events);
    }
    const result = recoverAmmunition(resolvedCharacter);
    events.push(...result.events);
    if (!result.success) return buildCommandResult(resolvedCharacter, room, events);
    events.push(...applySkillPoolGain(resolvedCharacter, 'survival', 1).events);
    setActionCooldown(resolvedCharacter, 400);
    modified = true;
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'reload') {
    const result = reloadRangedWeapon(resolvedCharacter, room);
    events.push(...result.events);
    if (result.success) {
      setActionCooldown(resolvedCharacter, 350);
      modified = true;
    }
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'target' || command.startsWith('target ') || command.startsWith('appraise ')) {
    const requestedTarget = command.startsWith('target ')
      ? command.slice(7).trim()
      : command.startsWith('appraise ')
        ? command.slice(9).trim()
        : '';
    if (command.startsWith('appraise ')) {
      const itemEvents = buildItemDetailEvents(resolvedCharacter, room, requestedTarget);
      if (!itemEvents[0]?.startsWith('You cannot find an item')) {
        events.push(...itemEvents);
      } else {
        events.push(...buildTargetDetailEvents(resolvedCharacter, requestedTarget));
      }
    } else {
      events.push(...buildTargetDetailEvents(resolvedCharacter, requestedTarget));
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'train' || command.startsWith('train ')) {
    const requestedSkill = command.startsWith('train ') ? command.slice(6).trim().replace(/\s+/g, '_') : '';
    if (trainCharacter(resolvedCharacter, room, requestedSkill, events)) {
      setActionCooldown(resolvedCharacter, 900);
      modified = true;
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'combat') {
    events.push(...buildCombatEvents(resolvedCharacter));
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'defend') {
    if (!resolvedCharacter.combat) {
      events.push('You are not currently in combat.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    resolvedCharacter.combat.defendUntil = Date.now() + 1200;
    recoverBalance(resolvedCharacter, resolvedCharacter.stance === 'defensive' || resolvedCharacter.stance === 'evasive' ? 2 : 1);
    setActionCooldown(resolvedCharacter, 300);
    modified = true;
    events.push(`You guard and recover your footing. Balance: ${formatBalance(resolvedCharacter.balance)}.`);
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'advance' || command.startsWith('advance ')) {
    const requestedTarget = command.startsWith('advance ') ? command.slice(8).trim() : '';
    if (!resolvedCharacter.combat) {
      const combat = buildCharacterCombat(resolvedCharacter, requestedTarget);
      if (!combat) {
        events.push('There are no immediate targets in this location.');
        await persist();
        return buildCommandResult(resolvedCharacter, room, events);
      }
      resolvedCharacter.combat = combat;
      events.push(`You begin advancing on ${combat.targetName}.`);
    }

    const combat = resolvedCharacter.combat;
    const currentRange = normalizeRange(combat.range);
    const nextRange = shiftCombatRange(currentRange, 'advance');
    if (nextRange === currentRange) {
      events.push(`You are already at ${formatRange(currentRange)}.`);
    } else {
      combat.range = nextRange;
      reduceBalance(resolvedCharacter, 1);
      events.push(...applySkillPoolGain(resolvedCharacter, 'tactics', 1).events);
      events.push(`You advance to ${formatRange(nextRange)}.`);
      events.push(`Balance: ${formatBalance(resolvedCharacter.balance)}.`);
    }
    const template = findCombatTemplate(resolvedCharacter);
    if (template) {
      applyEnemyPressure(resolvedCharacter, template, Date.now(), events);
      if (resolvedCharacter.health.current <= 0) {
        clearCombat(resolvedCharacter);
        setActionCooldown(resolvedCharacter, 1500);
        events.push('You have fallen unconscious and can no longer act.');
      }
    }
    if (resolvedCharacter.health.current > 0) {
      setActionCooldown(resolvedCharacter, 500);
    }
    modified = true;
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'retreat') {
    if (!resolvedCharacter.combat) {
      events.push('You are not currently in combat.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    const currentRange = normalizeRange(resolvedCharacter.combat.range);
    const nextRange = shiftCombatRange(currentRange, 'retreat');
    if (nextRange === currentRange) {
      events.push(`You are already out at ${formatRange(currentRange)}.`);
    } else {
      resolvedCharacter.combat.range = nextRange;
      recoverBalance(resolvedCharacter, 1);
      events.push(...applySkillPoolGain(resolvedCharacter, 'evasion', 1).events);
      events.push(`You retreat to ${formatRange(nextRange)}.`);
      events.push(`Balance: ${formatBalance(resolvedCharacter.balance)}.`);
    }
    const template = findCombatTemplate(resolvedCharacter);
    if (template) {
      applyEnemyPressure(resolvedCharacter, template, Date.now(), events);
      if (resolvedCharacter.health.current <= 0) {
        clearCombat(resolvedCharacter);
        setActionCooldown(resolvedCharacter, 1500);
        events.push('You have fallen unconscious and can no longer act.');
      }
    }
    if (resolvedCharacter.health.current > 0) {
      setActionCooldown(resolvedCharacter, 500);
    }
    modified = true;
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'flee') {
    if (!resolvedCharacter.combat) {
      events.push('You are not currently in combat.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    clearCombat(resolvedCharacter);
    setActionCooldown(resolvedCharacter, 800);
    modified = true;
    events.push('You break line and flee from combat.');
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('attack') || command.startsWith('fire') || command.startsWith('shoot')) {
    const rangedAlias = command.startsWith('fire') || command.startsWith('shoot');
    const requestedTarget = command.startsWith('attack ')
      ? command.slice(7).trim()
      : command.startsWith('fire ')
        ? command.slice(5).trim()
        : command.startsWith('shoot ')
          ? command.slice(6).trim()
          : '';
    if (!resolvedCharacter.combat) {
      const combat = buildCharacterCombat(resolvedCharacter, requestedTarget);
      if (!combat) {
        events.push('There are no immediate targets in this location.');
        await persist();
        return buildCommandResult(resolvedCharacter, room, events);
      }
      resolvedCharacter.combat = combat;
      modified = true;
      events.push(`You engage ${combat.targetName}.`);
    }

    if (!resolvedCharacter.combat) {
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const equipment = buildEquipmentSummary(resolvedCharacter, room);
    const weapon = findHeldWeapon(resolvedCharacter, room);
    if (rangedAlias && weapon?.weaponRange !== 'ranged') {
      events.push(...prepareRangedFire(resolvedCharacter, weapon).events);
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    events.push(...buildAttackOpeningEvents(weapon));

    const attackRange = normalizeRange(resolvedCharacter.combat.range);
    const rangeValidation = validateAttackRange(weapon, attackRange);
    if (!rangeValidation.success) {
      events.push(...rangeValidation.events);
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const now = Date.now();
    const attackCycle = resolveAttackCycleStatus(resolvedCharacter.combat.nextAttackAt, now);
    if (!attackCycle.ready) {
      setActionCooldown(resolvedCharacter, attackCycle.remainingMs);
      events.push(...attackCycle.events);
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    let consumedAmmo: string | undefined;
    if (weapon?.weaponRange === 'ranged') {
      const readiness = prepareRangedFire(resolvedCharacter, weapon);
      events.push(...readiness.events);
      if (!readiness.success) {
        await persist();
        return buildCommandResult(resolvedCharacter, room, events);
      }
      consumedAmmo = readiness.consumedAmmo;
      modified = true;
    }

    const template = ENEMY_TEMPLATES.find((entry) => entry.id === resolvedCharacter.combat?.targetId);
    if (!template) {
      clearCombat(resolvedCharacter);
      modified = true;
      events.push(...buildTargetVanishedEvents());
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const target = resolvedCharacter.combat;
    const stanceProfile = STANCE_PROFILES[resolvedCharacter.stance];
    const balanceBonus = (resolvedCharacter.balance - 2) * 5;
    const advantageBonus = normalizeAdvantage(resolvedCharacter.combat.advantage) * 7;
    const playerAttack = evaluateToHit(
      resolvedCharacter.stats.strength + resolvedCharacter.stats.agility + resolvedCharacter.stats.reflex,
      (requestedTarget ? -2 : 0) + stanceProfile.attack + balanceBonus + advantageBonus + equipment.totalAttackModifier * 3,
    );
    if (weapon?.weaponRange === 'ranged' && consumedAmmo) {
      const recovery = resolveRangedAmmoRecovery(
        resolvedCharacter,
        consumedAmmo,
        weapon.ammoName ?? consumedAmmo,
        playerAttack.roll + playerAttack.threshold + resolvedCharacter.balance,
      );
      events.push(...recovery.events);
      modified = true;
    }

    const damage = playerAttack.hit
      ? resolveAttackDamage(
        resolvedCharacter.stats.strength,
        resolvedCharacter.stats.discipline + stanceProfile.damage + equipment.totalAttackModifier,
        template.damageMin,
        template.damageMax,
      )
      : 0;
    const attackOutcome = resolveAttackOutcome(target.targetName, target.targetHp, damage, playerAttack);
    target.targetHp = attackOutcome.targetHp;
    shiftAdvantage(resolvedCharacter, attackOutcome.advantageShift);
    modified = true;
    events.push(...attackOutcome.events);
    if (attackOutcome.collapsed) {
        resolvedCharacter.inventory.push(`${target.targetName} fang`);
        events.push(...applySkillPoolGain(resolvedCharacter, weapon?.trainingSkill ?? 'melee', 4).events);
        events.push(...applySkillPoolGain(resolvedCharacter, 'survival', 2).events);
        clearCombat(resolvedCharacter);
        setActionCooldown(resolvedCharacter, 700);
        await persist();
        return buildCommandResult(resolvedCharacter, room, events);
    }
    reduceBalance(resolvedCharacter, stanceProfile.cost);
    events.push(...buildPostAttackStatusEvents(resolvedCharacter.combat.advantage, resolvedCharacter.balance));

    applyMeleeRetaliation(resolvedCharacter, template, now, events);
    if (resolvedCharacter.health.current <= 0) {
      clearCombat(resolvedCharacter);
      setActionCooldown(resolvedCharacter, 1500);
      modified = true;
      events.push('You have fallen unconscious and can no longer act.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    modified = true;
    setActionCooldown(resolvedCharacter, resolveAttackCooldownMs(template.aggression));
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'look' || command === 'l') {
    events.push(room.description);
    events.push(...room.prompts);
    if (room.forage?.items.length) {
      events.push(`Forageable: difficulty ${room.forage.difficulty}; try forage to search for ${room.forage.items.map((item) => item.name).join(', ')}.`);
    }
    const enemies = getRoomEnemies(room.id);
    if (enemies.length) {
      events.push(...buildEnemyScanEvents(room.id));
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'scan') {
    events.push(...buildEnemyScanEvents(room.id));
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'forage') {
    if (forageRoom(resolvedCharacter, room, events)) {
      setActionCooldown(resolvedCharacter, 750);
      modified = true;
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'rest') {
    if (resolvedCharacter.health.current >= resolvedCharacter.health.max) {
      events.push(`You are fully rested at ${resolvedCharacter.health.current}/${resolvedCharacter.health.max}.`);
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    const regained = Math.max(1, Math.ceil(resolvedCharacter.health.max / 6));
    const previousHealth = resolvedCharacter.health.current;
    resolvedCharacter.health.current = Math.min(resolvedCharacter.health.max, resolvedCharacter.health.current + regained);
    events.push(...applySkillPoolGain(resolvedCharacter, 'first_aid', 1).events);
    setActionCooldown(resolvedCharacter, 1500);
    modified = true;
    const actualGain = resolvedCharacter.health.current - previousHealth;
    events.push(`You settle and recover ${actualGain} health (${resolvedCharacter.health.current}/${resolvedCharacter.health.max}).`);
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'exits') {
    events.push(room.exits.map((exit) => `${exit.direction}: ${exit.destination}`).join(' | ') || 'No exits listed.');
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'inventory' || command === 'inv') {
    const equipment = buildEquipmentSummary(resolvedCharacter, room);
    events.push(
      ...buildInventoryEquipmentEvents(
        resolvedCharacter,
        equipment,
        formatAmmoPouch(resolvedCharacter),
        formatLoadedAmmo(resolvedCharacter),
        formatRecoverableAmmo(resolvedCharacter),
      ),
    );
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('hold ') || command.startsWith('wield ')) {
    const wielding = command.startsWith('wield ');
    const heldRequest = parseHeldItemRequest(command.slice(wielding ? 6 : 5));
    if (wielding) {
      const item = findItemDetailForRequest(resolvedCharacter, room, heldRequest.requestedItem);
      if (!item || !canWieldItem(item)) {
        events.push(`You cannot wield "${heldRequest.requestedItem}" as a weapon.`);
        return buildCommandResult(resolvedCharacter, room, events);
      }
    }
    const result = holdInventoryItem(resolvedCharacter, room, heldRequest.requestedItem, heldRequest.requestedSlot);
    events.push(...result.events);
    if (result.success) {
      modified = true;
      setActionCooldown(resolvedCharacter, 300);
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('stow ')) {
    const result = stowHeldItem(resolvedCharacter, room, command.slice(5).trim());
    events.push(...result.events);
    if (result.success) {
      modified = true;
      setActionCooldown(resolvedCharacter, 300);
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('wear ')) {
    const result = wearCarriedItem(resolvedCharacter, room, command.slice(5).trim());
    events.push(...result.events);
    if (result.success) {
      modified = true;
      setActionCooldown(resolvedCharacter, 350);
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('remove ')) {
    const result = removeWornInventoryItem(resolvedCharacter, room, command.slice(7).trim());
    events.push(...result.events);
    if (result.success) {
      modified = true;
      setActionCooldown(resolvedCharacter, 350);
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'score') {
    events.push(
      ...buildScoreSummaryEvents(resolvedCharacter, {
        wallet: formatWallet(resolvedCharacter.wallet),
        stanceLabel: STANCE_PROFILES[resolvedCharacter.stance].label,
        balanceLabel: formatBalance(resolvedCharacter.balance),
      }),
    );
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('roll')) {
    events.push(...buildRollProfileEvents(resolvedCharacter));
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'shop') {
    events.push(...listShopItems(room.shop));
    events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('shop buy ')) {
    const code = command.slice(9).trim();
    const decision = resolveShopBuyDecision(room.shop, code, resolvedCharacter.wallet, (item) => {
      const itemDetail = resolveItemDetail(item.code, room, resolvedCharacter);
      return { category: itemDetail.category, bundleSize: itemDetail.bundleSize };
    });
    if (!decision.allowed) {
      events.push(...decision.events);
    } else {
        spendFunds(resolvedCharacter.wallet, decision.item.currency, decision.item.price);
        if (decision.purchase.delivery === 'ammoPouch') {
          addAmmo(resolvedCharacter, decision.item.code, decision.purchase.quantity);
      } else {
          resolvedCharacter.inventory.push(decision.item.code);
        }
        events.push(...applySkillPoolGain(resolvedCharacter, 'trading', 1).events);
        modified = true;
        setActionCooldown(resolvedCharacter, 450);
        events.push(...decision.events);
        events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
    }
    if (modified) {
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('shop sell ')) {
    const code = command.slice(10).trim();
    const decision = resolveShopSellDecision(
      room.shop,
      code,
      resolvedCharacter.inventory,
      (itemCode) => resolveItemDetail(itemCode, room, resolvedCharacter),
      (itemCode) => countAmmo(resolvedCharacter, itemCode),
    );
    if (!decision.allowed) {
      events.push(...decision.events);
    } else if (decision.source === 'ammoPouch') {
        consumeAmmo(resolvedCharacter, decision.itemCode);
        earnFunds(resolvedCharacter.wallet, decision.catalogItem.currency, decision.sellPrice);
        events.push(...applySkillPoolGain(resolvedCharacter, 'trading', 1).events);
        modified = true;
        setActionCooldown(resolvedCharacter, 450);
        events.push(...decision.events);
        events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
    } else {
        resolvedCharacter.inventory.splice(decision.inventoryIndex, 1);
        if (resolvedCharacter.hands.left === decision.itemCode) {
          resolvedCharacter.hands.left = null;
        }
        if (resolvedCharacter.hands.right === decision.itemCode) {
          resolvedCharacter.hands.right = null;
        }
        earnFunds(resolvedCharacter.wallet, decision.catalogItem.currency, decision.sellPrice);
        events.push(...applySkillPoolGain(resolvedCharacter, 'trading', 1).events);
        modified = true;
        setActionCooldown(resolvedCharacter, 450);
        events.push(...decision.events);
        events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
    }
    if (modified) {
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  const movement = resolveMovementDecision(command, room);
  if (movement.moved) {
      resolvedCharacter.roomId = movement.nextRoom.id;
      events.push(...applySkillPoolGain(resolvedCharacter, 'athletics', 1).events);
      setActionCooldown(resolvedCharacter, 350);
      modified = true;
      events.push(...movement.events);
      if (modified) {
        await storage.saveCharacter(resolvedCharacter);
      }
      return buildCommandResult(resolvedCharacter, movement.nextRoom, events);
  } else {
    events.push(...movement.events);
  }

  return buildCommandResult(resolvedCharacter, room, events);
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'cleanroom-dragonrealms-server' });
});

app.get('/v1/races', (_req: Request, res: Response) => {
  res.json({
    races: getAllRaces().map((race) => ({
      id: race.id,
      name: race.name,
      description: race.description,
      fixedStartingStats: race.fixedStartingStats,
    })),
  });
});

app.get('/v1/scripts/presets', (_req: Request, res: Response) => {
  res.json({
    presets: SCRIPT_PRESETS,
  });
});

app.get('/v1/world/guilds', (_req: Request, res: Response) => {
  res.json({ guilds });
});

app.get('/v1/world/shops', (_req: Request, res: Response) => {
  const roomsWithShops = Object.values(worldRooms)
    .filter((room) => room.shop)
    .map((room) => ({ roomId: room.id, title: room.title, shop: room.shop }));
  res.json({ shops: roomsWithShops });
});

app.get('/v1/world/rooms', (_req: Request, res: Response) => {
  const town = String(_req.query.town || '').toLowerCase();
  const rooms = Object.values(worldRooms).filter((room) => (town ? room.code.town === town : true));
  res.json({ rooms });
});

app.get('/v1/world/path', (_req: Request, res: Response) => {
  const from = String(_req.query.from || '').trim() as RoomId;
  const to = String(_req.query.to || '').trim() as RoomId;
  if (!from || !to) {
    return res.status(400).json({ error: 'Both from/to room IDs are required.' });
  }
  if (!worldRooms[from] || !worldRooms[to]) {
    return res.status(404).json({ error: 'Unknown room id in path request.' });
  }
  const path = findPathToRoom(from, to);
  if (!path.length && from !== to) {
    return res.status(404).json({ error: `No path found from ${from} to ${to}.` });
  }
  return res.json({ from, to, path, distance: path.length });
});

app.post('/v1/auth/register', async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? '').trim();

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and 8+ char password required.' });
  }

  const existing = await storage.getAccountByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Account already exists.' });
  }

  const account: AccountRecord = {
    id: `acct-${randomUUID()}`,
    email,
    passwordHash: await argon2.hash(password),
    createdAt: new Date().toISOString(),
  };

  await storage.saveAccount(account);

  return res.status(201).json({
    id: account.id,
    email: account.email,
    displayName: displayName || undefined,
  });
});

app.post('/v1/auth/login', async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  const account = await storage.getAccountByEmail(email);

  if (!account) return res.status(401).json({ error: 'Invalid credentials.' });
  const valid = await argon2.verify(account.passwordHash, password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

  const characters = await storage.listCharactersForAccount(account.id);
  const character = characters[0];
  const tokens = await issueTokens(account, character);
  res.json(tokens);
});

app.post('/v1/auth/refresh', async (req: Request, res: Response) => {
  const token = String(req.body?.refreshToken ?? '');
  const session = await storage.getRefreshSession(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      await storage.deleteRefreshSession(token);
    }
    return res.status(401).json({ error: 'Session expired.' });
  }

  const account = await storage.getAccountById(session.accountId);
  if (!account) return res.status(401).json({ error: 'Invalid session account.' });

  const character = session.characterId ? await storage.getCharacter(session.characterId) : undefined;
  const rotated = await issueTokens(account, character);
  await storage.deleteRefreshSession(token);
  res.json(rotated);
});

app.post('/v1/characters', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const raceInput = String(req.body?.race ?? '').trim() || 'Human';
  const statMode = normalizeStatGenerationMode(req.body?.statMode);
  const requestedGuild = req.body?.guildId ?? req.body?.guild;

  if (!name || name.length > 40) {
    return res.status(400).json({ error: 'A valid character name is required.' });
  }

  if (requestedGuild !== undefined) {
    return res.status(400).json({ error: 'Guild is not selected during character creation. Travel to a guild registrar and use "join guild".' });
  }

  if (!isValidRace(raceInput)) {
    return res.status(400).json({ error: `Unknown race: ${raceInput}` });
  }

  const character = await createRolledCharacter(req.auth!.sub, name, raceInput, statMode);
  await storage.saveCharacter(character);

  return res.status(201).json(sanitizeCharacter(character));
});

app.get('/v1/characters', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const characters = await storage.listCharactersForAccount(req.auth!.sub);
  const payload = await Promise.all(
    characters.map(async (entry) => {
      const ensured = ensureCharacterShape(entry);
      if (ensured.changed) {
        await storage.saveCharacter(ensured.character);
      }
      return sanitizeCharacter(ensured.character);
    }),
  );
  return res.json({ characters: payload });
});

app.post('/v1/characters/:characterId/reroll', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const character = await storage.getCharacter(req.params.characterId);
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  if (character.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Character access denied.' });
  }

  const characterRace = String(req.body?.race ?? '').trim() || character.race;
  const statMode = normalizeStatGenerationMode(req.body?.statMode ?? character.statGenerationMode);
  if (!isValidRace(characterRace)) {
    return res.status(400).json({ error: `Unknown race: ${characterRace}` });
  }

  const reroll = rollCharacterForRace(resolveRace(characterRace).name, statMode);
  applyRollToCharacter(character, reroll);
  await storage.saveCharacter(character);
  return res.json({
    ...sanitizeCharacter(character),
    trace: reroll.trace,
  });
});

app.get('/v1/characters/:characterId', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const character = await storage.getCharacter(req.params.characterId);
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  if (character.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Character access denied.' });
  }
  const resolved = ensureCharacterShape(character);
  if (resolved.changed) {
    await storage.saveCharacter(resolved.character);
  }
  res.json(sanitizeCharacter(resolved.character));
});

app.get('/v1/world/rooms/:roomId', (_req: Request, res: Response) => {
  const room = worldRooms[_req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  res.json(room);
});

app.get('/v1/scripts', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const scripts = await storage.listScriptsForAccount(req.auth!.sub);
  res.json({
    scripts: scripts
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        commands: entry.commands,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
  });
});

app.post('/v1/scripts', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const commands = parseScriptCommandLines(req.body?.commands);
  const expanded = expandScriptCommands(commands);
  if (!name || name.length > 80) {
    return res.status(400).json({ error: 'A name between 1 and 80 characters is required.' });
  }
  if (!commands.length) {
    return res.status(400).json({ error: 'At least one command is required.' });
  }
  if (commands.length > MAX_SCRIPT_INPUT_COMMANDS) {
    return res.status(400).json({ error: 'Scripts are limited to 200 commands.' });
  }
  if (expanded.length > MAX_SCRIPT_RUNTIME_STEPS) {
    return res.status(400).json({
      error: `Expanded script too long (${expanded.length} steps, max ${MAX_SCRIPT_RUNTIME_STEPS}). Use smaller repeats.`,
    });
  }

  const script = buildScriptRecord(req.auth!.sub, name, expanded, description);
  await storage.saveScript(script);

  res.status(201).json(script);
});

app.delete('/v1/scripts/:scriptId', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const script = await storage.getScript(req.params.scriptId);
  if (!script) return res.status(404).json({ error: 'Script not found.' });
  if (script.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Script access denied.' });
  }
  const deleted = await storage.deleteScript(req.params.scriptId);
  if (!deleted) return res.status(404).json({ error: 'Script not found.' });
  return res.json({ deleted: true, scriptId: req.params.scriptId });
});

app.post('/v1/command', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const characterId = String(req.body?.characterId ?? req.auth?.characterId ?? '').trim();
  const command = String(req.body?.command ?? '');
  if (!characterId) return res.status(400).json({ error: 'characterId is required.' });

  const character = await storage.getCharacter(characterId);
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  if (character.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Character access denied.' });
  }
  const normalized = ensureCharacterShape(character);
  if (normalized.changed) {
    await storage.saveCharacter(normalized.character);
  }

  const result = await processCommand(normalized.character.id, command);
  if (!result) return res.status(500).json({ error: 'Command processing failure.' });

  emitToCharacter(character.id, {
    type: 'command_result',
    payload: result,
    source: 'rest',
  });

  return res.json(result);
});

app.post('/v1/scripts/:scriptId/run', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const script = await storage.getScript(req.params.scriptId);
  if (!script) return res.status(404).json({ error: 'Script not found.' });
  if (script.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Script access denied.' });
  }

  const characterId = String(req.body?.characterId ?? req.auth?.characterId ?? '').trim();
  const continueOnError = req.body?.continueOnError === true;
  const paceMs = Number(req.body?.paceMs ?? 0);
  const pause = Math.max(0, Math.min(5000, Number.isFinite(paceMs) ? Math.round(paceMs) : 0));

  if (!characterId) return res.status(400).json({ error: 'characterId is required.' });

  const character = await storage.getCharacter(characterId);
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  if (character.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Character access denied.' });
  }

  const resolved = ensureCharacterShape(character);
  if (resolved.changed) await storage.saveCharacter(resolved.character);

  const expandedCommands = expandScriptCommands(script.commands);
  const steps: ScriptRunStep[] = [];
  let current = resolved.character;
  let lastResult = await processCommand(current.id, 'look');
  if (!lastResult) return res.status(500).json({ error: 'Command processing failure.' });

  for (let index = 0; index < expandedCommands.length; index += 1) {
    const rawCommand = expandedCommands[index];
    const normalizedCommand = rawCommand.trim().toLowerCase();
    const step: ScriptRunStep = {
      index,
      command: rawCommand,
      events: [],
      roomId: current.roomId,
    };

    try {
      const parsedWait = await parseSleepCommand(normalizedCommand);
      if (parsedWait !== null) {
        const waitMs = parsedWait > 0 ? parsedWait : pause;
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        step.events.push(`Waited ${waitMs}ms.`);
        step.roomId = current.roomId;
        steps.push(step);
        continue;
      }

      const commandResult = await processCommand(current.id, rawCommand);
      if (!commandResult) {
        step.error = 'Command processing failure.';
        if (!continueOnError) {
          steps.push(step);
          break;
        }
      } else {
        step.events = commandResult.events;
        step.roomId = commandResult.room.id;
        steps.push(step);
        current = await storage.getCharacter(current.id) ?? current;
        lastResult = commandResult;
      }
    } catch (error) {
      step.error = error instanceof Error ? error.message : 'Unknown command error.';
      steps.push(step);
      if (!continueOnError) break;
    }

    if (pause > 0 && index < expandedCommands.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }

  emitToCharacter(character.id, {
    type: 'script_run_complete',
    payload: {
      scriptId: script.id,
      steps,
      finalCharacterId: lastResult.character.id,
    },
    source: 'rest',
  });

  const finalCharacter = await storage.getCharacter(current.id);
  if (!finalCharacter) return res.status(500).json({ error: 'Character disappeared during script execution.' });
  const finalRoom = worldRooms[finalCharacter.roomId];
  return res.json({
    scriptId: script.id,
    executedSteps: steps.length,
    steps,
    character: sanitizeCharacter(finalCharacter),
    room: finalRoom,
    targets: buildRoomTargets(finalCharacter.roomId),
    itemDetails: buildItemDetails(finalCharacter, finalRoom),
  });
});

app.get('/v1/characters/:characterId/state', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const character = await storage.getCharacter(req.params.characterId);
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  if (character.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Character access denied.' });
  }
  const resolved = ensureCharacterShape(character);
  if (resolved.changed) {
    await storage.saveCharacter(resolved.character);
  }
  const room = worldRooms[resolved.character.roomId];
  return res.json({
    character: sanitizeCharacter(resolved.character),
    room,
    targets: buildRoomTargets(resolved.character.roomId),
    itemDetails: buildItemDetails(resolved.character, room),
  });
});

app.post('/v1/test/characters/:characterId/state', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  if (!TEST_FIXTURES_ENABLED) {
    return res.status(404).json({ error: 'Test fixtures are disabled.' });
  }

  const character = await storage.getCharacter(req.params.characterId);
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  if (character.accountId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Character access denied.' });
  }

  const resolved = ensureCharacterShape(character).character;
  const healthCurrent = req.body?.healthCurrent;
  const roomId = String(req.body?.roomId ?? '').trim();
  const clearActiveCombat = req.body?.clearCombat === true;
  const inventoryAppend = Array.isArray(req.body?.inventoryAppend) ? req.body.inventoryAppend : [];
  const legacyRaceMetadata = String(req.body?.legacyRaceMetadata ?? '').trim();

  if (typeof healthCurrent === 'number' && Number.isFinite(healthCurrent)) {
    resolved.health.current = Math.max(0, Math.min(resolved.health.max, Math.floor(healthCurrent)));
  }

  if (roomId) {
    if (!worldRooms[roomId]) return res.status(400).json({ error: `Unknown room id: ${roomId}` });
    resolved.roomId = roomId;
  }

  if (clearActiveCombat) {
    clearCombat(resolved);
  }

  for (const itemCode of inventoryAppend) {
    if (typeof itemCode === 'string' && itemCode.trim()) {
      resolved.inventory.push(itemCode.trim());
    }
  }

  if (legacyRaceMetadata) {
    if (legacyRaceMetadata === 'modern') {
      delete resolved.statGenerationMode;
      resolved.role = 'frontline';
      resolved.roleTitle = 'Frontline';
      resolved.rollTrace = ['Race selected: Human', 'Role selected: Frontline (frontline)'];
      resolved.rollProfileVersion = 1;
    } else if (legacyRaceMetadata === 'classic') {
      resolved.statGenerationMode = 'classic_random';
      resolved.role = 'berserker';
      resolved.roleTitle = 'Berserker';
      resolved.rollTrace = ['Race selected: Kaldar', 'Role selected: Berserker (berserker)'];
      resolved.rollProfileVersion = 1;
    } else {
      return res.status(400).json({ error: `Unknown legacy race metadata fixture: ${legacyRaceMetadata}` });
    }
    ensureCharacterShape(resolved);
  }

  setActionCooldown(resolved, 0);
  await storage.saveCharacter(resolved);

  const room = worldRooms[resolved.roomId];
  return res.json({
    character: sanitizeCharacter(resolved),
    room,
    targets: buildRoomTargets(resolved.roomId),
    itemDetails: buildItemDetails(resolved, room),
  });
});

wss.on('connection', (socket, request) => {
  const parsed = request.url ? new URL(request.url, `http://localhost:${PORT}`) : null;
  const token = parsed?.searchParams.get('token') || '';
  const characterId = parsed?.searchParams.get('characterId') || undefined;

  let claims: TokenClaims | null = null;
  try {
    claims = token ? (jwt.verify(token, JWT_SECRET) as TokenClaims) : null;
  } catch {
    socket.close(4401, 'Unauthorized');
    return;
  }

  if (!claims) {
    socket.close(4401, 'Unauthorized');
    return;
  }

  void (async () => {
    if (characterId) {
      const character = await storage.getCharacter(characterId);
      if (!character || character.accountId !== claims!.sub) {
        socket.close(4403, 'Forbidden character access.');
        return;
      }
      const entry: SocketState = { accountId: claims.sub, characterId };
      const characterSockets = socketsByCharacter.get(characterId) ?? new Set<WebSocket>();
      characterSockets.add(socket);
      socketsByCharacter.set(characterId, characterSockets);

      socket.on('close', () => {
        characterSockets.delete(socket);
        if (characterSockets.size === 0) socketsByCharacter.delete(characterId);
      });
    }
  })();

  socket.on('message', async (payload) => {
    try {
      const parsedPayload = JSON.parse(String(payload.toString()));
      const bodyCommand = String(parsedPayload?.command ?? '').trim();
      const bodyCharacter = String(parsedPayload?.characterId ?? characterId ?? '').trim();
      if (!bodyCharacter || !bodyCommand) {
        socket.send(JSON.stringify({ type: 'error', message: 'characterId and command required.' }));
        return;
      }
      const character = await storage.getCharacter(bodyCharacter);
      if (!character || character.accountId !== claims!.sub) {
        socket.send(JSON.stringify({ type: 'error', message: 'access denied for character.' }));
        return;
      }

      const result = await processCommand(bodyCharacter, bodyCommand);
      if (!result) {
        socket.send(JSON.stringify({ type: 'error', message: 'Could not process command.' }));
        return;
      }
      socket.send(JSON.stringify({ type: 'command_result', payload: result, source: 'ws' }));
      emitToCharacter(bodyCharacter, {
        type: 'command_result',
        payload: result,
        source: 'ws_broadcast',
      });
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid command payload.' }));
    }
  });
});

(async () => {
  await storage.init();
  server.listen(PORT, () => {
    console.log(`[server] cleanroom-dragonrealms-server on http://localhost:${PORT}`);
  });
})();
