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

def has_full_kickoff(match):
    for field in ('kickoffUtc', 'kickoff', 'kickoffLocal', 'date', 'utc', 'time'):
        value = match.get(field)
        if value and 'T' in str(value):
            return True
    return False

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

def prune_sources(data, names):
    sources = data.get('sources')
    if not isinstance(sources, list):
        return False
    blocked = set(names)
    kept = [source for source in sources if not (isinstance(source, dict) and source.get('name') in blocked)]
    if len(kept) != len(sources):
        data['sources'] = kept
        return True
    return False

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
knockout = data.get('knockout', []) if isinstance(data.get('knockout'), list) else []
all_match_rows = matches + knockout
played = [m for m in all_match_rows if m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
played_group = [m for m in matches if m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
played_knockout = [m for m in knockout if m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
unplayed = [m for m in all_match_rows if not m.get('played')]
tournament_complete = len(all_match_rows) == 104 and len(played) == 104 and not unplayed
weather = data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'), dict) else {}
rest = data.get('restTravel') if isinstance(data.get('restTravel'), dict) else {}
model_inputs = data.get('modelInputs') if isinstance(data.get('modelInputs'), dict) else {}
kickoff_rows = [m for m in all_match_rows if has_full_kickoff(m)]
kickoff_group = [m for m in matches if has_full_kickoff(m)]
kickoff_knockout = [m for m in knockout if has_full_kickoff(m)]
automation_schedule = (
    'Tournament cron schedules were retired after 104/104 source-backed finals. Daily and match-window workflows remain available through workflow_dispatch for reproducible source-backed corrections; workflow-run recovery and the local WC_DATA_RESCUE path remain guarded and manual.'
    if tournament_complete else
    'GitHub Actions runs at 11:37 UTC and 17:37 UTC plus match-window checks every 30 minutes during June/July UTC days. The match-window script no-ops unless near a kickoff slot, a normal post-match slot, or the bounded stale-result recovery window for unplayed matches; it refuses full updates during active-match windows and permits freeze-only pre-kickoff records for later matches. America/Montreal local time shifts with DST because cron is UTC. If Actions is unavailable, WC_DATA_RESCUE runs the same guarded local update path through scripts/manual-update-trigger.mjs.'
)
match_window_source = (
    'scripts/match-window-update.mjs retained for workflow_dispatch reproduction and source-backed corrections; its former tournament cron schedule is retired'
    if tournament_complete else
    'scripts/match-window-update.mjs with active-match lock, freeze-only overlap path, pre/post kickoff slots, and bounded stale-result recovery'
)
quality_core = {
    'scores': {'status': status(bool(played)), 'playedMatches': len(played), 'totalMatches': len(all_match_rows), 'playedGroupMatches': len(played_group), 'totalGroupMatches': len(matches), 'playedKnockoutMatches': len(played_knockout), 'totalKnockoutMatches': len(knockout), 'source': 'scoreboard updater'},
    'fixtures': {'status': status(len(kickoff_rows) == len(all_match_rows), bool(kickoff_rows)), 'coveredMatches': len(kickoff_rows), 'totalMatches': len(all_match_rows), 'coveredGroupMatches': len(kickoff_group), 'totalGroupMatches': len(matches), 'coveredKnockoutMatches': len(kickoff_knockout), 'totalKnockoutMatches': len(knockout), 'source': 'embedded schedule plus ESPN scoreboard event timestamps; automated pass cross-matches scoreboard events by teams or date/venue and fills missing kickoffUtc timestamps without overwriting existing venue fields'},
    'weather': {'status': status(len(weather) >= len(unplayed), bool(weather)), 'coveredUnplayedMatches': len([m for m in unplayed if str(m.get('no')) in weather]), 'totalUnplayedMatches': len(unplayed), 'source': 'open-meteo'},
    'restTravel': {'status': status(len(rest) >= len(all_match_rows), bool(rest)), 'coveredMatches': len(rest), 'totalMatches': len(all_match_rows), 'coveredGroupMatches': len([m for m in matches if str(m.get('no')) in rest]), 'totalGroupMatches': len(matches), 'coveredKnockoutMatches': len([m for m in knockout if str(m.get('no')) in rest]), 'totalKnockoutMatches': len(knockout), 'source': 'embedded schedule and venue coordinates'},
    'modelInputs': {'status': status(bool(model_inputs)), 'features': model_inputs.get('features', []) if model_inputs else []},
    'awardProjections': {'status': 'partial', 'source': 'simulator-side projections from embedded team/star assumptions and Monte Carlo progression; official player award feeds are not configured'},
    'automation': {'status': 'current', 'schedule': automation_schedule},
    'matchWindowAutomation': {'status': 'current', 'source': match_window_source},
    'lineups': {'status': 'neutral_unless_verified', 'reason': 'no reliable automated official lineup adapter configured; source-backed availability fields are applied only when verified data is patched'},
    'injuries': {'status': 'missing', 'reason': 'no reliable automated source configured'},
    'suspensions': {'status': 'neutral_unless_verified', 'reason': 'no reliable automated official discipline adapter configured; confirmed suspensions can be applied from source-backed availability fields'},
    'goalkeepers': {'status': 'neutral_unless_verified', 'reason': 'starting goalkeeper changes are applied only from verified lineup/availability patches'},
    'referees': {'status': 'missing', 'reason': 'no reliable automated source configured; referee effects remain neutral to avoid overfitting'},
    'principle': 'Missing factors remain neutral; stale or conflicting factors must lower confidence rather than force precision.'
}
source_note = (
    'Final 104-match source-backed tournament snapshot with immutable prediction audit, comparative scoring, raw-only calibration rollback, and manual-only guarded update paths.'
    if tournament_complete else
    'Automated BASE_DATA update with score, form, rank-seeded Elo-style prior, rest/travel, weather, and data-quality enrichment. Companion UI shell is not rewritten.'
)
quality_changed = stable(data.get('dataQuality')) != quality_core
source_note_changed = data.get('sourceNote') != source_note
sources_before = json.dumps(data.get('sources'), sort_keys=True)
maintenance_before = json.dumps(data.get('maintenance'), sort_keys=True)
pruned_sources = prune_sources(data, {'FIFA Peace Prize - Football Unites the World'})
upsert_source(data, {
    'name': 'ESPN public soccer scoreboard API',
    'url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
    'use': 'Automated completed-match score refresh, matched kickoff timestamp fill, and scoreboard health ledger',
    'tier': 'public sports data API',
    'confidence': 'medium-high',
    'maintenanceNote': 'Used for automation because no stable unauthenticated FIFA match API is assumed; official FIFA should remain the manual cross-check source.'
})
upsert_source(data, {
    'name': 'GitHub Actions match-window updater',
    'url': '.github/workflows/match-window-data-update.yml',
    'use': 'Manual reproduction of the guarded pre-kickoff and post-match update path after tournament completion' if tournament_complete else 'Pre-kickoff freeze/refresh and post-match score/calibration checks near scheduled match windows',
    'tier': 'internal automation',
    'confidence': 'high',
    'maintenanceNote': 'Cron schedule retired after 104/104; workflow_dispatch and workflow-run recovery remain for reproducible source-backed corrections.' if tournament_complete else 'Runs every 30 minutes during June/July UTC days; scripts/match-window-update.mjs no-ops outside slots/recovery windows, refuses full active-match updates, retries stale unplayed results for a bounded window, and can freeze later pre-kickoff predictions during overlap.'
})
upsert_source(data, {
    'name': 'Source-backed availability hooks',
    'url': 'embedded BASE_DATA match availability fields',
    'use': 'Confirmed lineups, goalkeeper changes, suspensions, and key absences can affect context only when verified source metadata is present',
    'tier': 'internal model guardrail',
    'confidence': 'medium',
    'maintenanceNote': 'No rumor feed is used; unavailable or unverified availability data remains neutral.'
})
upsert_source(data, {
    'name': 'GitHub Actions daily updater',
    'url': '.github/workflows/daily-base-data-update.yml',
    'use': 'Manual BASE_DATA reproduction and source-backed correction workflow' if tournament_complete else 'Scheduled and manual BASE_DATA update automation',
    'tier': 'internal automation',
    'confidence': 'high',
    'maintenanceNote': 'Cron schedule retired after 104/104; workflow_dispatch remains and publishes only validated tracked changes.' if tournament_complete else 'Runs morning plus safety pass in UTC; commits only after validation and only when tracked artifacts change.'
})
upsert_source(data, {
    'name': 'Local rescue update trigger',
    'url': 'scripts/manual-update-trigger.mjs',
    'use': 'Operator-triggered fallback when GitHub Actions is unavailable',
    'tier': 'internal automation',
    'confidence': 'high',
    'maintenanceNote': 'Requires exact trigger WC_DATA_RESCUE, refuses dirty candidate artifacts, restores candidate files on validation failure, and commits only when explicitly requested.'
})
maintenance = data.get('maintenance') if isinstance(data.get('maintenance'), dict) else {}
if tournament_complete:
    retired_risks = {
        'Scheduled data updates can be delayed, skipped, or blocked by source/network failures.',
        'Active in-progress matches must not mutate predictions from partial scores or weather/context refreshes.'
    }
    maintenance['knownRisks'] = [row for row in maintenance.get('knownRisks', []) if not (isinstance(row, dict) and row.get('risk') in retired_risks)]
    maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
        'risk': 'Post-tournament source corrections are intentionally manual and may not appear until an operator runs the guarded workflow.',
        'mitigation': 'workflow_dispatch, workflow-run publication recovery, WC_DATA_RESCUE, immutable audit reconciliation, validation, and exact-commit Pages deployment remain available.'
    }, 'risk')
else:
    maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
        'risk': 'Scheduled data updates can be delayed, skipped, or blocked by source/network failures.',
        'mitigation': 'Workflow has a morning run, a later safety run, manual workflow_dispatch, rollback-capable updater script, local WC_DATA_RESCUE trigger, and commit-after-validation guard.'
    }, 'risk')
maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
    'risk': 'Automated score updates use ESPN scoreboard data, while official FIFA remains the preferred manual authority.',
    'mitigation': 'Source ledger labels ESPN as the machine-readable automation feed; official FIFA fixtures/reports should be checked for disputed results, cards, lineups, injuries, and regulations.'
}, 'risk')
maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
    'risk': 'Official tournament award and player leader feeds are incomplete or not configured.',
    'mitigation': 'Stats displays separate actual top-scorer snapshots from model-side award projections; player-age, goalkeeper, and discipline gaps are marked neutral instead of invented.'
}, 'risk')
maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
    'risk': 'Any manual replay of an active-match window must not mutate predictions from partial scores or weather/context refreshes.',
    'mitigation': 'The retained match-window path refuses full updates during the active-match lock, permits only freeze-only later-match records during overlap, and the scoreboard applicator only accepts completed/final events.'
}, 'risk')
maintenance['knownRisks'] = append_unique(maintenance.get('knownRisks'), {
    'risk': 'Confirmed lineup, goalkeeper, suspension, and injury inputs are high-value but source availability is inconsistent.',
    'mitigation': 'Availability hooks are neutral unless verified source metadata is present; expected lineup rumors and referee bias assumptions are not automated.'
}, 'risk')
if tournament_complete:
    maintenance['nextUpdateChecklist'] = [
        'Run a manual update only for a documented source-backed correction; never rewrite immutable frozen forecasts or refit calibration on final outcomes.',
        'Use workflow_dispatch or WC_DATA_RESCUE, reconcile both audit branches, and require validation plus exact-commit Pages deployment before publication.',
        'Regenerate health, comparative, calibration, and backtest receipts and keep permanent source gaps neutral and visible.'
    ]
