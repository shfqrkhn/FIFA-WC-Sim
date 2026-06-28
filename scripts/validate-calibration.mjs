#!/usr/bin/env node
import fs from 'node:fs';
import { readArtifact } from './base-data.mjs';
import {
  brierScore,
  calibrationBucket,
  emptyAuditLedger,
  emptyCalibrationState,
  calibrationEligiblePredictions,
  FAILURE_TYPES,
  logLoss,
  MIN_RESOLVED_PREDICTIONS,
  matchKickoffMs,
  publicCalibrationState,
  readJson,
  REQUIRED_LEDGER_FIELDS,
  scorelineError,
  stableJson,
  validateNoMarketFields,
  WDL_KEYS
} from './prediction-audit-lib.mjs';

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const AUDIT_PATH = getArg('--audit') || 'data/prediction-audit.json';
const STATE_PATH = getArg('--state') || 'data/calibration-state.json';
const HTML_PATH = getArg('--html') || 'docs/index.html';

const missingFiles = [
  [AUDIT_PATH, 'missing prediction audit file'],
  [STATE_PATH, 'missing calibration state file'],
  [HTML_PATH, 'missing embedded app HTML file']
].filter(([filePath]) => !fs.existsSync(filePath));
if (missingFiles.length) {
  console.error(JSON.stringify({ ok: false, errors: missingFiles.map(([, message]) => message) }, null, 2));
  process.exit(1);
}

const audit = readJson(AUDIT_PATH, emptyAuditLedger());
const state = readJson(STATE_PATH, emptyCalibrationState());
const artifact = readArtifact(HTML_PATH).data;
const matchMap = new Map([...(artifact.matches || []), ...(artifact.knockout || [])].map(match => [Number(match.no), match]));
const errors = [];

function fail(message) {
  errors.push(message);
}

function utcMs(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(String(value))) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function saneScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 15;
}

function parseScoreline(row) {
  if (typeof row?.score === 'string') {
    const match = row.score.match(/^(\d+)-(\d+)$/);
    if (!match) return [NaN, NaN];
    return [Number(match[1]), Number(match[2])];
  }
  return [Number(row?.a), Number(row?.b)];
}

function finiteNumberLike(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    stableJson(Object.keys(value).sort()) === stableJson(keys.slice().sort());
}

function resultFromScore(home, away) {
  if (home === away) return 'draw';
  return home > away ? 'home_win' : 'away_win';
}

const VALID_BUCKETS = new Set(Array.from({ length: 10 }, (_, index) => {
  const low = index / 10;
  const high = (index + 1) / 10;
  return `${low.toFixed(1)}-${high.toFixed(1)}`;
}));

function validBucket(value) {
  return VALID_BUCKETS.has(String(value || ''));
}

function validMetricPair(metrics) {
  return metrics && finiteNumberLike(metrics.brier_score) && Number(metrics.brier_score) >= 0 && Number(metrics.brier_score) <= 2 &&
    finiteNumberLike(metrics.log_loss) && Number(metrics.log_loss) >= 0;
}

function validateProbabilityObject(value, label, predictionId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`prediction ${predictionId} has invalid ${label}`);
    return;
  }
  if (label === 'predicted_advancement_probs') {
    const required = ['home', 'draw', 'away'];
    const keys = Object.keys(value).sort();
    if (stableJson(keys) !== stableJson(required.sort())) {
      fail(`prediction ${predictionId} has invalid ${label} keys`);
      return;
    }
    const total = required.reduce((sum, key) => sum + Number(value[key] || 0), 0);
    if (Math.abs(total - 1) > 1e-6) fail(`prediction ${predictionId} ${label} probabilities do not sum to 1`);
  }
  for (const [key, raw] of Object.entries(value)) {
    if (!finiteNumberLike(raw) || Number(raw) < 0 || Number(raw) > 1) {
      fail(`prediction ${predictionId} has invalid ${label}.${key}`);
    }
  }
}

function validateScorelineDistribution(rows, predictionId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    fail(`prediction ${predictionId} has invalid predicted_scoreline_distribution`);
    return;
  }
  const seen = new Set();
  let total = 0;
  for (const [index, row] of rows.entries()) {
    const probability = Number(row?.probability ?? row?.p);
    const [home, away] = parseScoreline(row);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1 || !saneScore(home) || !saneScore(away)) {
      fail(`prediction ${predictionId} has invalid predicted_scoreline_distribution row ${index}`);
    }
    const score = `${home}-${away}`;
    if (seen.has(score)) fail(`prediction ${predictionId} has duplicate predicted_scoreline_distribution row ${score}`);
    seen.add(score);
    if (Number.isFinite(probability)) total += probability;
  }
  if (total > 1 + 1e-6) fail(`prediction ${predictionId} predicted_scoreline_distribution probabilities exceed 1`);
}

