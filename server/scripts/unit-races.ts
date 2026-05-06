import assert from 'node:assert/strict';
import { fixedStartingStatsForRace, getAllRaces, rollCharacterForRace, type StatBlock } from '../src/races.js';

const expectedFixedStats: Record<string, StatBlock> = {
  Dwarf: { strength: 10, reflex: 8, agility: 8, discipline: 12, stamina: 12, wisdom: 10, intelligence: 10, charisma: 10 },
  Elf: { strength: 8, reflex: 12, agility: 12, discipline: 8, stamina: 8, wisdom: 10, intelligence: 10, charisma: 12 },
  Elothean: { strength: 8, reflex: 12, agility: 10, discipline: 10, stamina: 6, wisdom: 12, intelligence: 12, charisma: 10 },
  Gnome: { strength: 4, reflex: 14, agility: 12, discipline: 10, stamina: 6, wisdom: 10, intelligence: 14, charisma: 10 },
  "Gor'tog": { strength: 16, reflex: 8, agility: 10, discipline: 10, stamina: 14, wisdom: 6, intelligence: 6, charisma: 10 },
  Halfling: { strength: 6, reflex: 12, agility: 14, discipline: 8, stamina: 12, wisdom: 8, intelligence: 10, charisma: 10 },
  Human: { strength: 10, reflex: 10, agility: 10, discipline: 10, stamina: 10, wisdom: 10, intelligence: 10, charisma: 10 },
  Kaldar: { strength: 12, reflex: 10, agility: 10, discipline: 10, stamina: 10, wisdom: 8, intelligence: 8, charisma: 12 },
  Prydaen: { strength: 10, reflex: 14, agility: 10, discipline: 8, stamina: 10, wisdom: 6, intelligence: 10, charisma: 12 },
  Rakash: { strength: 10, reflex: 12, agility: 8, discipline: 12, stamina: 14, wisdom: 8, intelligence: 6, charisma: 10 },
  "S'Kra Mur": { strength: 12, reflex: 12, agility: 10, discipline: 10, stamina: 10, wisdom: 8, intelligence: 8, charisma: 10 },
};

const races = getAllRaces();
const forbiddenPublicDescriptionWords = ['archetype', 'baseline', 'profile', 'brawler', 'skirmisher', 'broker', 'tinker', 'berserker'];
assert.equal(races.length, 11);
assert.deepEqual(races.map((race) => race.name).sort(), Object.keys(expectedFixedStats).sort());

for (const race of races) {
  const expected = expectedFixedStats[race.name];
  for (const forbidden of forbiddenPublicDescriptionWords) {
    assert.equal(race.description.toLowerCase().includes(forbidden), false, `${race.name} public description leaked ${forbidden}`);
  }
  assert.deepEqual(race.fixedStartingStats, expected, `${race.name} API race fixed stats`);
  assert.deepEqual(fixedStartingStatsForRace(race.name), expected, `${race.name} fixedStartingStatsForRace`);

  const modernRoll = rollCharacterForRace(race.name);
  assert.equal(modernRoll.statGenerationMode, 'modern_fixed');
  assert.equal(modernRoll.role, 'modern_fixed');
  assert.deepEqual(modernRoll.baseStats, expected, `${race.name} modern base stats`);
  assert.deepEqual(modernRoll.finalStats, expected, `${race.name} modern final stats`);

  const classicRoll = rollCharacterForRace(race.name, 'classic_random');
  assert.equal(classicRoll.statGenerationMode, 'classic_random');
}

console.log(JSON.stringify({ ok: true, suite: 'unit:races', fixedRaceStatsChecked: races.length }, null, 2));
