import type { CharacterRecord } from './storage.js';

export interface GuildRegistrarSummary {
  id: string;
  roomId: string;
}

export type CircleAdvancementDecision =
  | { allowed: true; registrarRoomId: string }
  | { allowed: false; reason: 'commoner' | 'wrong_room'; events: string[] };

export interface CircleAdvancementResult {
  advanced: boolean;
  circle: number;
  events: string[];
}

export function totalSkillRanks(character: Pick<CharacterRecord, 'skills'>): number {
  return Object.values(character.skills).reduce((sum, skill) => sum + skill.rank, 0);
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
