import assert from 'node:assert/strict';
import { findPathToRoom, normalizeDirection, resolveMovementDecision, type Room } from '../src/world.js';

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

console.log(JSON.stringify({ ok: true, suite: 'unit:world', movementDecisionChecked: true, pathfindingChecked: true }, null, 2));
