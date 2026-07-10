import assert from 'node:assert/strict';
import { reconcileAuditLedgers } from '../scripts/reconcile-prediction-audits.mjs';

const prediction = (id, match = 98, created = '2026-07-10T17:42:04Z') => ({
  prediction_id: id,
  created_at_utc: created,
  match_id: match,
  stage: 'QF',
  home_team: 'Spain',
  away_team: 'Belgium',
  model_version: 'embedded-simulator-v1',
  data_version: 'v1',
  source_snapshot_hash: id.padEnd(64, '0'),
  predicted_wdl_probs: { home_win: 0.5, draw: 0.3, away_win: 0.2 },
  predicted_scoreline_distribution: [],
  predicted_advancement_probs: { home: 0.65, draw: 0, away: 0.35 },
  actual_home_score: null,
  actual_away_score: null,
  actual_result: null,
  settled_at_utc: null,
  brier_score: null,
  log_loss: null,
  scoreline_error: null,
  calibration_bucket: null,
  failure_type: null,
  kickoff_utc: '2026-07-10T19:00:00Z',
  venue: 'SoFi Stadium',
  group: null,
  feature_flags: {}
});

const base = { schema: 1, generated_at_utc: '2026-07-10T16:00:00Z', predictions: [prediction('aaaaaaaaaaaaaaaaaaaaaaaa')] };
const unique = { ...prediction('bbbbbbbbbbbbbbbbbbbbbbbb'), data_version: 'v2' };
const equivalent = { ...unique, prediction_id: 'cccccccccccccccccccccccc', source_snapshot_hash: 'c'.repeat(64) };
const result = reconcileAuditLedgers(base, [{ schema: 1, predictions: [unique, equivalent] }]);

assert.equal(result.added, 1);
assert.equal(result.skipped, 1);
assert.deepEqual(result.ledger.predictions.map(x => x.prediction_id), [
  'aaaaaaaaaaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbbbbbbbbbb'
]);
assert.throws(() => reconcileAuditLedgers(base, [{ predictions: [{ ...base.predictions[0], home_team: 'England' }] }]), /conflicting frozen prediction_id/);

console.log('prediction audit reconciliation tests passed');
