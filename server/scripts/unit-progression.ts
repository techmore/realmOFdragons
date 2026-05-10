import assert from 'node:assert/strict';
import type { CharacterRecord, SkillState } from '../src/storage.js';
import {
  GUILD_NAMES,
  STARTER_SKILLS,
  SKILL_ALIASES,
  SKILL_FAMILIES,
  applySkillPoolGain,
  buildCircleStatus,
  buildGuildRegistrarDisplay,
  buildScoreSummaryEvents,
  buildSkillFamilySummaryEvents,
  buildSkillSummaryEvents,
  buildStarterSkills,
  canCircle,
  ensureProgressionShape,
  isTrainingRoom,
  nextCircleRequirement,
  primarySkillForGuild,
  resolveSkillFamily,
  resolveSkillId,
  resolveCircleAdvancement,
  resolveCircleAdvancementRequest,
  resolveGuildJoinDecision,
  resolveTrainingDecision,
  totalSkillRanks,
} from '../src/progression.js';

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
      expertise: skill('Expertise', 0),
      instinct: skill('Instinct', 0),
      bardic_lore: skill('Bardic Lore', 0),
      melee: skill('Melee', 0),
      athletics: skill('Athletics', 0),
      tactics: skill('Tactics', 0),
      alchemy: skill('Alchemy', 0),
      primary_magic: skill('Primary Magic', 0),
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

assert.equal(primarySkillForGuild('barbarian'), 'expertise');
assert.equal(primarySkillForGuild('moon_mage'), 'astrology');
assert.equal(primarySkillForGuild('ranger'), 'instinct');
assert.equal(primarySkillForGuild('warrior_mage'), 'summoning');
assert.equal(primarySkillForGuild('unknown'), 'athletics');
assert.equal(GUILD_NAMES.commoner, 'Unaffiliated');
assert.equal(STARTER_SKILLS.length, 67);
assert.equal(SKILL_ALIASES.scouting, 'instinct');
assert.equal(SKILL_FAMILIES.guild.length, 11);
assert.equal(SKILL_FAMILIES.armor.length, 7);
assert.equal(SKILL_FAMILIES.weapon.length, 19);
assert.equal(SKILL_FAMILIES.magic.length, 12);
assert.equal(SKILL_FAMILIES.survival.length, 12);
assert.equal(SKILL_FAMILIES.lore.length, 13);

const starterSkills = buildStarterSkills();
assert.equal(starterSkills.melee.name, 'Melee');
assert.equal(starterSkills.expertise.name, 'Expertise');
assert.equal(starterSkills.instinct.name, 'Instinct');
assert.equal(starterSkills.scouting, undefined);
assert.equal(starterSkills.shield_usage.name, 'Shield Usage');
assert.equal(starterSkills.primary_magic.name, 'Primary Magic');
assert.equal(starterSkills.thanatology.name, 'Thanatology');
assert.equal(starterSkills.mechanical_lore.name, 'Mechanical Lore');
assert.equal(starterSkills.first_aid.name, 'First Aid');
assert.equal(starterSkills.trading.rank, 0);

const malformed = character({
  guildId: '',
  guildName: 'Bad Guild',
  circle: -4,
  skills: {
    melee: skill('Bad Melee', -2, -7),
  },
});
assert.equal(ensureProgressionShape(malformed), true);
assert.equal(malformed.guildId, 'commoner');
assert.equal(malformed.guildName, 'Unaffiliated');
assert.equal(malformed.circle, 1);
assert.equal(malformed.skills.melee.name, 'Melee');
assert.equal(malformed.skills.melee.rank, 0);
assert.equal(malformed.skills.melee.pool, 0);
assert.equal(malformed.skills.first_aid.name, 'First Aid');
assert.equal(malformed.skills.backstab.name, 'Backstab');
assert.equal(malformed.skills.instinct.name, 'Instinct');
assert.equal(malformed.skills.mechanical_lore.name, 'Mechanical Lore');
assert.equal(ensureProgressionShape(malformed), false);

const guildNameFix = character({
  guildId: 'barbarian',
  guildName: 'Wrong',
});
assert.equal(ensureProgressionShape(guildNameFix), true);
assert.equal(guildNameFix.guildName, 'Barbarian Guild');

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
        expertise: skill('Expertise', 4),
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
        expertise: skill('Expertise', 3),
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
        expertise: skill('Expertise', 20),
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

const circleReady = character({
  circle: 1,
  skills: {
    expertise: skill('Expertise', 4),
    athletics: skill('Athletics', 2),
  },
});

assert.deepEqual(buildCircleStatus(circleReady), [
  'Unit is Circle 1 in Barbarian Guild.',
  'Next Circle 2: total skill ranks 6/6.',
  'Expertise rank 4/4.',
]);

