import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calibrationEligiblePredictions, validateNoMarketFields } from '../scripts/prediction-audit-lib.mjs';

const base = {
  prediction_id: 'p',
  created_at_utc: '2026-06-20T10:00:00Z',
  match_id: 1,
  stage: 'group',
  home_team: 'Alpha',
  away_team: 'Beta',
  model_version: 'm',
  data_version: 'd',
  source_snapshot_hash: 'h',
  predicted_wdl_probs: { home_win: 0.5, draw: 0.25, away_win: 0.25 },
  predicted_scoreline_distribution: [],
  predicted_advancement_probs: {},
  actual_home_score: 1,
  actual_away_score: 0,
  actual_result: 'home_win',
  settled_at_utc: '2026-06-20T22:00:00Z',
  brier_score: 0.375,
  log_loss: 0.693,
  scoreline_error: 1,
  calibration_bucket: '0.5-0.6',
  failure_type: 'pure_variance'
};

const eligible = calibrationEligiblePredictions([
  base,
  { ...base, prediction_id: 'future-settled', settled_at_utc: '2026-07-02T00:00:00Z' },
  { ...base, prediction_id: 'late-created', created_at_utc: '2026-06-20T21:00:00Z' },
  { ...base, prediction_id: 'future-created', created_at_utc: '2026-07-02T01:00:00Z' },
  { ...base, prediction_id: 'no-kickoff', match_id: 2 },
  { ...base, prediction_id: 'settled-before-kickoff', match_id: 3, kickoff_utc: '2026-06-21T18:00:00Z' },
  { ...base, prediction_id: 'missing-score', actual_home_score: null },
  { ...base, prediction_id: 'unsettled', actual_result: null, settled_at_utc: null }
], new Map([
  [1, { no: 1, date: '2026-06-20T18:00:00Z' }]
]), { asOfUtc: '2026-07-01T00:00:00Z' });

assert.deepEqual(eligible.map(p => p.prediction_id), ['p']);

const sameBatch = calibrationEligiblePredictions([
  { ...base, prediction_id: 'z-earlier-kickoff', match_id: 11, settled_at_utc: '2026-06-22T00:00:00Z' },
  { ...base, prediction_id: 'a-later-kickoff', match_id: 12, settled_at_utc: '2026-06-22T00:00:00Z' }
], new Map([
  [11, { no: 11, date: '2026-06-20T18:00:00Z' }],
  [12, { no: 12, date: '2026-06-21T18:00:00Z' }]
]), { asOfUtc: '2026-06-23T00:00:00Z' });

assert.deepEqual(sameBatch.map(p => p.prediction_id), ['z-earlier-kickoff', 'a-later-kickoff']);

const repoText = [
  fs.readFileSync('README.md', 'utf8'),
  fs.readFileSync('docs/index.html', 'utf8')
].join('\n');
assert.ok(validateNoMarketFields(JSON.parse(JSON.stringify({ repoText }))).ok);

console.log('no-leakage tests passed');
