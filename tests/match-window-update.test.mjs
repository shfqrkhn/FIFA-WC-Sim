import assert from 'node:assert/strict';
import {
  ACTIVE_LOCK_END_MIN,
  evaluateMatchWindow,
  parseMatchWindowArgs
} from '../scripts/match-window-update.mjs';

const baseData = {
  matches: [
    { no: 1, stage: 'group', teamA: 'Alpha', teamB: 'Beta', date: '2026-06-20T18:00:00Z' },
    { no: 2, stage: 'group', teamA: 'Gamma', teamB: 'Delta', date: '2026-06-21T18:00:00Z' },
    { no: 3, stage: 'group', teamA: 'Epsilon', teamB: 'Zeta', date: '2026-06-21T00:00:00Z', played: true }
  ],
  knockout: []
};

const pre = evaluateMatchWindow(baseData, '2026-06-20T17:00:00Z');
assert.equal(pre.shouldRun, true);
assert.equal(pre.reason, 'pre_kickoff');
assert.deepEqual(pre.pre.map(match => match.no), [1]);

const active = evaluateMatchWindow(baseData, '2026-06-20T18:30:00Z');
assert.equal(active.shouldRun, false);
assert.equal(active.reason, 'active_match_lock');
assert.deepEqual(active.active.map(match => match.no), [1]);

const overlap = evaluateMatchWindow({
  matches: [
    { no: 1, stage: 'group', teamA: 'Alpha', teamB: 'Beta', date: '2026-06-20T18:00:00Z' },
    { no: 2, stage: 'group', teamA: 'Gamma', teamB: 'Delta', date: '2026-06-20T20:30:00Z' }
  ],
  knockout: []
}, '2026-06-20T18:30:00Z');
assert.equal(overlap.shouldRun, true);
assert.equal(overlap.mode, 'freeze_only');
assert.equal(overlap.reason, 'pre_kickoff_freeze_only_active_lock');
assert.deepEqual(overlap.active.map(match => match.no), [1]);
assert.deepEqual(overlap.pre.map(match => match.no), [2]);

const post = evaluateMatchWindow(baseData, '2026-06-20T20:15:00Z');
assert.equal(post.shouldRun, true);
assert.equal(post.mode, 'full_update');
assert.equal(post.reason, 'post_match');
assert.deepEqual(post.post.map(match => match.no), [1]);

const outside = evaluateMatchWindow(baseData, '2026-06-20T14:00:00Z');
assert.equal(outside.shouldRun, false);
assert.equal(outside.reason, 'outside_match_window');

const ignored = evaluateMatchWindow(baseData, '2026-06-20T18:30:00Z', { ignoreActiveLock: true });
assert.equal(ignored.shouldRun, false);
assert.equal(ignored.active.length, 1);

const forced = evaluateMatchWindow(baseData, '2026-06-20T14:00:00Z', { force: true });
assert.equal(forced.shouldRun, true);
assert.equal(forced.reason, 'forced');

assert.equal(ACTIVE_LOCK_END_MIN, 135);
assert.deepEqual(parseMatchWindowArgs(['--now', '2026-06-20T17:00:00Z', '--no-fetch', '--force'], {}).nowUtc, '2026-06-20T17:00:00Z');

console.log('match-window update tests passed');
