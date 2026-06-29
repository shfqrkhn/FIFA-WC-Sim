import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function readBaseData(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const marker = 'const BASE_DATA = ';
  const start = html.indexOf(marker) + marker.length;
  const tail = html.slice(start);
  const endMarker = tail.match(/;\r?\nconst BLOCKED_PATCH_KEYS/);
  assert.ok(endMarker, 'BASE_DATA end marker not found');
  return JSON.parse(html.slice(start, start + endMarker.index));
}

function writeBaseData(htmlPath, data) {
  const html = readFileSync(htmlPath, 'utf8');
  const marker = 'const BASE_DATA = ';
  const start = html.indexOf(marker) + marker.length;
  const tail = html.slice(start);
  const endMarker = tail.match(/;\r?\nconst BLOCKED_PATCH_KEYS/);
  assert.ok(endMarker, 'BASE_DATA end marker not found');
  writeFileSync(htmlPath, html.slice(0, start) + JSON.stringify(data) + html.slice(start + endMarker.index), 'utf8');
}

function runPython(script, env) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const command of candidates) {
    const result = spawnSync(command, [script], { encoding: 'utf8', env: { ...process.env, ...env } });
    if (result.error?.code === 'ENOENT') continue;
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result;
  }
  assert.fail('Python interpreter not found');
}

function playedRows(data) {
  return [...(data.matches || []), ...(data.knockout || [])]
    .filter(match => match.played && Number.isInteger(match.scoreA) && Number.isInteger(match.scoreB));
}

function teamPlayedCount(data, name) {
  return playedRows(data).filter(match => match.teamA === name || match.teamB === name).length;
}

const dir = mkdtempSync(join(tmpdir(), 'fifa-enrich-'));
try {
  const htmlPath = join(dir, 'index.html');
  copyFileSync('docs/index.html', htmlPath);
  const before = readBaseData(htmlPath);
  const m73 = before.knockout.find(m => m.no === 73);
  assert.equal(m73?.played, true);
  assert.equal(m73?.winner, 'Canada');
  for (const name of ['Canada', 'South Africa']) {
    const team = before.teams.find(t => t.name === name);
    team.eloRatingMatches = 3;
  }
  writeBaseData(htmlPath, before);
  const result = runPython('scripts/enrich_predictions.py', { FIFA_WC_HTML_PATH: htmlPath });
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.teamsEnriched, 48);
  assert.equal(summary.playedMatches, playedRows(before).length);
  const after = readBaseData(htmlPath);
  assert.equal(after.teams.find(t => t.name === 'Canada')?.eloRatingMatches, teamPlayedCount(before, 'Canada'));
  assert.equal(after.teams.find(t => t.name === 'South Africa')?.eloRatingMatches, teamPlayedCount(before, 'South Africa'));
  assert.ok(after.modelInputs.features.includes('played results'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('enrich-predictions tests passed');
