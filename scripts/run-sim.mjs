#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const htmlPath = process.env.SIM_HTML || 'docs/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('No inline simulator script found.');
const script = scriptMatch[1]
  .replace(/render\(\);\s*$/m, '')
  .replace(/document\.querySelector/g, 'document.querySelector')
  .replace(/document\.querySelectorAll/g, 'document.querySelectorAll');

function createElementStub(selector = '') {
  const listeners = {};
  const classes = new Set();
  const attributes = {};
  return {
    value: selector === '#mode' ? 'balanced' : selector === '#seed' ? 'automation-smoke' : selector === '#runs' ? '200' : '',
    innerHTML: '',
    textContent: '',
    onclick: null,
    href: '',
    download: '',
    files: [],
    style: {},
    dataset: {},
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : !!force;
        on ? classes.add(name) : classes.delete(name);
        return on;
      },
      contains(name) { return classes.has(name); }
    },
    addEventListener(type, handler) { listeners[type] = handler; },
    removeEventListener(type) { delete listeners[type]; },
    setAttribute(name, value) { attributes[name] = String(value); },
    removeAttribute(name) { delete attributes[name]; },
    getAttribute(name) { return attributes[name] || ''; },
    appendChild() {},
    focus() {},
    select() {},
    click() {}
  };
}

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
const localStorageStub = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  removeItem(key) { this.data.delete(key); }
};

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  document: documentStub,
  localStorage: localStorageStub,
  location: { hash: '' },
  history: { replaceState() {} },
  navigator: { clipboard: { writeText: async () => {} } },
  Blob: class Blob {},
  URL: { createObjectURL() { return 'blob:smoke'; }, revokeObjectURL() {} },
  fetch: async () => { throw new Error('network disabled during simulation smoke test'); }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { timeout: 5000 });
await vm.runInContext('__bootstrapReady', sandbox, { timeout: 1000 });
const initialMc = vm.runInContext('MC', sandbox, { timeout: 1000 });
const initialGroupsHtml = elements.get('#groupsView')?.innerHTML || '';
const initialBracketHtml = elements.get('#bracketView')?.innerHTML || '';
const initialUnplayedGroupMatches = vm.runInContext('DATA.matches.filter(m => !m.played).length', sandbox, { timeout: 1000 });
const initialGroupsMcOk = initialUnplayedGroupMatches === 0 || initialGroupsHtml.includes('MC:');
if (!initialMc?.predictions?.groups || !initialMc?.predictions?.knockout || !initialGroupsMcOk || !initialBracketHtml.includes('MC:')) {
  throw new Error('Initial page load did not run Monte Carlo predictions into Groups and Bracket views.');
}
const initialRepresentativeOk = vm.runInContext('MC?.representative && LAST === MC.representative && LAST.champion === MC.rows[0].team', sandbox, { timeout: 1000 });
if (!initialRepresentativeOk) {
  throw new Error('Initial Monte Carlo representative did not inform the sample path, Groups, and Bracket views.');
}
const footerText = elements.get('#lastDataUpdate')?.textContent || '';
if (!html.includes('id="lastDataUpdate"') || !footerText || /^Loading/.test(footerText)) {
  throw new Error('Last data update footer was not rendered.');
}
const footerMetadataOk = vm.runInContext(`(() => {
  return $('#appVersion')?.textContent === APP_VERSION &&
    $('#dataVersion')?.textContent === DATA.version &&
    /^\\d{4}$/.test($('#copyrightYear')?.textContent || '') &&
    ($('#legalNotice')?.textContent || '').includes('not affiliated with FIFA');
})()`, sandbox, { timeout: 1000 });
if (!footerMetadataOk) {
  throw new Error('Footer metadata did not render app version, data version, copyright, and legal notice.');
}
const sponsorButtonOk =
  html.includes('src="https://github.com/sponsors/shfqrkhn/button"') &&
  html.includes('title="Sponsor shfqrkhn"') &&
  html.includes('loading="lazy"') &&
  html.includes('class="footerSupport"') &&
  html.includes('class="sponsorFrame"');
