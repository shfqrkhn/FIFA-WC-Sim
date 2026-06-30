#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  MIN_RESOLVED_PREDICTIONS,
  benchmarkMetrics,
  brierScore,
  calibrationBucket,
  calibrationEligiblePredictions,
  favoriteKey,
  logLoss,
  normalizeWdlProbs,
  readJson,
  validateNoMarketFields,
  writeJsonIfChanged
} from './prediction-audit-lib.mjs';
import { readArtifact } from './base-data.mjs';

const DEFAULT_AUDIT = 'data/prediction-audit.json';
const DEFAULT_STATE = 'data/calibration-state.json';
const DEFAULT_HTML = 'docs/index.html';
const DEFAULT_OUT = 'data/backtest-audit.json';

function getArg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function validUtcMs(raw) {
  const ms = Date.parse(raw || '');
  return Number.isFinite(ms) ? ms : null;
}

function latestTimestamp(...values) {
  const valid = values
    .filter(Boolean)
    .map(value => [String(value), validUtcMs(value)])
    .filter(([, ms]) => Number.isFinite(ms))
    .sort((a, b) => b[1] - a[1]);
  return valid[0]?.[0] || new Date(0).toISOString().replace('.000Z', 'Z');
}

function round(value, digits = 6) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
}

function matchMapFromData(data) {
  return new Map([...(data?.matches || []), ...(data?.knockout || [])].flatMap(match => [
    [Number(match.no), match],
    [String(match.no), match]
  ]));
}

function teamMapFromData(data) {
  return new Map((data?.teams || []).map(team => [team.name, team]));
}

function averageScorelineError(rows) {
  const values = rows.map(row => Number(row.scoreline_error)).filter(Number.isFinite);
  if (!values.length) return { mean_absolute_error: null, count: 0 };
  return {
    mean_absolute_error: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    count: values.length
  };
}

function summarizeRows(rows, teamMap = new Map()) {
  const metrics = benchmarkMetrics(rows, { teamMap });
  let favoriteCorrect = 0;
  let confidenceSum = 0;
  for (const row of rows) {
    const probs = normalizeWdlProbs(row.predicted_wdl_probs);
    const favorite = favoriteKey(probs);
    if (row.actual_result === favorite) favoriteCorrect += 1;
    confidenceSum += probs[favorite];
  }
  return {
    count: rows.length,
    metrics,
    favorite_accuracy: {
      correct: favoriteCorrect,
      count: rows.length,
      rate: rows.length ? round(favoriteCorrect / rows.length) : null,
      average_confidence: rows.length ? round(confidenceSum / rows.length) : null
    },
    scoreline_error: averageScorelineError(rows)
  };
}

function groupBy(rows, keyFn) {
  const groups = {};
  for (const row of rows) {
    const key = keyFn(row);
    groups[key] ||= [];
    groups[key].push(row);
  }
  return groups;
}

function summarizeGroups(rows, keyFn, teamMap) {
  return Object.fromEntries(Object.entries(groupBy(rows, keyFn))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupRows]) => [key, summarizeRows(groupRows, teamMap)]));
}

function stageBucket(row) {
  const stage = String(row?.stage || '').trim().toLowerCase();
  if (stage === 'group') return 'group';
  return stage ? 'knockout' : 'unknown';
}

function summarizeBuckets(rows) {
  return Object.fromEntries(Object.entries(groupBy(rows, row => row.calibration_bucket || calibrationBucket(row.predicted_wdl_probs)))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, groupRows]) => {
      let hits = 0;
      let confidence = 0;
      let brier = 0;
      let loss = 0;
      for (const row of groupRows) {
        const probs = normalizeWdlProbs(row.predicted_wdl_probs);
        const favorite = favoriteKey(probs);
        const maxProb = probs[favorite];
        hits += row.actual_result === favorite ? 1 : 0;
        confidence += maxProb;
        brier += brierScore(probs, row.actual_result);
        loss += logLoss(probs, row.actual_result);
      }
      return [bucket, {
        count: groupRows.length,
        average_confidence: round(confidence / groupRows.length),
        observed_favorite_hit_rate: round(hits / groupRows.length),
        brier_score: round(brier / groupRows.length, 12),
        log_loss: round(loss / groupRows.length, 12)
      }];
    }));
}

function countBy(rows, keyFn) {
  return Object.fromEntries(Object.entries(groupBy(rows, keyFn))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupRows]) => [key, groupRows.length]));
}

function compare(raw, baseline) {
  if (!raw || !baseline || raw.count === 0 || baseline.count === 0) {
    return { brier_delta: null, log_loss_delta: null, compared_count: 0 };
  }
  return {
    brier_delta: round(raw.brier_score - baseline.brier_score, 12),
    log_loss_delta: round(raw.log_loss - baseline.log_loss, 12),
    compared_count: Math.min(raw.count, baseline.count)
  };
}

