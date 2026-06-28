#!/usr/bin/env node
import { readArtifact } from './base-data.mjs';
import {
  emptyAuditLedger,
  emptyCalibrationState,
  MIN_RESOLVED_PREDICTIONS,
  readJson,
  REQUIRED_LEDGER_FIELDS,
  validateNoMarketFields,
  WDL_KEYS
} from './prediction-audit-lib.mjs';

const audit = readJson('data/prediction-audit.json', emptyAuditLedger());
const state = readJson('data/calibration-state.json', emptyCalibrationState());
const artifact = readArtifact('docs/index.html').data;
const errors = [];

function fail(message) {
  errors.push(message);
}

function utcMs(value) {
  if (!value || !String(value).includes('T')) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function saneScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 15;
}

function finiteNumberLike(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

const marketAudit = validateNoMarketFields(audit);
const marketState = validateNoMarketFields(state);
if (!marketAudit.ok) fail(`market-like audit field(s): ${marketAudit.fields.join(', ')}`);
if (!marketState.ok) fail(`market-like calibration field(s): ${marketState.fields.join(', ')}`);
if (!Array.isArray(audit.predictions)) fail('audit predictions must be an array');

const ids = new Set();
for (const [index, row] of (audit.predictions || []).entries()) {
  for (const field of REQUIRED_LEDGER_FIELDS) if (!Object.hasOwn(row, field)) fail(`prediction ${index} missing ${field}`);
  if (ids.has(row.prediction_id)) fail(`duplicate prediction_id ${row.prediction_id}`);
  ids.add(row.prediction_id);
  for (const key of WDL_KEYS) {
    const value = row.predicted_wdl_probs?.[key];
    if (!finiteNumberLike(value) || Number(value) < 0 || Number(value) > 1) fail(`prediction ${row.prediction_id} has invalid ${key} probability`);
  }
  const total = WDL_KEYS.reduce((sum, key) => sum + Number(row.predicted_wdl_probs?.[key] || 0), 0);
  if (Math.abs(total - 1) > 1e-6) fail(`prediction ${row.prediction_id} WDL probabilities do not sum to 1`);
  if (row.actual_result && !WDL_KEYS.includes(row.actual_result)) fail(`prediction ${row.prediction_id} has invalid actual_result`);
  if (row.actual_result) {
    if (!(saneScore(row.actual_home_score) && saneScore(row.actual_away_score))) fail(`prediction ${row.prediction_id} has result without sane integer score`);
    if (!finiteNumberLike(row.brier_score) || !finiteNumberLike(row.log_loss)) fail(`prediction ${row.prediction_id} has result without finite scoring metrics`);
    const created = utcMs(row.created_at_utc);
    const kickoff = utcMs(row.kickoff_utc);
    const settled = utcMs(row.settled_at_utc);
    if (!Number.isFinite(created) || !Number.isFinite(kickoff) || !Number.isFinite(settled)) fail(`prediction ${row.prediction_id} has invalid audit timestamps`);
    else if (!(created < kickoff && kickoff <= settled)) fail(`prediction ${row.prediction_id} has time-inconsistent audit timestamps`);
  }
}

if (state.resolved_predictions < MIN_RESOLVED_PREDICTIONS && state.calibration_status !== 'insufficient_sample') {
  fail('calibration must be insufficient_sample below minimum resolved predictions');
}
if (state.calibration_status === 'active') {
  if (!state.active || !state.use_calibrated_probabilities) fail('active calibration must explicitly enable calibrated probabilities');
  if (!Array.isArray(state.bucket_adjustments) || !state.bucket_adjustments.length) fail('active calibration requires bucket adjustments');
  if (!state.validation_metrics || !state.raw_validation_metrics) fail('active calibration requires validation metrics');
  if (state.validation_metrics?.brier_score > state.raw_validation_metrics?.brier_score + 1e-12) fail('active calibration worsens Brier score');
  if (state.validation_metrics?.log_loss > state.raw_validation_metrics?.log_loss + 1e-12) fail('active calibration worsens log loss');
}
if (artifact.calibration?.calibration_status !== state.calibration_status) {
  fail('embedded BASE_DATA calibration status does not match data/calibration-state.json');
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
