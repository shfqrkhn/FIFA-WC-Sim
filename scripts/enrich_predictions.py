import datetime, json
from automation_utils import utc_stamp

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

def rank_seeded_elo(rank):
    return 2150 - (max(1, rank) - 1) * 13.5

def expected_result(ra, rb):
    return 1 / (1 + 10 ** ((rb - ra) / 400))

def match_result(gf, ga):
    return 1 if gf > ga else 0.5 if gf == ga else 0

def goal_margin_multiplier(gf, ga):
    return 1 + min(3, abs(gf - ga)) * 0.12

def upsert_source(data, item):
    sources = data.get('sources')
    if not isinstance(sources, list):
        sources = []
    for i, source in enumerate(sources):
        if isinstance(source, dict) and source.get('name') == item['name']:
            sources[i] = dict(source, **item)
            data['sources'] = sources
            return True
    sources.append(item)
    data['sources'] = sources
    return True

def set_changed(obj, key, value):
    if obj.get(key) != value:
        obj[key] = value
        return True
    return False

html, start, end, data = load_data()
teams = data.get('teams', [])
ranks = {t['name']: int(t.get('rank') or 60) for t in teams}
state = {t['name']: {'pts':0, 'gd':0, 'gf':0, 'ga':0, 'played':0, 'residual':0.0, 'last':0.0} for t in teams}
ratings = {t['name']: rank_seeded_elo(ranks.get(t['name'], 60)) for t in teams}
rating_matches = {t['name']: 0 for t in teams}
played = []
changed = False
for m in sorted(data.get('matches', []), key=lambda x: x.get('no') or 0):
    if m.get('stage') != 'group' or not m.get('played'):
        continue
    if not isinstance(m.get('scoreA'), int) or not isinstance(m.get('scoreB'), int):
        continue
    a, b, sa, sb = m['teamA'], m['teamB'], m['scoreA'], m['scoreB']
    played.append(m)
    if a in ratings and b in ratings:
        ea = expected_result(ratings[a], ratings[b])
        outcome_a = match_result(sa, sb)
        delta = 18 * goal_margin_multiplier(sa, sb) * (outcome_a - ea)
        ratings[a] += delta
        ratings[b] -= delta
        rating_matches[a] += 1
        rating_matches[b] += 1
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
        morale = round(clamp((ppg - 1.35) * 14 + gdpg * 5 + row['last'] * 1.5, -22, 24), 2)
        power = round(clamp(residual * 12, -24, 24), 2)
    else:
        morale = round(float(t.get('morale') or 0) * 0.72, 2)
        power = round(float(t.get('manualPowerAdj') or 0) * 0.72, 2)
    changed |= set_changed(t, 'morale', morale)
    changed |= set_changed(t, 'manualPowerAdj', power)
    changed |= set_changed(t, 'eloRating', round(ratings.get(t['name'], rank_seeded_elo(ranks.get(t['name'], 60))), 1))
    changed |= set_changed(t, 'eloRatingMatches', rating_matches.get(t['name'], 0))
    changed |= set_changed(t, 'eloRatingSource', 'Rank-seeded Elo-style rating derived from FIFA-rank prior and embedded played World Cup results; no external Elo feed or betting market data used.')

for m in data.get('matches', []):
    if m.get('stage') != 'group' or m.get('played'):
        continue
    a, b = m.get('teamA'), m.get('teamB')
    if a not in state or b not in state:
        continue
    sa, sb = state[a], state[b]
    adj_a = round(clamp(((sa['pts']/max(1, sa['played'])) - (sb['pts']/max(1, sb['played']))) * 0.018 + ((sa['gd']/max(1, sa['played'])) - (sb['gd']/max(1, sb['played']))) * 0.014, -0.08, 0.08), 3)
    ctx = m.get('context') if isinstance(m.get('context'), dict) else {}
    a_ctx = dict(ctx.get('A', {}))
    b_ctx = dict(ctx.get('B', {}))
    base_a = float(a_ctx.get('goalAdj') or 0) - float(a_ctx.get('formAdj') or 0)
    base_b = float(b_ctx.get('goalAdj') or 0) - float(b_ctx.get('formAdj') or 0)
    a_ctx.update({'goalAdj': round(clamp(base_a + adj_a, -0.18, 0.18), 3), 'formAdj': adj_a, 'note': 'Auto form/context adjustment from current tournament results.'})
    b_ctx.update({'goalAdj': round(clamp(base_b - adj_a, -0.18, 0.18), 3), 'formAdj': -adj_a, 'note': 'Auto form/context adjustment from current tournament results.'})
    next_ctx = dict(ctx, A=a_ctx, B=b_ctx)
    if m.get('context') != next_ctx:
        m['context'] = next_ctx
        changed = True

if changed:
    updated = utc_stamp()
    for t in teams:
        t['eloRatingUpdatedAt'] = updated
    data['modelInputs'] = {
        'updatedAt': updated,
        'method': 'Auto-derived tournament form, rank-expectation residual, rank-seeded Elo-style rating, upcoming-match context edge, and UI-preserving BASE_DATA-only update.',
        'features': ['rank', 'rank-seeded Elo-style rating', 'played results', 'points per game', 'goal difference per game', 'rank-adjusted result residual', 'last-match momentum', 'upcoming-match context goalAdj'],
        'coefficients': {'eloK': 18, 'eloGoalMarginStep': 0.12, 'eloGoalMarginCap': 3},
        'guardrail': 'Derived fields only tune existing morale/manualPowerAdj/context factors and the transparent Elo-style prior; missing external injury, lineup, xG, referee, and market data remain neutral unless patched explicitly.'
    }
    upsert_source(data, {
        'name': 'FIFA/Coca-Cola Men\'s World Ranking',
        'url': 'https://inside.fifa.com/fifa-world-ranking/men',
        'use': 'FIFA ranking prior used to seed team strength and rank-seeded Elo-style ratings',
        'tier': 'official',
        'confidence': 'high',
        'maintenanceNote': 'Refresh rankings from FIFA when the embedded rank field is patched; no unauthenticated ranking API is assumed.'
    })
    upsert_source(data, {
        'name': 'Rank-seeded Elo-style model input',
        'url': 'embedded BASE_DATA modelInputs',
        'use': 'Transparent derived rating from FIFA rank prior plus embedded played World Cup results',
        'tier': 'internal deterministic model input',
        'confidence': 'medium',
        'maintenanceNote': 'Not an external Elo feed; coefficient and source limits are disclosed in How, Health, and Sources.'
    })
    data['schema'] = max(int(data.get('schema', 0)), 34)
    data['version'] = datetime.date.today().isoformat() + '-accuracy-enriched'
    data['generatedAt'] = updated
    data['sourceNote'] = 'Automated BASE_DATA score update plus prediction-enrichment pass with rank-seeded Elo-style prior. Companion UI shell is not rewritten.'
    save_data(html, start, end, data)
print(json.dumps({'teamsEnriched': len(teams), 'playedMatches': len(played), 'changed': changed}, indent=2))
