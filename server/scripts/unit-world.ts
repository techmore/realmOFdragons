import assert from 'node:assert/strict';
import { buildRoomSurveyEvents, findPathToRoom, normalizeDirection, resolveMovementDecision, type Room } from '../src/world.js';

const start: Room = {
  id: 'test-start',
  code: { town: 'test', square: 'ST01', zone: 'test-zone' },
  title: 'Test Start',
  description: 'A test room.',
  prompts: [],
  exits: [
    { direction: 'north', destination: 'test-north', details: 'North.' },
    { direction: 'east', destination: 'test-missing', details: 'Broken.' },
  ],
};

const north: Room = {
  id: 'test-north',
  code: { town: 'test', square: 'NO01', zone: 'test-zone' },
  title: 'North Room',
  description: 'A northern room.',
  prompts: [],
  exits: [{ direction: 'south', destination: 'test-start', details: 'Back.' }],
};

const fullRoom: Room = {
  id: 'test-full',
  code: { town: 'test', square: 'FU01', zone: 'test-zone' },
  title: 'Full Room',
  description: 'A fully featured room.',
  prompts: [],
  exits: [{ direction: 'west', destination: 'test-start', details: 'Back.' }],
  forage: {
    difficulty: 2,
    items: [{ code: 'forage-test', name: 'test herb' }],
  },
  shop: {
    code: 'test-shop',
    name: 'Test Shop',
    items: [{ code: 'test-item', name: 'test item', price: 1, currency: 'trias' }],
  },
};

const east: Room = {
  id: 'test-east',
  code: { town: 'test', square: 'EA01', zone: 'test-zone' },
  title: 'East Room',
  description: 'An eastern room.',
  prompts: [],
  exits: [],
};

const rooms = { [start.id]: start, [north.id]: north, [east.id]: east };

assert.equal(normalizeDirection('n'), 'north');
assert.equal(normalizeDirection('go n'), 'north');
assert.equal(normalizeDirection('  go east  '), 'east');
assert.equal(normalizeDirection('out'), 'exit');
assert.equal(normalizeDirection('dance'), 'dance');

assert.deepEqual(resolveMovementDecision('n', start, rooms), {
  moved: true,
  direction: 'north',
  nextRoom: north,
  events: ['You go north to North Room.'],
});

assert.deepEqual(resolveMovementDecision('east', start, rooms), {
  moved: false,
  reason: 'broken_exit',
  direction: 'east',
  events: ['That path is broken in the world data.'],
});

assert.deepEqual(resolveMovementDecision('dance', start, rooms), {
  moved: false,
  reason: 'unknown_command',
  direction: 'dance',
  events: ['Unknown command: dance'],
});

assert.deepEqual(findPathToRoom('test-start', 'test-start', rooms), []);
assert.deepEqual(findPathToRoom('test-start', 'test-north', rooms), ['north']);
assert.deepEqual(findPathToRoom('test-north', 'test-start', rooms), ['south']);
assert.deepEqual(findPathToRoom('test-start', 'test-east', rooms), []);
assert.deepEqual(findPathToRoom('test-start', 'test-missing', rooms), []);

assert.deepEqual(buildRoomSurveyEvents(start), [
  'Surveying Test Start:',
  'Exits: north, east.',
  'Forage: nothing obvious.',
  'Shop: none visible.',
  'Guild registrar: none visible.',
  'Targets: none immediate.',
]);

assert.deepEqual(buildRoomSurveyEvents(fullRoom, {
  guildRegistrarEvent: 'Guild registrar: Test Guild.',
  targetNames: ['test rat', 'test goblin'],
}), [
  'Surveying Full Room:',
  'Exits: west.',
  'Forage: difficulty 2; possible finds test herb.',
  'Shop: Test Shop (1 catalog item(s)).',
  'Guild registrar: Test Guild.',
  'Targets: test rat, test goblin.',
]);

console.log(JSON.stringify({ ok: true, suite: 'unit:world', movementDecisionChecked: true, pathfindingChecked: true, roomSurveyChecked: true }, null, 2));
