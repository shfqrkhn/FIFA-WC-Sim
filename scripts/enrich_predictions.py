import datetime, json, os
from automation_utils import utc_stamp

HTML_PATH = os.environ.get('FIFA_WC_HTML_PATH', 'docs/index.html')
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

def team_group(name, teams):
    for team in teams:
        if team.get('name') == name:
            return team.get('group')
    return None

def group_unplayed(group, matches):
    return [m for m in matches if m.get('stage') == 'group' and m.get('group') == group and not m.get('played')]

def played_result_rows(data):
    rows = []
    for m in list(data.get('matches', [])) + list(data.get('knockout', [])):
        if not m.get('played') or not m.get('teamA') or not m.get('teamB'):
            continue
        if not isinstance(m.get('scoreA'), int) or not isinstance(m.get('scoreB'), int):
            continue
        rows.append(m)
    return rows

def group_incentive(name, group, state, matches):
    row = state.get(name, {})
    if row.get('played', 0) < 2 or len(group_unplayed(group, matches)) > 2:
        return 0.0, 'neutral until final group-match incentive state is reached'
    pts = row.get('pts', 0)
    gd = row.get('gd', 0)
    if pts >= 6:
        return -0.02, 'already on six or more points; small rotation/control discount'
    if pts <= 1:
        return 0.025, 'needs a result from final group match; small chase incentive'
    if pts == 3:
        return 0.018 if gd < 1 else 0.012, 'three-point final-match qualification pressure'
    if pts == 4:
        return 0.006 if gd < 2 else -0.004, 'four-point final-match consolidation state'
    return 0.0, 'neutral group-table incentive'

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
for m in sorted(played_result_rows(data), key=lambda x: (str(x.get('date') or ''), x.get('no') or 0)):
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
    group = m.get('group') or team_group(a, teams)
    incentive_a, incentive_note_a = group_incentive(a, group, state, data.get('matches', []))
    incentive_b, incentive_note_b = group_incentive(b, group, state, data.get('matches', []))
    base_a = float(a_ctx.get('goalAdj') or 0) - float(a_ctx.get('formAdj') or 0) - float(a_ctx.get('incentiveAdj') or 0)
    base_b = float(b_ctx.get('goalAdj') or 0) - float(b_ctx.get('formAdj') or 0) - float(b_ctx.get('incentiveAdj') or 0)
    a_ctx.update({
        'goalAdj': round(clamp(base_a + adj_a + incentive_a, -0.18, 0.18), 3),
        'formAdj': adj_a,
        'incentiveAdj': round(incentive_a, 3),
        'incentiveNote': incentive_note_a,
        'note': 'Auto form/context adjustment from current tournament results and final-group incentive state.'
    })
    b_ctx.update({
        'goalAdj': round(clamp(base_b - adj_a + incentive_b, -0.18, 0.18), 3),
        'formAdj': -adj_a,
        'incentiveAdj': round(incentive_b, 3),
        'incentiveNote': incentive_note_b,
        'note': 'Auto form/context adjustment from current tournament results and final-group incentive state.'
    })
    incentive_profile = {
        'status': 'derived_from_embedded_standings' if incentive_a or incentive_b else 'neutral',
        'source': 'embedded standings before final group match',
        'teamA': {'team': a, 'goalAdj': round(incentive_a, 3), 'note': incentive_note_a},
        'teamB': {'team': b, 'goalAdj': round(incentive_b, 3), 'note': incentive_note_b}
    }
    if m.get('incentiveProfile') != incentive_profile:
        m['incentiveProfile'] = incentive_profile
        changed = True
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
        'method': 'Auto-derived tournament form, rank-expectation residual, rank-seeded Elo-style rating, final group-table incentive, upcoming-match context edge, and UI-preserving BASE_DATA-only update.',
        'features': ['rank', 'rank-seeded Elo-style rating', 'played results', 'points per game', 'goal difference per game', 'rank-adjusted result residual', 'last-match momentum', 'group-table incentive', 'upcoming-match context goalAdj'],
        'coefficients': {'eloK': 18, 'eloGoalMarginStep': 0.12, 'eloGoalMarginCap': 3, 'groupIncentiveGoalCap': 0.025},
        'guardrail': 'Derived fields only tune existing morale/manualPowerAdj/context factors and the transparent Elo-style prior; missing external injury, lineup, suspension, goalkeeper, xG, referee, and market data remain neutral unless patched explicitly.'
    }
    cfg = data.get('config') if isinstance(data.get('config'), dict) else {}
    cfg.setdefault('confirmedKeyAbsenceGoalPenalty', 0.055)
    cfg.setdefault('confirmedSuspensionGoalPenalty', 0.045)
    cfg.setdefault('confirmedKeeperDowngradeGoalPenalty', 0.035)
    cfg.setdefault('confirmedRotationGoalPenalty', 0.03)
    data['config'] = cfg
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
    data['version'] = datetime.datetime.now(datetime.timezone.utc).date().isoformat() + '-accuracy-enriched'
    data['generatedAt'] = updated
    data['sourceNote'] = 'Automated BASE_DATA score update plus prediction-enrichment pass with rank-seeded Elo-style prior. Companion UI shell is not rewritten.'
    save_data(html, start, end, data)
print(json.dumps({'teamsEnriched': len(teams), 'playedMatches': len(played), 'changed': changed}, indent=2))
