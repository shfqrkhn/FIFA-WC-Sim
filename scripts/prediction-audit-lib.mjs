#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REQUIRED_LEDGER_FIELDS = [
  'prediction_id',
  'created_at_utc',
  'match_id',
  'stage',
  'home_team',
  'away_team',
  'model_version',
  'data_version',
  'source_snapshot_hash',
  'predicted_wdl_probs',
  'predicted_scoreline_distribution',
  'predicted_advancement_probs',
  'actual_home_score',
  'actual_away_score',
  'actual_result',
  'settled_at_utc',
  'brier_score',
  'log_loss',
  'scoreline_error',
  'calibration_bucket',
  'failure_type'
];

export const FAILURE_TYPES = [
  'overconfident_favorite',
  'underestimated_draw',
  'bad_weather_adjustment',
  'bad_host_adjustment',
  'bad_recent_form_weight',
  'bad_attack_defense_weight',
  'knockout_penalty_variance',
  'missing_lineup_or_suspension_data',
  'pure_variance',
  'data_quality_or_source_gap'
];

export const MIN_RESOLVED_PREDICTIONS = 30;
export const WDL_KEYS = ['home_win', 'draw', 'away_win'];

const BLOCKED_FIELD_RE = /(betting|sportsbook|wager|gambling|market.?edge|prediction.?market|odds)/i;
const EPS = 1e-12;

export function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJsonIfChanged(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (prev === next) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next);
  return true;
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

export function validateNoMarketFields(value, pathParts = []) {
  const bad = [];
  function walk(node, parts) {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...parts, String(index)]));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const next = [...parts, key];
      if (BLOCKED_FIELD_RE.test(key)) bad.push(next.join('.'));
      walk(child, next);
    }
  }
  walk(value, pathParts);
  return { ok: bad.length === 0, fields: bad };
}

export function emptyAuditLedger(generatedAtUtc = utcNow()) {
  return {
    schema: 1,
    generated_at_utc: generatedAtUtc,
    source_note: 'Frozen pre-match simulator predictions. Scored only after results are embedded; no external market data is used.',
    predictions: []
  };
}

export function emptyCalibrationState(generatedAtUtc = utcNow()) {
  return {
    schema: 1,
    generated_at_utc: generatedAtUtc,
    calibration_status: 'insufficient_sample',
    active: false,
    resolved_predictions: 0,
    min_resolved_predictions: MIN_RESOLVED_PREDICTIONS,
    use_calibrated_probabilities: false,
    method: 'conservative_bucket_calibration',
    bucket_adjustments: [],
    raw_validation_metrics: null,
    validation_metrics: null,
    last_update_decision: 'raw_model_only',
    rollback_count: 0,
    notes: [
      'Calibration is disabled until enough frozen predictions have resolved.',
      'Base model output and calibrated output remain separate.',
      'Unavailable lineups, injuries, suspensions, referees, and incomplete discipline ledgers remain neutral unless patched from reliable sources.'
    ]
  };
}

export function matchDateValue(match) {
  return match && (match.kickoffUtc || match.kickoff || match.kickoffLocal || match.date || match.utc || match.time);
}

function utcTimestampMs(raw) {
  if (!raw) return null;
  const text = String(raw);
  if (!text.includes('T')) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

export function matchKickoffMs(match) {
  return utcTimestampMs(matchDateValue(match));
}

export function isBeforeKickoff(createdAtUtc, match) {
  const created = Date.parse(createdAtUtc);
  const kickoff = matchKickoffMs(match);
  return Number.isFinite(created) && Number.isFinite(kickoff) && created < kickoff;
}

export function normalizeWdlProbs(probs) {
  const cleaned = Object.fromEntries(WDL_KEYS.map(key => [key, Math.max(0, Number(probs?.[key]) || 0)]));
  const total = WDL_KEYS.reduce((sum, key) => sum + cleaned[key], 0);
  if (!(total > 0)) return { home_win: 1 / 3, draw: 1 / 3, away_win: 1 / 3 };
  const normalized = Object.fromEntries(WDL_KEYS.map(key => [key, cleaned[key] / total]));
  const drift = 1 - WDL_KEYS.reduce((sum, key) => sum + normalized[key], 0);
  normalized.away_win += drift;
  return normalized;
}

export function actualResult(scoreA, scoreB) {
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return null;
  if (scoreA === scoreB) return 'draw';
  return scoreA > scoreB ? 'home_win' : 'away_win';
}

export function favoriteKey(probs) {
  const normalized = normalizeWdlProbs(probs);
  return WDL_KEYS.slice().sort((a, b) => normalized[b] - normalized[a] || a.localeCompare(b))[0];
}

function finiteProbability(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) &&
    Number(value) >= 0 && Number(value) <= 1;
}