else:
    maintenance['nextUpdateChecklist'] = append_unique_text(maintenance.get('nextUpdateChecklist'), 'If the morning scheduled run fails or GitHub delays it, trigger Daily BASE_DATA update manually from Actions or run node scripts/update-base-data.mjs locally, then validate before committing.')
    maintenance['nextUpdateChecklist'] = append_unique_text(maintenance.get('nextUpdateChecklist'), 'If GitHub Actions itself is unavailable, provide trigger WC_DATA_RESCUE and run node scripts/manual-update-trigger.mjs --trigger WC_DATA_RESCUE locally; add --commit or --push only after validation is intended.')
    maintenance['nextUpdateChecklist'] = append_unique_text(maintenance.get('nextUpdateChecklist'), 'Before kickoff, rely on match-window automation to refresh/freeze predictions; during the active-match lock, only freeze later pre-kickoff matches and avoid mutating the active match until final status is available.')
maintenance['validationMatrix'] = append_unique(maintenance.get('validationMatrix'), {
    'gate': 'Daily automation safety',
    'method': 'Manual workflow_dispatch runs the rollback-capable updater, validation, idempotence test, and simulation smoke before publishing changed artifacts.' if tournament_complete else 'GitHub Actions runs rollback-capable updater, validation, idempotence test, and simulation smoke before committing changed artifacts.',
    'status': 'passed',
    'lastRun': 'validated on each manual workflow run' if tournament_complete else 'automated on each workflow run'
}, 'gate')
maintenance['validationMatrix'] = append_unique(maintenance.get('validationMatrix'), {
    'gate': 'Match-window automation safety',
    'method': 'Former scheduled behavior remains reproducible through workflow_dispatch; tests cover pre-kickoff, post-match, delayed recovery, outside-window no-op, and active-match lock behavior.' if tournament_complete else 'tests/match-window-update.test.mjs verifies pre-kickoff slots, post-match slots, delayed stale-result recovery, outside-window no-op, and active-match lock behavior.',
    'status': 'passed',
    'lastRun': 'node tests/run-all.mjs'
}, 'gate')
maintenance['patchReceipts'] = append_unique(maintenance.get('patchReceipts'), {
    'version': '2026.06.27-daily-update-hardening',
    'reason': 'Add rollback-capable BASE_DATA updater, redundant daily schedule, rank-seeded Elo-style input, and stricter validation.',
    'validation': 'scripts/update-base-data.mjs, validate_base_data, idempotence, and run-sim smoke',
    'risk': 'Official lineup/injury/suspension/referee feeds remain neutral unless reliable data is manually patched.'
}, 'version')
if tournament_complete:
    maintenance['patchReceipts'] = append_unique(maintenance.get('patchReceipts'), {
        'version': '2026.07.20-post-tournament-closure',
        'reason': 'Freeze the final 104-match public snapshot, retain raw-only calibration rollback, and retire tournament cron schedules while preserving manual reproducibility.',
        'validation': 'full QA, immutable audit reconciliation, comparative/calibration/backtest checks, repository ZIP inspection, GitHub checks, and live Pages verification',
        'risk': 'Source gaps and accessibility limits remain disclosed; future corrections require an intentional guarded manual run.'
    }, 'version')
