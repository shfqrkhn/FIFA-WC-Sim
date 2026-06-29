import datetime
import json
import os
import sys
import urllib.request

from automation_utils import utc_stamp


HTML_PATH = os.environ.get('FIFA_WC_HTML_PATH', 'docs/index.html')
STOP_DATE = datetime.date(2026, 7, 20)
NO_FETCH = '--no-fetch' in sys.argv
FETCH_FAILURES = []

TEAM = {
    'MEX': 'Mexico', 'RSA': 'South Africa', 'KOR': 'South Korea', 'CZE': 'Czechia',
    'CAN': 'Canada', 'QAT': 'Qatar', 'SUI': 'Switzerland', 'BIH': 'Bosnia and Herzegovina',
    'BRA': 'Brazil', 'MAR': 'Morocco', 'SCO': 'Scotland', 'HAI': 'Haiti',
    'USA': 'United States', 'AUS': 'Australia', 'PAR': 'Paraguay', 'TUR': 'Turkey',
    'ESP': 'Spain', 'ECU': 'Ecuador', 'CPV': 'Cape Verde', 'KSA': 'Saudi Arabia',
    'FRA': 'France', 'SEN': 'Senegal', 'NED': 'Netherlands', 'IRQ': 'Iraq',
    'ARG': 'Argentina', 'ALG': 'Algeria', 'AUT': 'Austria', 'JOR': 'Jordan',
    'POR': 'Portugal', 'COL': 'Colombia', 'COD': 'DR Congo', 'UZB': 'Uzbekistan',
    'ENG': 'England', 'CRO': 'Croatia', 'GHA': 'Ghana', 'PAN': 'Panama',
    'GER': 'Germany', 'JPN': 'Japan', 'CIV': 'Ivory Coast', 'NZL': 'New Zealand',
    'BEL': 'Belgium', 'IRN': 'Iran', 'EGY': 'Egypt', 'CUR': 'Curaçao',
    'ITA': 'Italy', 'DEN': 'Denmark', 'TUN': 'Tunisia', 'CHI': 'Chile',
    'URU': 'Uruguay', 'NOR': 'Norway', 'CRC': 'Costa Rica', 'UAE': 'United Arab Emirates',
}


def key(a, b):
    return '|'.join(sorted([a, b]))


def all_matches(data):
    return list(data.get('matches') or []) + list(data.get('knockout') or [])


def match_day(m):
    raw = m.get('date') or ''
    if not raw:
        return None
    try:
        return datetime.date.fromisoformat(raw[:10])
    except ValueError:
        return None


def latest_played_day(matches):
    days = [match_day(m) for m in matches if m.get('played')]
    days = [d for d in days if d is not None]
    return max(days).isoformat() if days else None


def score_int(value):
    try:
        if value is None or value == '':
            return None
        parsed = int(value)
        return parsed if 0 <= parsed <= 30 else None
    except (TypeError, ValueError):
        return None


def load_base_data():
    html = open(HTML_PATH, encoding='utf-8').read()
    marker = 'const BASE_DATA = '
    start = html.index(marker) + len(marker)
    end = html.index(';\nconst BLOCKED_PATCH_KEYS', start)
    return html, start, end, json.loads(html[start:end])


def save_base_data(html, start, end, data):
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    open(HTML_PATH, 'w', encoding='utf-8').write(html[:start] + payload + html[end:])


def fetch_day(day):
    if NO_FETCH:
        return []
    url = f'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates={day:%Y%m%d}'
    try:
        with urllib.request.urlopen(url, timeout=25) as res:
            payload = json.load(res)
        return payload.get('events') or []
    except Exception as exc:
        FETCH_FAILURES.append({'date': day.isoformat(), 'error': str(exc)})
        return []


def read_events_from_args():
    events = []
    for arg in sys.argv[1:]:
        if arg.startswith('--'):
            continue
        with open(arg, encoding='utf-8') as f:
            payload = json.load(f)
        if isinstance(payload, dict):
            events.extend(payload.get('events') or [])
        elif isinstance(payload, list):
            events.extend(payload)
        else:
            raise SystemExit('scoreboard file invalid shape')
    return events


