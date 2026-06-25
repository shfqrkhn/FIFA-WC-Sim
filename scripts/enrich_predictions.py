import datetime, json, math, os

HTML_PATH = 'docs/index.html'
MARKER = 'const BASE_DATA = '
END_MARKER = ';\nconst BLOCKED_PATCH_KEYS'

def load_data():
    html = open(HTML_PATH, encoding='utf-8').read()
    start = html.index(MARKER) + len(MARKER)
    end = html.index(END_MARKER, start)
    return html, start, end, json.loads(html[start:end])

def save_data(html, start, end, data):
    open(HTML_PATH, 'w', encoding='utf-8').write(html[:start] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[end:])

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def expected_edge(team_a, team_b, ranks):
    return clamp((ranks.get(team_b, 60) - ranks.get(team_a, 60)) / 55.0, -1.2, 1.2)

def result_points(gf, ga):
    return 3 if gf > ga else 1 if gf == ga else 0

html, start, end, data = load_data()
teams = data.get('teams', [])
ranks = {t['name']: int(t.get('rank') or 60) for t in teams}
state = {t['name']: {'pts':0, 'gd':0, 'gf':0, 'ga':0, 'played':0, 'residual':0.0, 'last':0.0} for t in teams}
played = []
for m in data.get('matches', []):
    if m.get('stage') != 'group' or not m.get('played'):
        continue
    if not isinstance(m.get('scoreA'), int) or not isinstance(m.get('scoreB'), int):
        continue
    a, b, sa, sb = m['teamA'], m['teamB'], m['scoreA'], m['scoreB']
    played.append(m)
    for name, gf, ga, opp in [(a, sa, sb, b), (b, sb, sa, a)]:
        row = state[name]
        row['pts'] += result_points(gf, ga)
        row['gd'] += gf - ga
        row['gf'] += gf
        row['ga'] += ga
        row['played'] += 1
        row['last'] = gf - ga
        row['residual'] += (gf - ga) - expected_edge(name, opp, ranks)

for t in teams:
    row = state[t['name']]
    if row['played']:
        gdpg = row['gd'] / row['played']
        ppg = row['pts'] / row['played']
        residual = row['residual'] / row['played']
        t['morale'] = round(clamp((ppg - 1.35) * 14 + gdpg * 5 + row['last'] * 1.5, -22, 24), 2)
        t['manualPowerAdj'] = round(clamp(residual * 12, -24, 24), 2)
    else:
        t['morale'] = round(float(t.get('morale') or 0) * 0.72, 2)
        t['manualPowerAdj'] = round(float(t.get('manualPowerAdj') or 0) * 0.72, 2)

for m in data.get('matches', []):
    if m.get('stage') != 'group' or m.get('played'):
        continue
    a, b = m.get('teamA'), m.get('teamB')
    if a not in state or b not in state:
        continue
    sa, sb = state[a], state[b]
    adj_a = clamp(((sa['pts']/max(1, sa['played'])) - (sb['pts']/max(1, sb['played']))) * 0.018 + ((sa['gd']/max(1, sa['played'])) - (sb['gd']/max(1, sb['played']))) * 0.014, -0.08, 0.08)
    m['context'] = m.get('context') if isinstance(m.get('context'), dict) else {}
    m['context']['A'] = dict(m['context'].get('A', {}), goalAdj=round(adj_a, 3), note='Auto form/context adjustment from current tournament results.')
    m['context']['B'] = dict(m['context'].get('B', {}), goalAdj=round(-adj_a, 3), note='Auto form/context adjustment from current tournament results.')

data['modelInputs'] = {
    'updatedAt': datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
    'method': 'Auto-derived tournament form, rank-expectation residual, upcoming-match context edge, and UI-preserving BASE_DATA-only update.',
    'features': ['rank', 'played results', 'points per game', 'goal difference per game', 'rank-adjusted result residual', 'last-match momentum', 'upcoming-match context goalAdj'],
    'guardrail': 'Derived fields only tune existing morale/manualPowerAdj/context factors; missing external injury, lineup, xG, referee, and market data remain neutral unless patched explicitly.'
}
data['version'] = datetime.date.today().isoformat() + '-accuracy-enriched'
data['generatedAt'] = data['modelInputs']['updatedAt']
data['sourceNote'] = 'Automated BASE_DATA score update plus prediction-enrichment pass. Companion UI shell is not rewritten.'
save_data(html, start, end, data)
print(json.dumps({'teamsEnriched': len(teams), 'playedMatches': len(played), 'modelInputs': data['modelInputs']['features']}, indent=2))