if (!sponsorButtonOk) {
  throw new Error('GitHub sponsor button was not embedded as a lazy nonessential footer control.');
}
const footerLatestOk = vm.runInContext(`(() => {
  const vals = [DATA.dataQuality?.updatedAt, DATA.generatedAt, DATA.currentStats?.updatedAt].filter(Boolean);
  const latest = vals.map(x => [String(x), new Date(x)]).filter(x => Number.isFinite(x[1].getTime())).sort((a,b) => b[1]-a[1])[0]?.[0];
  return !latest || dataUpdateStamp() === latest;
})()`, sandbox, { timeout: 1000 });
if (!footerLatestOk) {
  throw new Error('Last data update footer did not use the latest embedded timestamp.');
}
const todayHighlightOk = vm.runInContext(`(() => {
  const RealDate = Date;
  const key = matchDateKey(DATA.matches.find(m => m.no === 65));
  const parts = key.split('-').map(Number);
  class MockDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [parts[0], parts[1] - 1, parts[2], 12])); }
    static now() { return new RealDate(parts[0], parts[1] - 1, parts[2], 12).getTime(); }
    static parse(v) { return RealDate.parse(v); }
    static UTC(...args) { return RealDate.UTC(...args); }
  }
  globalThis.Date = MockDate;
  try {
    const date = new Date();
    renderTodayMatches();
    renderGroups(DATA.matches);
    const todayHtml = $('#todayView')?.innerHTML || '';
    const localTime = matchTimeLabel(DATA.matches.find(m => m.no === 65));
    const sampleRun = simulate('today-highlight-smoke');
    renderResult(sampleRun);
    const runTodayHtml = $('#todayView')?.innerHTML || '';
    const groupsHtml = $('#groupsView')?.innerHTML || '';
    const runTodayRows = todayMatches(date, sampleRun);
    const syntheticOrder = todayMatches(date, {
      matches: [
        { no: 30, date: key + 'T20:00:00Z' },
        { no: 20, date: key + 'T16:00:00Z' },
        { no: 10, date: key + 'T16:00:00Z' },
        { no: 40, date: key }
      ],
      ko: []
    }).map(m => m.no).join(',');
    const bracketHtml = matchCard({ no: 999, round: 'R32', date: key, venue: 'Smoke Venue', teamA: 'Argentina', teamB: 'Portugal' });
    return localDateKey(date) === key &&
      isTodayMatch({ date: key }, date) &&
      !isTodayMatch({ date: '2099-01-01' }, date) &&
      todayMatches(date).length >= 1 &&
      syntheticOrder === '10,20,30,40' &&
      runTodayRows.length >= 1 &&
      $('#todayView').classList.contains('hasToday') &&
      todayHtml.includes("Today's matches") &&
      todayHtml.includes('Today') &&
      localTime &&
      todayHtml.includes(localTime) &&
      !matchTimeLabel({ date: key }) &&
      runTodayRows.every(m => runTodayHtml.includes('M' + m.no) && runTodayHtml.includes(m.scoreA + '–' + m.scoreB)) &&
      (groupsHtml.match(/todayMatch/g) || []).length >= runTodayRows.length &&
      bracketHtml.includes('todayMatch') &&
      bracketHtml.includes('Today');
  } finally {
    globalThis.Date = RealDate;
  }
})()`, sandbox, { timeout: 1000 });
if (!todayHighlightOk) {
  throw new Error('Today match highlighting did not classify and render schedule dates correctly.');
}
const statsSnapshotOk = vm.runInContext(`(() => {
  const key = matchDateKey(DATA.matches.find(m => m.no === 65));
  const parts = key.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
  const snap = scheduleSnapshot(date);
  renderStats();
  const html = $('#statsView')?.innerHTML || '';
  return snap.total === 104 &&
    snap.played === 66 &&
    snap.remaining === 38 &&
    snap.groupLeft === 6 &&
    snap.koLeft === 32 &&
    snap.todayCount >= 1 &&
    Number.isFinite(snap.daysToFinal) &&
    html.includes('Schedule progress') &&
    html.includes('Award projections') &&
    html.includes('Golden Boot') &&
    html.includes('Silver Ball') &&
    html.includes('Bronze Boot') &&
    html.includes('Goal of the Tournament') &&
    html.includes('FIFA Peace Prize - Football Unites the World') &&
    html.includes('Not refreshed by automated scoreboard updater') &&
    html.includes('Matches left') &&
    html.includes('Calendar days to final') &&
    html.includes('Next scheduled match day') &&
    html.includes('<div>Attendance</div><div>—</div>');
})()`, sandbox, { timeout: 1000 });
if (!statsSnapshotOk) {
  throw new Error('Tournament snapshot schedule progress did not render expected remaining-match fields.');
}
const ensembleModelOk = vm.runInContext(`(() => {
  const breakdown = ensembleBreakdown('Argentina', { matches: DATA.matches });
  const weightTotal = Object.values(ensembleWeights()).reduce((sum, x) => sum + x, 0);
  const dist = scorelineDistribution(1.15, 1.05, {});
  const high = scorelineDistribution(5.8, 5.8, {});
  const maxA = Math.max(...high.map(x => x.a));
  const tailBucket = high.find(x => x.a === maxA && x.b === 0);
  const probTotal = dist.reduce((sum, x) => sum + x.p, 0);
  const highTotal = high.reduce((sum, x) => sum + x.p, 0);
  const sampled = sampleScoreline(1.15, 1.05, rngFactory('ensemble-smoke'), {});
  const disclosure = String(DATA.config?.modelNotes || '') + ' ' + (DATA.config?.assumptions || []).join(' ');
  const availabilitySample = { teamA:'Alpha', teamB:'Beta', availability:{ A:{ status:'official', keyAbsences:1 } }, context:{ A:{ goalAdj:0 }, B:{ goalAdj:0 } } };
  const unverifiedSample = { teamA:'Alpha', teamB:'Beta', availability:{ A:{ status:'unverified', keyAbsences:3 } }, context:{ A:{ goalAdj:0 }, B:{ goalAdj:0 } } };
  const priorKeyAbsencePenalty = DATA.config.confirmedKeyAbsenceGoalPenalty;
  DATA.config.confirmedKeyAbsenceGoalPenalty = 0;
  const zeroPenaltyOk = availabilityFactor('Alpha', availabilitySample) === 0;
  DATA.config.confirmedKeyAbsenceGoalPenalty = priorKeyAbsencePenalty;
  return Number.isFinite(breakdown.total) &&
    breakdown.parts.some(p => p.label === 'Ranking prior') &&
    breakdown.parts.some(p => p.label === 'Rank-seeded Elo prior') &&
    breakdown.parts.some(p => p.label === 'Attack/defense profile') &&
    typeof availabilityFactor === 'function' &&
    availabilityFactor('Alpha', availabilitySample) < 0 &&
    contextFactor('Alpha', availabilitySample) < 0 &&
    zeroPenaltyOk &&
    availabilityFactor('Alpha', unverifiedSample) === 0 &&
    contextFactor('Alpha', unverifiedSample) === 0 &&
    DATA.modelInputs?.features?.includes('group-table incentive') &&
    DATA.matches.some(m => m.incentiveProfile?.status) &&
    Math.abs(weightTotal - 1) < 1e-9 &&
    Math.abs(probTotal - 1) < 1e-6 &&
    Math.abs(highTotal - 1) < 1e-6 &&
    tailBucket?.p > poissonPmf(maxA, 5.8) * poissonPmf(0, 5.8) &&
    Array.isArray(sampled) && sampled.length === 2 &&
    /ensemble/i.test(disclosure) &&
    /Elo-style prior/i.test(disclosure) &&
    /low-score/i.test(disclosure) &&
    /availability|lineup|suspension/i.test(disclosure);
})()`, sandbox, { timeout: 1000 });
if (!ensembleModelOk) {
  throw new Error('Ensemble model and low-score scoreline sampler were not active and disclosed.');
}
const calibrationDisclosureOk = vm.runInContext(`(() => {
  const state = calibrationState();
  const text = calibrationStatusText();
  const sample = calibrationAdjustedGroupOutcome({runs:10,teamA:'Alpha',teamB:'Beta',outcomes:{Alpha:7,Draw:2,Beta:1}}, 'Alpha');
  const original = DATA.calibration;
  DATA.calibration = {calibration_status:'active',active:true,resolved_predictions:1,min_resolved_predictions:30,bucket_adjustments:[{bucket:'0.7-0.8',outcome:'home_win',calibrated_confidence:.2}]};
  const failClosed = calibrationAdjustedGroupOutcome({runs:10,teamA:'Alpha',teamB:'Beta',outcomes:{Alpha:7,Draw:2,Beta:1}}, 'Alpha');
  DATA.calibration = original;
  renderTransparency(LAST);
  const html = $('#assumptionsView')?.innerHTML || '';
  return state.calibration_status &&
    text.includes(state.calibration_status) &&
    sample.status === state.calibration_status &&
    failClosed.status === 'insufficient_sample' &&
    Math.abs(failClosed.prob - failClosed.raw) < 1e-12 &&
    html.includes('Calibration') &&
    html.includes('raw model probabilities');
})()`, sandbox, { timeout: 1000 });
if (!calibrationDisclosureOk) {
  throw new Error('Prediction-audit calibration status was not disclosed or failed closed.');
}
const busyOk = vm.runInContext(`(() => {
  setBusy(true, 'Busy smoke');
  const on = $('#appStatus').classList.contains('isBusy') && $('#appStatus').getAttribute('aria-busy') === 'true';
  setBusy(false);
  const off = !$('#appStatus').classList.contains('isBusy') && $('#appStatus').getAttribute('aria-busy') === 'false';
  return on && off;
})()`, sandbox, { timeout: 1000 });
if (!busyOk) {
  throw new Error('Monte Carlo loading state did not toggle accessibly.');
}
const controlsLockOk = vm.runInContext(`(() => {
  const ids = ['seed','runs','mode','homeAdv','weather','mcBtn'];
  setMonteCarloControlsDisabled(true);
  const locked = ids.every(id => $('#'+id).disabled === true && $('#'+id).getAttribute('aria-disabled') === 'true');
  setMonteCarloControlsDisabled(false);
  const unlocked = ids.every(id => $('#'+id).disabled === false && $('#'+id).getAttribute('aria-disabled') === 'false');
  return locked && unlocked;
})()`, sandbox, { timeout: 1000 });
if (!controlsLockOk) {
  throw new Error('Monte Carlo controls were not locked during simulation.');
}
const collapsedControlsOk =
  /<div class="toolbar primaryControls">\s*<button class="btn gold" id="mcBtn"/.test(html) &&
  html.includes('<details class="advancedControls" id="predictionSettings">') &&
  html.includes('.advancedControls:not([open]) .settingsControls{display:none}') &&
  html.includes('<div class="toolbar settingsControls" aria-label="Prediction settings">') &&
  !html.includes('<details class="advancedControls" id="predictionSettings" open>') &&
  html.indexOf('id="mcBtn"') < html.indexOf('id="predictionSettings"') &&
  html.indexOf('id="seed"') > html.indexOf('id="predictionSettings"');
