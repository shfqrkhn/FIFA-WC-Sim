import datetime, json, os, sys, urllib.request
from automation_utils import utc_stamp

HTML_PATH = 'docs/index.html'
STOP_DATE = datetime.date(2026, 7, 20)
NO_FETCH = '--no-fetch' in sys.argv
FETCH_FAILURES = []
TEAM = {
    'MEX':'Mexico','RSA':'South Africa','KOR':'South Korea','CZE':'Czechia','CAN':'Canada','BIH':'Bosnia and Herzegovina','QAT':'Qatar','SUI':'Switzerland',
    'BRA':'Brazil','MAR':'Morocco','HTI':'Haiti','SCO':'Scotland','USA':'United States','PAR':'Paraguay','AUS':'Australia','TUR':'Turkey',
    'GER':'Germany','CUW':'Curaçao','CUR':'Curaçao','CIV':'Ivory Coast','ECU':'Ecuador','NED':'Netherlands','JPN':'Japan','SWE':'Sweden','TUN':'Tunisia',
    'BEL':'Belgium','EGY':'Egypt','IRI':'Iran','IRN':'Iran','NZL':'New Zealand','ESP':'Spain','CPV':'Cape Verde','KSA':'Saudi Arabia','URU':'Uruguay',
    'FRA':'France','SEN':'Senegal','IRQ':'Iraq','NOR':'Norway','ARG':'Argentina','DZA':'Algeria','ALG':'Algeria','AUT':'Austria','JOR':'Jordan',
    'POR':'Portugal','COD':'DR Congo','DRC':'DR Congo','UZB':'Uzbekistan','COL':'Colombia','ENG':'England','CRO':'Croatia','GHA':'Ghana','PAN':'Panama'
}

def key(a, b): return '|'.join(sorted([a, b]))
def date_key(day): return day.strftime('%Y%m%d')
def match_day(m):
    for field in ('date', 'kickoff', 'kickoffLocal', 'utc', 'time'):
        value = m.get(field) if isinstance(m, dict) else None
        if not value: continue
        try: return datetime.date.fromisoformat(str(value)[:10])
        except Exception: continue
    return None
def latest_played_day(matches):
    days = [match_day(m) for m in matches if m.get('stage') == 'group' and m.get('played')]
    days = [d for d in days if d]
    return max(days).isoformat() if days else None
def load_base_data():
    with open(HTML_PATH, encoding='utf-8') as f: html = f.read()
    marker = 'const BASE_DATA = '
    start = html.index(marker) + len(marker)
    end = html.index(';\nconst BLOCKED_PATCH_KEYS', start)
    return html, start, end, json.loads(html[start:end])
def competitor_name(c):
    if not isinstance(c, dict): return ''
    team = c.get('team') if isinstance(c.get('team'), dict) else {}
    code = c.get('abbreviation') or team.get('abbreviation')
    return TEAM.get(code, '')
def is_final(ev):
    status = ev.get('status') if isinstance(ev.get('status'), dict) else {}
    typ = status.get('type') if isinstance(status.get('type'), dict) else {}
    return bool(typ.get('completed') or typ.get('name') in ('STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FINAL_PEN'))
def scoreboard_paths():
    args = [a for a in sys.argv[1:] if a != '--no-fetch']
    if NO_FETCH: return args
    if args: return args
    today = datetime.datetime.now(datetime.timezone.utc).date()
    if today > STOP_DATE:
        print('World Cup update window ended.')
        return []
    os.makedirs('data/scoreboards', exist_ok=True)
    end_day = min(today, STOP_DATE)
    day = datetime.date(2026, 6, 11)
    paths = []
    while day <= end_day:
        day_id = date_key(day)
        path = 'data/scoreboards/%s.json' % day_id
        url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=%s' % day_id
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                payload = response.read()
            with open(path, 'wb') as f: f.write(payload)
            paths.append(path)
        except Exception as e:
            FETCH_FAILURES.append({'date': day_id, 'error': str(e)})
        day += datetime.timedelta(days=1)
    return paths
def current_stats_needs_refresh(current, played, goals, updated_to):
    return (
        current.get('matchesPlayed') != len(played) or
        current.get('goalsScored') != goals or
        current.get('updatedTo') != updated_to or
        'ESPN scoreboard updater refreshed' not in str(current.get('source', '')) or
        current.get('attendance') is not None or
        current.get('attendancePerMatch') is not None or
        bool(current.get('topScorers'))
    )