const marketAudit = validateNoMarketFields(audit);
const marketState = validateNoMarketFields(state);
if (!marketAudit.ok) fail(`market-like audit field(s): ${marketAudit.fields.join(', ')}`);
if (!marketState.ok) fail(`market-like calibration field(s): ${marketState.fields.join(', ')}`);
if (!Array.isArray(audit.predictions)) fail('audit predictions must be an array');

const ids = new Set();
if (!Number.isFinite(utcMs(audit.generated_at_utc))) fail('audit generated_at_utc must be a valid UTC timestamp');
if (!Number.isFinite(utcMs(state.generated_at_utc))) fail('calibration generated_at_utc must be a valid UTC timestamp');

for (const [index, row] of (audit.predictions || []).entries()) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    fail(`prediction ${index} must be an object`);
    continue;
  }
  for (const field of REQUIRED_LEDGER_FIELDS) if (!Object.hasOwn(row, field)) fail(`prediction ${index} missing ${field}`);
  if (ids.has(row.prediction_id)) fail(`duplicate prediction_id ${row.prediction_id}`);
  ids.add(row.prediction_id);
  const created = utcMs(row.created_at_utc);
  const kickoff = utcMs(row.kickoff_utc);
  if (!Number.isFinite(created) || !Number.isFinite(kickoff) || !(created < kickoff)) {
    fail(`prediction ${row.prediction_id} has invalid freeze timestamps`);
  }
  for (const field of ['prediction_id', 'stage', 'home_team', 'away_team', 'model_version', 'data_version', 'source_snapshot_hash']) {
    if (!nonEmptyString(row[field])) fail(`prediction ${row.prediction_id || index} has invalid ${field}`);
  }
  if (!/^[0-9a-f]{24}$/.test(String(row.prediction_id || ''))) fail(`prediction ${row.prediction_id || index} has invalid prediction_id format`);
  if (!/^[0-9a-f]{64}$/.test(String(row.source_snapshot_hash || ''))) fail(`prediction ${row.prediction_id || index} has invalid source_snapshot_hash format`);
  if (!Number.isFinite(Number(row.match_id))) fail(`prediction ${row.prediction_id || index} has invalid match_id`);
  const match = matchMap.get(Number(row.match_id));
  if (!match) {
    fail(`prediction ${row.prediction_id || index} references unknown match_id`);
  } else {
    if (row.home_team !== match.teamA || row.away_team !== match.teamB) fail(`prediction ${row.prediction_id} team names do not match embedded fixture`);
    if (row.stage !== (match.stage || match.round || 'unknown')) fail(`prediction ${row.prediction_id} stage does not match embedded fixture`);
    const currentKickoff = matchKickoffMs(match);
    if (Number.isFinite(currentKickoff) && Number.isFinite(created) && !(created < currentKickoff)) fail(`prediction ${row.prediction_id} was frozen after current embedded kickoff`);
  }
  if (!hasExactKeys(row.predicted_wdl_probs, WDL_KEYS)) fail(`prediction ${row.prediction_id} has invalid predicted_wdl_probs keys`);
  for (const key of WDL_KEYS) {
    const value = row.predicted_wdl_probs?.[key];
    if (!finiteNumberLike(value) || Number(value) < 0 || Number(value) > 1) fail(`prediction ${row.prediction_id} has invalid ${key} probability`);
  }
  const total = WDL_KEYS.reduce((sum, key) => sum + Number(row.predicted_wdl_probs?.[key] || 0), 0);
  if (Math.abs(total - 1) > 1e-6) fail(`prediction ${row.prediction_id} WDL probabilities do not sum to 1`);
  validateScorelineDistribution(row.predicted_scoreline_distribution, row.prediction_id);
  validateProbabilityObject(row.predicted_advancement_probs, 'predicted_advancement_probs', row.prediction_id);
  if (row.actual_result !== null && !WDL_KEYS.includes(row.actual_result)) fail(`prediction ${row.prediction_id} has invalid actual_result`);
  if (WDL_KEYS.includes(row.actual_result)) {
    if (!(saneScore(row.actual_home_score) && saneScore(row.actual_away_score))) fail(`prediction ${row.prediction_id} has result without sane integer score`);
    if (resultFromScore(row.actual_home_score, row.actual_away_score) !== row.actual_result) fail(`prediction ${row.prediction_id} actual_result does not match score`);
    if (!finiteNumberLike(row.brier_score) || Number(row.brier_score) < 0 || Number(row.brier_score) > 2 ||
        !finiteNumberLike(row.log_loss) || Number(row.log_loss) < 0 ||
        !finiteNumberLike(row.scoreline_error) || Number(row.scoreline_error) < 0 ||
        !validBucket(row.calibration_bucket)) fail(`prediction ${row.prediction_id} has invalid scoring metrics`);
    const expectedBrier = brierScore(row.predicted_wdl_probs, row.actual_result);
    const expectedLoss = logLoss(row.predicted_wdl_probs, row.actual_result);
    const expectedScorelineError = scorelineError(row.predicted_scoreline_distribution, row.actual_home_score, row.actual_away_score);
    const expectedBucket = calibrationBucket(row.predicted_wdl_probs);
    if (Math.abs(Number(row.brier_score) - expectedBrier) > 1e-9 ||
        Math.abs(Number(row.log_loss) - expectedLoss) > 1e-9 ||
        Math.abs(Number(row.scoreline_error) - Number(expectedScorelineError)) > 1e-6 ||
        row.calibration_bucket !== expectedBucket) fail(`prediction ${row.prediction_id} scoring metrics do not match frozen probabilities`);
    const settled = utcMs(row.settled_at_utc);
    if (!Number.isFinite(created) || !Number.isFinite(kickoff) || !Number.isFinite(settled)) fail(`prediction ${row.prediction_id} has invalid audit timestamps`);
    else if (!(created < kickoff && kickoff <= settled)) fail(`prediction ${row.prediction_id} has time-inconsistent audit timestamps`);
    if (!FAILURE_TYPES.includes(row.failure_type)) fail(`prediction ${row.prediction_id} has invalid failure_type`);
    if (!match?.played) fail(`prediction ${row.prediction_id} is settled before embedded match is played`);
    else if (row.actual_home_score !== match.scoreA || row.actual_away_score !== match.scoreB) fail(`prediction ${row.prediction_id} settled score does not match embedded result`);
  } else if ([
    row.actual_home_score,
    row.actual_away_score,
    row.settled_at_utc,
    row.brier_score,
    row.log_loss,
    row.scoreline_error,
    row.calibration_bucket,
    row.failure_type
  ].some(value => value !== null)) {
    fail(`prediction ${row.prediction_id} has unsettled result/scoring fields`);
  } else if (match?.played) {
    fail(`prediction ${row.prediction_id} is unsettled after embedded match is played`);
  }
}