if (!collapsedControlsOk) {
  throw new Error('Prediction settings were not collapsed behind the visible run button.');
}
const invalidationOk = vm.runInContext(`(() => {
  const hadMc = !!MC;
  refresh('Invalidation smoke.');
  return hadMc && MC === null && !($('#groupsView').innerHTML || '').includes('MC:') && !($('#bracketView').innerHTML || '').includes('MC:');
})()`, sandbox, { timeout: 5000 });
if (!invalidationOk) {
  throw new Error('Monte Carlo summaries were not invalidated after data/control refresh.');
}
const result = vm.runInContext("simulate('automation-smoke')", sandbox, { timeout: 5000 });
if (!result || !result.champion || result.ko.length < 5) {
  throw new Error('Simulation smoke test failed.');
}
const mc = vm.runInContext("renderResult(simulate('automation-smoke')); runMCCore()", sandbox, { timeout: 5000 });
const groupsHtml = elements.get('#groupsView')?.innerHTML || '';
const bracketHtml = elements.get('#bracketView')?.innerHTML || '';
const unplayedGroupMatches = vm.runInContext('DATA.matches.filter(m => !m.played).length', sandbox, { timeout: 1000 });
const groupsMcOk = unplayedGroupMatches === 0 || groupsHtml.includes('MC:');
if (!mc?.predictions?.groups || !mc?.predictions?.knockout || !groupsMcOk || !bracketHtml.includes('MC:')) {
  throw new Error('Monte Carlo predictions were not reflected in Groups and Bracket views.');
}
const representativeRunOk = vm.runInContext('MC?.representative && LAST === MC.representative && LAST.champion === MC.rows[0].team', sandbox, { timeout: 1000 });
if (!representativeRunOk) {
  throw new Error('Sample path, Groups, and Bracket were not informed by the Monte Carlo representative run.');
}
const predictionConsistency = vm.runInContext(`(() => {
  const groupOk = Object.values(MC.predictions.groups).every(p => {
    const outcome = topCount(p.outcomes);
    const score = outcome && topCount(p.outcomeScores?.[outcome[0]]);
    if (!outcome || !score) return false;
    const [a, b] = score[0].split('-').map(Number);
    return outcome[0] === 'Draw' ? a === b : outcome[0] === p.teamA ? a > b : a < b;
  });
  const bracketOk = Object.values(MC.predictions.knockout).every(p => {
    const winner = topCount(p.winners);
    const pairing = winner && topCount(p.winnerPairings?.[winner[0]]);
    return !!winner && !!pairing && pairing[0].split(' vs ').includes(winner[0]);
  });
  return { groupOk, bracketOk };
})()`, sandbox, { timeout: 5000 });
if (!predictionConsistency.groupOk || !predictionConsistency.bracketOk) {
  throw new Error('Monte Carlo prediction summaries are internally inconsistent.');
}
const displayedBracketPredictionOk = vm.runInContext(`(() => {
  return LAST.ko.every(m => {
    const text = formatKnockoutMCPrediction(m.no, m.teamA, m.teamB);
    if (!text || text.includes('this matchup was not sampled')) return true;
    const winner = text.match(/^MC: (.+?) wins /)?.[1];
    return !winner || winner === m.teamA || winner === m.teamB;
  });
})()`, sandbox, { timeout: 5000 });
if (!displayedBracketPredictionOk) {
  throw new Error('Displayed bracket Monte Carlo prediction did not match displayed teams.');
}
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/latest-simulation.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  seed: 'automation-smoke',
  champion: result.champion,
  runnerUp: result.runnerUp,
  knockoutMatches: result.ko.length
}, null, 2) + '\n');
console.log(`Simulation smoke passed: ${result.champion} over ${result.runnerUp}`);
