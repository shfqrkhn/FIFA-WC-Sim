#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readArtifact } from './base-data.mjs';
import { runPythonScript } from './node-python.mjs';

export const PRE_KICKOFF_SLOTS_MIN = Object.freeze([120, 60, 15]);
export const POST_KICKOFF_SLOTS_MIN = Object.freeze([135, 240, 300, 450, 600, 720]);
export const SLOT_TOLERANCE_MIN = 18;
export const ACTIVE_LOCK_START_MIN = -10;
export const ACTIVE_LOCK_END_MIN = 135;
export const STALE_RESULT_RECOVERY_END_MIN = 18 * 60;

function getArg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

export function parseMatchWindowArgs(argv = [], env = process.env) {
  return {
    nowUtc: getArg(argv, '--now') || env.MATCH_WINDOW_NOW || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    noFetch: argv.includes('--no-fetch'),
    force: argv.includes('--force'),
    ignoreActiveLock: argv.includes('--ignore-active-lock')
  };
}

export function matchDateValue(match) {
  return match && (match.kickoffUtc || match.kickoff || match.kickoffLocal || match.date || match.utc || match.time);
}

export function matchKickoffMs(match) {
  const raw = matchDateValue(match);
  if (!raw || !String(raw).includes('T')) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function nearSlot(deltaMin, slots) {
  return slots.some(slot => Math.abs(deltaMin - slot) <= SLOT_TOLERANCE_MIN);
}

function summarizeMatch(match, deltaMin, phase) {
  return {
    no: match.no,
    stage: match.round || match.stage || match.group || 'unknown',
    teamA: match.teamA || 'TBD',
    teamB: match.teamB || 'TBD',
    kickoff: new Date(matchKickoffMs(match)).toISOString(),
    deltaMinutes: Math.round(deltaMin),
    phase
  };
}

export function evaluateMatchWindow(data, nowUtc, options = {}) {
  const nowMs = Date.parse(nowUtc);
  if (!Number.isFinite(nowMs)) throw new Error(`invalid --now timestamp: ${nowUtc}`);
  const matches = [...(data.matches || []), ...(data.knockout || [])].filter(match => {
    const kickoff = matchKickoffMs(match);
    return Number.isFinite(kickoff) && match.teamA && match.teamB;
  });
  const pre = [];
  const post = [];
  const active = [];
  for (const match of matches) {
    const kickoff = matchKickoffMs(match);
    const deltaMin = (nowMs - kickoff) / 60000;
    if (!match.played && deltaMin >= ACTIVE_LOCK_START_MIN && deltaMin < ACTIVE_LOCK_END_MIN) {
      active.push(summarizeMatch(match, deltaMin, 'active_lock'));
      continue;
    }
    if (!match.played && nearSlot(-deltaMin, PRE_KICKOFF_SLOTS_MIN)) {
      pre.push(summarizeMatch(match, deltaMin, 'pre_kickoff'));
      continue;
    }
    if (!match.played && deltaMin >= ACTIVE_LOCK_END_MIN && deltaMin <= STALE_RESULT_RECOVERY_END_MIN) {
      const phase = nearSlot(deltaMin, POST_KICKOFF_SLOTS_MIN) ? 'post_match' : 'stale_result_recovery';
      post.push(summarizeMatch(match, deltaMin, phase));
    }
  }
  if (active.length && !options.ignoreActiveLock) {
    if (pre.length) {
      return { shouldRun: true, mode: 'freeze_only', reason: 'pre_kickoff_freeze_only_active_lock', nowUtc, pre, post, active };
    }
    return { shouldRun: false, mode: 'none', reason: 'active_match_lock', nowUtc, pre, post, active };
  }
  const shouldRun = !!(options.force || pre.length || post.length);
  const postReasons = [
    post.some(match => match.phase === 'post_match') && 'post_match',
    post.some(match => match.phase === 'stale_result_recovery') && 'stale_result_recovery'
  ].filter(Boolean);
  const reasons = [
    pre.length && 'pre_kickoff',
    ...postReasons
  ].filter(Boolean);
  return {
    shouldRun,
    mode: shouldRun ? 'full_update' : 'none',
    reason: options.force ? 'forced' : shouldRun ? reasons.join('+') : 'outside_match_window',
    nowUtc,
    pre,
    post,
    active
  };
}

function runUpdate(options) {
  const args = ['scripts/update-base-data.mjs', '--now', options.nowUtc];
  if (options.noFetch) args.push('--no-fetch');
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runFreezeOnly(options) {
  const nowArgs = ['--now', options.nowUtc];
  const freeze = runNode('scripts/freeze-predictions.mjs', nowArgs);
  if (freeze !== 0) return freeze;
  const health = runPythonScript('scripts/update_health.py');
  if (health !== 0) return health;
  const base = runPythonScript('scripts/validate_base_data.py');
  if (base !== 0) return base;
  return runNode('scripts/validate-calibration.mjs');
}

export function runMatchWindowUpdate(options = parseMatchWindowArgs()) {
  const artifact = readArtifact('docs/index.html');
  const decision = evaluateMatchWindow(artifact.data, options.nowUtc, options);
  console.log(JSON.stringify(decision, null, 2));
  if (!decision.shouldRun) return 0;
  if (decision.mode === 'freeze_only') return runFreezeOnly(options);
  return runUpdate(options);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exit(runMatchWindowUpdate(parseMatchWindowArgs(process.argv.slice(2))));
}
