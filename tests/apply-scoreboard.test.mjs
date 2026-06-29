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
  const end = start + endMarker.index;
  return JSON.parse(html.slice(start, end));
}

function writeBaseData(htmlPath, data) {
  const html = readFileSync(htmlPath, 'utf8');
  const marker = 'const BASE_DATA = ';
  const start = html.indexOf(marker) + marker.length;
  const tail = html.slice(start);
  const endMarker = tail.match(/;\r?\nconst BLOCKED_PATCH_KEYS/);
  assert.ok(endMarker, 'BASE_DATA end marker not found');
  const end = start + endMarker.index;
  writeFileSync(htmlPath, html.slice(0, start) + JSON.stringify(data) + html.slice(end), 'utf8');
}

function runPython(script, args, env) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const command of candidates) {
    const result = spawnSync(command, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
    if (result.error?.code === 'ENOENT') continue;
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result;
  }
  assert.fail('Python interpreter not found');
}

const dir = mkdtempSync(join(tmpdir(), 'fifa-scoreboard-'));
try {
  const htmlPath = join(dir, 'index.html');
  const fixturePath = join(dir, 'scoreboard.json');
  copyFileSync('docs/index.html', htmlPath);
  const stale = readBaseData(htmlPath);
  const staleMatch = stale.knockout.find(m => m.no === 73);
  for (const field of ['teamA', 'teamB', 'scoreA', 'scoreB', 'played', 'winner', 'loser', 'note']) {
    delete staleMatch[field];
  }
  stale.currentStats.matchesPlayed = 72;
  stale.currentStats.goalsScored = 215;
  stale.currentStats.updatedTo = '2026-06-27';
  writeBaseData(htmlPath, stale);
  writeFileSync(fixturePath, JSON.stringify({
    events: [{
      id: '760486',
      date: '2026-06-28T19:00Z',
      competitions: [{
        status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
        competitors: [
          { homeAway: 'home', score: '0', winner: false, advance: false, team: { abbreviation: 'RSA', displayName: 'South Africa' } },
          { homeAway: 'away', score: '1', winner: true, advance: true, team: { abbreviation: 'CAN', displayName: 'Canada' } }
        ]
      }]
    }]
  }), 'utf8');

  const before = readBaseData(htmlPath);
  assert.equal(before.knockout.find(m => m.no === 73).played, undefined);
  runPython('scripts/apply_scoreboard.py', [fixturePath, '--no-fetch'], { FIFA_WC_HTML_PATH: htmlPath });
  const after = readBaseData(htmlPath);
  const match = after.knockout.find(m => m.no === 73);
  assert.equal(match.teamA, 'South Africa');
  assert.equal(match.teamB, 'Canada');
  assert.equal(match.scoreA, 0);
  assert.equal(match.scoreB, 1);
  assert.equal(match.played, true);
  assert.equal(match.winner, 'Canada');
  assert.equal(match.loser, 'South Africa');
  assert.match(match.note, /scoreboard event 760486/);
  assert.equal(after.currentStats.matchesPlayed, 73);
  assert.equal(after.currentStats.goalsScored, 216);
  assert.equal(after.currentStats.updatedTo, '2026-06-28');
  assert.equal(after.currentStats.topScorers.length, 0);
  assert.equal(after.knockout.filter(m => m.played).length, 1);
  assert.equal(after.matches.filter(m => m.played).length, 72);
  assert.equal(after.knockout.filter(m => !m.played && (m.scoreA !== undefined || m.scoreB !== undefined)).length, 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('apply-scoreboard tests passed');