assert.deepEqual(buildSkillSummaryEvents(circleReady), [
  'expertise: Expertise rank 4, pool 0',
  'athletics: Athletics rank 2, pool 0',
]);
assert.equal(resolveSkillFamily('weapons'), 'weapon');
assert.equal(resolveSkillFamily('compat'), 'compatibility');
assert.equal(resolveSkillFamily('unknown'), null);
assert.equal(resolveSkillId(character(), 'Primary Magic'), 'primary_magic');
assert.equal(resolveSkillId(character(), 'bardic lore'), 'bardic_lore');
assert.equal(resolveSkillId(character(), 'scouting'), 'instinct');
assert.equal(resolveSkillId(character(), 'not a skill'), 'not_a_skill');
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'guild'), [
  'Skill family: guild.',
  'empathy: Empathy rank 0, pool 0',
  'astrology: Astrology rank 0, pool 0',
  'expertise: Expertise rank 4, pool 0',
  'instinct: Instinct rank 0, pool 0',
  'backstab: Backstab rank 0, pool 0',
  'summoning: Summoning rank 0, pool 0',
  'bardic_lore: Bardic Lore rank 0, pool 0',
  'conviction: Conviction rank 0, pool 0',
  'theurgy: Theurgy rank 0, pool 0',
  'thanatology: Thanatology rank 0, pool 0',
  'trading: Trading rank 0, pool 0',
]);
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'bogus'), [
  'Unknown skill family "bogus". Known families: guild, armor, weapon, magic, survival, lore, compatibility.',
]);
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'weapon').slice(0, 3), [
  'Skill family: weapon.',
  'expertise: Expertise rank 4, pool 0',
  'parry_ability: Parry Ability rank 0, pool 0',
]);
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'armor').slice(-2), [
  'defending: Defending rank 0, pool 0',
  'conviction: Conviction rank 0, pool 0',
]);
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'magic').slice(-3), [
  'astrology: Astrology rank 0, pool 0',
  'summoning: Summoning rank 0, pool 0',
  'theurgy: Theurgy rank 0, pool 0',
]);
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'survival').slice(-3), [
  'backstab: Backstab rank 0, pool 0',
  'instinct: Instinct rank 0, pool 0',
  'thanatology: Thanatology rank 0, pool 0',
]);
assert.deepEqual(buildSkillFamilySummaryEvents(circleReady, 'lore').slice(-4), [
  'tactics: Tactics rank 0, pool 0',
  'bardic_lore: Bardic Lore rank 0, pool 0',
  'empathy: Empathy rank 0, pool 0',
  'trading: Trading rank 0, pool 0',
]);

assert.deepEqual(
  buildScoreSummaryEvents(circleReady, {
    wallet: '0 plat, 0 trias, 0 lucan, 0 silk',
    stanceLabel: 'Balanced',
    balanceLabel: 'steady',
  }),
  [
    'You are Unit, race Human.',
    'Stats: modern fixed racial start.',
    'Guild: Barbarian Guild. Circle 1.',
    'Wallet: 0 plat, 0 trias, 0 lucan, 0 silk.',
    'Health 40/40.',
    'Stance: Balanced. Balance: steady.',
    'Current room crossing-TG01-001 | roundtime 0ms.',
    'Strength 10, Reflex 10, Agility 10, Discipline 10, Stamina 10, Wisdom 10, Intelligence 10, Charisma 10',
  ],
);

assert.equal(buildScoreSummaryEvents(character({ statGenerationMode: 'classic_random' }), {
  wallet: '1 plat',
  stanceLabel: 'Evasive',
  balanceLabel: 'excellent',
})[1], 'Stats: classic random roll.');

assert.deepEqual(resolveCircleAdvancement(character()), {
  advanced: false,
  circle: 1,
  events: [],
});

assert.deepEqual(resolveCircleAdvancement(circleReady), {
  advanced: true,
  circle: 2,
  events: ['You advance to Circle 2.'],
});

assert.equal(isTrainingRoom({ id: 'crossing-TG01-001' }), false);
assert.equal(isTrainingRoom({ id: 'crossing-MA01-001' }), true);
assert.equal(isTrainingRoom({ id: 'crossing-GU10-001', guild: 'barbarian' }), true);

assert.deepEqual(resolveGuildJoinDecision({}), {
  joined: false,
  reason: 'no_registrar',
  events: ['There is no guild registrar here.'],
});

assert.deepEqual(resolveGuildJoinDecision({ guild: 'barbarian' }), {
  joined: true,
  guildId: 'barbarian',
  guildName: 'Barbarian Guild',
  events: ['You are now registered with Barbarian Guild.'],
});

assert.deepEqual(resolveGuildJoinDecision({ guild: 'fighter' }), {
  joined: true,
  guildId: 'fighter',
  guildName: 'Fighter Guild',
  events: ['You are now registered with Fighter Guild.'],
});

assert.deepEqual(resolveGuildJoinDecision({ guild: 'cleanroom_test_guild' }), {
  joined: true,
  guildId: 'cleanroom_test_guild',
  guildName: 'cleanroom_test_guild',
  events: ['You are now registered with cleanroom_test_guild.'],
});

assert.deepEqual(buildGuildRegistrarDisplay({}), {
  visible: false,
  guildId: null,
  guildName: null,
  event: 'Guild registrar: none visible.',
});

