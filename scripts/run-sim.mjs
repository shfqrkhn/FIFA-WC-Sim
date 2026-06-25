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

const sandbox = {
  console,
  document: {
    querySelector(selector) {
      const values = {
        '#mode': { value: 'balanced' },
        '#seed': { value: 'automation-smoke' },
        '#runs': { value: '200' }
      };
      return values[selector] || { value: '', innerHTML: '', textContent: '', onclick: null };
    },
    querySelectorAll() { return []; }
  }
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { timeout: 5000 });
const result = vm.runInContext("simulate('automation-smoke')", sandbox, { timeout: 5000 });
if (!result || !result.champion || result.ko.length < 5) {
  throw new Error('Simulation smoke test failed.');
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
