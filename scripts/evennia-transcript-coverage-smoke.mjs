#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const transcriptPath = join(root, 'EVENNIA_SMOKE_TRANSCRIPT.md');
const transcript = readFileSync(transcriptPath, 'utf8');

const requiredTokens = [
  'create character <name> = <race>',
  'puppet <name>',
  '> join guild',
  '> circle status',
  '> train',
  '> perk',
  '> signature',
  '> milestone',
  '> passive',
  '> drill',
  '> practice',
  '> rite',
  '> boon',
  '> capstone',
  'Canal Bank Narrows',
  'Canal Bank Supply Tin',
  'Bank narrows count',
  'bank_mink',
  '> shop stock',
  '> task request',
  '> task complete',
  '> forage',
  '> appraise wild_herbs',
  '> target reed_snake',
  '> maneuvers',
  '> advance',
  '> combat',
  '> tend',
  '> skin corpse',
  'Async range combat',
  'DRCommandSmokeTests.test_all_guilds_join_and_reach_circle_ten_through_commands',
  'DRCommandSmokeTests.test_all_crossing_enemies_can_be_fought_through_command_loop',
];

const missingTokens = requiredTokens.filter((token) => !transcript.includes(token));

if (missingTokens.length > 0) {
  console.error('[evennia-transcript-coverage] missing required transcript tokens:');
  for (const token of missingTokens) {
    console.error(`- ${token}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({
  checked_tokens: requiredTokens.length,
  missing_tokens: [],
  path: 'EVENNIA_SMOKE_TRANSCRIPT.md',
}));
