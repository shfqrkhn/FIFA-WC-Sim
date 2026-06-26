#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('docs/index.html', 'utf8');
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
if (!initialMc?.predictions?.groups || !initialMc?.predictions?.knockout || !initialGroupsHtml.includes('MC:') || !initialBracketHtml.includes('MC:')) {
  throw new Error('Initial page load did not run Monte Carlo predictions into Groups and Bracket views.');
}
const initialRepresentativeOk = vm.runInContext('MC?.representative && LAST === MC.representative && LAST.champion === MC.rows[0].team', sandbox, { timeout: 1000 });
if (!initialRepresentativeOk) {
  throw new Error('Initial Monte Carlo representative did not inform Run Result, Groups, and Bracket views.');
}
const footerText = elements.get('#lastDataUpdate')?.textContent || '';
if (!html.includes('id="lastDataUpdate"') || !footerText || footerText === 'Loading…') {
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
const footerLatestOk = vm.runInContext(`(() => {
  const vals = [DATA.dataQuality?.updatedAt, DATA.generatedAt, DATA.currentStats?.updatedAt].filter(Boolean);
  const latest = vals.map(x => [String(x), new Date(x)]).filter(x => Number.isFinite(x[1].getTime())).sort((a,b) => b[1]-a[1])[0]?.[0];
  return !latest || dataUpdateStamp() === latest;
})()`, sandbox, { timeout: 1000 });
if (!footerLatestOk) {
  throw new Error('Last data update footer did not use the latest embedded timestamp.');
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
if (!mc?.predictions?.groups || !mc?.predictions?.knockout || !groupsHtml.includes('MC:') || !bracketHtml.includes('MC:')) {
  throw new Error('Monte Carlo predictions were not reflected in Groups and Bracket views.');
}
const representativeRunOk = vm.runInContext('MC?.representative && LAST === MC.representative && LAST.champion === MC.rows[0].team', sandbox, { timeout: 1000 });
if (!representativeRunOk) {
  throw new Error('Run Result, Groups, and Bracket were not informed by the Monte Carlo representative run.');
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
