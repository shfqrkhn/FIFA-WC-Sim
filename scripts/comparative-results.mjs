#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readArtifact, writeArtifact } from './base-data.mjs';
import { buildBacktestAuditReport } from './backtest-audit.mjs';
import { calibrationEligiblePredictions, readJson, validateNoMarketFields, writeJsonIfChanged } from './prediction-audit-lib.mjs';

const args = process.argv.slice(2);
const getArg = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const outcomeLabel = value => ({ home_win: 'home win', draw: 'draw', away_win: 'away win' }[value] || 'unresolved');
const favorite = probs => Object.entries(probs || {}).sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))[0]?.[0] || null;

export function buildComparativeResultsReport({ ledger = {}, data = {}, calibrationState = {}, asOfUtc = null } = {}) {
  const backtest = buildBacktestAuditReport({ ledger, data, calibrationState, asOfUtc });
  const allMatches = [...(data.matches || []), ...(data.knockout || [])];
  const matchMap = new Map(allMatches.map(match => [Number(match.no), match]));
  const eligible = calibrationEligiblePredictions(ledger.predictions || [], matchMap, { asOfUtc: backtest.generated_at_utc });
  const rows = eligible.map(row => {
    const match = matchMap.get(Number(row.match_id)) || {};
    const predicted = favorite(row.predicted_wdl_probs);
    return {
      prediction_id: row.prediction_id,
      match_id: Number(row.match_id),
      stage: row.stage || match.round || match.stage || 'unknown',
      teams: `${row.home_team} vs ${row.away_team}`,
      actual_score: `${row.actual_home_score}–${row.actual_away_score}`,
      predicted_outcome: outcomeLabel(predicted),
      actual_outcome: outcomeLabel(row.actual_result),
      outcome_correct: predicted === row.actual_result,
      predicted_confidence: round(row.predicted_wdl_probs?.[predicted]),
      scoreline_error: round(row.scoreline_error),
      brier_score: round(row.brier_score, 12),
      log_loss: round(row.log_loss, 12),
      confidence_bucket: row.calibration_bucket,
      failure_class: row.failure_type || 'unclassified',
      frozen_at_utc: row.created_at_utc,
      settled_at_utc: row.settled_at_utc
    };
  }).sort((a, b) => a.match_id - b.match_id || a.prediction_id.localeCompare(b.prediction_id));
  const exactScore = rows.filter(row => row.scoreline_error === 0).length;
  const report = {
    schema: 1,
    generated_at_utc: backtest.generated_at_utc,
    source_note: 'Settled-only comparison of immutable pre-kickoff simulator forecasts against embedded ESPN completed finals. No market data is used.',
    settled_only: true,
    denominators: { frozen: (ledger.predictions || []).length, settled_eligible: rows.length, unresolved: backtest.unresolved_predictions, rejected: backtest.rejected_predictions },
    summary: {
      outcome_accuracy: { correct: rows.filter(row => row.outcome_correct).length, count: rows.length, rate: rows.length ? round(rows.filter(row => row.outcome_correct).length / rows.length) : null },
      exact_score_accuracy: { correct: exactScore, count: rows.length, rate: rows.length ? round(exactScore / rows.length) : null },
      mean_scoreline_error: backtest.overall.scoreline_error.mean_absolute_error,
      raw_model: backtest.overall.metrics.raw_model,
      uniform_wdl: backtest.overall.metrics.uniform_wdl,
      rank_prior: backtest.overall.metrics.rank_prior,
      calibration: { status: calibrationState.calibration_status || 'insufficient_sample', active: !!calibrationState.active, raw_validation_metrics: calibrationState.raw_validation_metrics || null, validation_metrics: calibrationState.validation_metrics || null }
    },
    reliability: backtest.by_confidence_bucket,
    by_stage: backtest.by_stage,
    by_failure_class: backtest.by_failure_type,
    comparisons: backtest.comparisons,
    rows,
    limitations: [...backtest.limitations, 'Rows are comparisons of frozen forecasts with embedded completed results; they are not a claim of official completeness or prediction certainty.']
  };
  const check = validateNoMarketFields(report);
  if (!check.ok) throw new Error(`blocked market-like comparative field(s): ${check.fields.join(', ')}`);
  return report;
}

export function runComparativeResults(argv = args) {
  const htmlPath = getArg('--html') || 'docs/index.html';
  const outPath = getArg('--out') || 'data/comparative-results.json';
  const auditPath = getArg('--audit') || 'data/prediction-audit.json';
  const statePath = getArg('--state') || 'data/calibration-state.json';
  const noWrite = argv.includes('--no-write');
  const artifact = readArtifact(htmlPath);
  const report = buildComparativeResultsReport({ ledger: readJson(auditPath, { predictions: [] }), data: artifact.data, calibrationState: readJson(statePath, {}), asOfUtc: getArg('--as-of') });
  if (!noWrite) {
    const changed = writeJsonIfChanged(outPath, report);
    artifact.data.comparativeResults = report;
    writeArtifact(artifact, htmlPath);
    console.log(`Comparative results: ${report.denominators.settled_eligible} settled forecast(s), ${changed ? 'updated' : 'unchanged'} ${outPath}.`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runComparativeResults(); } catch (error) { console.error(error.message); process.exit(1); }
}
