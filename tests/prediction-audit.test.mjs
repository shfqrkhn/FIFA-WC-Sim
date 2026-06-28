import assert from 'node:assert/strict';
import {
  appendFrozenPrediction,
  createPredictionRecord,
  emptyAuditLedger,
  REQUIRED_LEDGER_FIELDS,
  validateNoMarketFields
} from '../scripts/prediction-audit-lib.mjs';

const match = {
  no: 101,
  stage: 'group',
  group: 'A',
  date: '2026-07-01T19:00:00Z',
  venue: 'Audit Stadium',
  teamA: 'Alpha',
  teamB: 'Beta',
  played: false
};
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

const prediction = createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T12:00:00Z',
  modelVersion: 'audit-test-model',
  dataVersion: 'audit-test-data',
  sourceSnapshotHash: HASH_A,
  predictedWdlProbs: { home_win: 0.45, draw: 0.28, away_win: 0.27 },
  predictedScorelineDistribution: [{ score: '1-0', probability: 0.12 }],
  predictedAdvancementProbs: { home: 0.45, draw: 0.28, away: 0.27 }
});

for (const field of REQUIRED_LEDGER_FIELDS) {
  assert.ok(Object.hasOwn(prediction, field), `missing ${field}`);
}

assert.equal(prediction.match_id, 101);
assert.equal(prediction.home_team, 'Alpha');
assert.equal(prediction.away_team, 'Beta');
assert.equal(prediction.actual_home_score, null);
assert.equal(prediction.brier_score, null);
assert.equal(prediction.failure_type, null);
assert.ok(validateNoMarketFields(prediction).ok);

const ledger = emptyAuditLedger('2026-07-01T12:00:00Z');
const appended = appendFrozenPrediction(ledger, prediction);
const duplicate = appendFrozenPrediction(appended.ledger, {
  ...prediction,
  predicted_wdl_probs: { home_win: 0.99, draw: 0.005, away_win: 0.005 }
});

assert.equal(appended.changed, true);
assert.equal(duplicate.changed, false);
assert.equal(duplicate.ledger.predictions.length, 1);
assert.deepEqual(duplicate.ledger.predictions[0].predicted_wdl_probs, prediction.predicted_wdl_probs);

const equivalentNewSnapshot = createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T12:30:00Z',
  modelVersion: 'audit-test-model',
  dataVersion: 'audit-test-data',
  sourceSnapshotHash: HASH_B,
  predictedWdlProbs: { home_win: 0.45, draw: 0.28, away_win: 0.27 },
  predictedScorelineDistribution: [{ score: '1-0', probability: 0.12 }],
  predictedAdvancementProbs: { home: 0.45, draw: 0.28, away: 0.27 }
});
const equivalent = appendFrozenPrediction(appended.ledger, equivalentNewSnapshot);
assert.equal(equivalent.changed, false);
assert.equal(equivalent.skipped, 'equivalent_prediction_already_frozen');
assert.equal(equivalent.ledger.predictions.length, 1);

assert.throws(() => createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T19:00:01Z',
  modelVersion: 'late-model',
  dataVersion: 'late-data',
  sourceSnapshotHash: HASH_C,
  predictedWdlProbs: { home_win: 0.4, draw: 0.3, away_win: 0.3 },
  predictedScorelineDistribution: [],
  predictedAdvancementProbs: {}
}), /after kickoff/);

assert.throws(() => createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T12:00:00Z',
  modelVersion: 'audit-test-model',
  dataVersion: 'audit-test-data',
  sourceSnapshotHash: 'short-hash',
  predictedWdlProbs: { home_win: 0.45, draw: 0.28, away_win: 0.27 },
  predictedScorelineDistribution: [{ score: '1-0', probability: 0.12 }],
  predictedAdvancementProbs: { home: 0.45, draw: 0.28, away: 0.27 }
}), /sourceSnapshotHash/);

assert.throws(() => createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T12:00:00Z',
  modelVersion: 'audit-test-model',
  dataVersion: 'audit-test-data',
  sourceSnapshotHash: HASH_C,
  predictedWdlProbs: { home_win: 0.45, draw: 0.28 },
  predictedScorelineDistribution: [{ score: '1-0', probability: 0.12 }],
  predictedAdvancementProbs: { home: 0.45, draw: 0.28, away: 0.27 }
}), /predictedWdlProbs/);

assert.throws(() => createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T12:00:00Z',
  modelVersion: 'audit-test-model',
  dataVersion: 'audit-test-data',
  sourceSnapshotHash: HASH_C,
  predictedWdlProbs: { home_win: 0.45, draw: 0.28, away_win: 0.27 },
  predictedScorelineDistribution: [],
  predictedAdvancementProbs: { home: 0.45, draw: 0.28, away: 0.27 }
}), /predictedScorelineDistribution/);

assert.throws(() => createPredictionRecord({
  match,
  createdAtUtc: '2026-07-01T12:00:00Z',
  modelVersion: 'audit-test-model',
  dataVersion: 'audit-test-data',
  sourceSnapshotHash: HASH_C,
  predictedWdlProbs: { home_win: 0.45, draw: 0.28, away_win: 0.27 },
  predictedScorelineDistribution: [{ score: '1-0', probability: 0.12 }],
  predictedAdvancementProbs: { home: 0.45, away: 0.27 }
}), /predictedAdvancementProbs/);

console.log('prediction audit tests passed');
