import assert from 'node:assert/strict';
import {
  brierScore,
  classifyFailure,
  logLoss,
  scorePrediction
} from '../scripts/prediction-audit-lib.mjs';

assert.equal(brierScore({ home_win: 0.7, draw: 0.2, away_win: 0.1 }, 'home_win'), 0.14);
assert.ok(Math.abs(logLoss({ home_win: 0.7, draw: 0.2, away_win: 0.1 }, 'home_win') - 0.3566749439) < 1e-9);

const frozen = {
  prediction_id: 'p1',
  created_at_utc: '2026-06-20T12:00:00Z',
  match_id: 7,
  stage: 'group',
  home_team: 'Alpha',
  away_team: 'Beta',
  model_version: 'm',
  data_version: 'd',
  source_snapshot_hash: 'h',
  predicted_wdl_probs: { home_win: 0.7, draw: 0.2, away_win: 0.1 },
  predicted_scoreline_distribution: [{ score: '2-0', probability: 0.2 }],
  predicted_advancement_probs: { home: 0.7, draw: 0.2, away: 0.1 },
  actual_home_score: null,
  actual_away_score: null,
  actual_result: null,
  settled_at_utc: null,
  brier_score: null,
  log_loss: null,
  scoreline_error: null,
  calibration_bucket: null,
  failure_type: null
};

const completed = {
  no: 7,
  stage: 'group',
  date: '2026-06-20T18:00:00Z',
  teamA: 'Alpha',
  teamB: 'Beta',
  scoreA: 1,
  scoreB: 1,
  played: true
};

const scored = scorePrediction(frozen, completed, '2026-06-20T20:00:00Z');
assert.equal(scored.scored, true);
assert.equal(scored.prediction.actual_result, 'draw');
assert.equal(scored.prediction.actual_home_score, 1);
assert.equal(scored.prediction.actual_away_score, 1);
assert.equal(scored.prediction.failure_type, 'underestimated_draw');
assert.ok(Number.isFinite(scored.prediction.brier_score));
assert.ok(Number.isFinite(scored.prediction.log_loss));
assert.ok(Number.isFinite(scored.prediction.scoreline_error));

const late = scorePrediction({ ...frozen, created_at_utc: '2026-06-20T18:00:01Z' }, completed, '2026-06-20T20:00:00Z');
assert.equal(late.scored, false);
assert.match(late.reason, /after kickoff/);

const prematureSettlement = scorePrediction(frozen, completed, '2026-06-20T17:59:59Z');
assert.equal(prematureSettlement.scored, false);
assert.match(prematureSettlement.reason, /before kickoff/);

const impossibleSettlementOrder = scorePrediction(frozen, completed, '2026-06-20T11:59:59Z');
assert.equal(impossibleSettlementOrder.scored, false);
assert.match(impossibleSettlementOrder.reason, /before prediction creation/);

const malformedScore = scorePrediction(frozen, { ...completed, scoreA: 1.5 }, '2026-06-20T20:00:00Z');
assert.equal(malformedScore.scored, false);
assert.match(malformedScore.reason, /sane integer/);

assert.equal(classifyFailure({
  ...frozen,
  predicted_wdl_probs: { home_win: 0.8, draw: 0.12, away_win: 0.08 }
}, { actual_result: 'away_win', scoreline_error: 3 }), 'overconfident_favorite');

console.log('scoring tests passed');
