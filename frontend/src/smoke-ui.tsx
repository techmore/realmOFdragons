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
  exits: [
    { direction: 'north', destination: 'crossing-IN02-001', details: 'Toward inns.' },
    { direction: 'east', destination: 'crossing-MA01-001', details: 'Toward training.' },
  ],
  shop: {
    code: 'test-shop',
    name: 'Test Gear Stand',
    items: [{ code: 'itm-test-blade', name: 'test blade', price: 3, currency: 'trias' }],
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
  inventory: ['itm-test-blade', 'forage wolf-cub fang'],
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
  />,
);

for (const expected of [
  'Room',
  'Exits',
  'north',
  'east',
  'Test Gear Stand',
  'buy itm-test-blade',
  'Controls',
  'scan',
  'range',
  'advance',
  'jab',
  'bash',
  'Directional movement controls',
  'Visible Targets',
  'Vitality 12 · Aggression 55',
  'advance',
  'attack',
  'Character',
  'UiScout | Human | Baseline',
  'Fighter Guild | Circle 4',
  'Right: itm-test-blade',
  'Left: empty',
  'Inventory',
  'forage wolf-cub fang',
  'Combat',
  'forage wolf-cub: 4/12',
  'Range: melee',
  'Advantage: 1',
]) {
  assertIncludes(markup, expected);
}

console.log(JSON.stringify({ ok: true, suite: 'frontend:smoke-ui' }, null, 2));