function hasExactProbabilityInput(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = keys.slice().sort();
  if (stableJson(actualKeys) !== stableJson(expectedKeys)) return false;
  const total = keys.reduce((sum, key) => sum + Number(value[key]), 0);
  return keys.every(key => finiteProbability(value[key])) && Math.abs(total - 1) <= 1e-6;
}

function parseScorelineInput(row) {
  if (typeof row?.score === 'string') {
    const match = row.score.match(/^(\d+)-(\d+)$/);
    return match ? [Number(match[1]), Number(match[2])] : [NaN, NaN];
  }
  return [Number(row?.a), Number(row?.b)];
}

function hasUsableScorelineDistribution(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  let total = 0;
  const seen = new Set();
  for (const row of rows) {
    const probability = Number(row?.probability ?? row?.p);
    const [home, away] = parseScorelineInput(row);
    const key = `${home}-${away}`;
    if (!finiteProbability(probability) || !isSaneScore(home) || !isSaneScore(away) || seen.has(key)) return false;
    seen.add(key);
    total += probability;
  }
  return total > 0 && total <= 1 + 1e-6;
}

export function calibrationBucket(probsOrConfidence) {
  const confidence = typeof probsOrConfidence === 'number'
    ? probsOrConfidence
    : Math.max(...Object.values(normalizeWdlProbs(probsOrConfidence)));
  const low = Math.max(0, Math.min(0.9, Math.floor((confidence + EPS) * 10) / 10));
  return `${low.toFixed(1)}-${(low + 0.1).toFixed(1)}`;
}

export function brierScore(probs, actual) {
  const p = normalizeWdlProbs(probs);
  return Number(WDL_KEYS.reduce((sum, key) => sum + (p[key] - (actual === key ? 1 : 0)) ** 2, 0).toFixed(12));
}

export function logLoss(probs, actual) {
  const p = normalizeWdlProbs(probs);
  return Number((-Math.log(Math.max(1e-15, p[actual] || 0))).toFixed(12));
}