maintenance['patchReceipts'] = append_unique(maintenance.get('patchReceipts'), {
    'version': '2026.06.27-match-window-prediction-inputs',
    'reason': 'Add match-window update automation, active-match lock, final group-table incentive input, and source-backed availability hooks.',
    'validation': 'tests/match-window-update.test.mjs, run-sim smoke, validate_base_data, and calibration validation',
    'risk': 'Lineup, injury, suspension, goalkeeper, and referee data remain neutral unless verified source metadata is available.'
}, 'version')
maintenance['patchReceipts'] = append_unique(maintenance.get('patchReceipts'), {
    'version': '2026.06.27-manual-rescue-trigger',
    'reason': 'Add an exact-word local rescue updater for cases where scheduled and manual GitHub Actions updates are unavailable.',
    'validation': 'scripts/manual-update-trigger.mjs, tests/manual-update-trigger.test.mjs, validate_base_data, idempotence, and run-sim smoke',
    'risk': 'Rescue mode still depends on public source availability for fresh score/weather fetches; unavailable sources remain neutral or cached.'
}, 'version')
maintenance['patchReceipts'] = append_unique(maintenance.get('patchReceipts'), {
    'version': '2026.06.27-award-projections',
    'reason': 'Explain empty official top-scorer snapshots and add transparent simulator-side award projections.',
    'validation': 'renderStats award projection smoke, validate_base_data, idempotence, and run-sim smoke',
    'risk': 'Golden Ball/Boot/Glove/coach projections use team progression and embedded star assumptions only; official player award feeds remain unavailable.'
}, 'version')
data['maintenance'] = maintenance
sources_changed = pruned_sources or json.dumps(data.get('sources'), sort_keys=True) != sources_before
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
