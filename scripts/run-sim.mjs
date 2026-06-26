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
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    addEventListener(type, handler) { listeners[type] = handler; },
    removeEventListener(type) { delete listeners[type]; },
    setAttribute() {},
    removeAttribute() {},
    getAttribute() { return ''; },
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
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/latest-simulation.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  seed: 'automation-smoke',
  champion: result.champion,
  runnerUp: result.runnerUp,
  knockoutMatches: result.ko.length
}, null, 2) + '\n');
console.log(`Simulation smoke passed: ${result.champion} over ${result.runnerUp}`);
