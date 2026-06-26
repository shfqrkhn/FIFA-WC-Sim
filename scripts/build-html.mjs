#!/usr/bin/env node
import { readArtifact } from './base-data.mjs';

const state = readArtifact('docs/index.html');
const { html, data } = state;
const groupMatches = Array.isArray(data.matches) ? data.matches.filter(m => m.stage === 'group') : [];
const knockoutMatches = Array.isArray(data.knockout) ? data.knockout : [];
const teams = Array.isArray(data.teams) ? data.teams : [];
const failures = [];

if (!html.includes('World Cup 2026 Simulator') && !html.includes('Whole Tournament Simulator')) {
  failures.push('docs/index.html does not look like the simulator artifact.');
}
if (!Number.isInteger(data.schema)) {
  failures.push('BASE_DATA schema is missing or invalid.');
}
if (teams.length !== 48) {
  failures.push(`expected 48 teams, found ${teams.length}`);
}
if (new Set(teams.map(t => t?.name).filter(Boolean)).size !== 48) {
  failures.push('team names are missing or duplicated.');
}
if (groupMatches.length !== 72) {
  failures.push(`expected 72 group matches, found ${groupMatches.length}`);
}
if (knockoutMatches.length !== 32) {
  failures.push(`expected 32 knockout matches, found ${knockoutMatches.length}`);
}

if (failures.length) {
  throw new Error(failures.join('\n'));
}

console.log(JSON.stringify({
  ok: true,
  schema: data.schema,
  version: data.version,
  teams: teams.length,
  groupMatches: groupMatches.length,
  knockoutMatches: knockoutMatches.length
}, null, 2));