def event_state(event):
    comp = (event.get('competitions') or [{}])[0]
    status = comp.get('status') or event.get('status') or {}
    status_type = status.get('type') or {}
    return comp, status_type


def is_final(event):
    comp, status_type = event_state(event)
    return bool(status_type.get('completed') or status_type.get('name') in {'STATUS_FINAL', 'STATUS_FULL_TIME'})


def competitor_name(c):
    team = c.get('team') or {}
    return TEAM.get(team.get('abbreviation')) or team.get('displayName') or team.get('name')


def event_teams_scores(event):
    comp, _ = event_state(event)
    comps = comp.get('competitors') or []
    if len(comps) < 2:
        return None
    teams = [competitor_name(c) for c in comps[:2]]
    scores = [score_int(c.get('score')) for c in comps[:2]]
    if not all(teams) or any(s is None for s in scores):
        return None
    return comps[:2], teams, scores


def event_winner(comps):
    for c in comps:
        if c.get('winner') is True or c.get('advance') is True:
            return competitor_name(c)
    return None


def team_meta(data):
    return {t.get('name'): t for t in data.get('teams', []) if t.get('name')}


def group_match_rows(data, group=None):
    rows = [m for m in data.get('matches', []) if m.get('stage') == 'group']
    if group:
        rows = [m for m in rows if m.get('group') == group]
    return rows


def completed_score(m):
    a = score_int(m.get('scoreA'))
    b = score_int(m.get('scoreB'))
    if not m.get('played') or a is None or b is None:
        return None
    return a, b


def base_row(team_name, group_name):
    return {'team': team_name, 'group': group_name, 'P': 0, 'W': 0, 'D': 0, 'L': 0, 'GF': 0, 'GA': 0, 'GD': 0, 'Pts': 0}


def add_group_result(rows, team_a, team_b, score_a, score_b):
    a = rows[team_a]
    b = rows[team_b]
    a['P'] += 1
    b['P'] += 1
    a['GF'] += score_a
    a['GA'] += score_b
    b['GF'] += score_b
    b['GA'] += score_a
    a['GD'] = a['GF'] - a['GA']
    b['GD'] = b['GF'] - b['GA']
    if score_a > score_b:
        a['W'] += 1
        b['L'] += 1
        a['Pts'] += 3
    elif score_b > score_a:
        b['W'] += 1
        a['L'] += 1
        b['Pts'] += 3
    else:
        a['D'] += 1
        b['D'] += 1
        a['Pts'] += 1
        b['Pts'] += 1


def h2h_metrics(names, matches):
    names = set(names)
    stats = {name: {'Pts': 0, 'GF': 0, 'GA': 0, 'GD': 0} for name in names}
    for m in matches:
        score = completed_score(m)
        if not score or m.get('teamA') not in names or m.get('teamB') not in names:
            continue
        a, b = m['teamA'], m['teamB']
        sa, sb = score
        stats[a]['GF'] += sa
        stats[a]['GA'] += sb
        stats[b]['GF'] += sb
        stats[b]['GA'] += sa
        if sa > sb:
            stats[a]['Pts'] += 3
        elif sb > sa:
            stats[b]['Pts'] += 3
        else:
            stats[a]['Pts'] += 1
            stats[b]['Pts'] += 1
    for row in stats.values():
        row['GD'] = row['GF'] - row['GA']
    return stats


def split_by(rows, key_fn):
    groups = []
    for row in rows:
        value = key_fn(row)
        if groups and groups[-1][0] == value:
            groups[-1][1].append(row)
        else:
            groups.append((value, [row]))
    return groups


def final_group_key(row, meta):
    info = meta.get(row['team'], {})
    return (-row['GD'], -row['GF'], -(info.get('fairPlay') or 0), info.get('rank') or 9999, row['team'])


