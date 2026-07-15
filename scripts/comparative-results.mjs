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
const predictedAdvancementSide = probs => {
  const home = Number(probs?.home);
  const away = Number(probs?.away);
  if (!Number.isFinite(home) || !Number.isFinite(away) || home + away <= 0) return null;
  return away > home ? 'away' : 'home';
};
const actualAdvancementSide = (row, match) => match?.winner === row.home_team ? 'home' : match?.winner === row.away_team ? 'away' : null;

export function buildComparativeResultsReport({ ledger = {}, data = {}, calibrationState = {}, asOfUtc = null } = {}) {
  const backtest = buildBacktestAuditReport({ ledger, data, calibrationState, asOfUtc });
  const allMatches = [...(data.matches || []), ...(data.knockout || [])];
  const matchMap = new Map(allMatches.map(match => [Number(match.no), match]));
  const eligible = calibrationEligiblePredictions(ledger.predictions || [], matchMap, { asOfUtc: backtest.generated_at_utc });
  const selected = new Map();
  for (const row of eligible) {
    const prior = selected.get(Number(row.match_id));
    if (!prior || Date.parse(row.created_at_utc) > Date.parse(prior.created_at_utc) || (Date.parse(row.created_at_utc) === Date.parse(prior.created_at_utc) && String(row.prediction_id) > String(prior.prediction_id))) selected.set(Number(row.match_id), row);
  }
  const canonical = [...selected.values()];
  const matchBacktest = buildBacktestAuditReport({ ledger: { ...ledger, predictions: canonical }, data, calibrationState, asOfUtc: backtest.generated_at_utc });
  const rows = canonical.map(row => {
    const match = matchMap.get(Number(row.match_id)) || {};
    const predicted = favorite(row.predicted_wdl_probs);
    const predictedAdvance = predictedAdvancementSide(row.predicted_advancement_probs);
    const actualAdvance = actualAdvancementSide(row, match);
    const hasAdvancement = !!(predictedAdvance && actualAdvance);
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
      predicted_advancing_team: hasAdvancement ? (predictedAdvance === 'home' ? row.home_team : row.away_team) : null,
      actual_advancing_team: hasAdvancement ? match.winner : null,
      predicted_advancement_confidence: hasAdvancement ? round(row.predicted_advancement_probs?.[predictedAdvance]) : null,
      advancement_correct: hasAdvancement ? predictedAdvance === actualAdvance : null,
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
  const advancementRows = rows.filter(row => typeof row.advancement_correct === 'boolean');
  const advancementCorrect = advancementRows.filter(row => row.advancement_correct).length;
  const report = {
    schema: 1,
    generated_at_utc: backtest.generated_at_utc,
    source_note: 'Settled-only comparison of immutable pre-kickoff simulator forecasts against embedded ESPN completed finals. No market data is used.',
    settled_only: true,
    denominators: { frozen: (ledger.predictions || []).length, settled_eligible_forecasts: eligible.length, settled_matches: rows.length, excluded_duplicate_snapshots: eligible.length - rows.length, unresolved: backtest.unresolved_predictions, rejected: backtest.rejected_predictions },
    selection_rule: 'One row per settled match: latest eligible immutable pre-kickoff forecast. Earlier snapshots remain preserved in the audit ledger and are excluded from match-level metrics.',
    summary: {
      outcome_accuracy: { correct: rows.filter(row => row.outcome_correct).length, count: rows.length, rate: rows.length ? round(rows.filter(row => row.outcome_correct).length / rows.length) : null },
      exact_score_accuracy: { correct: exactScore, count: rows.length, rate: rows.length ? round(exactScore / rows.length) : null },
      advancement_accuracy: { correct: advancementCorrect, count: advancementRows.length, rate: advancementRows.length ? round(advancementCorrect / advancementRows.length) : null },
      mean_scoreline_error: matchBacktest.overall.scoreline_error.mean_absolute_error,
      raw_model: matchBacktest.overall.metrics.raw_model,
      uniform_wdl: matchBacktest.overall.metrics.uniform_wdl,
      rank_prior: matchBacktest.overall.metrics.rank_prior,
      calibration: { status: calibrationState.calibration_status || 'insufficient_sample', active: !!calibrationState.active, raw_validation_metrics: calibrationState.raw_validation_metrics || null, validation_metrics: calibrationState.validation_metrics || null }
    },
    reliability: matchBacktest.by_confidence_bucket,
    by_stage: matchBacktest.by_stage,
    by_failure_class: matchBacktest.by_failure_type,
    comparisons: matchBacktest.comparisons,
    rows,
    limitations: [...backtest.limitations, 'Knockout advancement is evaluated separately from field-score WDL; a penalty-decided tied score remains a draw for WDL scoring.', 'Rows are comparisons of frozen forecasts with embedded completed results; they are not a claim of official completeness or prediction certainty.']
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
    console.log(`Comparative results: ${report.denominators.settled_matches} settled match(es), ${changed ? 'updated' : 'unchanged'} ${outPath}.`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runComparativeResults(); } catch (error) { console.error(error.message); process.exit(1); }
}
