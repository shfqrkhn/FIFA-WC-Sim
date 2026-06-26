import datetime, json, math
from automation_utils import utc_stamp

HTML_PATH = 'docs/index.html'
MARKER = 'const BASE_DATA = '
END_MARKER = ';\nconst BLOCKED_PATCH_KEYS'
EARTH_KM = 6371.0

def load_data():
    html = open(HTML_PATH, encoding='utf-8').read()
    start = html.index(MARKER) + len(MARKER)
    end = html.index(END_MARKER, start)
    return html, start, end, json.loads(html[start:end])

def save_data(html, start, end, data):
    open(HTML_PATH, 'w', encoding='utf-8').write(html[:start] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[end:])

def clamp(x, lo, hi): return max(lo, min(hi, x))
def parse_day(m):
    for k in ('date', 'kickoff', 'kickoffLocal', 'utc', 'time'):
        v = m.get(k)
        if not v: continue
        try: return datetime.date.fromisoformat(str(v)[:10])
        except Exception: pass
    return None

def haversine(a, b):
    if not a or not b: return 0
    lat1, lon1, lat2, lon2 = a.get('lat'), a.get('lon'), b.get('lat'), b.get('lon')
    if not all(isinstance(x, (int, float)) for x in (lat1, lon1, lat2, lon2)): return 0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lon2-lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return round(2 * EARTH_KM * math.asin(math.sqrt(h)))

def rest_edge(a_rest, b_rest):
    if a_rest is None or b_rest is None: return 0
    return clamp((a_rest - b_rest) * 0.012, -0.045, 0.045)

def travel_edge(a_km, b_km): return clamp((b_km - a_km) / 12000.0, -0.035, 0.035)

html, start, end, data = load_data()
venues = data.get('venues') or {}
team_last = {}
rest_travel = data.get('restTravel') if isinstance(data.get('restTravel'), dict) else {}
changed = False
matches = sorted([m for m in data.get('matches', []) if m.get('stage') == 'group'], key=lambda m: m.get('no') or 0)
for m in matches:
    no = str(m.get('no'))
    venue = venues.get(m.get('venue')) or {}
    day = parse_day(m)
    a, b = m.get('teamA'), m.get('teamB')
    prev_a, prev_b = team_last.get(a), team_last.get(b)
    a_rest = (day - prev_a['day']).days if day and prev_a and prev_a.get('day') else None
    b_rest = (day - prev_b['day']).days if day and prev_b and prev_b.get('day') else None
    a_travel = haversine(prev_a.get('venue') if prev_a else None, venue) if prev_a else 0
    b_travel = haversine(prev_b.get('venue') if prev_b else None, venue) if prev_b else 0
    edge = round(clamp(rest_edge(a_rest, b_rest) + travel_edge(a_travel, b_travel), -0.06, 0.06), 3)
    item = {'teamA': a, 'teamB': b, 'venue': m.get('venue'), 'date': day.isoformat() if day else None, 'teamA_restDays': a_rest, 'teamB_restDays': b_rest, 'teamA_travelKm': a_travel, 'teamB_travelKm': b_travel, 'goalAdjA': edge, 'source': 'derived from embedded schedule and venue coordinates'}
    if rest_travel.get(no) != item:
        rest_travel[no] = item
        changed = True
    if not m.get('played'):
        ctx = m.get('context') if isinstance(m.get('context'), dict) else {}
        a_ctx, b_ctx = dict(ctx.get('A', {})), dict(ctx.get('B', {}))
        base_a = float(a_ctx.get('goalAdj') or 0) - float(a_ctx.get('restTravelAdj') or 0)
        base_b = float(b_ctx.get('goalAdj') or 0) - float(b_ctx.get('restTravelAdj') or 0)
        a_ctx.update({'goalAdj': round(clamp(base_a + edge, -0.18, 0.18), 3), 'restTravelAdj': edge, 'restTravelSource': 'embedded schedule/venues'})
        b_ctx.update({'goalAdj': round(clamp(base_b - edge, -0.18, 0.18), 3), 'restTravelAdj': -edge, 'restTravelSource': 'embedded schedule/venues'})
        next_ctx = dict(ctx, A=a_ctx, B=b_ctx)
        if m.get('context') != next_ctx:
            m['context'] = next_ctx
            changed = True
    if day:
        team_last[a] = {'day': day, 'venue': venue}
        team_last[b] = {'day': day, 'venue': venue}
if changed:
    data['restTravel'] = rest_travel
    data['generatedAt'] = utc_stamp()
    data['sourceNote'] = 'Automated BASE_DATA update including scoreboard, form, rest/travel, and weather context. Companion UI shell is not rewritten.'
    save_data(html, start, end, data)
print(json.dumps({'restTravelMatches': len(rest_travel), 'changed': changed}, indent=2))
