import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { acceptedTrigger, REFINEMENT_TRIGGER } from '../scripts/refinement-pass.mjs';

assert.equal(REFINEMENT_TRIGGER, 'Iterate until reaching THE END. ');
assert.equal(acceptedTrigger(REFINEMENT_TRIGGER), true);
assert.equal(acceptedTrigger(REFINEMENT_TRIGGER.trimEnd()), false);
assert.equal(acceptedTrigger('iterate until reaching THE END. '), false);

const selfTest = spawnSync(process.execPath, ['scripts/refinement-pass.mjs', '--self-test'], { encoding: 'utf8' });
assert.equal(selfTest.status, 0, selfTest.stderr || selfTest.stdout);
assert.match(selfTest.stdout, /refinement-pass self-test passed/);

const rejected = spawnSync(process.execPath, ['scripts/refinement-pass.mjs', '--trigger', REFINEMENT_TRIGGER.trimEnd()], { encoding: 'utf8' });
assert.notEqual(rejected.status, 0);
assert.match(rejected.stderr, /requires exact trigger phrase/);

console.log('refinement-pass tests passed');
