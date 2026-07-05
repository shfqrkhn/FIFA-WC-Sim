#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import { readArtifact } from './base-data.mjs';
import {
  appendFrozenPrediction,
  createPredictionRecord,
  emptyAuditLedger,
  matchKickoffMs,
  readJson,
  sha256,
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
const MATCH_FILTER = getArg('--match');
const MODEL_VERSION = 'embedded-simulator-v1';

function createElementStub(selector = '') {
  const classes = new Set();
  return {
    value: selector === '#mode' ? 'balanced' : selector === '#seed' ? 'audit-freeze' : selector === '#runs' ? '400' : '',
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, force) { const on = force === undefined ? !classes.has(name) : !!force; on ? classes.add(name) : classes.delete(name); return on; },
      contains(name) { return classes.has(name); }
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return ''; },
    appendChild() {},
    focus() {},
    click() {}
  };
}

async function simulatorSandbox(html) {
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.indexOf('</script>', scriptStart);
  if (scriptStart < 0 || scriptEnd < 0) throw new Error('No inline simulator script found.');
  const script = html.slice(scriptStart + '<script>'.length, scriptEnd).replace(/render\(\);\s*$/m, '');
  const elements = new Map();
  const documentStub = {
    styleSheets: [],
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, createElementStub(selector));
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    getElementById(id) { return this.querySelector(`#${id}`); },
    createElement(tag) { return createElementStub(tag); },
    addEventListener() {},
    removeEventListener() {}
  };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    document: documentStub,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { hash: '' },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    Blob: class Blob {},
    URL: { createObjectURL() { return 'blob:audit'; }, revokeObjectURL() {} },
    fetch: async () => { throw new Error('network disabled during prediction freeze'); }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { timeout: 5000 });
  await vm.runInContext('__bootstrapReady', sandbox, { timeout: 1000 });
  return sandbox;
}

function sourceSnapshotHash(data, match) {
  const home = data.teams.find(t => t.name === match.teamA);
  const away = data.teams.find(t => t.name === match.teamB);
  return sha256({
    dataVersion: data.version,
    generatedAt: data.generatedAt,
    config: data.config,
    modelInputs: data.modelInputs,
    match,
    home,
    away,
    weather: data.weatherByMatch?.[String(match.no)] || null
  });
}

function featureFlags(data, match) {
  const ctxA = match.context?.A || {};
  const ctxB = match.context?.B || {};
  const hostTeam = name => {
    const t = data.teams.find(row => row.name === name);
    const venue = data.venues?.[match.venue] || {};
    return !!(t?.host && venue.country && t.name && venue.country.includes(t.name.split(' ')[0]));
  };
  return {
    weather_adjustment_abs: Math.max(Math.abs(Number(ctxA.weatherAdj || 0)), Math.abs(Number(ctxB.weatherAdj || 0))),
    recent_form_adjustment_abs: Math.max(Math.abs(Number(ctxA.formAdj || 0)), Math.abs(Number(ctxB.formAdj || 0))),
    host_adjustment_abs: hostTeam(match.teamA) || hostTeam(match.teamB) ? Number(data.config?.homeAdvGoals || 0.18) : 0,
    attack_defense_weight: Number(data.config?.attackWeight || 0),
    lineups_missing: data.dataQuality?.lineups?.status === 'missing',
    suspensions_missing: data.dataQuality?.suspensions?.status === 'missing'
  };
}

function estimatePrediction(sandbox, matchNo) {
  return vm.runInContext(`(() => {
    const m = DATA.matches.find(x => Number(x.no) === ${Number(matchNo)}) || DATA.knockout.find(x => Number(x.no) === ${Number(matchNo)});
    if (!m || !m.teamA || !m.teamB) throw new Error('match has unresolved teams');
    const opts = {mode:'balanced', chaos:1, homeAdv:true, liveWeather:false, weatherOff:false};
    const [lambdaA, lambdaB] = expectedGoals(m.teamA, m.teamB, m, opts, DATA.matches);
    const dist = scorelineDistribution(lambdaA, lambdaB, opts);
    const out = {home_win:0, draw:0, away_win:0};
    for (const row of dist) {
      if (row.a === row.b) out.draw += row.p;
      else if (row.a > row.b) out.home_win += row.p;
      else out.away_win += row.p;
    }
    const topScores = dist.slice().sort((a,b) => b.p - a.p || a.a - b.a || a.b - b.b).slice(0,12).map(row => ({
      score: row.a + '-' + row.b,
      probability: Number(row.p.toFixed(8))
    }));
    return {
      predictedWdlProbs: Object.fromEntries(Object.entries(out).map(([k,v]) => [k, Number(v.toFixed(10))])),
      predictedScorelineDistribution: topScores,
      predictedAdvancementProbs: {
        home: Number((out.home_win + (m.stage === 'group' ? 0 : out.draw / 2)).toFixed(10)),
        draw: Number((m.stage === 'group' ? out.draw : 0).toFixed(10)),
        away: Number((out.away_win + (m.stage === 'group' ? 0 : out.draw / 2)).toFixed(10))
      }
    };
  })()`, sandbox, { timeout: 1000 });
}

const state = readArtifact('docs/index.html');
const data = state.data;
const audit = readJson(AUDIT_PATH, emptyAuditLedger(NOW));
const sandbox = await simulatorSandbox(state.html);
const nowMs = Date.parse(NOW);
let frozen = 0;
let skipped = 0;
let current = audit;

for (const match of [...data.matches, ...data.knockout]) {
  if (MATCH_FILTER && String(match.no) !== String(MATCH_FILTER)) continue;
  if (match.played || !match.teamA || !match.teamB) { skipped += 1; continue; }
  const kickoff = matchKickoffMs(match);
  if (!Number.isFinite(kickoff) || kickoff <= nowMs) { skipped += 1; continue; }
  const estimate = estimatePrediction(sandbox, match.no);
  const prediction = createPredictionRecord({
    match,
    createdAtUtc: NOW,
    modelVersion: MODEL_VERSION,
    dataVersion: data.version,
    sourceSnapshotHash: sourceSnapshotHash(data, match),
    predictedWdlProbs: estimate.predictedWdlProbs,
    predictedScorelineDistribution: estimate.predictedScorelineDistribution,
    predictedAdvancementProbs: estimate.predictedAdvancementProbs,
    featureFlags: featureFlags(data, match)
  });
  const result = appendFrozenPrediction(current, prediction);
  current = result.ledger;
  frozen += result.changed ? 1 : 0;
}

const marketCheck = validateNoMarketFields(current);
if (!marketCheck.ok) throw new Error(`blocked market-like audit field(s): ${marketCheck.fields.join(', ')}`);
const changed = writeJsonIfChanged(AUDIT_PATH, current);
console.log(JSON.stringify({ frozen, skipped, changed, audit: AUDIT_PATH }, null, 2));
