import argon2 from 'argon2';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  Room,
  RoomId,
  RoomShop,
  directionAliases,
  guilds,
  worldRooms,
} from './world.js';
import { FileStorage, LoginSession, AccountRecord, CharacterRecord, ScriptRecord } from './storage.js';
import {
  getAllRaces,
  isValidRace,
  resolveRace,
  rollCharacterForRace,
  type RaceRollResult,
  type StatBlock,
} from './races.js';
import { canCircle, nextCircleRequirement, primarySkillForGuild, totalSkillRanks } from './progression.js';
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
  shiftAdvantageValue,
  shiftCombatRange,
} from './combat.js';
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
  | 'roundtimeMs'
  | 'combat'
  | 'stance'
  | 'balance'
  | 'stats'
  > & {
    rollProfileVersion: number;
    wallet: CharacterRecord['wallet'];
  };
  room: Room;
  events: string[];
  targets: RoomTarget[];
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
const SHOP_SELL_RATE = 0.75;
const STARTING_WALLET = Object.freeze({
  plat: 40,
  trias: 80,
  lucan: 0,
  silk: 0,
});

const STARTER_SKILLS = [
  ['melee', 'Melee'],
  ['evasion', 'Evasion'],
  ['athletics', 'Athletics'],
  ['survival', 'Survival'],
  ['stealth', 'Stealth'],
  ['magic', 'Magic'],
  ['tactics', 'Tactics'],
  ['scholarship', 'Scholarship'],
  ['performance', 'Performance'],
  ['empathy', 'Empathy'],
  ['trading', 'Trading'],
  ['first_aid', 'First Aid'],
] as const;

const GUILD_NAMES: Record<string, string> = {
  commoner: 'Unaffiliated',
  barbarian: 'Barbarian Guild',
  bard: 'Bard Guild',
  fighter: 'Fighter Guild',
  mage: 'Mage Guild',
  moon_mage: 'Moon Mage Guild',
  necromancer: 'Necromancer Guild',
  paladin: 'Paladin Guild',
  ranger: 'Ranger Guild',
  scout: 'Scout Guild',
  rogue: 'Rogue Guild',
  thief: 'Thief Guild',
  trader: 'Trader Guild',
  warrior_mage: 'Warrior Mage Guild',
  cleric: 'Cleric Guild',
  empath: 'Empath Guild',
};

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
    wallet: character.wallet,
    stats: character.stats,
    rollProfileVersion: character.rollProfileVersion,
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

function hasFunds(wallet: CharacterRecord['wallet'], currency: keyof CharacterRecord['wallet'], cost: number) {
  return wallet[currency] >= cost;
}

function spendFunds(wallet: CharacterRecord['wallet'], currency: keyof CharacterRecord['wallet'], cost: number) {
  wallet[currency] = Math.max(0, wallet[currency] - Math.max(0, Math.floor(cost)));
}

