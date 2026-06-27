#!/usr/bin/env node
import { readArtifact } from './base-data.mjs';
import {
  emptyAuditLedger,
  readJson,
  scoreLedger,
  validateNoMarketFields,
  writeJsonIfChanged
} from './prediction-audit-lib.mjs';

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const AUDIT_PATH = getArg('--audit') || 'data/prediction-audit.json';
const NOW = getArg('--now') || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const data = readArtifact('docs/index.html').data;
const audit = readJson(AUDIT_PATH, emptyAuditLedger(NOW));
const matchMap = new Map([...data.matches, ...data.knockout].map(match => [Number(match.no), match]));
const result = scoreLedger(audit, matchMap, NOW);
const marketCheck = validateNoMarketFields(result.ledger);
if (!marketCheck.ok) throw new Error(`blocked market-like audit field(s): ${marketCheck.fields.join(', ')}`);
const changed = writeJsonIfChanged(AUDIT_PATH, result.ledger);
console.log(JSON.stringify({ scored: result.scored, skipped: result.skipped, changed, audit: AUDIT_PATH }, null, 2));
