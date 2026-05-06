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

export type StatGenerationMode = 'modern_fixed' | 'classic_random';

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
  statGenerationMode: StatGenerationMode;
}

export interface RollProfileSummary {
  rollProfileVersion?: number;
  rollTrace?: string[];
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
      { id: 'adaptive', title: 'Private classic-random test profile A', rollModifiers: {} },
      { id: 'frontline', title: 'Private classic-random test profile B', rollModifiers: { strength: 2, stamina: 1, charisma: -1 } },
      { id: 'versatile', title: 'Private classic-random test profile C', rollModifiers: { agility: 1, reflex: 1, wisdom: 1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Humans are broadly adaptable people with even starting attributes and no racial extremes.',
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
      { id: 'scout', title: 'Private classic-random test profile A', rollModifiers: { agility: 1, reflex: 1, stamina: -1 } },
      { id: 'arts', title: 'Private classic-random test profile B', rollModifiers: { intelligence: 2, wisdom: 1, charisma: 1 } },
      { id: 'blade', title: 'Private classic-random test profile C', rollModifiers: { agility: 2, reflex: 1, discipline: -1 } },
    ],
    minStat: 17,
    maxStat: 41,
    description: 'Elves begin with strong agility, reflex, and charisma, balanced by lighter strength and stamina.',
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
      { id: 'guardian', title: 'Private classic-random test profile A', rollModifiers: { strength: 2, stamina: 1 } },
      { id: 'craft', title: 'Private classic-random test profile B', rollModifiers: { discipline: 2, wisdom: 1, agility: -1 } },
      { id: 'miner', title: 'Private classic-random test profile C', rollModifiers: { stamina: 1, reflex: -1 } },
    ],
    minStat: 18,
    maxStat: 42,
    description: 'Dwarves begin with strong stamina and discipline, balanced by lower reflex and agility.',
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
      { id: 'sage', title: 'Private classic-random test profile A', rollModifiers: { wisdom: 2, intelligence: 2, discipline: 1 } },
      { id: 'binder', title: 'Private classic-random test profile B', rollModifiers: { charisma: 1, wisdom: 1 } },
      { id: 'mender', title: 'Private classic-random test profile C', rollModifiers: { intelligence: 1, agility: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Elotheans begin with strong intelligence and wisdom, balanced by lighter strength and stamina.',
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
      { id: 'brawler', title: 'Private classic-random test profile A', rollModifiers: { strength: 2, discipline: -1 } },
      { id: 'wrestler', title: 'Private classic-random test profile B', rollModifiers: { stamina: 1, strength: 1 } },
      { id: 'beat', title: 'Private classic-random test profile C', rollModifiers: { reflex: -1, discipline: 1 } },
    ],
    minStat: 20,
    maxStat: 46,
    description: "Gor'togs begin with exceptional strength and stamina, balanced by lower reflex and agility.",
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
      { id: 'skirmish', title: 'Private classic-random test profile A', rollModifiers: { agility: 2, reflex: 2 } },
      { id: 'trader', title: 'Private classic-random test profile B', rollModifiers: { charisma: 2, intelligence: 1 } },
      { id: 'lightfoot', title: 'Private classic-random test profile C', rollModifiers: { agility: 1, stamina: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Halflings begin with strong agility, reflex, and stamina, balanced by lower strength and discipline.',
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
      { id: 'seer', title: 'Private classic-random test profile A', rollModifiers: { wisdom: 2, intelligence: 1 } },
      { id: 'rider', title: 'Private classic-random test profile B', rollModifiers: { agility: 1, reflex: 1, strength: -1 } },
      { id: 'warden', title: 'Private classic-random test profile C', rollModifiers: { stamina: 1, discipline: 1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: "S'Kra Mur begin with strong strength and reflex, with even physical development and lower mental/social starts.",
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
      { id: 'striker', title: 'Private classic-random test profile A', rollModifiers: { reflex: 2, agility: 2 } },
      { id: 'trance', title: 'Private classic-random test profile B', rollModifiers: { wisdom: 1, discipline: -1 } },
      { id: 'watch', title: 'Private classic-random test profile C', rollModifiers: { discipline: 1, wisdom: 1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Rakash begin with strong stamina, discipline, and reflex, balanced by lower agility and mental starts.',
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
      { id: 'seer', title: 'Private classic-random test profile A', rollModifiers: { wisdom: 2, intelligence: 1 } },
      { id: 'healer', title: 'Private classic-random test profile B', rollModifiers: { wisdom: 1, charisma: 1 } },
      { id: 'guide', title: 'Private classic-random test profile C', rollModifiers: { discipline: 1, stamina: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Prydaen begin with strong reflex and charisma, balanced by lower discipline and wisdom.',
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
      { id: 'tinker', title: 'Private classic-random test profile A', rollModifiers: { intelligence: 2, reflex: 1 } },
      { id: 'inquisitor', title: 'Private classic-random test profile B', rollModifiers: { wisdom: 1, discipline: 1 } },
      { id: 'ambush', title: 'Private classic-random test profile C', rollModifiers: { agility: 1, reflex: 1, strength: -1 } },
    ],
    minStat: 16,
    maxStat: 40,
    description: 'Gnomes begin with strong reflex, agility, and intelligence, balanced by lower strength and stamina.',
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
      { id: 'berserker', title: 'Private classic-random test profile A', rollModifiers: { strength: 2, stamina: 1, discipline: -1 } },
      { id: 'crusher', title: 'Private classic-random test profile B', rollModifiers: { discipline: 1, strength: 1 } },
      { id: 'warden', title: 'Private classic-random test profile C', rollModifiers: { charisma: -1, wisdom: -1, stamina: 1 } },
    ],
    minStat: 18,
    maxStat: 44,
    description: 'Kaldar begin with strong strength and charisma, with balanced physical starts and lower wisdom/intelligence.',
  },
];

const MODERN_FIXED_STARTING_STATS: Record<string, StatBlock> = {
  dwarf: { strength: 10, reflex: 8, agility: 8, discipline: 12, stamina: 12, wisdom: 10, intelligence: 10, charisma: 10 },
  elf: { strength: 8, reflex: 12, agility: 12, discipline: 8, stamina: 8, wisdom: 10, intelligence: 10, charisma: 12 },
  elothean: { strength: 8, reflex: 12, agility: 10, discipline: 10, stamina: 6, wisdom: 12, intelligence: 12, charisma: 10 },
  gnome: { strength: 4, reflex: 14, agility: 12, discipline: 10, stamina: 6, wisdom: 10, intelligence: 14, charisma: 10 },
  gortog: { strength: 16, reflex: 8, agility: 10, discipline: 10, stamina: 14, wisdom: 6, intelligence: 6, charisma: 10 },
  halfling: { strength: 6, reflex: 12, agility: 14, discipline: 8, stamina: 12, wisdom: 8, intelligence: 10, charisma: 10 },
  human: { strength: 10, reflex: 10, agility: 10, discipline: 10, stamina: 10, wisdom: 10, intelligence: 10, charisma: 10 },
  kaldar: { strength: 12, reflex: 10, agility: 10, discipline: 10, stamina: 10, wisdom: 8, intelligence: 8, charisma: 12 },
  prydaen: { strength: 10, reflex: 14, agility: 10, discipline: 8, stamina: 10, wisdom: 6, intelligence: 10, charisma: 12 },
  rakash: { strength: 10, reflex: 12, agility: 8, discipline: 12, stamina: 14, wisdom: 8, intelligence: 6, charisma: 10 },
  skramur: { strength: 12, reflex: 12, agility: 10, discipline: 10, stamina: 10, wisdom: 8, intelligence: 8, charisma: 10 },
};

function normalizeRaceInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

export const ROLL_PROFILE_VERSION = 2;

export function getAllRaces(): Array<
  Pick<RaceTemplate, 'id' | 'name' | 'statModifiers' | 'roles' | 'description' | 'minStat' | 'maxStat'> & {
    fixedStartingStats: StatBlock;
  }
> {
  return RACE_DEFINITIONS.map((race) => ({
    ...race,
    fixedStartingStats: fixedStartingStatsForRace(race.name),
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

export function normalizeStatGenerationMode(input: unknown): StatGenerationMode {
  return input === 'classic_random' ? 'classic_random' : 'modern_fixed';
}

export function normalizeStoredRaceRollMetadata(character: {
  role?: string;
  roleTitle?: string;
  rollTrace?: string[];
  statGenerationMode?: StatGenerationMode;
  rollProfileVersion?: number;
}): boolean {
  let changed = false;
  const mode = normalizeStatGenerationMode(character.statGenerationMode);
  const oldRoleTitle = String(character.roleTitle ?? '');

  if (character.statGenerationMode !== mode) {
    character.statGenerationMode = mode;
    changed = true;
  }

  if (mode === 'modern_fixed') {
    if (character.role !== 'modern_fixed') {
      character.role = 'modern_fixed';
      changed = true;
    }
    if (character.roleTitle !== 'Modern fixed racial start') {
      character.roleTitle = 'Modern fixed racial start';
      changed = true;
    }
    return changed;
  }

  if (!oldRoleTitle.startsWith('Private classic-random test profile ')) {
    const profileSuffix = character.role?.endsWith('b') || oldRoleTitle.match(/\b(B|Frontline|Scholar|Craftmaster|Binder|Wrestler|Broker|Rider|Trancefighter|Healer|Inquisitive|Crusher)\b/)
      ? 'B'
      : character.role?.endsWith('c') || oldRoleTitle.match(/\b(C|Versatile|Quickblade|Breach|Mender|Breaker|Lightfoot|Warden|Watchkeeper|Guide|Ambusher)\b/)
        ? 'C'
        : 'A';
    character.roleTitle = `Private classic-random test profile ${profileSuffix}`;
    changed = true;
  }

  if (Array.isArray(character.rollTrace)) {
    const nextTrace = character.rollTrace.map((entry) =>
      entry.startsWith('Role selected:')
        ? entry.replace('Role selected:', 'Private classic-random test profile selected:')
        : entry,
    );
    if (nextTrace.some((entry, index) => entry !== character.rollTrace?.[index])) {
      character.rollTrace = nextTrace;
      changed = true;
    }
  }

  return changed;
}

export function buildRollProfileEvents(summary: RollProfileSummary): string[] {
  const version = Number.isFinite(summary.rollProfileVersion) ? Math.floor(summary.rollProfileVersion ?? 0) : 0;
  const firstTrace = summary.rollTrace?.[0] || 'No trace';
  return [`Current roll profile v${version}, ${firstTrace}.`];
}

export function fixedStartingStatsForRace(raceInput: string): StatBlock {
  const race = resolveRace(raceInput);
  const fixed = MODERN_FIXED_STARTING_STATS[normalizeRaceInput(race.id)];
  if (!fixed) {
    throw new Error(`Missing fixed starting stats for race: ${race.name}`);
  }
  return { ...fixed };
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

export function rollCharacterForRace(raceInput: string, mode: StatGenerationMode = 'modern_fixed'): RaceRollResult {
  const race = resolveRace(raceInput);
  const statGenerationMode = normalizeStatGenerationMode(mode);
  if (statGenerationMode === 'modern_fixed') {
    const fixedStats = fixedStartingStatsForRace(race.name);
    return {
      race: race.name,
      role: 'modern_fixed',
      roleTitle: 'Modern fixed racial start',
      baseStats: { ...fixedStats },
      finalStats: { ...fixedStats },
      trace: [
        `Race selected: ${race.name}`,
        'Stat generation mode: modern_fixed',
        'Using DragonRealms fixed racial starting stats.',
        `Roll profile version ${ROLL_PROFILE_VERSION}`,
      ],
      rollProfileVersion: ROLL_PROFILE_VERSION,
      statGenerationMode,
    };
  }

  const selectedRole = randomChoice(race.roles);
  const trace: string[] = [];

  const baseStats = Object.fromEntries(
    STAT_NAMES.map((statName) => [statName, 0]),
  ) as StatBlock;
  const finalStats = Object.fromEntries(
    STAT_NAMES.map((statName) => [statName, 0]),
  ) as StatBlock;

  trace.push(`Race selected: ${race.name}`);
  trace.push('Stat generation mode: classic_random');
  trace.push(`Private classic-random test profile selected: ${selectedRole.title} (${selectedRole.id})`);

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
    statGenerationMode,
  };
}
