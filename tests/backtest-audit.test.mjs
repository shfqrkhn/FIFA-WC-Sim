import assert from 'node:assert/strict';
import { buildBacktestAuditReport } from '../scripts/backtest-audit.mjs';

function row(id, probs, actual, extra = {}) {
  return {
    prediction_id: `p${id}`,
    created_at_utc: '2026-06-20T10:00:00Z',
    match_id: id,
    stage: extra.stage || 'group',
    home_team: extra.home || 'Alpha',
    away_team: extra.away || 'Beta',
    model_version: 'm',
    data_version: 'd',
    source_snapshot_hash: 'a'.repeat(64),
    predicted_wdl_probs: probs,
    predicted_scoreline_distribution: [{ score: '1-0', probability: 1 }],
    predicted_advancement_probs: { home: 0.6, draw: 0, away: 0.4 },
    actual_home_score: actual === 'home_win' ? 1 : 0,
    actual_away_score: actual === 'away_win' ? 1 : 0,
    actual_result: actual,
    settled_at_utc: '2026-06-20T22:00:00Z',
    brier_score: 0,
    log_loss: 0,
    scoreline_error: 1,
    calibration_bucket: null,
    failure_type: extra.failure || 'pure_variance',
    kickoff_utc: extra.kickoff || '2026-06-20T18:00:00Z'
  };
}

const data = {
  teams: [
    { name: 'Alpha', rank: 10 },
    { name: 'Beta', rank: 40 }
  ],
  matches: [{ no: 1, teamA: 'Alpha', teamB: 'Beta', date: '2026-06-20T18:00:00Z' }],
  knockout: [
    { no: 2, teamA: 'Alpha', teamB: 'Beta', date: '2026-06-20T18:00:00Z', round: 'R32' },
    { no: 3, teamA: 'Alpha', teamB: 'Beta', date: '2026-06-20T18:00:00Z', round: 'R32' },
    { no: 4, teamA: 'Alpha', teamB: 'Beta', date: '2026-06-20T18:00:00Z', round: 'R32' }
  ]
};

const ledger = {
  generated_at_utc: '2026-06-21T00:00:00Z',
  predictions: [
    row(1, { home_win: 0.7, draw: 0.2, away_win: 0.1 }, 'home_win'),
    row(2, { home_win: 0.7, draw: 0.2, away_win: 0.1 }, 'draw', { stage: 'R32', failure: 'underestimated_draw' }),
    row(3, { home_win: 0.2, draw: 0.2, away_win: 0.6 }, 'away_win', { stage: 'R32' }),
    { ...row(4, { home_win: 0.8, draw: 0.1, away_win: 0.1 }, 'home_win'), created_at_utc: '2026-06-20T18:00:01Z' },
    { ...row(5, { home_win: 0.8, draw: 0.1, away_win: 0.1 }, 'home_win'), settled_at_utc: null, actual_result: null }
  ]
};

const report = buildBacktestAuditReport({
  ledger,
  data,
  calibrationState: { generated_at_utc: '2026-06-21T00:00:00Z' },
  asOfUtc: '2026-06-21T00:00:00Z'
});

assert.equal(report.resolved_predictions, 3);
assert.equal(report.unresolved_predictions, 1);
assert.equal(report.rejected_predictions, 1);
assert.equal(report.sample_status, 'insufficient_sample');
assert.equal(report.overall.metrics.raw_model.count, 3);
assert.equal(report.overall.metrics.uniform_wdl.count, 3);
assert.equal(report.overall.metrics.rank_prior.count, 3);
assert.equal(report.by_stage.group.count, 1);
assert.equal(report.by_stage.knockout.count, 2);
assert.equal(report.by_failure_type.underestimated_draw, 1);
assert.equal(report.by_actual_result.draw, 1);
assert.ok(report.overall.favorite_accuracy.rate > 0.6);
assert.ok(report.by_confidence_bucket['0.7-0.8']);
assert.ok(report.comparisons.raw_vs_uniform_wdl.brier_delta < 0);
assert.ok(report.leakage_guards.some(text => text.includes('created after kickoff')));
assert.ok(report.limitations.some(text => text.includes('historical replay')));

console.log('backtest-audit tests passed');