def rank_equal_points(rows, matches, meta, depth=0):
    if len(rows) < 2:
        return rows
    h2h = h2h_metrics([r['team'] for r in rows], matches)
    sorted_rows = sorted(rows, key=lambda r: (-h2h[r['team']]['Pts'], -h2h[r['team']]['GD'], -h2h[r['team']]['GF']))
    groups = split_by(sorted_rows, lambda r: (h2h[r['team']]['Pts'], h2h[r['team']]['GD'], h2h[r['team']]['GF']))
    if len(groups) > 1 and depth < 4:
        ranked = []
        for _, group_rows in groups:
            ranked.extend(rank_equal_points(group_rows, matches, meta, depth + 1) if len(group_rows) > 1 else group_rows)
        return ranked
    return sorted(rows, key=lambda r: final_group_key(r, meta))


def sort_group_rows(rows, group, matches, meta):
    ranked = []
    by_points = split_by(sorted(rows, key=lambda r: -r['Pts']), lambda r: r['Pts'])
    for _, tied_rows in by_points:
        ranked.extend(rank_equal_points(tied_rows, matches, meta))
    return ranked


def sort_third_rows(rows, meta):
    return sorted(rows, key=lambda r: (-r['Pts'], -r['GD'], -r['GF'], -(meta.get(r['team'], {}).get('fairPlay') or 0), meta.get(r['team'], {}).get('rank') or 9999, r['team']))


def calc_standings(data):
    meta = team_meta(data)
    by_group = {}
    for m in group_match_rows(data):
        group = m.get('group')
        if not group:
            continue
        by_group.setdefault(group, {})
        if m.get('teamA'):
            by_group[group].setdefault(m['teamA'], base_row(m['teamA'], group))
        if m.get('teamB'):
            by_group[group].setdefault(m['teamB'], base_row(m['teamB'], group))
        score = completed_score(m)
        if score and m.get('teamA') and m.get('teamB'):
            add_group_result(by_group[group], m['teamA'], m['teamB'], score[0], score[1])
    standings = {}
    for group, rows in by_group.items():
        standings[group] = sort_group_rows(list(rows.values()), group, group_match_rows(data, group), meta)
    return standings


def qualifiers(data):
    standings = calc_standings(data)
    q = {'rank': {}, 'thirds': [], 'q3': []}
    meta = team_meta(data)
    for group in sorted(standings):
        rows = standings[group]
        for pos, row in enumerate(rows[:4], 1):
            q['rank'][f'{group}{pos}'] = row['team']
        if len(rows) >= 3:
            q['thirds'].append(rows[2])
    q['thirds'] = sort_third_rows(q['thirds'], meta)
    q['q3'] = [r['team'] for r in q['thirds'][:8]]
    return q


def third_slot_entries(knockout):
    slots = []
    for m in knockout:
        if m.get('round') != 'R32':
            continue
        side = None
        if (m.get('a') or {}).get('type') == 'third':
            side = 'a'
        elif (m.get('b') or {}).get('type') == 'third':
            side = 'b'
        if side:
            slots.append({'no': m.get('no'), 'side': side, 'groups': (m.get(side) or {}).get('groups') or []})
    return slots


def validate_third_allocation(pool, assigned, knockout):
    teams = [r['team'] for r in pool]
    if len(teams) != len(set(teams)):
        return False
    if any(assigned.get(s['no']) not in teams for s in third_slot_entries(knockout)):
        return False
    used = set()
    for slot in third_slot_entries(knockout):
        team = assigned.get(slot['no'])
        row = next((r for r in pool if r['team'] == team), None)
        if not row or row['group'] not in slot['groups'] or team in used:
            return False
        used.add(team)
    return True


