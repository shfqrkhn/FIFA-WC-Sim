import assert from 'node:assert/strict';
import {
  applyCalibrationToWdl,
  benchmarkMetrics,
  emptyCalibrationState,
  updateCalibrationState
} from '../scripts/prediction-audit-lib.mjs';

function settled(id, createdDay, probs, actual) {
  return {
    prediction_id: `p${id}`,
    created_at_utc: `2026-06-${String(createdDay).padStart(2, '0')}T10:00:00Z`,
    match_id: id,
    stage: 'group',
    home_team: 'Alpha',
    away_team: 'Beta',
    model_version: 'm',
    data_version: 'd',
    source_snapshot_hash: 'h',
    predicted_wdl_probs: probs,
    predicted_scoreline_distribution: [],
    predicted_advancement_probs: {},
    actual_home_score: actual === 'home_win' ? 1 : 0,
    actual_away_score: actual === 'away_win' ? 1 : 0,
    actual_result: actual,
    settled_at_utc: `2026-06-${String(createdDay).padStart(2, '0')}T22:00:00Z`,
    brier_score: 0,
    log_loss: 0,
    scoreline_error: 0,
    calibration_bucket: '0.8-0.9',
    failure_type: 'pure_variance',
    kickoff_utc: `2026-06-${String(createdDay).padStart(2, '0')}T18:00:00Z`
  };
}

const teamMap = new Map([['Alpha', { rank: 10 }], ['Beta', { rank: 40 }]]);
const smallLedger = { predictions: Array.from({ length: 12 }, (_, i) => settled(i + 1, 1, { home_win: 0.8, draw: 0.1, away_win: 0.1 }, 'home_win')) };
const smallState = updateCalibrationState(smallLedger, emptyCalibrationState(), { asOfUtc: '2026-07-01T00:00:00Z', teamMap });
assert.equal(smallState.calibration_status, 'insufficient_sample');
assert.equal(smallState.benchmark_metrics.raw_model.count, 12);
assert.equal(smallState.benchmark_metrics.uniform_wdl.count, 12);
assert.equal(smallState.benchmark_metrics.rank_prior.count, 12);
assert.equal(benchmarkMetrics(smallLedger.predictions).rank_prior.count, 0);
assert.deepEqual(applyCalibrationToWdl({ home_win: 0.8, draw: 0.1, away_win: 0.1 }, smallState).probabilities, { home_win: 0.8, draw: 0.1, away_win: 0.1 });
const repeatedSmallState = updateCalibrationState(smallLedger, {
  ...smallState,
  generated_at_utc: '2026-06-01T00:00:00Z'
}, { asOfUtc: '2026-07-02T00:00:00Z', teamMap });
assert.equal(repeatedSmallState.generated_at_utc, '2026-06-01T00:00:00Z');
assert.equal(repeatedSmallState.last_update_decision, 'insufficient_sample');
assert.equal(applyCalibrationToWdl({ home_win: 0.8, draw: 0.1, away_win: 0.1 }, {
  calibration_status: 'active',
  active: true,
  resolved_predictions: 1,
  min_resolved_predictions: 30,
  raw_validation_metrics: { brier_score: 0.4, log_loss: 0.8 },
  validation_metrics: { brier_score: 0.3, log_loss: 0.7 },
  bucket_adjustments: [{ bucket: '0.8-0.9', outcome: 'home_win', calibrated_confidence: 0.2 }]
}).status, 'insufficient_sample');

const train = [];
for (let i = 1; i <= 40; i++) {
  const actual = i % 2 === 0 ? 'home_win' : 'draw';
  train.push(settled(i, Math.min(28, i), { home_win: 0.8, draw: 0.1, away_win: 0.1 }, actual));
}
const activeState = updateCalibrationState({ predictions: train }, emptyCalibrationState(), { asOfUtc: '2026-07-01T00:00:00Z', teamMap });
assert.equal(activeState.calibration_status, 'active');
assert.equal(activeState.resolved_predictions, 40);
assert.equal(activeState.benchmark_metrics.raw_model.count, 40);
assert.ok(activeState.validation_metrics.brier_score <= activeState.raw_validation_metrics.brier_score + 1e-12);

const repeatedActiveState = updateCalibrationState({ predictions: train }, activeState, { asOfUtc: '2026-07-02T00:00:00Z', teamMap });
assert.equal(repeatedActiveState, activeState, 'unchanged active calibration must retain its prior state verbatim');

const adjusted = applyCalibrationToWdl({ home_win: 0.8, draw: 0.1, away_win: 0.1 }, activeState);
assert.equal(adjusted.status, 'active');
assert.ok(adjusted.probabilities.home_win < 0.8);
assert.ok(Math.abs(Object.values(adjusted.probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-9);

const badLedger = {
  predictions: Array.from({ length: 40 }, (_, i) => settled(i + 1, Math.min(28, i + 1), { home_win: 0.45, draw: 0.35, away_win: 0.2 }, i % 2 ? 'home_win' : 'draw'))
};
const rolled = updateCalibrationState(badLedger, activeState, { asOfUtc: '2026-07-01T00:00:00Z', teamMap });
assert.equal(rolled.last_update_decision, 'kept_previous_validated_bucket_calibration');
assert.equal(rolled.calibration_status, 'active');
assert.ok(rolled.validation_metrics.brier_score <= rolled.raw_validation_metrics.brier_score + 1e-12);

const staleBadState = {
  ...activeState,
  bucket_adjustments: [{ bucket: '0.4-0.5', outcome: 'home_win', count: 30, raw_confidence: 0.45, observed_frequency: 1, calibrated_confidence: 0.98 }],
  validation_metrics: { brier_score: 0.1, log_loss: 0.1 },
  raw_validation_metrics: { brier_score: 0.2, log_loss: 0.2 }
};
const staleRolledBack = updateCalibrationState(badLedger, staleBadState, { asOfUtc: '2026-07-01T00:00:00Z', teamMap });
assert.equal(staleRolledBack.calibration_status, 'validation_worsened_rollback');
assert.equal(staleRolledBack.active, false);
assert.equal(staleRolledBack.last_update_decision, 'raw_model_only_previous_validation_worsened');

console.log('calibration tests passed');
