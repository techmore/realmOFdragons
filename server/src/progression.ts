import type { CharacterRecord } from './storage.js';

export const STARTER_SKILLS = [
  ['melee', 'Melee'],
  ['missile', 'Missile'],
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

export const GUILD_NAMES: Record<string, string> = {
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

export interface GuildRegistrarSummary {
  id: string;
  roomId: string;
}

export interface TrainingRoomSummary {
  id: string;
  guild?: string;
}

export type CircleAdvancementDecision =
  | { allowed: true; registrarRoomId: string }
  | { allowed: false; reason: 'commoner' | 'wrong_room'; events: string[] };

export interface CircleAdvancementResult {
  advanced: boolean;
  circle: number;
  events: string[];
}

export type TrainingDecision =
  | { allowed: false; reason: 'wrong_room' | 'unknown_skill'; events: string[] }
  | {
      allowed: true;
      skillId: string;
      skillName: string;
      primarySkillId: string;
      gains: Array<{ skillId: string; amount: number }>;
      events: string[];
    };

export interface SkillPoolGainResult {
  applied: boolean;
  skillId: string;
  rank: number;
  pool: number;
  events: string[];
}

export function totalSkillRanks(character: Pick<CharacterRecord, 'skills'>): number {
  return Object.values(character.skills).reduce((sum, skill) => sum + skill.rank, 0);
}

export function buildStarterSkills(): CharacterRecord['skills'] {
  return Object.fromEntries(
    STARTER_SKILLS.map(([id, name]) => [id, { name, rank: 0, pool: 0 }]),
  );
}

export function ensureProgressionShape(character: CharacterRecord): boolean {
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

export function nextCircleRequirement(character: Pick<CharacterRecord, 'circle'>): {
  nextCircle: number;
  totalRanks: number;
  primaryRank: number;
} {
  const nextCircle = character.circle + 1;
  return {
    nextCircle,
    totalRanks: nextCircle * 3,
    primaryRank: nextCircle * 2,
  };
}

export function primarySkillForGuild(guildId: string): string {
  if (guildId === 'barbarian') return 'melee';
  if (guildId === 'bard') return 'performance';
  if (guildId === 'moon_mage') return 'scholarship';
  if (guildId === 'necromancer') return 'magic';
  if (guildId === 'paladin') return 'tactics';
  if (guildId === 'ranger') return 'survival';
  if (guildId === 'thief') return 'stealth';
  if (guildId === 'trader') return 'trading';
  if (guildId === 'warrior_mage') return 'magic';
  if (guildId === 'cleric') return 'first_aid';
  if (guildId === 'empath') return 'empathy';
  return 'athletics';
}

export function canCircle(character: Pick<CharacterRecord, 'circle' | 'guildId' | 'skills'>): boolean {
  const requirement = nextCircleRequirement(character);
  const primarySkill = character.skills[primarySkillForGuild(character.guildId)];
  return totalSkillRanks(character) >= requirement.totalRanks && (primarySkill?.rank ?? 0) >= requirement.primaryRank;
}

export function buildCircleStatus(character: Pick<CharacterRecord, 'name' | 'circle' | 'guildId' | 'guildName' | 'skills'>): string[] {
  const requirement = nextCircleRequirement(character);
  const primarySkillId = primarySkillForGuild(character.guildId);
  const primarySkill = character.skills[primarySkillId];
  return [
    `${character.name} is Circle ${character.circle} in ${character.guildName}.`,
    `Next Circle ${requirement.nextCircle}: total skill ranks ${totalSkillRanks(character)}/${requirement.totalRanks}.`,
    `${primarySkill?.name ?? 'Primary skill'} rank ${primarySkill?.rank ?? 0}/${requirement.primaryRank}.`,
  ];
}

export function resolveCircleAdvancement(character: Pick<CharacterRecord, 'circle' | 'guildId' | 'skills'>): CircleAdvancementResult {
  if (!canCircle(character)) {
    return { advanced: false, circle: character.circle, events: [] };
  }

  const nextCircle = character.circle + 1;
  return {
    advanced: true,
    circle: nextCircle,
    events: [`You advance to Circle ${nextCircle}.`],
  };
}

export function resolveCircleAdvancementRequest(
  character: Pick<CharacterRecord, 'guildId' | 'guildName' | 'roomId'>,
  registrars: GuildRegistrarSummary[],
): CircleAdvancementDecision {
  if (character.guildId === 'commoner') {
    return {
      allowed: false,
      reason: 'commoner',
      events: ['You need to join a guild before you can advance circles.'],
    };
  }

  const registrar = registrars.find((guild) => guild.id === character.guildId);
  if (!registrar || character.roomId !== registrar.roomId) {
    return {
      allowed: false,
      reason: 'wrong_room',
      events: [`Travel to your ${character.guildName} registrar before requesting circle advancement.`],
    };
  }

  return { allowed: true, registrarRoomId: registrar.roomId };
}

export function isTrainingRoom(room: TrainingRoomSummary): boolean {
  return Boolean(room.guild) || room.id === 'crossing-MA01-001' || room.id === 'crossing-MA01-002';
}

export function resolveTrainingDecision(
  character: Pick<CharacterRecord, 'guildId' | 'skills'>,
  room: TrainingRoomSummary,
  requestedSkill = '',
): TrainingDecision {
  if (!isTrainingRoom(room)) {
    return { allowed: false, reason: 'wrong_room', events: ['This is not a useful place to train.'] };
  }

  const skillId = requestedSkill || primarySkillForGuild(room.guild ?? character.guildId);
  const skill = character.skills[skillId];
  if (!skill) {
    return { allowed: false, reason: 'unknown_skill', events: [`You do not know how to train "${skillId}".`] };
  }

  const primarySkillId = primarySkillForGuild(room.guild ?? character.guildId);
  const gains = [{ skillId, amount: skillId === primarySkillId ? 5 : 3 }];
  if (skillId !== 'athletics') {
    gains.push({ skillId: 'athletics', amount: 1 });
  }

  return {
    allowed: true,
    skillId,
    skillName: skill.name,
    primarySkillId,
    gains,
    events: [`You drill ${skill.name}.`],
  };
}

export function applySkillPoolGain(
  character: Pick<CharacterRecord, 'skills'>,
  skillId: string,
  amount: number,
): SkillPoolGainResult {
  const skill = character.skills[skillId];
  if (!skill) {
    return { applied: false, skillId, rank: 0, pool: 0, events: [] };
  }

  const gain = Math.max(1, Math.floor(amount));
  skill.pool += gain;
  const needed = Math.max(4, (skill.rank + 1) * 5);
  const events: string[] = [];
  if (skill.pool >= needed) {
    skill.pool -= needed;
    skill.rank += 1;
    events.push(`${skill.name} improves to rank ${skill.rank}.`);
  }

  return {
    applied: true,
    skillId,
    rank: skill.rank,
    pool: skill.pool,
    events,
  };
}
