export const BALANCE_LABELS = [
  'hopelessly unbalanced',
  'off balance',
  'solidly balanced',
  'very balanced',
  'incredibly balanced',
] as const;

export const STANCE_PROFILES = {
  balanced: { attack: 0, defense: 0, damage: 0, cost: 1, label: 'balanced stance' },
  offensive: { attack: 8, defense: -8, damage: 2, cost: 2, label: 'offensive stance' },
  defensive: { attack: -3, defense: 10, damage: -1, cost: 1, label: 'defensive stance' },
  evasive: { attack: -6, defense: 14, damage: -2, cost: 1, label: 'evasive stance' },
} as const;

export type StanceName = keyof typeof STANCE_PROFILES;

export const COMBAT_RANGES = ['missile', 'pole', 'melee'] as const;
export type CombatRangeName = typeof COMBAT_RANGES[number];

export const ADVANTAGE_LABELS = new Map<number, string>([
  [-2, 'your opponent has overwhelming advantage'],
  [-1, 'your opponent has the edge'],
  [0, 'neither combatant has advantage'],
  [1, 'you have the edge'],
  [2, 'you have overwhelming advantage'],
]);

export function normalizeBalance(raw: unknown): 0 | 1 | 2 | 3 | 4 {
  const value = Math.max(0, Math.min(4, Math.floor(Number(raw) || 0)));
  return value as 0 | 1 | 2 | 3 | 4;
}

export function formatBalance(balance: unknown): string {
  return BALANCE_LABELS[normalizeBalance(balance)];
}

export function applyBalanceChange(balance: unknown, amount: number): 0 | 1 | 2 | 3 | 4 {
  return normalizeBalance(normalizeBalance(balance) + Math.floor(amount));
}

export function normalizeStance(raw: unknown): StanceName {
  const value = String(raw ?? '').toLowerCase();
  return value in STANCE_PROFILES ? (value as StanceName) : 'balanced';
}

export function normalizeRange(raw: unknown): CombatRangeName {
  const value = String(raw ?? '').toLowerCase();
  return COMBAT_RANGES.includes(value as CombatRangeName) ? (value as CombatRangeName) : 'missile';
}

export function formatRange(range: CombatRangeName): string {
  if (range === 'missile') return 'missile range';
  if (range === 'pole') return 'pole range';
  return 'melee range';
}

export function shiftCombatRange(range: CombatRangeName, direction: 'advance' | 'retreat'): CombatRangeName {
  const current = COMBAT_RANGES.indexOf(range);
  const next = direction === 'advance' ? Math.min(COMBAT_RANGES.length - 1, current + 1) : Math.max(0, current - 1);
  return COMBAT_RANGES[next];
}

export function normalizeAdvantage(raw: unknown): number {
  return Math.max(-2, Math.min(2, Math.floor(Number(raw) || 0)));
}

export function shiftAdvantageValue(advantage: unknown, amount: number): number {
  return normalizeAdvantage(normalizeAdvantage(advantage) + Math.floor(amount));
}

export function formatAdvantage(advantage: number): string {
  return ADVANTAGE_LABELS.get(normalizeAdvantage(advantage)) ?? ADVANTAGE_LABELS.get(0)!;
}

export type AttackRollResult = {
  hit: boolean;
  roll: number;
  threshold: number;
};

export type AttackOutcomeResult = {
  targetHp: number;
  collapsed: boolean;
  advantageShift: number;
  events: string[];
};

export type AttackCycleStatus = {
  ready: boolean;
  remainingMs: number;
  events: string[];
};

export function resolveAttackCycleStatus(nextAttackAt: number, now: number): AttackCycleStatus {
  const remainingMs = Math.max(0, Math.floor(nextAttackAt) - Math.floor(now));
  if (remainingMs <= 0) {
    return { ready: true, remainingMs: 0, events: [] };
  }
  return {
    ready: false,
    remainingMs,
    events: [`Your target is still in the attack cycle (${remainingMs}ms).`],
  };
}

export function buildTargetVanishedEvents(): string[] {
  return ['Your target vanished from the world.'];
}

export function resolveAttackOutcome(targetName: string, currentHp: number, damage: number, attack: AttackRollResult): AttackOutcomeResult {
  if (!attack.hit) {
    return {
      targetHp: currentHp,
      collapsed: false,
      advantageShift: -1,
      events: [`You miss ${targetName}.`],
    };
  }

  const targetHp = Math.max(0, currentHp - Math.max(0, Math.floor(damage)));
  const events = [`You hit ${targetName} for ${Math.max(0, Math.floor(damage))} (${attack.roll}/${attack.threshold}).`];
  if (targetHp <= 0) {
    events.push(`${targetName} collapses.`);
  }
  return {
    targetHp,
    collapsed: targetHp <= 0,
    advantageShift: 1,
    events,
  };
}