def allocate_third_slots(q, knockout):
    pool = [r for r in q['thirds'] if r['team'] in set(q['q3'])]
    slots = third_slot_entries(knockout)
    if len(pool) != len(slots):
        return {}
    assigned = {}
    used = set()
    order = sorted(slots, key=lambda s: (len([r for r in pool if r['group'] in s['groups']]), s['no']))

    def rec(i):
        if i >= len(order):
            return validate_third_allocation(pool, assigned, knockout)
        slot = order[i]
        candidates = [r for r in pool if r['group'] in slot['groups'] and r['team'] not in used]
        for row in candidates:
            assigned[slot['no']] = row['team']
            used.add(row['team'])
            if rec(i + 1):
                return True
            used.remove(row['team'])
            assigned.pop(slot['no'], None)
        return False

    return assigned if rec(0) else {}


def resolve_ref(ref, q, third_assigned, knockout_results):
    if not isinstance(ref, dict):
        return None
    ref_type = ref.get('type')
    if ref_type == 'rank':
        return q['rank'].get(f"{ref.get('group')}{ref.get('pos')}")
    if ref_type == 'third':
        return third_assigned.get(ref.get('matchNo'))
    if ref_type in {'winner', 'loser'}:
        result = knockout_results.get(ref.get('match'))
        return result.get(ref_type) if result else None
    return None


def apply_known_team(match, field, value):
    if not value:
        return False
    current = match.get(field)
    if current == value:
        return False
    if current and match.get('played'):
        FETCH_FAILURES.append({'match': match.get('no'), 'error': f'resolved {field} mismatch: {current} != {value}'})
        return False
    match[field] = value
    return True


def knockout_result(match):
    if not match.get('played') or not match.get('teamA') or not match.get('teamB'):
        return None
    winner = match.get('winner')
    loser = match.get('loser')
    if not winner:
        a = score_int(match.get('scoreA'))
        b = score_int(match.get('scoreB'))
        if a is None or b is None or a == b:
            return None
        winner = match['teamA'] if a > b else match['teamB']
        loser = match['teamB'] if a > b else match['teamA']
    if winner not in {match['teamA'], match['teamB']}:
        return None
    if not loser:
        loser = match['teamB'] if winner == match['teamA'] else match['teamA']
    return {'winner': winner, 'loser': loser}


def resolve_knockout_slots(data):
    changed = False
    q = qualifiers(data)
    third_assigned = allocate_third_slots(q, data.get('knockout') or [])
    knockout_results = {}
    for match in data.get('knockout') or []:
        if match.get('round') and match.get('stage') != match.get('round'):
            match['stage'] = match.get('round')
            changed = True
        a = resolve_ref(match.get('a'), q, third_assigned, knockout_results)
        b = resolve_ref(match.get('b'), q, third_assigned, knockout_results)
        changed = apply_known_team(match, 'teamA', a) or changed
        changed = apply_known_team(match, 'teamB', b) or changed
        result = knockout_result(match)
        if result:
            knockout_results[match.get('no')] = result
    return changed


def match_index(data):
    idx = {}
    for match in all_matches(data):
        if match.get('teamA') and match.get('teamB'):
            idx[key(match['teamA'], match['teamB'])] = match
    return idx


def apply_event_to_match(match, event_id, comps, teams, scores):
    score_a = scores[teams.index(match['teamA'])]
    score_b = scores[teams.index(match['teamB'])]
    changes = {}
    if match.get('scoreA') != score_a:
        changes['scoreA'] = score_a
    if match.get('scoreB') != score_b:
        changes['scoreB'] = score_b
    if match.get('played') is not True:
        changes['played'] = True
    note = f'Auto-updated from scoreboard event {event_id}.'
    if match.get('note') != note:
        changes['note'] = note
    if match.get('round') and match.get('round') != 'Group':
        winner = event_winner(comps)
        if not winner:
            if score_a == score_b:
                FETCH_FAILURES.append({'match': match.get('no'), 'event': event_id, 'error': 'knockout final score tied without winner/advance flag'})
                return False
            winner = match['teamA'] if score_a > score_b else match['teamB']
        if winner not in {match['teamA'], match['teamB']}:
            FETCH_FAILURES.append({'match': match.get('no'), 'event': event_id, 'error': f'scoreboard winner {winner} is not a match team'})
            return False
        loser = match['teamB'] if winner == match['teamA'] else match['teamA']
        if match.get('winner') != winner:
            changes['winner'] = winner
        if match.get('loser') != loser:
            changes['loser'] = loser
    if not changes:
        return False
    match.update(changes)
    return True


