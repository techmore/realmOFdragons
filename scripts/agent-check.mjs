#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const status = git(['status', '--short']);
const remote = git(['remote', '-v']);
const branch = git(['branch', '--show-current']);

const summary = {
  ok: true,
  branch,
  hasRemote: remote.length > 0,
  dirty: status.length > 0,
  changedFiles: status ? status.split('\n') : [],
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.hasRemote) {
  console.error('No git remote configured. Add origin before expecting autonomous pushes.');
  process.exitCode = 1;
}