assert.deepEqual(buildGuildRegistrarDisplay({ guild: 'barbarian' }), {
  visible: true,
  guildId: 'barbarian',
  guildName: 'Barbarian Guild',
  event: 'Guild registrar: Barbarian Guild.',
});

assert.deepEqual(buildGuildRegistrarDisplay({ guild: 'cleanroom_test_guild' }), {
  visible: true,
  guildId: 'cleanroom_test_guild',
  guildName: 'cleanroom_test_guild',
  event: 'Guild registrar: cleanroom_test_guild.',
});

assert.deepEqual(resolveTrainingDecision(character(), { id: 'crossing-TG01-001' }), {
  allowed: false,
  reason: 'wrong_room',
  events: ['This is not a useful place to train.'],
});

assert.deepEqual(resolveTrainingDecision(character(), { id: 'crossing-GU10-001', guild: 'barbarian' }), {
  allowed: true,
  skillId: 'expertise',
  skillName: 'Expertise',
  primarySkillId: 'expertise',
  gains: [
    { skillId: 'expertise', amount: 5 },
    { skillId: 'athletics', amount: 1 },
  ],
  events: ['You drill Expertise.'],
});

assert.deepEqual(resolveTrainingDecision(character(), { id: 'crossing-GU10-001', guild: 'barbarian' }, 'tactics'), {
  allowed: true,
  skillId: 'tactics',
  skillName: 'Tactics',
  primarySkillId: 'expertise',
  gains: [
    { skillId: 'tactics', amount: 3 },
    { skillId: 'athletics', amount: 1 },
  ],
  events: ['You drill Tactics.'],
});

assert.deepEqual(resolveTrainingDecision(character(), { id: 'crossing-GU10-001', guild: 'barbarian' }, 'athletics'), {
  allowed: true,
  skillId: 'athletics',
  skillName: 'Athletics',
  primarySkillId: 'expertise',
  gains: [{ skillId: 'athletics', amount: 3 }],
  events: ['You drill Athletics.'],
});

assert.deepEqual(resolveTrainingDecision(character(), { id: 'crossing-GU10-001', guild: 'barbarian' }, 'alchemy'), {
  allowed: true,
  skillId: 'alchemy',
  skillName: 'Alchemy',
  primarySkillId: 'expertise',
  gains: [
    { skillId: 'alchemy', amount: 3 },
    { skillId: 'athletics', amount: 1 },
  ],
  events: ['You drill Alchemy.'],
});

assert.deepEqual(resolveTrainingDecision(character(), { id: 'crossing-GU10-001', guild: 'barbarian' }, 'bardic lore'), {
  allowed: true,
  skillId: 'bardic_lore',
  skillName: 'Bardic Lore',
  primarySkillId: 'expertise',
  gains: [
    { skillId: 'bardic_lore', amount: 3 },
    { skillId: 'athletics', amount: 1 },
  ],
  events: ['You drill Bardic Lore.'],
});

assert.deepEqual(resolveTrainingDecision(character({ guildId: 'ranger' }), { id: 'crossing-GU14-001', guild: 'ranger' }, 'scouting'), {
  allowed: true,
  skillId: 'instinct',
  skillName: 'Instinct',
  primarySkillId: 'instinct',
  gains: [
    { skillId: 'instinct', amount: 5 },
    { skillId: 'athletics', amount: 1 },
  ],
  events: ['You drill Instinct.'],
});

const gainCharacter = character();
assert.deepEqual(applySkillPoolGain(gainCharacter, 'melee', 2), {
  applied: true,
  skillId: 'melee',
  rank: 0,
  pool: 2,
  events: [],
});
assert.equal(gainCharacter.skills.melee.rank, 0);
assert.equal(gainCharacter.skills.melee.pool, 2);

assert.deepEqual(applySkillPoolGain(gainCharacter, 'melee', 3), {
  applied: true,
  skillId: 'melee',
  rank: 1,
  pool: 0,
  events: ['Melee improves to rank 1.'],
});
assert.equal(gainCharacter.skills.melee.rank, 1);
assert.equal(gainCharacter.skills.melee.pool, 0);

assert.deepEqual(applySkillPoolGain(gainCharacter, 'melee', 0), {
  applied: true,
  skillId: 'melee',
  rank: 1,
  pool: 1,
  events: [],
});

assert.deepEqual(applySkillPoolGain(gainCharacter, 'cleanroom_fake_skill', 5), {
  applied: false,
  skillId: 'cleanroom_fake_skill',
  rank: 0,
  pool: 0,
  events: [],
});

console.log(
  JSON.stringify(
    {
      ok: true,
      suite: 'unit:progression',
      circleAdvancementRequestChecked: true,
      circleStatusChecked: true,
      circleAdvancementChecked: true,
      guildJoinDecisionChecked: true,
      guildRegistrarDisplayChecked: true,
      scoreSummaryChecked: true,
      skillSummaryChecked: true,
      trainingDecisionChecked: true,
      skillPoolGainChecked: true,
      progressionShapeChecked: true,
    },
    null,
    2,
  ),
);
