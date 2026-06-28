import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-calibration-'));
const htmlPath = path.join(tmp, 'index.html');
const auditPath = path.join(tmp, 'prediction-audit.json');
const statePath = path.join(tmp, 'calibration-state.json');

fs.copyFileSync('docs/index.html', htmlPath);
fs.copyFileSync('data/prediction-audit.json', auditPath);
fs.copyFileSync('data/calibration-state.json', statePath);

function runValidator() {
  return spawnSync(process.execPath, [
    'scripts/validate-calibration.mjs',
    '--html', htmlPath,
    '--audit', auditPath,
    '--state', statePath
  ], { encoding: 'utf8' });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const clean = runValidator();
assert.equal(clean.status, 0, clean.stderr || clean.stdout);

const audit = readJson(auditPath);
audit.predictions[0].match_id = 9999;
writeJson(auditPath, audit);
const unknownMatch = runValidator();
assert.notEqual(unknownMatch.status, 0);
assert.match(unknownMatch.stderr, /references unknown match_id/);

fs.copyFileSync('data/prediction-audit.json', auditPath);
const state = readJson(statePath);
state.resolved_predictions = 1;
writeJson(statePath, state);
const staleCount = runValidator();
assert.notEqual(staleCount.status, 0);
assert.match(staleCount.stderr, /does not match eligible settled predictions/);

state.resolved_predictions = 30;
state.calibration_status = 'insufficient_sample';
writeJson(statePath, state);
const staleInsufficient = runValidator();
assert.notEqual(staleInsufficient.status, 0);
assert.match(staleInsufficient.stderr, /must not remain insufficient_sample/);

fs.copyFileSync('data/calibration-state.json', statePath);
const fakeSettled = readJson(auditPath);
fakeSettled.predictions[0].actual_result = 'home_win';
fakeSettled.predictions[0].actual_home_score = 1;
fakeSettled.predictions[0].actual_away_score = 0;
fakeSettled.predictions[0].settled_at_utc = '2026-06-28T04:00:00Z';
fakeSettled.predictions[0].brier_score = 0.5;
fakeSettled.predictions[0].log_loss = 0.7;
fakeSettled.predictions[0].scoreline_error = 1;
fakeSettled.predictions[0].calibration_bucket = '0.4-0.5';
fakeSettled.predictions[0].failure_type = 'pure_variance';
writeJson(auditPath, fakeSettled);
const settledTooEarly = runValidator();
assert.notEqual(settledTooEarly.status, 0);
assert.match(settledTooEarly.stderr, /settled before embedded match is played/);

fs.copyFileSync('data/prediction-audit.json', auditPath);
const badTimestamp = readJson(auditPath);
badTimestamp.predictions[0].created_at_utc = '2026-06-27T07:57:06-04:00';
writeJson(auditPath, badTimestamp);
const nonUtc = runValidator();
assert.notEqual(nonUtc.status, 0);
assert.match(nonUtc.stderr, /invalid freeze timestamps/);

fs.copyFileSync('data/prediction-audit.json', auditPath);
const badDistribution = readJson(auditPath);
badDistribution.predictions[0].predicted_scoreline_distribution[0].probability = 2;
writeJson(auditPath, badDistribution);
const invalidDistribution = runValidator();
assert.notEqual(invalidDistribution.status, 0);
assert.match(invalidDistribution.stderr, /invalid predicted_scoreline_distribution/);

fs.copyFileSync('data/prediction-audit.json', auditPath);
const badAdvancement = readJson(auditPath);
delete badAdvancement.predictions[0].predicted_advancement_probs.draw;
writeJson(auditPath, badAdvancement);
const invalidAdvancement = runValidator();
assert.notEqual(invalidAdvancement.status, 0);
assert.match(invalidAdvancement.stderr, /invalid predicted_advancement_probs keys/);

fs.copyFileSync('data/prediction-audit.json', auditPath);
const extraWdl = readJson(auditPath);
extraWdl.predictions[0].predicted_wdl_probs.extra = 0;
writeJson(auditPath, extraWdl);
const invalidWdl = runValidator();
assert.notEqual(invalidWdl.status, 0);
assert.match(invalidWdl.stderr, /invalid predicted_wdl_probs keys/);

fs.copyFileSync('data/prediction-audit.json', auditPath);
const badHash = readJson(auditPath);
badHash.predictions[0].source_snapshot_hash = 'abc123';
writeJson(auditPath, badHash);
const invalidHash = runValidator();
assert.notEqual(invalidHash.status, 0);
assert.match(invalidHash.stderr, /invalid source_snapshot_hash format/);

fs.rmSync(auditPath);
const missingAudit = runValidator();
assert.notEqual(missingAudit.status, 0);
assert.match(missingAudit.stderr, /missing prediction audit file/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('validate-calibration tests passed');