export function scorelineError(distribution, actualHome, actualAway) {
  if (!Array.isArray(distribution) || !distribution.length) return null;
  let meanHome = 0;
  let meanAway = 0;
  let total = 0;
  for (const row of distribution) {
    const prob = Number(row.probability ?? row.p);
    const [a, b] = String(row.score ?? `${row.a}-${row.b}`).split('-').map(Number);
    if (!Number.isFinite(prob) || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    meanHome += a * prob;
    meanAway += b * prob;
    total += prob;
  }
  if (!(total > 0)) return null;
  return Number((Math.abs(meanHome / total - actualHome) + Math.abs(meanAway / total - actualAway)).toFixed(6));
}

export function classifyFailure(record, outcome = {}) {
  const actual = outcome.actual_result || record.actual_result;
  if (!WDL_KEYS.includes(actual)) return 'data_quality_or_source_gap';
  const probs = normalizeWdlProbs(record.predicted_wdl_probs);
  const favorite = favoriteKey(probs);
  const favoriteProb = probs[favorite];
  const miss = actual !== favorite;
  const flags = record.feature_flags || {};
  const err = Number(outcome.scoreline_error ?? record.scoreline_error);

  if (actual === 'draw' && probs.draw <= 0.24) return 'underestimated_draw';
  if (miss && favoriteProb >= 0.62) return 'overconfident_favorite';
  if (miss && Number(flags.weather_adjustment_abs || 0) >= 0.08) return 'bad_weather_adjustment';
  if (miss && Number(flags.host_adjustment_abs || 0) >= 0.08) return 'bad_host_adjustment';
  if (miss && Number(flags.recent_form_adjustment_abs || 0) >= 0.05) return 'bad_recent_form_weight';
  if (Number.isFinite(err) && err >= 2.25 && Number(flags.attack_defense_weight || 0) > 0) return 'bad_attack_defense_weight';
  if (record.stage !== 'group' && (flags.went_to_penalties || actual === 'draw')) return 'knockout_penalty_variance';
  if (miss && (flags.lineups_missing || flags.suspensions_missing)) return 'missing_lineup_or_suspension_data';
  return 'pure_variance';
}

export function makePredictionId(recordLike) {
  return sha256({
    match_id: recordLike.match_id,
    model_version: recordLike.model_version,
    data_version: recordLike.data_version,
    source_snapshot_hash: recordLike.source_snapshot_hash
  }).slice(0, 24);
}

export function createPredictionRecord(input) {
  const match = input.match;
  if (!match) throw new Error('match is required');
  const createdAtUtc = input.createdAtUtc || utcNow();
  if (!isBeforeKickoff(createdAtUtc, match)) throw new Error(`cannot freeze prediction after kickoff for match ${match.no}`);
  if (!input.modelVersion || !input.dataVersion) throw new Error('modelVersion and dataVersion are required');
  if (!/^[0-9a-f]{64}$/.test(String(input.sourceSnapshotHash || ''))) throw new Error('sourceSnapshotHash must be a sha256 hex digest');
  if (!hasExactProbabilityInput(input.predictedWdlProbs, WDL_KEYS)) throw new Error('predictedWdlProbs must contain finite home_win/draw/away_win probabilities that sum to 1');
  if (!hasUsableScorelineDistribution(input.predictedScorelineDistribution)) throw new Error('predictedScorelineDistribution must contain finite scoreline probabilities');
  if (!hasExactProbabilityInput(input.predictedAdvancementProbs, ['home', 'draw', 'away'])) throw new Error('predictedAdvancementProbs must contain finite home/draw/away probabilities that sum to 1');
  const probs = normalizeWdlProbs(input.predictedWdlProbs);
  const stage = match.stage || match.round || 'unknown';
  const record = {
    prediction_id: '',
    created_at_utc: createdAtUtc,
    match_id: match.no,
    stage,
    home_team: match.teamA,
    away_team: match.teamB,
    model_version: input.modelVersion,
    data_version: input.dataVersion,
    source_snapshot_hash: input.sourceSnapshotHash,
    predicted_wdl_probs: probs,
    predicted_scoreline_distribution: input.predictedScorelineDistribution || [],
    predicted_advancement_probs: input.predictedAdvancementProbs || {},
    actual_home_score: null,
    actual_away_score: null,
    actual_result: null,
    settled_at_utc: null,
    brier_score: null,
    log_loss: null,
    scoreline_error: null,
    calibration_bucket: null,
    failure_type: null,
    kickoff_utc: new Date(matchKickoffMs(match)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    venue: match.venue || null,
    group: match.group || null,
    feature_flags: input.featureFlags || {}
  };
  record.prediction_id = input.predictionId || makePredictionId(record);
  const marketCheck = validateNoMarketFields(record);
  if (!marketCheck.ok) throw new Error(`blocked market-like field(s): ${marketCheck.fields.join(', ')}`);
  return record;
}

function comparableFrozenPrediction(record) {
  return {
    match_id: record?.match_id,
    stage: record?.stage,
    home_team: record?.home_team,
    away_team: record?.away_team,
    model_version: record?.model_version,
    data_version: record?.data_version,
    predicted_wdl_probs: record?.predicted_wdl_probs || null,
    predicted_scoreline_distribution: record?.predicted_scoreline_distribution || [],
    predicted_advancement_probs: record?.predicted_advancement_probs || {},
    kickoff_utc: record?.kickoff_utc || null,
    venue: record?.venue || null,
    group: record?.group || null,
    feature_flags: record?.feature_flags || {}
  };
}

export function hasEquivalentFrozenPrediction(predictions, prediction) {
  const target = stableJson(comparableFrozenPrediction(prediction));
  return (predictions || []).some(row => stableJson(comparableFrozenPrediction(row)) === target);
}

export function appendFrozenPrediction(ledger, prediction) {
  const next = structuredClone(ledger || emptyAuditLedger());
  if (!Array.isArray(next.predictions)) next.predictions = [];
  const existing = next.predictions.find(row => row.prediction_id === prediction.prediction_id);
  if (existing) {
    const sameFrozenInputs = stableJson(comparableFrozenPrediction(existing)) === stableJson(comparableFrozenPrediction(prediction)) &&
      existing.source_snapshot_hash === prediction.source_snapshot_hash;
    if (!sameFrozenInputs) throw new Error(`conflicting frozen prediction_id ${prediction.prediction_id}`);
    return { ledger: next, changed: false, skipped: 'already_frozen' };
  }
  if (hasEquivalentFrozenPrediction(next.predictions, prediction)) {
    return { ledger: next, changed: false, skipped: 'equivalent_prediction_already_frozen' };
  }
  next.predictions.push(structuredClone(prediction));
  next.generated_at_utc = prediction.created_at_utc;
  return { ledger: next, changed: true };
}

export function scorePrediction(prediction, match, settledAtUtc = utcNow()) {
  if (!prediction || !match) return { scored: false, reason: 'missing prediction or match' };
  if (prediction.actual_result) return { scored: false, reason: 'already settled', prediction };
  if (!isBeforeKickoff(prediction.created_at_utc, match)) return { scored: false, reason: 'prediction created after kickoff' };
  const scoreA = match.scoreA;
  const scoreB = match.scoreB;
  if (!match.played || !isSaneScore(scoreA) || !isSaneScore(scoreB)) {
    return { scored: false, reason: 'match is not completed with sane integer scores' };
  }
  const result = actualResult(scoreA, scoreB);
  const err = scorelineError(prediction.predicted_scoreline_distribution, scoreA, scoreB);
  const scored = {
    ...prediction,
    actual_home_score: scoreA,
    actual_away_score: scoreB,
    actual_result: result,
    settled_at_utc: settledAtUtc,
    brier_score: brierScore(prediction.predicted_wdl_probs, result),
    log_loss: logLoss(prediction.predicted_wdl_probs, result),
    scoreline_error: err,
    calibration_bucket: calibrationBucket(prediction.predicted_wdl_probs)
  };
  scored.failure_type = classifyFailure(scored, { actual_result: result, scoreline_error: err });
  return { scored: true, prediction: scored };
}

export function scoreLedger(ledger, matchMap, settledAtUtc = utcNow()) {
  const next = structuredClone(ledger || emptyAuditLedger());
  let scored = 0;
  let skipped = 0;
  next.predictions = (next.predictions || []).map(prediction => {
    const match = matchMap.get(Number(prediction.match_id)) || matchMap.get(String(prediction.match_id));
    const result = scorePrediction(prediction, match, settledAtUtc);
    if (result.scored) {
      scored += 1;
      return result.prediction;
    }
    skipped += 1;
    return prediction;
  });
  if (scored) next.generated_at_utc = settledAtUtc;
  return { ledger: next, scored, skipped, changed: scored > 0 };
}

function hasResolvedMetrics(prediction) {
  return WDL_KEYS.includes(prediction.actual_result) &&
    isSaneScore(prediction.actual_home_score) &&
    isSaneScore(prediction.actual_away_score) &&
    prediction.settled_at_utc &&
    Number.isFinite(Number(prediction.brier_score)) &&
    Number.isFinite(Number(prediction.log_loss));
}

function isSaneScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 15;
}

function isFiniteNumberLike(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function calibrationEligiblePredictions(predictions, matchMap = new Map(), opts = {}) {
  const asOf = utcTimestampMs(opts.asOfUtc || utcNow());
  if (!Number.isFinite(asOf)) return [];
  return (predictions || [])
    .filter(hasResolvedMetrics)
    .filter(prediction => {
      const created = utcTimestampMs(prediction.created_at_utc);
      const settled = utcTimestampMs(prediction.settled_at_utc);
      if (!Number.isFinite(created) || !Number.isFinite(settled)) return false;
      if (created > asOf || settled > asOf || settled < created) return false;
      const match = matchMap.get(Number(prediction.match_id)) || matchMap.get(String(prediction.match_id));
      const kickoff = match ? matchKickoffMs(match) : utcTimestampMs(prediction.kickoff_utc);
      return Number.isFinite(kickoff) && created < kickoff && kickoff <= asOf && settled >= kickoff;
    })
    .sort((a, b) => Date.parse(a.created_at_utc) - Date.parse(b.created_at_utc) || String(a.prediction_id).localeCompare(String(b.prediction_id)));
}

function applyBucketAdjustmentUnchecked(probs, state) {
  const raw = normalizeWdlProbs(probs);
  const favorite = favoriteKey(raw);
  const bucket = calibrationBucket(raw);
  const adjustment = state?.bucket_adjustments?.find(row => row.bucket === bucket && row.outcome === favorite);
  if (!adjustment || !(Number(adjustment.count) > 0)) {
    return { status: 'no_matching_bucket', probabilities: raw, raw_probabilities: raw };
  }
  const target = Math.max(0.01, Math.min(0.98, Number(adjustment.calibrated_confidence)));
  const others = WDL_KEYS.filter(key => key !== favorite);
  const otherTotal = others.reduce((sum, key) => sum + raw[key], 0);
  const next = { ...raw, [favorite]: target };
  for (const key of others) next[key] = otherTotal > 0 ? raw[key] * (1 - target) / otherTotal : (1 - target) / 2;
  const drift = 1 - WDL_KEYS.reduce((sum, key) => sum + next[key], 0);
  next[others[others.length - 1]] += drift;
  return { status: 'active', probabilities: next, raw_probabilities: raw };
}

function averageMetrics(predictions, state = null) {
  if (!predictions.length) return { brier_score: null, log_loss: null, count: 0 };
  let brier = 0;
  let loss = 0;
  for (const prediction of predictions) {
    const probs = state ? applyBucketAdjustmentUnchecked(prediction.predicted_wdl_probs, state).probabilities : normalizeWdlProbs(prediction.predicted_wdl_probs);
    brier += brierScore(probs, prediction.actual_result);
    loss += logLoss(probs, prediction.actual_result);
  }
  return {
    brier_score: Number((brier / predictions.length).toFixed(12)),
    log_loss: Number((loss / predictions.length).toFixed(12)),
    count: predictions.length
  };
}

function buildBucketAdjustments(train) {
  const buckets = new Map();
  for (const prediction of train) {
    const probs = normalizeWdlProbs(prediction.predicted_wdl_probs);
    const favorite = favoriteKey(probs);
    const bucket = calibrationBucket(probs);
    const key = `${bucket}|${favorite}`;
    const row = buckets.get(key) || { bucket, outcome: favorite, count: 0, hits: 0, raw_confidence_sum: 0 };
    row.count += 1;
    row.hits += prediction.actual_result === favorite ? 1 : 0;
    row.raw_confidence_sum += probs[favorite];
    buckets.set(key, row);
  }
  return [...buckets.values()].map(row => {
    const avg = row.raw_confidence_sum / row.count;
    const prior = 8;
    return {
      bucket: row.bucket,
      outcome: row.outcome,
      count: row.count,
      raw_confidence: Number(avg.toFixed(6)),
      observed_frequency: Number((row.hits / row.count).toFixed(6)),
      calibrated_confidence: Number(((row.hits + prior * avg) / (row.count + prior)).toFixed(6))
    };
  });
}

export function applyCalibrationToWdl(probs, state) {
  const raw = normalizeWdlProbs(probs);
  const resolved = Number(state?.resolved_predictions || 0);
  const min = Number(state?.min_resolved_predictions || MIN_RESOLVED_PREDICTIONS);
  const rawMetrics = state?.raw_validation_metrics || {};
  const metrics = state?.validation_metrics || {};
  const validated = Number(metrics.brier_score) <= Number(rawMetrics.brier_score) + 1e-12 &&
    Number(metrics.log_loss) <= Number(rawMetrics.log_loss) + 1e-12;
  if (!state?.active || state.calibration_status !== 'active' || resolved < min || !validated || !Array.isArray(state.bucket_adjustments)) {
    const status = resolved < min ? 'insufficient_sample' : state?.calibration_status === 'active' ? 'validation_worsened_rollback' : state?.calibration_status || 'insufficient_sample';
    return { status, probabilities: raw, raw_probabilities: raw };
  }
  return applyBucketAdjustmentUnchecked(raw, state);
}

export function updateCalibrationState(ledger, previousState = emptyCalibrationState(), opts = {}) {
  const asOfUtc = opts.asOfUtc || utcNow();
  const matchMap = opts.matchMap || new Map();
  const eligible = calibrationEligiblePredictions(ledger?.predictions || [], matchMap, { asOfUtc });
  if (eligible.length < MIN_RESOLVED_PREDICTIONS) {
    const stableInsufficientSample = previousState?.calibration_status === 'insufficient_sample' &&
      !previousState.active &&
      !previousState.use_calibrated_probabilities &&
      Number(previousState.resolved_predictions) === eligible.length;
    return {
      ...emptyCalibrationState(stableInsufficientSample && previousState.generated_at_utc ? previousState.generated_at_utc : asOfUtc),
      resolved_predictions: eligible.length,
      last_update_decision: 'insufficient_sample',
      rollback_count: Number(previousState?.rollback_count || 0)
    };
  }

  const split = Math.min(eligible.length - 1, Math.max(1, Math.floor(eligible.length * 0.7)));
  const train = eligible.slice(0, split);
  const validate = eligible.slice(split);
  const candidate = {
    ...emptyCalibrationState(asOfUtc),
    calibration_status: 'active',
    active: true,
    resolved_predictions: eligible.length,
    use_calibrated_probabilities: true,
    bucket_adjustments: buildBucketAdjustments(train),
    last_update_decision: 'candidate'
  };
  const rawMetrics = averageMetrics(validate);
  const candidateMetrics = averageMetrics(validate, candidate);
  candidate.raw_validation_metrics = rawMetrics;
  candidate.validation_metrics = candidateMetrics;

  const improvesOrTies = candidateMetrics.brier_score <= rawMetrics.brier_score + 1e-12 &&
    candidateMetrics.log_loss <= rawMetrics.log_loss + 1e-12;
  if (improvesOrTies) {
    return { ...candidate, last_update_decision: 'promoted_validated_bucket_calibration' };
  }

  if (previousState?.active && previousState.calibration_status === 'active' && Array.isArray(previousState.bucket_adjustments)) {
    const previousMetrics = averageMetrics(validate, previousState);
    const previousStillValid = previousMetrics.brier_score <= rawMetrics.brier_score + 1e-12 &&
      previousMetrics.log_loss <= rawMetrics.log_loss + 1e-12;
    if (!previousStillValid) {
      return {
        ...emptyCalibrationState(asOfUtc),
        calibration_status: 'validation_worsened_rollback',
        resolved_predictions: eligible.length,
        raw_validation_metrics: rawMetrics,
        validation_metrics: previousMetrics,
        last_update_decision: 'raw_model_only_previous_validation_worsened',
        rollback_count: Number(previousState.rollback_count || 0) + 1
      };
    }
    return {
      ...previousState,
      generated_at_utc: asOfUtc,
      resolved_predictions: eligible.length,
      raw_validation_metrics: rawMetrics,
      validation_metrics: previousMetrics,
      last_update_decision: 'kept_previous_validated_bucket_calibration',
      rollback_count: Number(previousState.rollback_count || 0) + 1
    };
  }

  return {
    ...emptyCalibrationState(asOfUtc),
    calibration_status: 'validation_worsened_rollback',
    resolved_predictions: eligible.length,
    raw_validation_metrics: rawMetrics,
    validation_metrics: candidateMetrics,
    last_update_decision: 'raw_model_only_validation_worsened',
    rollback_count: Number(previousState?.rollback_count || 0) + 1
  };
}

export function publicCalibrationState(state) {
  return {
    schema: state?.schema || 1,
    generated_at_utc: state?.generated_at_utc || null,
    calibration_status: state?.calibration_status || 'insufficient_sample',
    active: !!state?.active,
    resolved_predictions: Number(state?.resolved_predictions || 0),
    min_resolved_predictions: Number(state?.min_resolved_predictions || MIN_RESOLVED_PREDICTIONS),
    use_calibrated_probabilities: !!state?.use_calibrated_probabilities,
    method: state?.method || 'conservative_bucket_calibration',
    bucket_adjustments: Array.isArray(state?.bucket_adjustments) ? state.bucket_adjustments : [],
    raw_validation_metrics: state?.raw_validation_metrics || null,
    validation_metrics: state?.validation_metrics || null,
    last_update_decision: state?.last_update_decision || 'raw_model_only',
    notes: Array.isArray(state?.notes) ? state.notes : []
  };
}
