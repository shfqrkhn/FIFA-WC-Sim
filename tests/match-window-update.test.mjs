import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  ACTIVE_LOCK_END_MIN,
  evaluateMatchWindow,
  parseMatchWindowArgs,
  POST_KICKOFF_SLOTS_MIN,
  STALE_RESULT_RECOVERY_END_MIN
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

const delayedPost = evaluateMatchWindow({
  matches: [
    { no: 59, stage: 'group', teamA: 'Algeria', teamB: 'Austria', date: '2026-06-28T02:00:00Z' },
    { no: 71, stage: 'group', teamA: 'Panama', teamB: 'England', date: '2026-06-27T21:00:00Z' }
  ],
  knockout: []
}, '2026-06-28T06:53:00Z');
assert.equal(delayedPost.shouldRun, true);
assert.equal(delayedPost.mode, 'full_update');
assert.equal(delayedPost.reason, 'post_match');
assert.deepEqual(delayedPost.post.map(match => match.no), [59, 71]);

const heavilyDelayedPost = evaluateMatchWindow({
  matches: [
    { no: 59, stage: 'group', teamA: 'Algeria', teamB: 'Austria', date: '2026-06-28T02:00:00Z' },
    { no: 71, stage: 'group', teamA: 'Panama', teamB: 'England', date: '2026-06-27T21:00:00Z' }
  ],
  knockout: []
}, '2026-06-28T09:51:57Z');
assert.equal(heavilyDelayedPost.shouldRun, true);
assert.equal(heavilyDelayedPost.mode, 'full_update');
assert.equal(heavilyDelayedPost.reason, 'stale_result_recovery');
assert.deepEqual(heavilyDelayedPost.post.map(match => match.no), [59, 71]);
assert.deepEqual(heavilyDelayedPost.post.map(match => match.phase), ['stale_result_recovery', 'stale_result_recovery']);

const staleBlockedByActive = evaluateMatchWindow({
  matches: [
    { no: 59, stage: 'group', teamA: 'Algeria', teamB: 'Austria', date: '2026-06-28T02:00:00Z' },
    { no: 61, stage: 'round-of-32', teamA: 'Winner A', teamB: 'Third C', date: '2026-06-28T09:30:00Z' }
  ],
  knockout: []
}, '2026-06-28T09:51:57Z');
assert.equal(staleBlockedByActive.shouldRun, false);
assert.equal(staleBlockedByActive.reason, 'active_match_lock');
assert.deepEqual(staleBlockedByActive.post.map(match => match.no), [59]);
assert.deepEqual(staleBlockedByActive.active.map(match => match.no), [61]);

const staleTooOld = evaluateMatchWindow({
  matches: [
    { no: 59, stage: 'group', teamA: 'Algeria', teamB: 'Austria', date: '2026-06-28T02:00:00Z' }
  ],
  knockout: []
}, '2026-06-29T00:30:00Z');
assert.equal(staleTooOld.shouldRun, false);
assert.equal(staleTooOld.reason, 'outside_match_window');

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
assert.equal(STALE_RESULT_RECOVERY_END_MIN, 1080);
assert.ok(POST_KICKOFF_SLOTS_MIN.includes(300));
assert.ok(POST_KICKOFF_SLOTS_MIN.includes(600));
assert.deepEqual(parseMatchWindowArgs(['--now', '2026-06-20T17:00:00Z', '--no-fetch', '--force'], {}).nowUtc, '2026-06-20T17:00:00Z');

const importFromEval = spawnSync(process.execPath, ['-e', "import('./scripts/match-window-update.mjs').then(m=>console.log(m.ACTIVE_LOCK_END_MIN))"], { encoding: 'utf8' });
assert.equal(importFromEval.status, 0, importFromEval.stderr || importFromEval.stdout);
assert.match(importFromEval.stdout, /135/);

console.log('match-window update tests passed');
