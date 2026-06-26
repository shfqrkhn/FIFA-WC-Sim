import datetime, json

HTML_PATH = 'docs/index.html'
MARKER = 'const BASE_DATA = '
END_MARKER = ';\nconst BLOCKED_PATCH_KEYS'

def utc_stamp():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')

def load_data():
    html = open(HTML_PATH, encoding='utf-8').read()
    start = html.index(MARKER) + len(MARKER)
    end = html.index(END_MARKER, start)
    return html, start, end, json.loads(html[start:end])

def save_data(html, start, end, data):
    open(HTML_PATH, 'w', encoding='utf-8').write(html[:start] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[end:])

def status(ok, partial=False):
    return 'current' if ok else 'partial' if partial else 'missing'

def stable(q):
    return {k:v for k,v in (q or {}).items() if k != 'updatedAt'}

html, start, end, data = load_data()
matches = [m for m in data.get('matches', []) if m.get('stage') == 'group']
played = [m for m in matches if m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
unplayed = [m for m in matches if not m.get('played')]
weather = data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'), dict) else {}
rest = data.get('restTravel') if isinstance(data.get('restTravel'), dict) else {}
model_inputs = data.get('modelInputs') if isinstance(data.get('modelInputs'), dict) else {}
quality_core = {
    'scores': {'status': status(bool(played)), 'playedGroupMatches': len(played), 'totalGroupMatches': len(matches), 'source': 'scoreboard updater'},
    'weather': {'status': status(len(weather) >= len(unplayed), bool(weather)), 'coveredUnplayedMatches': len([m for m in unplayed if str(m.get('no')) in weather]), 'totalUnplayedMatches': len(unplayed), 'source': 'open-meteo'},
    'restTravel': {'status': status(len(rest) >= len(matches), bool(rest)), 'coveredGroupMatches': len(rest), 'totalGroupMatches': len(matches), 'source': 'embedded schedule and venue coordinates'},
    'modelInputs': {'status': status(bool(model_inputs)), 'features': model_inputs.get('features', []) if model_inputs else []},
    'lineups': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'injuries': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'suspensions': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'referees': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'principle': 'Missing factors remain neutral; stale or conflicting factors must lower confidence rather than force precision.'
}
if stable(data.get('dataQuality')) != quality_core:
    now = utc_stamp()
    data['dataQuality'] = dict(quality_core, updatedAt=now)
    data['generatedAt'] = now
    data['sourceNote'] = 'Automated BASE_DATA update with score, form, rest/travel, weather, and data-quality enrichment. Companion UI shell is not rewritten.'
    save_data(html, start, end, data)
    changed = True
else:
    changed = False
print(json.dumps({'changed': changed, 'dataQuality': {k:v.get('status') for k,v in quality_core.items() if isinstance(v, dict) and 'status' in v}}, indent=2))
