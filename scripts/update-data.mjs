#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const HTML_PATH = 'docs/index.html';
const START_DATE = '2026-06-11';
const STOP_DATE = '2026-07-20';
const ESPN_LEAGUE = process.env.WC26_ESPN_LEAGUE || 'fifa.world';

const teamAliases = new Map(Object.entries({
  MEX: 'Mexico', RSA: 'South Africa', KOR: 'South Korea', CZE: 'Czechia',
  CAN: 'Canada', BIH: 'Bosnia and Herzegovina', QAT: 'Qatar', SUI: 'Switzerland',
  BRA: 'Brazil', MAR: 'Morocco', HTI: 'Haiti', SCO: 'Scotland',
  USA: 'United States', PAR: 'Paraguay', AUS: 'Australia', TUR: 'Turkey',
  GER: 'Germany', CUW: 'Curaçao', CUR: 'Curaçao', CIV: 'Ivory Coast', ECU: 'Ecuador',
  NED: 'Netherlands', JPN: 'Japan', SWE: 'Sweden', TUN: 'Tunisia',
  BEL: 'Belgium', EGY: 'Egypt', IRI: 'Iran', IRN: 'Iran', NZL: 'New Zealand',
  ESP: 'Spain', CPV: 'Cape Verde', KSA: 'Saudi Arabia', URU: 'Uruguay',
  FRA: 'France', SEN: 'Senegal', IRQ: 'Iraq', NOR: 'Norway',
  ARG: 'Argentina', DZA: 'Algeria', ALG: 'Algeria', AUT: 'Austria', JOR: 'Jordan',
  POR: 'Portugal', COD: 'DR Congo', DRC: 'DR Congo', UZB: 'Uzbekistan', COL: 'Colombia',
  ENG: 'England', CRO: 'Croatia', GHA: 'Ghana', PAN: 'Panama'
}));

function ymd(d) { return d.toISOString().slice(0, 10); }
function compactDate(d) { return ymd(d).replaceAll('-', ''); }
function constRange(html, name, nextName) {
  const marker = `const ${name}=`;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);
  const from = start + marker.length;
  const next = nextName ? html.indexOf(`const ${nextName}=`, from) : -1;
  let end = next >= 0 ? html.lastIndexOf(';', next) : html.indexOf('\nlet ', from);
  if (end < from) end = html.indexOf(';\n', from);
  if (end < from) throw new Error(`Could not find end of const ${name}`);
  return { from, end };
}
function parseConst(html, name, nextName) {
  const { from, end } = constRange(html, name, nextName);
  return vm.runInNewContext(html.slice(from, end), Object.create(null), { timeout: 1000 });
}
function replaceConst(html, name, nextName, value) {
  const { from, end } = constRange(html, name, nextName);
  return html.slice(0, from) + JSON.stringify(value) + html.slice(end);
}
function canonicalTeam(raw) {
  if (!raw) return null;
  const abbrev = raw.abbreviation || raw.team?.abbreviation;
  if (abbrev && teamAliases.has(abbrev)) return teamAliases.get(abbrev);
  const display = raw.displayName || raw.shortDisplayName || raw.name || raw.team?.displayName || raw.team?.name || '';
  const normalized = display.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const name of teamAliases.values()) {
    const n = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized === n || normalized.includes(n)) return name;
  }
  return display || null;
}
function isFinal(status) {
  const type = status?.type;
  return !!(type?.completed || ['STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FINAL_PEN'].includes(type?.name));
}
function matchKey(a, b) { return [a, b].sort().join(' / '); }
function scoreForCompetitor(c) {
  const v = Number(c.score ?? c.curatedRank?.current);
  return Number.isFinite(v) ? v : null;
}
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'FIFA-WC-Sim updater' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}
async function fetchScoresForDate(date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN_LEAGUE}/scoreboard?dates=${compactDate(date)}`;
  const json = await fetchJson(url);
  const out = [];
  for (const ev of json.events || []) {
    if (!isFinal(ev.status)) continue;
    const comps = ev.competitions?.[0]?.competitors || [];
    if (comps.length !== 2) continue;
    const a = canonicalTeam(comps[0]);
    const b = canonicalTeam(comps[1]);
    const sa = scoreForCompetitor(comps[0]);
    const sb = scoreForCompetitor(comps[1]);
    if (!a || !b || !Number.isFinite(sa) || !Number.isFinite(sb)) continue;
    out.push({ a, b, sa, sb, sourceId: ev.id, status: ev.status?.type?.description || 'final' });
  }
  return out;
}

const html = fs.readFileSync(HTML_PATH, 'utf8');
let matches = parseConst(html, 'M', 'SRC');
const index = new Map(matches.map((m, i) => [matchKey(m[2], m[3]), i]));
const today = new Date((process.env.WC26_TODAY || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
const stop = new Date(STOP_DATE + 'T00:00:00Z');
const start = new Date(START_DATE + 'T00:00:00Z');
const end = new Date(Math.min(today.getTime(), stop.getTime()));
let applied = 0;
let fetched = 0;
let notes = [];

for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
  let scores = [];
  try {
    scores = await fetchScoresForDate(d);
  } catch (err) {
    console.warn(`Score fetch failed for ${ymd(d)}: ${err.message}`);
    continue;
  }
  fetched += scores.length;
  for (const s of scores) {
    const idx = index.get(matchKey(s.a, s.b));
    if (idx === undefined) continue;
    const row = matches[idx];
    const homeFirst = row[2] === s.a;
    const nextA = homeFirst ? s.sa : s.sb;
    const nextB = homeFirst ? s.sb : s.sa;
    if (row[4] !== nextA || row[5] !== nextB) {
      row[4] = nextA;
      row[5] = nextB;
      row[6] = `Auto-updated from ESPN event ${s.sourceId} (${s.status}).`;
      applied++;
      notes.push(`M${row[0]} ${row[2]} ${nextA}-${nextB} ${row[3]}`);
    }
  }
}

let next = replaceConst(html, 'M', 'SRC', matches);
const stamp = new Date().toISOString();
next = next.replace(/version:'[^']+'/g, `version:'2026.06.25-auto-daily'`);
next = next.replace(/updated:'[^']+'/g, `updated:'${stamp}'`);
fs.writeFileSync(HTML_PATH, next);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/latest-update.json', JSON.stringify({
  generatedAt: stamp,
  source: `ESPN scoreboard ${ESPN_LEAGUE}`,
  fetchedFinals: fetched,
  appliedChanges: applied,
  changes: notes
}, null, 2) + '\n');

console.log(JSON.stringify({ applied, fetched, changes: notes }, null, 2));
