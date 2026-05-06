import assert from 'node:assert/strict';
import type { CharacterRecord, SkillState } from '../src/storage.js';
import { canCircle, nextCircleRequirement, primarySkillForGuild, resolveCircleAdvancementRequest, totalSkillRanks } from '../src/progression.js';

function skill(name: string, rank: number, pool = 0): SkillState {
  return { name, rank, pool };
}

function character(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-unit',
    accountId: 'acct-unit',
    name: 'Unit',
    race: 'human',
    raceDisplayName: 'Human',
    role: 'modern_fixed',
    roleTitle: 'Modern fixed racial start',
    guildId: 'barbarian',
    guildName: 'Barbarian Guild',
    circle: 1,
    skills: {
      melee: skill('Melee', 0),
      athletics: skill('Athletics', 0),
      tactics: skill('Tactics', 0),
      scholarship: skill('Scholarship', 0),
    },
    roomId: 'crossing-TG01-001',
    stats: {
      strength: 10,
      reflex: 10,
      agility: 10,
      discipline: 10,
      stamina: 10,
      wisdom: 10,
      intelligence: 10,
      charisma: 10,
    },
    health: { current: 40, max: 40 },
    wallet: { plat: 0, trias: 0, lucan: 0, silk: 0 },
    rollTrace: [],
    rollProfileVersion: 2,
    statGenerationMode: 'modern_fixed',
    createdAt: new Date(0).toISOString(),
    inventory: [],
    hands: { left: null, right: null },
    stance: 'balanced',
    balance: 4,
    roundtimeMs: 0,
    ...overrides,
  };
}

assert.equal(primarySkillForGuild('barbarian'), 'melee');
assert.equal(primarySkillForGuild('moon_mage'), 'scholarship');
assert.equal(primarySkillForGuild('warrior_mage'), 'magic');
assert.equal(primarySkillForGuild('unknown'), 'athletics');

assert.deepEqual(nextCircleRequirement(character({ circle: 1 })), {
  nextCircle: 2,
  totalRanks: 6,
  primaryRank: 4,
});
assert.deepEqual(nextCircleRequirement(character({ circle: 9 })), {
  nextCircle: 10,
  totalRanks: 30,
  primaryRank: 20,
});

assert.equal(totalSkillRanks(character()), 0);
assert.equal(
  totalSkillRanks(
    character({
      skills: {
        melee: skill('Melee', 4),
        athletics: skill('Athletics', 2),
        tactics: skill('Tactics', 1),
      },
    }),
  ),
  7,
);

assert.equal(canCircle(character()), false);
assert.equal(
  canCircle(
    character({
      circle: 1,
      skills: {
        melee: skill('Melee', 4),
        athletics: skill('Athletics', 2),
      },
    }),
  ),
  true,
);
assert.equal(
  canCircle(
    character({
      circle: 1,
      skills: {
        melee: skill('Melee', 3),
        athletics: skill('Athletics', 20),
      },
    }),
  ),
  false,
);
assert.equal(
  canCircle(
    character({
      circle: 9,
      skills: {
        melee: skill('Melee', 20),
        athletics: skill('Athletics', 10),
      },
    }),
  ),
  true,
);

const registrars = [{ id: 'barbarian', roomId: 'crossing-GU10-001' }];

assert.deepEqual(
  resolveCircleAdvancementRequest(
    character({
      guildId: 'commoner',
      guildName: 'Unaffiliated',
      roomId: 'crossing-TG01-001',
    }),
    registrars,
  ),
  {
    allowed: false,
    reason: 'commoner',
    events: ['You need to join a guild before you can advance circles.'],
  },
);

assert.deepEqual(
  resolveCircleAdvancementRequest(character({ roomId: 'crossing-TG01-001' }), registrars),
  {
    allowed: false,
    reason: 'wrong_room',
    events: ['Travel to your Barbarian Guild registrar before requesting circle advancement.'],
  },
);

assert.deepEqual(
  resolveCircleAdvancementRequest(character({ guildId: 'bard', guildName: 'Bard Guild', roomId: 'crossing-GU10-001' }), registrars),
  {
    allowed: false,
    reason: 'wrong_room',
    events: ['Travel to your Bard Guild registrar before requesting circle advancement.'],
  },
);

assert.deepEqual(
  resolveCircleAdvancementRequest(character({ roomId: 'crossing-GU10-001' }), registrars),
  {
    allowed: true,
    registrarRoomId: 'crossing-GU10-001',
  },
);

console.log(JSON.stringify({ ok: true, suite: 'unit:progression', circleAdvancementRequestChecked: true }, null, 2));
