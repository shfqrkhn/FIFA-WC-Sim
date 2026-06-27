import assert from 'node:assert/strict';
import {
  COMMIT_CANDIDATES,
  isAuthorizedManualUpdateTrigger,
  MANUAL_UPDATE_TRIGGER,
  parseManualUpdateArgs,
  updateBaseDataArgs
} from '../scripts/manual-update-trigger.mjs';

assert.equal(MANUAL_UPDATE_TRIGGER, 'WC_DATA_RESCUE');
assert.equal(isAuthorizedManualUpdateTrigger('WC_DATA_RESCUE'), true);
assert.equal(isAuthorizedManualUpdateTrigger(' WC_DATA_RESCUE '), true);
assert.equal(isAuthorizedManualUpdateTrigger('wc_data_rescue'), false);
assert.equal(isAuthorizedManualUpdateTrigger(''), false);

const parsed = parseManualUpdateArgs(['--trigger', MANUAL_UPDATE_TRIGGER, '--no-fetch', '--push', '--scoreboard', 'data/scoreboards/manual.json'], {});
assert.equal(parsed.trigger, MANUAL_UPDATE_TRIGGER);
assert.equal(parsed.noFetch, true);
assert.equal(parsed.commit, true);
assert.equal(parsed.push, true);
assert.deepEqual(parsed.scoreboardFiles, ['data/scoreboards/manual.json']);
assert.deepEqual(updateBaseDataArgs(parsed), ['data/scoreboards/manual.json', '--no-fetch']);

const envParsed = parseManualUpdateArgs(['--commit'], { FIFA_WC_UPDATE_TRIGGER: MANUAL_UPDATE_TRIGGER });
assert.equal(envParsed.trigger, MANUAL_UPDATE_TRIGGER);
assert.equal(envParsed.commit, true);

assert.throws(() => parseManualUpdateArgs(['--unknown'], {}), /Unknown option/);
assert.ok(COMMIT_CANDIDATES.includes('docs/index.html'));
assert.ok(COMMIT_CANDIDATES.includes('data/calibration-state.json'));

console.log('manual update trigger tests passed');