def refresh_current_stats(data, played, goals, stamp, updated_to):
    stats = data.setdefault('currentStats', {})
    changed = False
    updates = {
        'updatedTo': updated_to,
        'matchesPlayed': len(played),
        'goalsScored': goals,
        'goalsPerMatch': round(goals / len(played), 2) if played else None,
        'attendance': None,
        'attendancePerMatch': None,
        'topScorers': [],
        'topScorersSource': 'Not refreshed by automated scoreboard updater; no reliable player scorer feed is configured for automation. Official scorer snapshots remain unfilled unless manually patched.',
        'source': f'ESPN public scoreboard for completed World Cup matches through {updated_to}',
    }
    for field, value in updates.items():
        if stats.get(field) != value:
            stats[field] = value
            changed = True
    if changed:
        stats['lastUpdated'] = stamp
    return changed


html, start, end, data = load_base_data()
stamp = utc_stamp()
resolved_slots = resolve_knockout_slots(data)
idx = match_index(data)
events = read_events_from_args()
changes = []
fetched = 0
applied = 0

if not events and not NO_FETCH:
    start_day = latest_played_day(all_matches(data))
    start_day = datetime.date.fromisoformat(start_day) if start_day else datetime.date(2026, 6, 11)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    for offset in range((min(today, STOP_DATE) - start_day).days + 1):
        events.extend(fetch_day(start_day + datetime.timedelta(days=offset)))

for event in events:
    if not is_final(event):
        continue
    parsed = event_teams_scores(event)
    if not parsed:
        continue
    comps, teams, scores = parsed
    fetched += 1
    match = idx.get(key(teams[0], teams[1]))
    if not match:
        continue
    if apply_event_to_match(match, event.get('id') or event.get('uid') or 'unknown', comps, teams, scores):
        applied += 1
        changes.append({
            'match': match.get('no'),
            'teams': [match.get('teamA'), match.get('teamB')],
            'score': [match.get('scoreA'), match.get('scoreB')],
            'event': event.get('id') or event.get('uid'),
        })

post_score_slots = resolve_knockout_slots(data)
played = [m for m in all_matches(data) if completed_score(m)]
goals = sum(completed_score(m)[0] + completed_score(m)[1] for m in played)
updated_to = latest_played_day(played) or stamp[:10]
stats_changed = refresh_current_stats(data, played, goals, stamp, updated_to)
source_note = f'Automated scoreboard update at {stamp}; applied {applied} completed result(s), resolved knockout slots from completed group standings, and used neutral values for unavailable inputs.'

if applied or resolved_slots or post_score_slots or stats_changed or FETCH_FAILURES:
    data['version'] = f'{updated_to}-auto-daily'
    data['generatedAt'] = stamp
    data['sourceNote'] = source_note
    if FETCH_FAILURES:
        data.setdefault('maintenance', {})['scoreboardFetchFailures'] = FETCH_FAILURES
    else:
        data.setdefault('maintenance', {}).pop('scoreboardFetchFailures', None)
    save_base_data(html, start, end, data)

if not NO_FETCH and (applied or FETCH_FAILURES):
    os.makedirs('data', exist_ok=True)
    with open('data/latest-update.json', 'w', encoding='utf-8') as f:
        json.dump({
            'generatedAt': stamp,
            'updatedThrough': updated_to,
            'scoreboard': {
                'fetchedFinals': fetched,
                'appliedChanges': applied,
                'changes': changes,
                'fetchFailures': FETCH_FAILURES,
            },
        }, f, indent=2)

print(json.dumps({
    'fetchedFinals': fetched,
    'appliedChanges': applied,
    'changes': changes,
    'resolvedKnockoutSlots': bool(resolved_slots or post_score_slots),
    'fetchFailures': FETCH_FAILURES,
    'noFetch': NO_FETCH,
}, indent=2))