function earnFunds(wallet: CharacterRecord['wallet'], currency: keyof CharacterRecord['wallet'], amount: number) {
  wallet[currency] = Math.max(0, wallet[currency] + Math.max(0, Math.floor(amount)));
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

function buildStarterSkills(): CharacterRecord['skills'] {
  return Object.fromEntries(
    STARTER_SKILLS.map(([id, name]) => [id, { name, rank: 0, pool: 0 }]),
  );
}

function ensureProgressionShape(character: CharacterRecord): boolean {
  let changed = false;
  if (!character.guildId) {
    character.guildId = 'commoner';
    changed = true;
  }
  const expectedGuildName = GUILD_NAMES[character.guildId] ?? character.guildName ?? 'Unaffiliated';
  if (character.guildName !== expectedGuildName) {
    character.guildName = expectedGuildName;
    changed = true;
  }
  if (!Number.isFinite(character.circle) || character.circle < 1) {
    character.circle = 1;
    changed = true;
  }
  if (!character.skills) {
    character.skills = buildStarterSkills();
    changed = true;
  }
  for (const [id, name] of STARTER_SKILLS) {
    const skill = character.skills[id];
    if (!skill) {
      character.skills[id] = { name, rank: 0, pool: 0 };
      changed = true;
    } else {
      const normalizedRank = Math.max(0, Math.floor(Number(skill.rank) || 0));
      const normalizedPool = Math.max(0, Math.floor(Number(skill.pool) || 0));
      if (skill.name !== name || skill.rank !== normalizedRank || skill.pool !== normalizedPool) {
        character.skills[id] = { name, rank: normalizedRank, pool: normalizedPool };
        changed = true;
      }
    }
  }
  return changed;
}

function grantSkillPool(character: CharacterRecord, skillId: string, amount: number, events: string[]) {
  const skill = character.skills[skillId];
  if (!skill) return false;
  const gain = Math.max(1, Math.floor(amount));
  skill.pool += gain;
  const needed = Math.max(4, (skill.rank + 1) * 5);
  if (skill.pool >= needed) {
    skill.pool -= needed;
    skill.rank += 1;
    events.push(`${skill.name} improves to rank ${skill.rank}.`);
  }
  return true;
}

function buildCircleStatus(character: CharacterRecord) {
  const requirement = nextCircleRequirement(character);
  const primarySkillId = primarySkillForGuild(character.guildId);
  const primarySkill = character.skills[primarySkillId];
  return [
    `${character.name} is Circle ${character.circle} in ${character.guildName}.`,
    `Next Circle ${requirement.nextCircle}: total skill ranks ${totalSkillRanks(character)}/${requirement.totalRanks}.`,
    `${primarySkill?.name ?? 'Primary skill'} rank ${primarySkill?.rank ?? 0}/${requirement.primaryRank}.`,
  ];
}

function isTrainingRoom(room: Room) {
  return Boolean(room.guild) || room.id === 'crossing-MA01-001' || room.id === 'crossing-MA01-002';
}

function trainCharacter(character: CharacterRecord, room: Room, requestedSkill: string, events: string[]) {
  if (!isTrainingRoom(room)) {
    events.push('This is not a useful place to train.');
    return false;
  }

  const skillId = requestedSkill || primarySkillForGuild(room.guild ?? character.guildId);
  const skill = character.skills[skillId];
  if (!skill) {
    events.push(`You do not know how to train "${skillId}".`);
    return false;
  }

  const primarySkillId = primarySkillForGuild(room.guild ?? character.guildId);
  const isPrimary = skillId === primarySkillId;
  grantSkillPool(character, skillId, isPrimary ? 5 : 3, events);
  if (skillId !== 'athletics') {
    grantSkillPool(character, 'athletics', 1, events);
  }
  events.push(`You drill ${skill.name}.`);
  return true;
}

function applyMeleeRetaliation(character: CharacterRecord, template: EnemyTemplate, now: number, events: string[]) {
  if (!character.combat) return false;
  const stanceProfile = STANCE_PROFILES[character.stance];
  const balanceBonus = (character.balance - 2) * 5;
  const retaliation = evaluateToHit(
    template.attack * 8,
    -Math.floor((character.stats.discipline + character.stats.wisdom) / 5) - stanceProfile.defense - balanceBonus,
  );
  if (retaliation.hit) {
    const rawDamage = randomInt(template.damageMin, template.damageMax + 1);
    const defended = character.combat.defendUntil > now;
    const stanceMitigation = character.stance === 'defensive' ? 1 : character.stance === 'evasive' ? 2 : 0;
    const damage = Math.max(0, rawDamage - (defended ? 2 : 0) - stanceMitigation);
    events.push(`${character.combat.targetName} attacks for ${damage}.`);
    character.health.current = Math.max(0, character.health.current - damage);
    grantSkillPool(character, 'evasion', defended ? 2 : 1, events);
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
  const playerAttack = evaluateToHit(
    character.stats.strength + character.stats.agility + character.stats.reflex,
    stanceProfile.attack + balanceBonus + advantageBonus + maneuverBonus,
  );

  if (playerAttack.hit) {
    const damage = resolveAttackDamage(
      character.stats.strength,
      character.stats.discipline + stanceProfile.damage + (maneuver === 'bash' ? 3 : -1),
      template.damageMin,
      template.damageMax,
    );
    character.combat.targetHp = Math.max(0, character.combat.targetHp - damage);
    events.push(`You ${maneuver} ${character.combat.targetName} for ${damage} (${playerAttack.roll}/${playerAttack.threshold}).`);
    shiftAdvantage(character, maneuver === 'bash' ? 1 : 0);
    grantSkillPool(character, 'melee', maneuver === 'bash' ? 3 : 2, events);
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
    grantSkillPool(character, 'survival', 2, events);
    clearCombat(character);
    setActionCooldown(character, 700);
    return true;
  }

  applyMeleeRetaliation(character, template, now, events);
  return true;
}

function ensureCharacterShape(character: CharacterRecord): { character: CharacterRecord; changed: boolean } {
  let changed = false;
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

async function createRolledCharacter(accountId: string, name: string, raceInput: string): Promise<CharacterRecord> {
  const template = resolveRace(raceInput);
  const roll = rollCharacterForRace(template.name);
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
    createdAt: new Date().toISOString(),
    inventory: ['leather backpack', 'repair cloth'],
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
  };
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
    return [
      'You are not in combat.',
      `Stance: ${STANCE_PROFILES[character.stance].label}. Balance: ${formatBalance(character.balance)}.`,
    ];
  }
  return [
    `Combat target: ${character.combat.targetName}`,
    `Target HP: ${character.combat.targetHp}/${character.combat.targetMaxHp}`,
    `Range: ${formatRange(normalizeRange(character.combat.range))}`,
    `Position: ${formatAdvantage(character.combat.advantage)}`,
    `Stance: ${STANCE_PROFILES[character.stance].label}. Balance: ${formatBalance(character.balance)}.`,
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

function listShopItems(shop?: RoomShop) {
  if (!shop) return ['No shop is open in this location.'];
  const rows = shop.items.map((item) => `${item.code} ${item.name} — ${item.price} ${item.currency}`);
  return [`${shop.name}:`, ...rows];
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

function normalizeDirection(input: string): string {
  const normalized = input.toLowerCase().trim();
  if (directionAliases[normalized]) return directionAliases[normalized];
  const cleaned = normalized.replace(/^go\s+/, '');
  if (directionAliases[cleaned]) return directionAliases[cleaned];
  return cleaned;
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
    command === 'look' ||
    command === 'l' ||
    command === 'scan' ||
    command === 'target' ||
    command.startsWith('target ') ||
    command.startsWith('appraise ') ||
    command === 'exits' ||
    command === 'inventory' ||
    command === 'inv' ||
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
      'Commands: look, scan, help scan, rest, inventory, score, skills, circle, join guild, train [skill], stance [balanced|offensive|defensive|evasive], balance, range, advance, retreat, jab, bash, exits, shop, shop buy <code>, shop sell <code>, combat, attack [target], defend, flee, wait <ms>, go <direction>, <n/e/s/w>',
    );
    events.push(`Your wallets: ${formatWallet(resolvedCharacter.wallet)}.`);
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'join guild') {
    if (!room.guild) {
      events.push('There is no guild registrar here.');
      return buildCommandResult(resolvedCharacter, room, events);
    }
    resolvedCharacter.guildId = room.guild;
    resolvedCharacter.guildName = GUILD_NAMES[room.guild] ?? room.guild;
    modified = true;
    events.push(`You are now registered with ${resolvedCharacter.guildName}.`);
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'skills') {
    events.push(
      ...Object.entries(resolvedCharacter.skills).map(
        ([id, skill]) => `${id}: ${skill.name} rank ${skill.rank}, pool ${skill.pool}`,
      ),
    );
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
      grantSkillPool(resolvedCharacter, 'tactics', 2, events);
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
    events.push(...buildCircleStatus(resolvedCharacter));
    if (canCircle(resolvedCharacter)) {
      resolvedCharacter.circle += 1;
      resolvedCharacter.health = calculateHealth(resolvedCharacter.stats);
      modified = true;
      events.push(`You advance to Circle ${resolvedCharacter.circle}.`);
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

  if (command === 'target' || command.startsWith('target ') || command.startsWith('appraise ')) {
    const requestedTarget = command.startsWith('target ')
      ? command.slice(7).trim()
      : command.startsWith('appraise ')
        ? command.slice(9).trim()
        : '';
    events.push(...buildTargetDetailEvents(resolvedCharacter, requestedTarget));
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
      grantSkillPool(resolvedCharacter, 'tactics', 1, events);
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
      grantSkillPool(resolvedCharacter, 'evasion', 1, events);
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

  if (command.startsWith('attack')) {
    const requestedTarget = command.startsWith('attack ') ? command.slice(7).trim() : '';
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

    const attackRange = normalizeRange(resolvedCharacter.combat.range);
    if (attackRange !== 'melee') {
      events.push(`You are too far away to strike. Current range: ${formatRange(attackRange)}.`);
      events.push('Advance to melee range first.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const now = Date.now();
    if (resolvedCharacter.combat.nextAttackAt > now) {
      const remaining = resolvedCharacter.combat.nextAttackAt - now;
      setActionCooldown(resolvedCharacter, remaining);
      events.push(`Your target is still in the attack cycle (${remaining}ms).`);
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const template = ENEMY_TEMPLATES.find((entry) => entry.id === resolvedCharacter.combat?.targetId);
    if (!template) {
      clearCombat(resolvedCharacter);
      modified = true;
      events.push('Your target vanished from the world.');
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const target = resolvedCharacter.combat;
    const stanceProfile = STANCE_PROFILES[resolvedCharacter.stance];
    const balanceBonus = (resolvedCharacter.balance - 2) * 5;
    const advantageBonus = normalizeAdvantage(resolvedCharacter.combat.advantage) * 7;
    const playerAttack = evaluateToHit(
      resolvedCharacter.stats.strength + resolvedCharacter.stats.agility + resolvedCharacter.stats.reflex,
      (requestedTarget ? -2 : 0) + stanceProfile.attack + balanceBonus + advantageBonus,
    );

    if (playerAttack.hit) {
      const damage = resolveAttackDamage(
        resolvedCharacter.stats.strength,
        resolvedCharacter.stats.discipline + stanceProfile.damage,
        template.damageMin,
        template.damageMax,
      );
      target.targetHp = Math.max(0, target.targetHp - damage);
      shiftAdvantage(resolvedCharacter, 1);
      modified = true;
      events.push(`You hit ${target.targetName} for ${damage} (${playerAttack.roll}/${playerAttack.threshold}).`);
      if (target.targetHp <= 0) {
        events.push(`${target.targetName} collapses.`);
        resolvedCharacter.inventory.push(`${target.targetName} fang`);
        grantSkillPool(resolvedCharacter, 'melee', 4, events);
        grantSkillPool(resolvedCharacter, 'survival', 2, events);
        clearCombat(resolvedCharacter);
        setActionCooldown(resolvedCharacter, 700);
        await persist();
        return buildCommandResult(resolvedCharacter, room, events);
      }
    } else {
      events.push(`You miss ${target.targetName}.`);
      shiftAdvantage(resolvedCharacter, -1);
    }
    reduceBalance(resolvedCharacter, stanceProfile.cost);
    events.push(`Position: ${formatAdvantage(resolvedCharacter.combat.advantage)}.`);
    events.push(`Balance: ${formatBalance(resolvedCharacter.balance)}.`);

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
    setActionCooldown(resolvedCharacter, template.aggression >= 60 ? 900 : 650);
    await persist();
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'look' || command === 'l') {
    events.push(room.description);
    events.push(...room.prompts);
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

  if (command === 'rest') {
    if (resolvedCharacter.health.current >= resolvedCharacter.health.max) {
      events.push(`You are fully rested at ${resolvedCharacter.health.current}/${resolvedCharacter.health.max}.`);
      await persist();
      return buildCommandResult(resolvedCharacter, room, events);
    }
    const regained = Math.max(1, Math.ceil(resolvedCharacter.health.max / 6));
    const previousHealth = resolvedCharacter.health.current;
    resolvedCharacter.health.current = Math.min(resolvedCharacter.health.max, resolvedCharacter.health.current + regained);
    grantSkillPool(resolvedCharacter, 'first_aid', 1, events);
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
    events.push(`You are carrying ${resolvedCharacter.inventory.length} item(s).`);
    events.push(...resolvedCharacter.inventory.map((item) => ` - ${item}`));
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command === 'score') {
    events.push(
      `You are ${resolvedCharacter.name}, race ${resolvedCharacter.raceDisplayName} (${resolvedCharacter.roleTitle}) score ${resolvedCharacter.role}.`,
    );
    events.push(`Guild: ${resolvedCharacter.guildName}. Circle ${resolvedCharacter.circle}.`);
    events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
    events.push(`Health ${resolvedCharacter.health.current}/${resolvedCharacter.health.max}.`);
    events.push(`Stance: ${STANCE_PROFILES[resolvedCharacter.stance].label}. Balance: ${formatBalance(resolvedCharacter.balance)}.`);
    events.push(`Current room ${resolvedCharacter.roomId} | roundtime ${resolvedCharacter.roundtimeMs}ms.`);
    events.push(
      `Strength ${resolvedCharacter.stats.strength}, Reflex ${resolvedCharacter.stats.reflex}, Agility ${resolvedCharacter.stats.agility}, Discipline ${resolvedCharacter.stats.discipline}, Stamina ${resolvedCharacter.stats.stamina}, Wisdom ${resolvedCharacter.stats.wisdom}, Intelligence ${resolvedCharacter.stats.intelligence}, Charisma ${resolvedCharacter.stats.charisma}`,
    );
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('roll')) {
    events.push(`Current roll profile v${resolvedCharacter.rollProfileVersion}, ${resolvedCharacter.rollTrace[0] || 'No trace'}.`);
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
    if (!code) {
      events.push('Specify an item code or name: shop buy <code>.');
      return buildCommandResult(resolvedCharacter, room, events);
    }
    if (!room.shop) {
      events.push('No shop is present here.');
    } else {
      const lowered = code.toLowerCase();
      const item = room.shop.items.find(
        (entry) => entry.code.toLowerCase() === lowered || entry.name.toLowerCase() === lowered,
      );
      if (!item) {
        events.push(`I could not find "${code}" here.`);
      } else if (!hasFunds(resolvedCharacter.wallet, item.currency, item.price)) {
        events.push(`You cannot afford ${item.name}: ${item.price} ${item.currency} required.`);
      } else {
        spendFunds(resolvedCharacter.wallet, item.currency, item.price);
        resolvedCharacter.inventory.push(item.code);
        grantSkillPool(resolvedCharacter, 'trading', 1, events);
        modified = true;
        setActionCooldown(resolvedCharacter, 450);
        events.push(`You buy ${item.name} for ${item.price} ${item.currency}.`);
        events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
      }
    }
    if (modified) {
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  if (command.startsWith('shop sell ')) {
    if (!room.shop) {
      events.push('No shop is present here.');
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const code = command.slice(10).trim();
    if (!code) {
      events.push('Specify a carried item code: shop sell <code>.');
      return buildCommandResult(resolvedCharacter, room, events);
    }

    const lowered = code.toLowerCase();
    const inventoryIndex = resolvedCharacter.inventory.findIndex(
      (entry) => entry.toLowerCase() === lowered || entry.toLowerCase().replace(/\s+/g, '-') === lowered,
    );
    if (inventoryIndex < 0) {
      events.push(`You are not carrying "${code}".`);
    } else {
      const itemCode = resolvedCharacter.inventory[inventoryIndex];
      const catalogItem = room.shop.items.find((entry) => entry.code === itemCode);
      if (!catalogItem) {
        events.push(`This shop does not buy ${itemCode}.`);
      } else {
        const sellPrice = Math.max(1, Math.floor(catalogItem.price * SHOP_SELL_RATE));
        resolvedCharacter.inventory.splice(inventoryIndex, 1);
        if (resolvedCharacter.hands.left === itemCode) {
          resolvedCharacter.hands.left = null;
        }
        if (resolvedCharacter.hands.right === itemCode) {
          resolvedCharacter.hands.right = null;
        }
        earnFunds(resolvedCharacter.wallet, catalogItem.currency, sellPrice);
        grantSkillPool(resolvedCharacter, 'trading', 1, events);
        modified = true;
        setActionCooldown(resolvedCharacter, 450);
        events.push(`You sell ${catalogItem.name} for ${sellPrice} ${catalogItem.currency}.`);
        events.push(`Wallet: ${formatWallet(resolvedCharacter.wallet)}.`);
      }
    }
    if (modified) {
      await persist();
    }
    return buildCommandResult(resolvedCharacter, room, events);
  }

  const direction = normalizeDirection(command);
  const target = room.exits.find((exit) => exit.direction.toLowerCase() === direction);
  if (target) {
    const nextRoom = worldRooms[target.destination];
    if (!nextRoom) {
      events.push('That path is broken in the world data.');
    } else {
      resolvedCharacter.roomId = nextRoom.id;
      grantSkillPool(resolvedCharacter, 'athletics', 1, events);
      setActionCooldown(resolvedCharacter, 350);
      modified = true;
      events.push(`You go ${direction} to ${nextRoom.title}.`);
      if (modified) {
        await storage.saveCharacter(resolvedCharacter);
      }
      return buildCommandResult(resolvedCharacter, nextRoom, events);
    }
  } else {
    events.push(`Unknown command: ${command}`);
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
      minStat: race.minStat,
      maxStat: race.maxStat,
      statModifiers: race.statModifiers,
      roles: race.roles.map((role) => ({
        id: role.id,
        title: role.title,
        rollModifiers: role.rollModifiers,
      })),
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

  if (!name || name.length > 40) {
    return res.status(400).json({ error: 'A valid character name is required.' });
  }

  if (!isValidRace(raceInput)) {
    return res.status(400).json({ error: `Unknown race: ${raceInput}` });
  }

  const character = await createRolledCharacter(req.auth!.sub, name, raceInput);
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
  if (!isValidRace(characterRace)) {
    return res.status(400).json({ error: `Unknown race: ${characterRace}` });
  }

  const reroll = rollCharacterForRace(resolveRace(characterRace).name);
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

  setActionCooldown(resolved, 0);
  await storage.saveCharacter(resolved);

  const room = worldRooms[resolved.roomId];
  return res.json({
    character: sanitizeCharacter(resolved),
    room,
    targets: buildRoomTargets(resolved.roomId),
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
