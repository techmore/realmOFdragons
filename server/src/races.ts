import { randomInt } from 'node:crypto';

export type StatName =
  | 'strength'
  | 'reflex'
  | 'agility'
  | 'discipline'
  | 'stamina'
  | 'wisdom'
  | 'intelligence'
  | 'charisma';

export type StatBlock = {
  [key in StatName]: number;
};

export interface RaceRole {
  id: string;
  title: string;
  rollModifiers: Partial<StatBlock>;
}

export interface RaceTemplate {
  id: string;
  name: string;
  statModifiers: Partial<StatBlock>;
  roles: RaceRole[];
  minStat: number;
  maxStat: number;
  description: string;
}

export interface RaceRollResult {
  race: string;
  role: string;
  roleTitle: string;
  baseStats: StatBlock;
  finalStats: StatBlock;
  trace: string[];
  rollProfileVersion: number;
}

const STAT_NAMES: StatName[] = [
  'strength',
  'reflex',
  'agility',
  'discipline',
  'stamina',
  'wisdom',
  'intelligence',
  'charisma',
];

const RACE_DEFINITIONS: RaceTemplate[] = [
  {
    id: 'human',
    name: 'Human',
    statModifiers: {
      strength: 0,
      reflex: 0,
      agility: 0,
      discipline: 0,
      stamina: 0,
      wisdom: 0,
      intelligence: 0,
      charisma: 0,
    },
    roles: [
      { id: 'adaptive', title: 'Adaptive', rollModifiers: {} },
      { id: 'frontline', title: 'Frontline', rollModifiers: { strength: 2, stamina: 1, charisma: -1 } },
      { id: 'versatile', title: 'Versatile', rollModifiers: { agility: 1, reflex: 1, wisdom: 1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Balanced baseline with no major starting constraints.',
  },
  {
    id: 'elf',
    name: 'Elf',
    statModifiers: {
      agility: 2,
      reflex: 2,
      strength: -1,
      charisma: 1,
    },
    roles: [
      { id: 'scout', title: 'Scout', rollModifiers: { agility: 1, reflex: 1, stamina: -1 } },
      { id: 'arts', title: 'Scholar', rollModifiers: { intelligence: 2, wisdom: 1, charisma: 1 } },
      { id: 'blade', title: 'Quickblade', rollModifiers: { agility: 2, reflex: 1, discipline: -1 } },
    ],
    minStat: 17,
    maxStat: 41,
    description: 'Fast and reactive, tends toward dexterous archetypes.',
  },
  {
    id: "dwarf",
    name: 'Dwarf',
    statModifiers: {
      stamina: 2,
      discipline: 1,
      agility: -1,
      reflex: -1,
    },
    roles: [
      { id: 'guardian', title: 'Guardian', rollModifiers: { strength: 2, stamina: 1 } },
      { id: 'craft', title: 'Craftmaster', rollModifiers: { discipline: 2, wisdom: 1, agility: -1 } },
      { id: 'miner', title: 'Breach', rollModifiers: { stamina: 1, reflex: -1 } },
    ],
    minStat: 18,
    maxStat: 42,
    description: 'Resilient and stubborn with stronger endurance.',
  },
  {
    id: 'elothean',
    name: 'Elothean',
    statModifiers: {
      intelligence: 2,
      wisdom: 2,
      stamina: -1,
      strength: -1,
    },
    roles: [
      { id: 'sage', title: 'Sage', rollModifiers: { wisdom: 2, intelligence: 2, discipline: 1 } },
      { id: 'binder', title: 'Binder', rollModifiers: { charisma: 1, wisdom: 1 } },
      { id: 'mender', title: 'Mender', rollModifiers: { intelligence: 1, agility: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Mind-forward profiles with broad arcane learning potential.',
  },
  {
    id: "gortog",
    name: "Gor'tog",
    statModifiers: {
      strength: 3,
      stamina: 2,
      agility: -2,
      reflex: -1,
    },
    roles: [
      { id: 'brawler', title: 'Brawler', rollModifiers: { strength: 2, discipline: -1 } },
      { id: 'wrestler', title: 'Wrestler', rollModifiers: { stamina: 1, strength: 1 } },
      { id: 'beat', title: 'Breaker', rollModifiers: { reflex: -1, discipline: 1 } },
    ],
    minStat: 20,
    maxStat: 46,
    description: 'High impact power profile, with limited subtle control.',
  },
  {
    id: 'halfling',
    name: 'Halfling',
    statModifiers: {
      agility: 2,
      reflex: 2,
      strength: -1,
      discipline: -1,
    },
    roles: [
      { id: 'skirmish', title: 'Skirmisher', rollModifiers: { agility: 2, reflex: 2 } },
      { id: 'trader', title: 'Broker', rollModifiers: { charisma: 2, intelligence: 1 } },
      { id: 'lightfoot', title: 'Lightfoot', rollModifiers: { agility: 1, stamina: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Fast and tricky with high reflex and mobility.',
  },
  {
    id: "skra_mur",
    name: "S'Kra Mur",
    statModifiers: {
      wisdom: 1,
      intelligence: 1,
      stamina: 1,
      reflex: -2,
      agility: -1,
    },
    roles: [
      { id: 'seer', title: 'Seer', rollModifiers: { wisdom: 2, intelligence: 1 } },
      { id: 'rider', title: 'Rider', rollModifiers: { agility: 1, reflex: 1, strength: -1 } },
      { id: 'warden', title: 'Warden', rollModifiers: { stamina: 1, discipline: 1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Wisdom-weighted, patient, tactically balanced.',
  },
  {
    id: 'rakash',
    name: 'Rakash',
    statModifiers: {
      reflex: 2,
      agility: 2,
      stamina: -1,
      discipline: -1,
    },
    roles: [
      { id: 'striker', title: 'Striker', rollModifiers: { reflex: 2, agility: 2 } },
      { id: 'trance', title: 'Trancefighter', rollModifiers: { wisdom: 1, discipline: -1 } },
      { id: 'watch', title: 'Watchkeeper', rollModifiers: { discipline: 1, wisdom: 1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Reactive and fast, with lighter defensive posture.',
  },
  {
    id: 'prydaen',
    name: 'Prydaen',
    statModifiers: {
      wisdom: 2,
      intelligence: 1,
      charisma: 1,
      reflex: -1,
    },
    roles: [
      { id: 'seer', title: 'Visionary', rollModifiers: { wisdom: 2, intelligence: 1 } },
      { id: 'healer', title: 'Healer', rollModifiers: { wisdom: 1, charisma: 1 } },
      { id: 'guide', title: 'Guide', rollModifiers: { discipline: 1, stamina: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Perceptive lineages with magical learning preference.',
  },
  {
    id: 'gnome',
    name: 'Gnome',
    statModifiers: {
      intelligence: 2,
      agility: 1,
      strength: -1,
      stamina: -1,
    },
    roles: [
      { id: 'tinker', title: 'Tinkerer', rollModifiers: { intelligence: 2, reflex: 1 } },
      { id: 'inquisitor', title: 'Inquisitive', rollModifiers: { wisdom: 1, discipline: 1 } },
      { id: 'ambush', title: 'Ambusher', rollModifiers: { agility: 1, reflex: 1, strength: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Nimble and curious, with precision bonuses.',
  },
  {
    id: 'kaldar',
    name: 'Kaldar',
    statModifiers: {
      strength: 2,
      stamina: 2,
      wisdom: -1,
      reflex: -1,
    },
    roles: [
      { id: 'berserker', title: 'Berserker', rollModifiers: { strength: 2, stamina: 1, discipline: -1 } },
      { id: 'crusher', title: 'Crusher', rollModifiers: { discipline: 1, strength: 1 } },
      { id: 'warden', title: 'Warden', rollModifiers: { charisma: -1, wisdom: -1, stamina: 1 } },
    ],
    minStat: 18,
    maxStat: 44,
    description: 'Powerful and forceful with strong stamina edges.',
  },
];

function normalizeRaceInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

export const ROLL_PROFILE_VERSION = 1;

export function getAllRaces(): Array<
  Pick<RaceTemplate, 'id' | 'name' | 'statModifiers' | 'roles' | 'description' | 'minStat' | 'maxStat'>
> {
  return RACE_DEFINITIONS.map((race) => ({
    ...race,
  }));
}

export function resolveRace(input: string): RaceTemplate {
  const normalized = normalizeRaceInput(input);
  const match = RACE_DEFINITIONS.find((race) => normalizeRaceInput(race.id) === normalized || normalizeRaceInput(race.name) === normalized);
  if (!match) {
    throw new Error(`Unknown race: ${input}`);
  }
  return match;
}

export function isValidRace(input: string): boolean {
  try {
    resolveRace(input);
    return true;
  } catch {
    return false;
  }
}

function d20(): number {
  return randomInt(1, 21);
}

function d6(): number {
  return randomInt(1, 7);
}

function bounded(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomChoice<T>(items: T[]): T {
  return items[randomInt(0, items.length)];
}

function rollBase(): number {
  return 16 + d6() + d6() + d6();
}

function randomVariance(): number {
  return randomInt(0, 5) - 2;
}

export function rollCharacterForRace(raceInput: string): RaceRollResult {
  const race = resolveRace(raceInput);
  const selectedRole = randomChoice(race.roles);
  const trace: string[] = [];

  const baseStats = Object.fromEntries(
    STAT_NAMES.map((statName) => [statName, 0]),
  ) as StatBlock;
  const finalStats = Object.fromEntries(
    STAT_NAMES.map((statName) => [statName, 0]),
  ) as StatBlock;

  trace.push(`Race selected: ${race.name}`);
  trace.push(`Role selected: ${selectedRole.title} (${selectedRole.id})`);

  for (const statName of STAT_NAMES) {
    const statBase = rollBase();
    const raceBonus = race.statModifiers[statName as keyof StatBlock] ?? 0;
    const roleBonus = selectedRole.rollModifiers[statName as keyof StatBlock] ?? 0;
    const drift = randomVariance();
    const computed = bounded(statBase + raceBonus + roleBonus + drift, race.minStat, race.maxStat);
    const key = statName as keyof StatBlock;
    baseStats[key] = computed;
    finalStats[key] = d20() > 17 ? bounded(computed + 1, race.minStat, race.maxStat) : computed;
    trace.push(`${statName}: base ${statBase}, race ${raceBonus}, role ${roleBonus}, drift ${drift}`);
  }

  trace.push(`Roll profile version ${ROLL_PROFILE_VERSION}`);
  return {
    race: race.name,
    role: selectedRole.id,
    roleTitle: selectedRole.title,
    baseStats,
    finalStats,
    trace,
    rollProfileVersion: ROLL_PROFILE_VERSION,
  };
}