function trendRows(rows) {
  return Object.entries(groupBy(rows, row => String(row.settled_at_utc || '').slice(0, 10) || 'unknown'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, groupRows]) => ({
      date,
      count: groupRows.length,
      brier_score: round(groupRows.reduce((sum, row) => sum + Number(row.brier_score), 0) / groupRows.length, 12),
      log_loss: round(groupRows.reduce((sum, row) => sum + Number(row.log_loss), 0) / groupRows.length, 12)
    }));
}

export function buildBacktestAuditReport({ ledger = {}, data = {}, calibrationState = {}, asOfUtc = null } = {}) {
  const reportTime = asOfUtc || latestTimestamp(calibrationState.generated_at_utc, ledger.generated_at_utc);
  const matchMap = matchMapFromData(data);
  const teamMap = teamMapFromData(data);
  const predictions = Array.isArray(ledger.predictions) ? ledger.predictions : [];
  const eligible = calibrationEligiblePredictions(predictions, matchMap, { asOfUtc: reportTime });
  const unresolved = predictions.filter(row => !row.settled_at_utc).length;
  const rejected = predictions.length - eligible.length - unresolved;
  const overall = summarizeRows(eligible, teamMap);
  const raw = overall.metrics.raw_model;
  const report = {
    schema: 1,
    generated_at_utc: reportTime,
    source_note: 'Prospective backtest from frozen pre-match predictions only. Records are eligible only if frozen before kickoff and scored after final result; no external market data is used.',
    sample_status: eligible.length < MIN_RESOLVED_PREDICTIONS ? 'insufficient_sample' : 'sufficient_for_calibration_review',
    resolved_predictions: eligible.length,
    unresolved_predictions: unresolved,
    rejected_predictions: rejected,
    min_resolved_predictions: MIN_RESOLVED_PREDICTIONS,
    leakage_guards: [
      'uses frozen pre-match prediction records only',
      'rejects predictions created after kickoff',
      'rejects predictions settled after report as-of time',
      'does not use future results for calibration or scoring',
      'keeps raw model and calibrated output separate'
    ],
    overall,
    comparisons: {
      raw_vs_uniform_wdl: compare(raw, overall.metrics.uniform_wdl),
      raw_vs_rank_prior: compare(raw, overall.metrics.rank_prior)
    },
    by_stage: summarizeGroups(eligible, stageBucket, teamMap),
    by_confidence_bucket: summarizeBuckets(eligible),
    by_failure_type: countBy(eligible, row => row.failure_type || 'unclassified'),
    by_actual_result: countBy(eligible, row => row.actual_result || 'unknown'),
    trend_by_settled_date: trendRows(eligible),
    limitations: [
      eligible.length < MIN_RESOLVED_PREDICTIONS ? 'Sample is below the calibration threshold; treat accuracy numbers as directional only.' : 'Sample has reached the calibration threshold, but domain drift and source gaps still matter.',
      'This is not a historical replay. It does not reconstruct older matchdays from archival inputs.',
      'Unavailable lineups, injuries, suspensions, referee assignments, and incomplete discipline ledgers remain neutral unless source-backed records are embedded.',
      'Metrics are educational/informational model diagnostics, not guarantees or advice.'
    ]
  };
  const marketCheck = validateNoMarketFields(report);
  if (!marketCheck.ok) throw new Error(`blocked market-like backtest field(s): ${marketCheck.fields.join(', ')}`);
  return report;
}

function summary(report) {
  const raw = report.overall.metrics.raw_model;
  const uniform = report.overall.metrics.uniform_wdl;
  const rank = report.overall.metrics.rank_prior;
  return [
    `Backtest audit: ${report.resolved_predictions} resolved frozen prediction(s), ${report.sample_status}.`,
    `Raw model Brier/log loss: ${raw.brier_score ?? 'n/a'} / ${raw.log_loss ?? 'n/a'}.`,
    `Uniform baseline: ${uniform.brier_score ?? 'n/a'} / ${uniform.log_loss ?? 'n/a'}.`,
    `Rank-prior baseline: ${rank.brier_score ?? 'n/a'} / ${rank.log_loss ?? 'n/a'}.`,
    `Favorite hit rate: ${report.overall.favorite_accuracy.rate ?? 'n/a'}.`
  ].join('\n');
}

export function runBacktestAudit(argv = process.argv.slice(2)) {
  const auditPath = getArg(argv, '--audit') || DEFAULT_AUDIT;
  const statePath = getArg(argv, '--state') || DEFAULT_STATE;
  const htmlPath = getArg(argv, '--html') || DEFAULT_HTML;
  const outPath = getArg(argv, '--out') || DEFAULT_OUT;
  const asOfUtc = getArg(argv, '--as-of');
  const jsonOnly = argv.includes('--json');
  const noWrite = argv.includes('--no-write');
  const ledger = readJson(auditPath, { predictions: [] });
  const calibrationState = readJson(statePath, {});
  const { data } = readArtifact(htmlPath);
  const report = buildBacktestAuditReport({ ledger, data, calibrationState, asOfUtc });
  const changed = noWrite ? false : writeJsonIfChanged(outPath, report);
  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(summary(report));
    if (!noWrite) console.log(`${changed ? 'Updated' : 'Unchanged'} ${outPath}`);
  }
  return { report, changed };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    runBacktestAudit();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
