import type { CharacterRecord } from './storage.js';

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
  if (guildId === 'fighter') return 'melee';
  if (guildId === 'mage') return 'scholarship';
  if (guildId === 'moon_mage') return 'scholarship';
  if (guildId === 'necromancer') return 'magic';
  if (guildId === 'paladin') return 'tactics';
  if (guildId === 'ranger') return 'survival';
  if (guildId === 'scout') return 'survival';
  if (guildId === 'rogue') return 'evasion';
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
