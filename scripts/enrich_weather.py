import datetime, json, os, sys, urllib.parse, urllib.request

HTML_PATH = 'docs/index.html'
MARKER = 'const BASE_DATA = '
END_MARKER = ';\nconst BLOCKED_PATCH_KEYS'
NO_FETCH = '--no-fetch' in sys.argv

def load_data():
    html = open(HTML_PATH, encoding='utf-8').read()
    start = html.index(MARKER) + len(MARKER)
    end = html.index(END_MARKER, start)
    return html, start, end, json.loads(html[start:end])

def save_data(html, start, end, data):
    open(HTML_PATH, 'w', encoding='utf-8').write(html[:start] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[end:])

def clamp(x, lo, hi): return max(lo, min(hi, x))
def team_map(data): return {t['name']: t for t in data.get('teams', [])}
def iso_day(value):
    if not value: return None
    try: return datetime.date.fromisoformat(str(value)[:10])
    except Exception: return None

def weather_signature(w):
    return {k: w.get(k) for k in ('source','date','tempC','highC','lowC','precipProb','windKph','error')}

def fetch_weather(venue, day, existing=None):
    if NO_FETCH:
        return existing
    lat, lon = venue.get('lat'), venue.get('lon')
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not day: return None
    params = urllib.parse.urlencode({'latitude': lat,'longitude': lon,'start_date': day.isoformat(),'end_date': day.isoformat(),'daily': 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max','timezone': 'UTC'})
    with urllib.request.urlopen('https://api.open-meteo.com/v1/forecast?' + params, timeout=20) as r: payload = json.load(r)
    d = payload.get('daily', {})
    if not d.get('time'): return None
    high, low = d.get('temperature_2m_max', [None])[0], d.get('temperature_2m_min', [None])[0]
    if high is None or low is None: return None
    return {'source': 'open-meteo', 'date': day.isoformat(), 'tempC': round((high + low) / 2, 1), 'highC': high, 'lowC': low, 'precipProb': d.get('precipitation_probability_max', [None])[0], 'windKph': d.get('wind_speed_10m_max', [None])[0], 'fetchedAt': datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'}

def weather_edge(weather, team, venue):
    if not weather: return 0
    temp, precip, wind = weather.get('tempC'), weather.get('precipProb') or 0, weather.get('windKph') or 0
    adapt, edge = team.get('adaptation') or {}, 0.0
    if isinstance(temp, (int, float)):
        if temp >= 27: edge += 0.025 if adapt.get('heat') else -0.025
        if temp <= 8: edge += 0.015 if adapt.get('cold') else -0.012
    if wind >= 28: edge -= 0.008
    if precip >= 55: edge -= 0.006
    if (venue.get('altitudeM') or 0) >= 1000: edge += 0.018 if adapt.get('altitude') else -0.018
    return clamp(edge, -0.05, 0.05)

html, start, end, data = load_data()
teams, venues = team_map(data), data.get('venues') or {}
weather_by_match = data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'), dict) else {}
changed = False
for m in data.get('matches', []):
    if m.get('stage') != 'group' or m.get('played'): continue
    no = str(m.get('no'))
    day = iso_day(m.get('date') or m.get('kickoff') or m.get('kickoffLocal') or m.get('utc'))
    venue = venues.get(m.get('venue')) or {}
    try:
        weather = fetch_weather(venue, day, weather_by_match.get(no))
    except Exception as e:
        weather = {'source': 'open-meteo', 'date': day.isoformat() if day else None, 'error': str(e), 'fetchedAt': datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'} if day else None
    if not weather: continue
    if weather_signature(weather_by_match.get(no, {})) != weather_signature(weather):
        weather_by_match[no] = weather
        changed = True
    ta, tb = teams.get(m.get('teamA'), {}), teams.get(m.get('teamB'), {})
    delta = round(clamp(weather_edge(weather, ta, venue) - weather_edge(weather, tb, venue), -0.06, 0.06), 3)
    ctx = m.get('context') if isinstance(m.get('context'), dict) else {}
    a_ctx, b_ctx = dict(ctx.get('A', {})), dict(ctx.get('B', {}))
    base_a = float(a_ctx.get('goalAdj') or 0) - float(a_ctx.get('weatherAdj') or 0)
    base_b = float(b_ctx.get('goalAdj') or 0) - float(b_ctx.get('weatherAdj') or 0)
    a_ctx.update({'goalAdj': round(clamp(base_a + delta, -0.18, 0.18), 3), 'weatherAdj': delta, 'weatherSource': 'open-meteo'})
    b_ctx.update({'goalAdj': round(clamp(base_b - delta, -0.18, 0.18), 3), 'weatherAdj': -delta, 'weatherSource': 'open-meteo'})
    next_ctx = dict(ctx, A=a_ctx, B=b_ctx)
    if m.get('context') != next_ctx:
        m['context'] = next_ctx
        changed = True
if changed:
    data['weatherByMatch'] = weather_by_match
    data['generatedAt'] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    data['sourceNote'] = 'Automated BASE_DATA update including scoreboard, tournament-form enrichment, rest/travel, and weather context. Companion UI shell is not rewritten.'
    save_data(html, start, end, data)
print(json.dumps({'weatherMatches': len(weather_by_match), 'changed': changed, 'noFetch': NO_FETCH}, indent=2))
