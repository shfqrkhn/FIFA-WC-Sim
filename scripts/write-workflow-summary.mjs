#!/usr/bin/env node
import fs from 'node:fs';
import { readArtifact } from './base-data.mjs';

function readJson(path) {
  try {
    return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : null;
  } catch (error) {
    return { error: error.message };
  }
}

function row(label, value) {
  const safeValue = String(value ?? 'n/a')
    .split('|').join('\\|')
    .split('\r').join(' ')
    .split('\n').join(' ');
  return `| ${label} | ${safeValue} |`;
}

const { data } = readArtifact('docs/index.html');
const latest = readJson('data/latest-update.json') || {};
const health = readJson('data/update-health.json') || {};
const backtest = readJson('data/backtest-audit.json') || {};
const scoreboard = health.scoreboard || {};
const audit = health.predictionAudit || {};
const latestScoreboard = latest.scoreboard || {};

const lines = [
  '## BASE_DATA update summary',
  '',
  '| Field | Value |',
  '| --- | --- |',
  row('Data version', data.version),
  row('Generated at', data.generatedAt),
  row('Played matches', `${scoreboard.playedMatches ?? data.currentStats?.matchesPlayed ?? 'n/a'} / ${scoreboard.totalMatches ?? 104}`),
  row('Group matches', `${scoreboard.playedGroupMatches ?? 'n/a'} / ${scoreboard.totalGroupMatches ?? 72}`),
  row('Knockout matches', `${scoreboard.playedKnockoutMatches ?? 'n/a'} / ${scoreboard.totalKnockoutMatches ?? 32}`),
  row('Overdue unplayed matches', scoreboard.overdueUnplayedMatches),
  row('Next scheduled match day', scoreboard.nextScheduledMatchDay),
  row('Latest updater generated at', latest.generatedAt),
  row('Scoreboard finals fetched', latestScoreboard.fetchedFinals),
  row('Scoreboard changes applied', latestScoreboard.appliedChanges),
  row('Fetch failures', Array.isArray(latestScoreboard.fetchFailures) ? latestScoreboard.fetchFailures.length : 'n/a'),
  row('Frozen predictions', audit.frozenPredictions),
  row('Settled predictions', audit.settledPredictions),
  row('Calibration status', audit.calibrationStatus),
  row('Backtest sample status', backtest.sample_status),
  row('Backtest raw Brier/log loss', `${backtest.overall?.metrics?.raw_model?.brier_score ?? 'n/a'} / ${backtest.overall?.metrics?.raw_model?.log_loss ?? 'n/a'}`),
  '',
  data.dataQuality?.principle || health.principle || 'Missing or failed sources degrade to neutral inputs unless validated data is available.'
];

console.log(lines.join('\n'));
