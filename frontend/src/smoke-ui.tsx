import { renderToStaticMarkup } from 'react-dom/server';
import { GameStatusPanels, type Character, type Room } from './App.js';

function assertIncludes(markup: string, expected: string): void {
  if (!markup.includes(expected)) {
    throw new Error(`Expected UI markup to include: ${expected}`);
  }
}

const room: Room = {
  id: 'crossing-TG01-001',
  code: { town: 'crossing', square: 'TG01', zone: 'crossing-town' },
  title: 'Crossing Town Green',
  description: 'A broad square with clean-room test fixtures.',
  prompts: ['You see a fountain.', 'A guard watches the road.'],
  guild: 'fighter',
  exits: [
    { direction: 'north', destination: 'crossing-IN02-001', details: 'Toward inns.' },
    { direction: 'east', destination: 'crossing-MA01-001', details: 'Toward training.' },
  ],
  forage: {
    difficulty: 1,
    items: [{ code: 'foraged-fieldherb', name: 'field herb bundle' }],
  },
  shop: {
    code: 'test-shop',
    name: 'Test Gear Stand',
    items: [
      { code: 'itm-test-blade', name: 'test blade', price: 3, currency: 'trias' },
      { code: 'itm-sting-arrow', name: 'practice arrow', price: 12, currency: 'trias' },
    ],
  },
};

const character: Character = {
  id: 'char-ui',
  name: 'UiScout',
  race: 'human',
  raceDisplayName: 'Human',
  role: 'baseline',
  roleTitle: 'Baseline',
  guildId: 'fighter',
  guildName: 'Fighter Guild',
  circle: 4,
  skills: {
    melee: { name: 'Melee', rank: 7, pool: 2 },
    evasion: { name: 'Evasion', rank: 5, pool: 1 },
  },
  roomId: room.id,
  health: { current: 31, max: 38 },
  hands: { right: 'itm-test-blade', left: null },
  inventory: ['itm-test-blade', 'forage wolf-cub fang', 'damaged-itm-sting-arrow'],
  ammoPouch: { 'itm-sting-arrow': 4 },
  loadedAmmo: { 'itm-practice-bow': 'itm-sting-arrow' },
  recoverableAmmo: { 'itm-sting-arrow': 1 },
  worn: ['leather backpack'],
  equipment: { back: 'leather backpack' },
  wallet: { plat: 40, trias: 77, lucan: 0, silk: 0 },
  combat: {
    targetId: 'rv-wolf-cub',
    targetName: 'forage wolf-cub',
    targetHp: 4,
    targetMaxHp: 12,
    defendUntil: 0,
    nextAttackAt: 0,
    range: 'melee',
    advantage: 1,
  },
  stance: 'balanced',
  balance: 4,
  stats: {
    strength: 10,
    reflex: 11,
    agility: 12,
    discipline: 13,
    stamina: 14,
    wisdom: 15,
    intelligence: 16,
    charisma: 17,
  },
  rollProfileVersion: 1,
  roundtimeMs: 0,
};

const markup = renderToStaticMarkup(
  <GameStatusPanels
    character={character}
    room={room}
    selectedCharacter={character}
    skillEntries={Object.entries(character.skills)}
    localTargets={[{ id: 'rv-wolf-cub', name: 'forage wolf-cub', vitality: 12, aggression: 55 }]}
    itemDetails={[
      {
        code: 'itm-test-blade',
        name: 'test blade',
        category: 'weapon',
        description: 'A static smoke blade.',
        value: 3,
        currency: 'trias',
        source: 'shop',
        slot: undefined,
        armor: 0,
        evasionPenalty: 0,
        attackModifier: 2,
        weaponRange: 'melee',
        validAttackRanges: ['melee'],
        trainingSkill: 'melee',
        ammoCode: undefined,
        ammoName: undefined,
        carried: true,
        shopAvailable: true,
      },
      {
        code: 'forage wolf-cub fang',
        name: 'forage wolf-cub fang',
        category: 'trophy',
        description: 'A beginner hunting trophy.',
        value: 1,
        currency: 'trias',
        source: 'loot',
        slot: undefined,
        armor: 0,
        evasionPenalty: 0,
        attackModifier: 0,
        weaponRange: undefined,
        validAttackRanges: undefined,
        trainingSkill: undefined,
        ammoCode: undefined,
        ammoName: undefined,
        carried: true,
        shopAvailable: false,
      },
      {
        code: 'damaged-itm-sting-arrow',
        name: 'damaged practice arrow',
        category: 'salvage',
        description: 'damaged practice arrow is broken ranged ammunition.',
        value: 1,
        currency: 'trias',
        source: 'loot',
        slot: undefined,
        armor: 0,
        evasionPenalty: 0,
        attackModifier: 0,
        weaponRange: undefined,
        validAttackRanges: undefined,
        trainingSkill: undefined,
        ammoCode: undefined,
        ammoName: undefined,
        carried: true,
        shopAvailable: false,
      },
    ]}
  />,
);

const noShopMarkup = renderToStaticMarkup(
  <GameStatusPanels
    character={character}
    room={{ ...room, shop: undefined }}
    selectedCharacter={character}
    skillEntries={Object.entries(character.skills)}
    localTargets={[]}
    itemDetails={[]}
  />,
);

for (const expected of [
  'Room',
  'Room Affordances',
  'Structured survey summary from room state',
  'Exits mapped',
  'Forage available',
  'Shop service',
  'Guild registrar',
  'Targets visible',
  'difficulty 1: field herb bundle',
  'fighter',
  'Exits',
  'north',
  'east',
  'Test Gear Stand',
  'buy itm-test-blade',
  'Controls',
  'Forage',
  'Difficulty 1',
  'field herb bundle',
  'New here?',
  'help scan',
  'target &lt;name&gt;',
  'survey',
  'verb',
  'scan',
  'forage',
  'ammo',
  'reload',
  'recover arrows',
  'wield training sword',
  'range',
  'advance',
  'jab',
  'bash',
  'fire',
  'shoot',
  'Directional movement controls',
  'Visible Targets',
  'Vitality estimates staying power',
  'Vitality 12 · Aggression 55',
  'details',
  'advance',
  'attack',
  'Character',
  'UiScout | Human | Baseline',
  'Fighter Guild | Circle 4',
  'Right: itm-test-blade',
  'Left: empty',
  'Worn',
  'leather backpack',
  'Equipment Slots',
  'back: leather backpack',
  'Inventory',
  'Test Gear Stand stocks this item and can buy it.',
  'Test Gear Stand does not stock this item.',
  'Test Gear Stand buys matching salvage for trias.',
  'Ammo',
  'itm-sting-arrow x4',
  'Loaded: itm-practice-bow: itm-sting-arrow',
  'Recoverable: itm-sting-arrow x1',
  'Item Details',
  'test blade',
  'itm-test-blade | weapon | 3 trias',
  'slot held/carried | armor 0 | evasion penalty 0 | attack 2',
  'weapon melee | ranges melee | trains melee',
  'ammo none',
  'A static smoke blade.',
  'forage wolf-cub fang | trophy | 1 trias',
  'forage wolf-cub fang',
  'Combat',
  'forage wolf-cub: 4/12',
  'Range: melee',
  'Advantage: 1',
]) {
  assertIncludes(markup, expected);
}

for (const expected of [
  'Selling requires a local shop. Travel to a shop room before selling carried items.',
  'title="Selling requires a local shop."',
]) {
  assertIncludes(noShopMarkup, expected);
}

console.log(JSON.stringify({ ok: true, suite: 'frontend:smoke-ui' }, null, 2));
