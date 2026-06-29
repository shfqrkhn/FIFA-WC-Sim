#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const trigger = 'Iterate until reaching THE END. ';
const args = ['scripts/refinement-pass.mjs', '--trigger', trigger, ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
