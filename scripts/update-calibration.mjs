#!/usr/bin/env node
import { readArtifact, writeArtifact } from './base-data.mjs';
import {
  emptyAuditLedger,
  emptyCalibrationState,
  publicCalibrationState,
  readJson,
  stableJson,
  updateCalibrationState,
  validateNoMarketFields,
  writeJsonIfChanged
} from './prediction-audit-lib.mjs';

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const AUDIT_PATH = getArg('--audit') || 'data/prediction-audit.json';
const STATE_PATH = getArg('--state') || 'data/calibration-state.json';
const NOW = getArg('--now') || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const artifact = readArtifact('docs/index.html');
const audit = readJson(AUDIT_PATH, emptyAuditLedger(NOW));
const previous = readJson(STATE_PATH, emptyCalibrationState(NOW));
const matchMap = new Map([...artifact.data.matches, ...artifact.data.knockout].map(match => [Number(match.no), match]));
const next = updateCalibrationState(audit, previous, { asOfUtc: NOW, matchMap });
const marketCheck = validateNoMarketFields(next);
if (!marketCheck.ok) throw new Error(`blocked market-like calibration field(s): ${marketCheck.fields.join(', ')}`);
const stateChanged = writeJsonIfChanged(STATE_PATH, next);
const publicState = publicCalibrationState(next);
const before = stableJson(artifact.data.calibration || null);
artifact.data.calibration = publicState;
const embedChanged = before !== stableJson(publicState);
if (embedChanged) writeArtifact(artifact, 'docs/index.html');
console.log(JSON.stringify({
  calibration_status: next.calibration_status,
  resolved_predictions: next.resolved_predictions,
  stateChanged,
  embedChanged,
  state: STATE_PATH
}, null, 2));
