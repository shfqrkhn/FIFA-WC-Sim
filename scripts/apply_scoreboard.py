import datetime, json, os, sys, urllib.request

HTML_PATH = 'docs/index.html'
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
def load_base_data():
    with open(HTML_PATH, encoding='utf-8') as f: html = f.read()
    marker = 'const BASE_DATA = '
    start = html.index(marker) + len(marker)
    end = html.index(';\nconst BLOCKED_PATCH_KEYS', start)
    return html, start, end, json.loads(html[start:end])
def competitor_name(c):
    code = c.get('abbreviation') or c.get('team', {}).get('abbreviation')
    return TEAM.get(code, '')
def is_final(ev):
    typ = ev.get('status', {}).get('type', {})
    return bool(typ.get('completed') or typ.get('name') in ('STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FINAL_PEN'))
def scoreboard_paths():
    if len(sys.argv) > 1: return sys.argv[1:]
    os.makedirs('data/scoreboards', exist_ok=True)
    today = datetime.date.today()
    end_day = min(today, datetime.date(2026, 7, 20))
    day = datetime.date(2026, 6, 11)
    paths = []
    while day <= end_day:
        path = 'data/scoreboards/%s.json' % date_key(day)
        url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=%s' % date_key(day)
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                payload = response.read()
            with open(path, 'wb') as f: f.write(payload)
            paths.append(path)
        except Exception:
            pass
        day += datetime.timedelta(days=1)
    return paths

html, start, end, data = load_base_data()
idx = {key(m['teamA'], m['teamB']): m for m in data['matches'] if m.get('stage') == 'group'}
fetched = applied = 0
changes = []
for path in scoreboard_paths():
    with open(path, encoding='utf-8') as f: feed = json.load(f)
    for ev in feed.get('events', []):
        if not is_final(ev): continue
        comps = ev.get('competitions', [{}])[0].get('competitors', [])
        if len(comps) != 2: continue
        a, b = competitor_name(comps[0]), competitor_name(comps[1])
        if not a or not b: continue
        score_a, score_b = int(comps[0].get('score', 0)), int(comps[1].get('score', 0))
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
stamp = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
if applied:
    played = [m for m in data['matches'] if m.get('stage') == 'group' and m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
    goals = sum(m['scoreA'] + m['scoreB'] for m in played)
    data['schema'] = max(int(data.get('schema', 0)), 33)
    data['version'] = stamp[:10] + '-auto-daily'
    data['generatedAt'] = stamp
    data['sourceNote'] = 'Automated daily scoreboard update; applied %s completed match result(s).' % applied
    current = data.get('currentStats', {})
    current.update({'updatedTo': stamp[:10], 'matchesPlayed': len(played), 'goalsScored': goals, 'goalsPerMatch': round(goals / len(played), 2) if played else 0})
    data['currentStats'] = current
    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html[:start] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[end:])
os.makedirs('data', exist_ok=True)
with open('data/latest-update.json', 'w', encoding='utf-8') as f:
    json.dump({'generatedAt': stamp, 'fetchedFinals': fetched, 'appliedChanges': applied, 'changes': changes}, f, indent=2)
    f.write('\n')
print(json.dumps({'fetchedFinals': fetched, 'appliedChanges': applied, 'changes': changes}, indent=2))