if (!['insufficient_sample', 'active', 'validation_worsened_rollback'].includes(state.calibration_status)) {
  fail('calibration status is invalid');
}
if (!Number.isInteger(state.resolved_predictions) || state.resolved_predictions < 0) {
  fail('calibration resolved_predictions must be a non-negative integer');
}
if (state.min_resolved_predictions !== MIN_RESOLVED_PREDICTIONS) {
  fail(`calibration min_resolved_predictions must remain ${MIN_RESOLVED_PREDICTIONS}`);
}
if (state.resolved_predictions < MIN_RESOLVED_PREDICTIONS && state.calibration_status !== 'insufficient_sample') {
  fail('calibration must be insufficient_sample below minimum resolved predictions');
}
if (state.resolved_predictions >= MIN_RESOLVED_PREDICTIONS && state.calibration_status === 'insufficient_sample') {
  fail('calibration must not remain insufficient_sample at or above minimum resolved predictions');
}
const eligible = calibrationEligiblePredictions(audit.predictions || [], matchMap, { asOfUtc: state.generated_at_utc });
if (state.resolved_predictions !== eligible.length) {
  fail(`calibration resolved_predictions ${state.resolved_predictions} does not match eligible settled predictions ${eligible.length}`);
}
if (state.calibration_status === 'active') {
  if (!state.active || !state.use_calibrated_probabilities) fail('active calibration must explicitly enable calibrated probabilities');
  if (!Array.isArray(state.bucket_adjustments) || !state.bucket_adjustments.length) fail('active calibration requires bucket adjustments');
  if (!validMetricPair(state.validation_metrics) || !validMetricPair(state.raw_validation_metrics)) fail('active calibration requires validation metrics');
  if (state.validation_metrics?.brier_score > state.raw_validation_metrics?.brier_score + 1e-12) fail('active calibration worsens Brier score');
  if (state.validation_metrics?.log_loss > state.raw_validation_metrics?.log_loss + 1e-12) fail('active calibration worsens log loss');
  for (const [index, row] of (state.bucket_adjustments || []).entries()) {
    if (!validBucket(row?.bucket) || !WDL_KEYS.includes(row?.outcome) ||
        !Number.isInteger(row?.count) || row.count <= 0 ||
        !finiteNumberLike(row.raw_confidence) || Number(row.raw_confidence) < 0 || Number(row.raw_confidence) > 1 ||
        !finiteNumberLike(row.observed_frequency) || Number(row.observed_frequency) < 0 || Number(row.observed_frequency) > 1 ||
        !finiteNumberLike(row.calibrated_confidence) || Number(row.calibrated_confidence) < 0 || Number(row.calibrated_confidence) > 1) {
      fail(`active calibration has invalid bucket adjustment ${index}`);
    }
  }
} else if (state.active || state.use_calibrated_probabilities) {
  fail('inactive calibration must not enable calibrated probabilities');
}
if (stableJson(artifact.calibration || null) !== stableJson(publicCalibrationState(state))) {
  fail('embedded BASE_DATA public calibration state does not match data/calibration-state.json');
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  frozenPredictions: audit.predictions.length,
  calibration_status: state.calibration_status,
  resolved_predictions: state.resolved_predictions
}, null, 2));
