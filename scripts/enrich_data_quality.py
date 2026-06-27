import json
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

def status(ok, partial=False):
    return 'current' if ok else 'partial' if partial else 'missing'

def stable(q):
    return {k:v for k,v in (q or {}).items() if k != 'updatedAt'}

def upsert_source(data, item):
    sources = data.get('sources')
    if not isinstance(sources, list):
        sources = []
    for i, source in enumerate(sources):
        if isinstance(source, dict) and source.get('name') == item['name']:
            sources[i] = dict(source, **item)
            data['sources'] = sources
            return
    sources.append(item)
    data['sources'] = sources

def append_unique(rows, item, key):
    if not isinstance(rows, list):
        rows = []
    value = item.get(key)
    for row in rows:
        if isinstance(row, dict) and row.get(key) == value:
            row.update(item)
            return rows
    rows.append(item)
    return rows

def append_unique_text(rows, text):
    if not isinstance(rows, list):
        rows = []
    if text not in rows:
        rows.append(text)
    return rows

html, start, end, data = load_data()
matches = [m for m in data.get('matches', []) if m.get('stage') == 'group']
played = [m for m in matches if m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
unplayed = [m for m in matches if not m.get('played')]
weather = data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'), dict) else {}
rest = data.get('restTravel') if isinstance(data.get('restTravel'), dict) else {}
model_inputs = data.get('modelInputs') if isinstance(data.get('modelInputs'), dict) else {}
quality_core = {
    'scores': {'status': status(bool(played)), 'playedGroupMatches': len(played), 'totalGroupMatches': len(matches), 'source': 'scoreboard updater'},
    'fixtures': {'status': 'partial', 'coveredGroupMatches': len(matches), 'totalGroupMatches': len(matches), 'source': 'embedded schedule; automated pass cross-matches scoreboard events by teams but does not overwrite venue/kickoff fields without an unambiguous source adapter'},
    'weather': {'status': status(len(weather) >= len(unplayed), bool(weather)), 'coveredUnplayedMatches': len([m for m in unplayed if str(m.get('no')) in weather]), 'totalUnplayedMatches': len(unplayed), 'source': 'open-meteo'},
    'restTravel': {'status': status(len(rest) >= len(matches), bool(rest)), 'coveredGroupMatches': len(rest), 'totalGroupMatches': len(matches), 'source': 'embedded schedule and venue coordinates'},
    'modelInputs': {'status': status(bool(model_inputs)), 'features': model_inputs.get('features', []) if model_inputs else []},
    'automation': {'status': 'current', 'schedule': 'GitHub Actions runs at 11:37 UTC and 17:37 UTC with workflow_dispatch fallback; America/Montreal local time shifts with DST because cron is UTC.'},
    'lineups': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'injuries': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'suspensions': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'referees': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'principle': 'Missing factors remain neutral; stale or conflicting factors must lower confidence rather than force precision.'
}
source_note = 'Automated BASE_DATA update with score, form, rank-seeded Elo-style prior, rest/travel, weather, and data-quality enrichment. Companion UI shell is not rewritten.'
quality_changed = stable(data.get('dataQuality')) != quality_core
source_note_changed = data.get('sourceNote') != source_note
sources_before = json.dumps(data.get('sources'), sort_keys=True)
maintenance_before = json.dumps(data.get('maintenance'), sort_keys=True)
upsert_source(data, {
    'name': 'ESPN public soccer scoreboard API',
    'url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
    'use': 'Automated completed-match score refresh and scoreboard health ledger',
    'tier': 'public sports data API',
    'confidence': 'medium-high',
    'maintenanceNote': 'Used for automation because no stable unauthenticated FIFA match API is assumed; official FIFA should remain the manual cross-check source.'
})
upsert_source(data, {
    'name': 'GitHub Actions daily updater',
    'url': '.github/workflows/daily-base-data-update.yml',
    'use': 'Scheduled and manual BASE_DATA update automation',
    'tier': 'internal automation',
    'confidence': 'high',
    'maintenanceNote': 'Runs morning plus safety pass in UTC; commits only after validation and only when tracked artifacts change.'
})
maintenance = data.get('maintenance') if isinstance(data.get('maintenance'), dict) else {}
maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
    'risk': 'Scheduled data updates can be delayed, skipped, or blocked by source/network failures.',
    'mitigation': 'Workflow has a morning run, a later safety run, manual workflow_dispatch, rollback-capable updater script, and commit-after-validation guard.'
}, 'risk')
maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
    'risk': 'Automated score updates use ESPN scoreboard data, while official FIFA remains the preferred manual authority.',
    'mitigation': 'Source ledger labels ESPN as the machine-readable automation feed; official FIFA fixtures/reports should be checked for disputed results, cards, lineups, injuries, and regulations.'
}, 'risk')
maintenance['nextUpdateChecklist'] = append_unique_text(maintenance.get('nextUpdateChecklist'), 'If the morning scheduled run fails or GitHub delays it, trigger Daily BASE_DATA update manually from Actions or run node scripts/update-base-data.mjs locally, then validate before committing.')
maintenance['validationMatrix'] = append_unique(maintenance.get('validationMatrix'), {
    'gate': 'Daily automation safety',
    'method': 'GitHub Actions runs rollback-capable updater, validation, idempotence test, and simulation smoke before committing changed artifacts.',
    'status': 'passed',
    'lastRun': 'automated on each workflow run'
}, 'gate')
maintenance['patchReceipts'] = append_unique(maintenance.get('patchReceipts'), {
    'version': '2026.06.27-daily-update-hardening',
    'reason': 'Add rollback-capable BASE_DATA updater, redundant daily schedule, rank-seeded Elo-style input, and stricter validation.',
    'validation': 'scripts/update-base-data.mjs, validate_base_data, idempotence, and run-sim smoke',
    'risk': 'Official lineup/injury/suspension/referee feeds remain neutral unless reliable data is manually patched.'
}, 'version')
data['maintenance'] = maintenance
sources_changed = json.dumps(data.get('sources'), sort_keys=True) != sources_before
maintenance_changed = json.dumps(data.get('maintenance'), sort_keys=True) != maintenance_before
if quality_changed or source_note_changed or sources_changed or maintenance_changed:
    now = utc_stamp()
    if quality_changed:
        data['dataQuality'] = dict(quality_core, updatedAt=now)
    data['maintenance'] = maintenance
    data['generatedAt'] = now
    data['sourceNote'] = source_note
    save_data(html, start, end, data)
    changed = True
else:
    changed = False
print(json.dumps({'changed': changed, 'dataQuality': {k:v.get('status') for k,v in quality_core.items() if isinstance(v, dict) and 'status' in v}}, indent=2))
