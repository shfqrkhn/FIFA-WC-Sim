#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('docs/index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Missing inline script.');

function extractConst(name) {
  const marker = `const ${name}=`;
  const start = scriptMatch[1].indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);
  const from = start + marker.length;
  const end = scriptMatch[1].indexOf(';', from);
  if (end < 0) throw new Error(`Missing semicolon after ${name}`);
  return vm.runInNewContext(scriptMatch[1].slice(from, end), Object.create(null), { timeout: 1000 });
}

vm.runInNewContext(scriptMatch[1].replace(/render\(\);\s*$/m, ''), {
  console,
  document: {
    querySelector() { return { value: 'balanced', innerHTML: '', textContent: '', onclick: null }; },
    querySelectorAll() { return []; }
  }
}, { timeout: 5000 });

const teams = extractConst('T');
const matches = extractConst('M');
const names = new Set(teams.map(t => t[0]));
const groups = new Set('ABCDEFGHIJKL'.split(''));
const failures = [];
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}${detail ? ': ' + detail : ''}`);
}
check('team count', teams.length === 48, String(teams.length));
check('unique team names', names.size === 48, String(names.size));
check('group match count', matches.length === 72, String(matches.length));
const groupCounts = Object.create(null);
for (const t of teams) groupCounts[t[1]] = (groupCounts[t[1]] || 0) + 1;
for (const g of groups) check(`group ${g} team count`, groupCounts[g] === 4, String(groupCounts[g] || 0));
const nos = new Set();
for (const m of matches) {
  check(`match ${m[0]} number`, Number.isInteger(m[0]) && m[0] >= 1 && m[0] <= 72);
  check(`match ${m[0]} duplicate`, !nos.has(m[0]));
  nos.add(m[0]);
  check(`match ${m[0]} group`, groups.has(m[1]), String(m[1]));
  check(`match ${m[0]} team A`, names.has(m[2]), String(m[2]));
  check(`match ${m[0]} team B`, names.has(m[3]), String(m[3]));
  check(`match ${m[0]} different teams`, m[2] !== m[3]);
  const a = m[4], b = m[5];
  const bothNull = a === null && b === null;
  const bothScores = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0;
  check(`match ${m[0]} score shape`, bothNull || bothScores, `${a}-${b}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Validation passed.');