def refresh_current_stats(current, played, goals, updated_to, stamp):
    current.update({
        'updatedTo': updated_to,
        'source': 'ESPN scoreboard updater refreshed completed group results, match count, and goals through %s. Attendance, top-scorer, and conduct snapshots are not refreshed by this automated score pass.' % updated_to,
        'matchesPlayed': len(played),
        'goalsScored': goals,
        'goalsPerMatch': round(goals / len(played), 2) if played else 0,
        'scoreSource': 'ESPN scoreboard fifa.world; generated %s.' % stamp,
        'attendance': None,
        'attendancePerMatch': None,
        'attendanceSource': 'Not refreshed by automated scoreboard updater after score totals advanced.',
        'topScorers': [],
        'topScorersSource': 'Not refreshed by automated scoreboard updater after score totals advanced.',
        'thirdPlaceTableSource': 'Prior conduct/fair-play notes only; not refreshed by automated scoreboard updater after score totals advanced.'
    })
    return current

html, start, end, data = load_base_data()
idx = {key(m['teamA'], m['teamB']): m for m in data['matches'] if m.get('stage') == 'group'}
fetched = applied = 0
changes = []
paths = scoreboard_paths()
for path in paths:
    try:
        with open(path, encoding='utf-8') as f: feed = json.load(f)
    except Exception:
        FETCH_FAILURES.append({'path': path, 'error': 'scoreboard file unreadable'})
        continue
    events = feed.get('events') if isinstance(feed, dict) else None
    if not isinstance(events, list):
        FETCH_FAILURES.append({'path': path, 'error': 'scoreboard file invalid shape'})
        continue
    for ev in events:
        if not isinstance(ev, dict): continue
        if not is_final(ev): continue
        competitions = ev.get('competitions') or [{}]
        if not isinstance(competitions, list) or not competitions or not isinstance(competitions[0], dict): continue
        comps = competitions[0].get('competitors', [])
        if not isinstance(comps, list) or len(comps) != 2 or any(not isinstance(c, dict) for c in comps): continue
        a, b = competitor_name(comps[0]), competitor_name(comps[1])
        if not a or not b: continue
        try:
            score_a, score_b = int(comps[0].get('score', 0)), int(comps[1].get('score', 0))
        except Exception:
            continue
        fetched += 1
        match = idx.get(key(a, b))
        if not match: continue
        next_a, next_b = (score_a, score_b) if match['teamA'] == a else (score_b, score_a)
        if match.get('scoreA') != next_a or match.get('scoreB') != next_b or not match.get('played'):
            match['scoreA'], match['scoreB'], match['played'] = next_a, next_b, True
            match['note'] = 'Auto-updated from scoreboard event %s.' % ev.get('id')
            match.pop('context', None)
            applied += 1
            changes.append('M%s %s %s-%s %s' % (match['no'], match['teamA'], next_a, next_b, match['teamB']))
stamp = utc_stamp()
played = [m for m in data['matches'] if m.get('stage') == 'group' and m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
goals = sum(m['scoreA'] + m['scoreB'] for m in played)
updated_to = latest_played_day(data['matches']) or stamp[:10]
current = data.get('currentStats') if isinstance(data.get('currentStats'), dict) else {}
stats_changed = current_stats_needs_refresh(current, played, goals, updated_to)
if applied:
    next_source_note = 'Automated daily scoreboard update; applied %s completed match result(s) and refreshed score-derived stats.' % applied
elif 'applied 0 completed match result(s)' in str(data.get('sourceNote', '')):
    next_source_note = 'Automated daily scoreboard metadata refresh from embedded completed match results; no additional score rows were applied in this repair pass.'
else:
    next_source_note = data.get('sourceNote') or 'Automated daily scoreboard metadata refresh from embedded completed match results.'
source_note_changed = next_source_note != data.get('sourceNote')
if applied or stats_changed or source_note_changed:
    data['schema'] = max(int(data.get('schema', 0)), 33)
    data['version'] = updated_to + '-auto-daily'
    data['generatedAt'] = stamp
    data['sourceNote'] = next_source_note
    data['currentStats'] = refresh_current_stats(current, played, goals, updated_to, stamp)
    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html[:start] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[end:])
if not NO_FETCH and (applied or FETCH_FAILURES):
    os.makedirs('data', exist_ok=True)
    with open('data/latest-update.json', 'w', encoding='utf-8') as f:
        json.dump({'generatedAt': stamp, 'fetchedFinals': fetched, 'appliedChanges': applied, 'changes': changes, 'fetchFailures': FETCH_FAILURES}, f, indent=2)
        f.write('\n')
print(json.dumps({'fetchedFinals': fetched, 'appliedChanges': applied, 'changes': changes, 'fetchFailures': FETCH_FAILURES, 'noFetch': NO_FETCH}, indent=2))
