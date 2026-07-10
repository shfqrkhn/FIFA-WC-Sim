#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  appendFrozenPrediction,
  emptyAuditLedger,
  readJson,
  validateNoMarketFields,
  writeJsonIfChanged
} from './prediction-audit-lib.mjs';

export function reconcileAuditLedgers(primary, sources = []) {
  let ledger = structuredClone(primary || emptyAuditLedger());
  let added = 0;
  let skipped = 0;
  for (const source of sources) {
    for (const prediction of source?.predictions || []) {
      const result = appendFrozenPrediction(ledger, prediction);
      ledger = result.ledger;
      result.changed ? added += 1 : skipped += 1;
    }
  }
  ledger.predictions.sort((a, b) =>
    String(a.created_at_utc).localeCompare(String(b.created_at_utc)) ||
    Number(a.match_id) - Number(b.match_id) ||
    String(a.prediction_id).localeCompare(String(b.prediction_id)));
  const marketCheck = validateNoMarketFields(ledger);
  if (!marketCheck.ok) throw new Error(`blocked market-like audit field(s): ${marketCheck.fields.join(', ')}`);
  return { ledger, added, skipped };
}

function readLedgerFromRef(ref, auditPath) {
  try {
    const text = execFileSync('git', ['show', `${ref}:${auditPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const options = { audit: 'data/prediction-audit.json', refs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--audit') options.audit = argv[++i] || '';
    else if (argv[i] === '--source-ref') options.refs.push(argv[++i] || '');
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!options.audit) throw new Error('--audit requires a path');
  options.refs = options.refs.filter(Boolean);
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const primary = readJson(options.audit, emptyAuditLedger());
  const sources = options.refs.map(ref => ({ ref, ledger: readLedgerFromRef(ref, options.audit) })).filter(x => x.ledger);
  const result = reconcileAuditLedgers(primary, sources.map(x => x.ledger));
  const changed = writeJsonIfChanged(options.audit, result.ledger);
  console.log(JSON.stringify({
    changed,
    added: result.added,
    skipped: result.skipped,
    sourceRefs: sources.map(x => x.ref),
    audit: options.audit
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}
