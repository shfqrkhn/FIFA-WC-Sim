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

function playedRows(data) {
  return [...(data.matches || []), ...(data.knockout || [])]
    .filter(match => match.played && Number.isInteger(match.scoreA) && Number.isInteger(match.scoreB));
}

function goalTotal(rows) {
  return rows.reduce((sum, match) => sum + match.scoreA + match.scoreB, 0);
}

const dir = mkdtempSync(join(tmpdir(), 'fifa-scoreboard-'));
try {
  const htmlPath = join(dir, 'index.html');
  const fixturePath = join(dir, 'scoreboard.json');
  copyFileSync('docs/index.html', htmlPath);
  const stale = readBaseData(htmlPath);
  for (const knockoutMatch of stale.knockout) {
    for (const field of ['scoreA', 'scoreB', 'played', 'winner', 'loser', 'note', 'pens']) {
      delete knockoutMatch[field];
    }
  }
  const staleMatch = stale.knockout.find(m => m.no === 73);
  for (const field of ['teamA', 'teamB']) {
    delete staleMatch[field];
  }
  const stalePlayed = playedRows(stale);
  stale.currentStats.matchesPlayed = stalePlayed.length;
  stale.currentStats.goalsScored = goalTotal(stalePlayed);
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
  const beforePlayed = playedRows(before);
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
  assert.equal(match.kickoffUtc, '2026-06-28T19:00:00Z');
  assert.match(match.note, /scoreboard event 760486/);
  assert.equal(after.currentStats.matchesPlayed, beforePlayed.length + 1);
  assert.equal(after.currentStats.goalsScored, goalTotal(beforePlayed) + 1);
  assert.equal(after.currentStats.updatedTo, '2026-06-28');
  assert.equal(after.currentStats.topScorers.length, 0);
  assert.equal(after.knockout.filter(m => m.played).length, 1);
  assert.equal(after.matches.filter(m => m.played).length, 72);
  assert.equal(after.knockout.filter(m => !m.played && (m.scoreA !== undefined || m.scoreB !== undefined)).length, 0);

  const aliasHtmlPath = join(dir, 'alias-index.html');
  const aliasFixturePath = join(dir, 'alias-scoreboard.json');
  copyFileSync('docs/index.html', aliasHtmlPath);
  const aliasStale = readBaseData(aliasHtmlPath);
  const aliasMatch = aliasStale.matches.find(m => m.no === 59);
  for (const field of ['scoreA', 'scoreB', 'played', 'note']) {
    delete aliasMatch[field];
  }
  aliasStale.currentStats.matchesPlayed -= 1;
  aliasStale.currentStats.goalsScored -= 2;
  writeBaseData(aliasHtmlPath, aliasStale);
  writeFileSync(aliasFixturePath, JSON.stringify({
    events: [{
      id: 'alias-dza-aut',
      date: '2026-06-27T22:00Z',
      competitions: [{
        status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
        competitors: [
          { homeAway: 'home', score: '0', winner: false, team: { abbreviation: 'DZA', displayName: 'Algeria' } },
          { homeAway: 'away', score: '2', winner: true, team: { abbreviation: 'AUT', displayName: 'Austria' } }
        ]
      }]
    }]
  }), 'utf8');
  runPython('scripts/apply_scoreboard.py', [aliasFixturePath, '--no-fetch'], { FIFA_WC_HTML_PATH: aliasHtmlPath });
  const aliasAfter = readBaseData(aliasHtmlPath);
  const aliasUpdated = aliasAfter.matches.find(m => m.no === 59);
  assert.equal(aliasUpdated.played, true);
  assert.equal(aliasUpdated.scoreA, 0);
  assert.equal(aliasUpdated.scoreB, 2);
  assert.match(aliasUpdated.note, /alias-dza-aut/);

  const scheduledHtmlPath = join(dir, 'scheduled-index.html');
  const scheduledFixturePath = join(dir, 'scheduled-scoreboard.json');
  copyFileSync('docs/index.html', scheduledHtmlPath);
  const scheduledStale = readBaseData(scheduledHtmlPath);
  const scheduledMatch = scheduledStale.knockout.find(m => m.no === 74);
  scheduledMatch.teamA = 'Germany';
  delete scheduledMatch.teamB;
  scheduledMatch.date = '2026-06-29';
  for (const field of ['kickoffUtc', 'scoreA', 'scoreB', 'played', 'winner', 'loser', 'note', 'pens']) {
    delete scheduledMatch[field];
  }
  writeBaseData(scheduledHtmlPath, scheduledStale);
  writeFileSync(scheduledFixturePath, JSON.stringify({
    events: [{
      id: 'scheduled-ger-par',
      date: '2026-06-29T20:30Z',
      competitions: [{
        status: { type: { name: 'STATUS_HALFTIME', completed: false } },
        competitors: [
          { homeAway: 'home', score: '0', winner: false, team: { abbreviation: 'GER', displayName: 'Germany' } },
          { homeAway: 'away', score: '1', winner: false, team: { abbreviation: 'PAR', displayName: 'Paraguay' } }
        ]
      }]
    }]
  }), 'utf8');
  runPython('scripts/apply_scoreboard.py', [scheduledFixturePath, '--no-fetch'], { FIFA_WC_HTML_PATH: scheduledHtmlPath });
  const scheduledAfter = readBaseData(scheduledHtmlPath);
  const scheduledUpdated = scheduledAfter.knockout.find(m => m.no === 74);
  assert.equal(scheduledUpdated.teamA, 'Germany');
  assert.equal(scheduledUpdated.teamB, 'Paraguay');
  assert.equal(scheduledUpdated.kickoffUtc, '2026-06-29T20:30:00Z');
  assert.equal(scheduledUpdated.played, undefined);
  assert.equal(scheduledUpdated.scoreA, undefined);
  assert.equal(scheduledUpdated.scoreB, undefined);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('apply-scoreboard tests passed');
