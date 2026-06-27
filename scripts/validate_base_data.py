import json, os, re, sys

HTML = 'docs/index.html'
README = 'README.md'
WORKFLOW = '.github/workflows/daily-base-data-update.yml'
GITIGNORE = '.gitignore'
REQUIRED_UI = [
    '<title>FIFA World Cup 2026 \u2014 Whole Tournament Simulator</title>',
    'Whole Tournament Simulator',
    'data-tab="groups"',
    'data-tab="bracket"',
    'data-tab="prob"',
    'data-tab="stats"',
    'How predictions work',
    'Technical checks',
    'Data health',
    'const BASE_DATA = ',
    'predicted upcoming scores',
    'formatGroupMCPrediction',
    'formatKnockoutMCPrediction',
    'recordMonteCarloPredictions',
    'chooseMonteCarloRepresentativeRun',
    'representative',
    'Predictions complete. Favorites, sample path, Groups, and Bracket updated.',
    'const APP_VERSION',
    'MODEL_DEFAULTS',
    'hydrateModelDisclosure',
    'ensembleBreakdown',
    'scorelineDistribution',
    'poissonBucketPmf',
    'dixonColesTau',
    'calibrationStatusText',
    'calibrationAdjustedGroupOutcome',
    'frozen-prediction bucket adjustment',
    'id="appVersion"',
    'id="dataVersion"',
    'id="lastDataUpdate"',
    'id="copyrightNotice"',
    'id="legalNotice"',
    'id="todayView"',
    'function todayMatches',
    'function renderTodayMatches',
    'function matchTimeLabel',
    'timeZoneName',
    'todayMatch',
    'function scheduleSnapshot',
    'Schedule progress',
    'Award projections',
    'Golden Boot',
    'Silver Boot',
    'Bronze Boot',
    'Golden Ball',
    'Silver Ball',
    'Bronze Ball',
    'Golden Glove',
    'Best Young Player',
    'Goal of the Tournament',
    'FIFA Fair Play Trophy',
    'FIFA Peace Prize - Football Unites the World',
    'function awardProjectionRows',
    'function renderAwardProjectionTable',
    'Matches left',
    'Calendar days to final',
    'Last data update:',
    'Unofficial project; not affiliated with FIFA.',
    'function runMCCoreAsync',
    'function bootstrapApp',
    'function setMonteCarloControlsDisabled',
    'opts:activeOpts()',
    'pairingWinners',
    'matchup appears',
    "MC=null; renderSummary()",
    'aria-busy',
    'statusLine.isBusy',
]
REQUIRED_INPUT_UI = [
    'class="skip"',
    'role="tablist"',
    'aria-label="Main sections"',
    'role="status"',
    'aria-live="polite"',
    ':focus-visible',
    'button,input,select{min-height:44px}',
    'setupA11y();',
    'activateSectionTarget',
]
REQUIRED_BRACKET_UI = [
    '.bracketScroller{overflow:visible',
    '@media (max-width:1480px) and (min-width:1001px)',
    'grid-template-columns:repeat(3,minmax(0,1fr))',
    'grid-template-columns:auto minmax(0,1fr)',
    'grid-template-columns:minmax(0,1fr) auto',
    'position:static;top:auto;z-index:2',
    'text-overflow:ellipsis',
    'venueText',
    'teamText',
    'title="${venue}"',
    'title="${teamA}"',
]
REQUIRED_WORKFLOW_STEPS = [
    "on:\n  workflow_dispatch:\n  schedule:",
    "cron: '37 11 * * *'",
    "cron: '37 17 * * *'",
    'actions/setup-node@v4',
    'python3 -m py_compile scripts/*.py',
    'node --check "$f"',
    'node scripts/update-base-data.mjs',
    'python3 scripts/test_idempotence.py',
    'node scripts/validate-calibration.mjs',
    'node tests/run-all.mjs',
    'node scripts/run-sim.mjs',
    'python3 scripts/validate_base_data.py',
    'git diff --quiet -- docs/index.html data/latest-update.json data/update-health.json data/prediction-audit.json data/calibration-state.json',
    'concurrency:',
    'git add -A -- docs/index.html data/latest-update.json data/update-health.json data/prediction-audit.json data/calibration-state.json',
    'data/update-health.json',
    'data/prediction-audit.json',
    'data/calibration-state.json',
]
REQUIRED_GITIGNORE_ENTRIES = [
    'data/scoreboards/',
    'data/latest-simulation.json',
]
README_VERSION_MARKER = "shown in the deployed app's Data health view from embedded `BASE_DATA`"
README_MANUAL_TRIGGER_MARKER = 'WC_DATA_RESCUE'
REQUIRED_SCRIPT_MARKERS = {
    'scripts/automation_utils.py': [
        'def utc_stamp():',
        'datetime.timezone.utc',
        ".replace('+00:00', 'Z')",
    ],
    'scripts/apply_scoreboard.py': [
        'from automation_utils import utc_stamp',
        "NO_FETCH = '--no-fetch' in sys.argv",
        'if not NO_FETCH and (applied or FETCH_FAILURES):',
        "'fetchFailures': FETCH_FAILURES",
        "'path': path",
        'def latest_played_day(matches):',
        'def refresh_current_stats(current, played, goals, updated_to, stamp):',
        "'attendanceSource'",
        "'topScorersSource'",
        'scoreboard file invalid shape',
        'isinstance(events, list)',
        "status = ev.get('status') if isinstance(ev.get('status'), dict) else {}",
        "typ = status.get('type') if isinstance(status.get('type'), dict) else {}",
        'data/latest-update.json',
    ],
    'scripts/update_health.py': [
        'from automation_utils import utc_stamp',
        'data/latest-update.json',
        'data/prediction-audit.json',
        'data/calibration-state.json',
        "'predictionAudit'",
        "'latestUpdate':latest",
    ],
    'scripts/test_idempotence.py': ['scripts/test_deterministic.py'],
    'scripts/test_deterministic.py': [
        "scripts/apply_scoreboard.py','--no-fetch",
        'scripts/enrich_predictions.py',
        'scripts/enrich_rest_travel.py',
        "scripts/enrich_weather.py','--no-fetch",
        'scripts/enrich_data_quality.py',
        'scripts/update_health.py',
        'before!=after or after!=final',
    ],
    'scripts/node-python.mjs': [
        'const PYTHON_CANDIDATES',
        'export function runPythonScript',
    ],
    'scripts/build-html.mjs': [
        "import { readArtifact } from './base-data.mjs'",
        'groupMatches',
        'knockoutMatches',
    ],
    'scripts/validate.mjs': [
        "import { runPythonScript } from './node-python.mjs'",
        'scripts/validate_base_data.py',
    ],
    'scripts/update-data.mjs': [
        'scripts/update-base-data.mjs',
        'Compatibility wrapper',
        'spawnSync',
    ],
    'scripts/update-base-data.mjs': [
        'COMMIT_CANDIDATES',
        'function snapshot',
        'function restore',
        'scripts/freeze-predictions.mjs',
        'scripts/apply_scoreboard.py',
        'scripts/enrich_predictions.py',
        'scripts/enrich_rest_travel.py',
        'scripts/enrich_weather.py',
        'scripts/enrich_data_quality.py',
        'scripts/score-predictions.mjs',
        'scripts/update-calibration.mjs',
        'scripts/update_health.py',
        'scripts/validate-calibration.mjs',
        'scripts/build-html.mjs',
        'scripts/validate.mjs',
    ],
    'scripts/manual-update-trigger.mjs': [
        'MANUAL_UPDATE_TRIGGER',
        'WC_DATA_RESCUE',
        'COMMIT_CANDIDATES',
        'assertCandidateFilesClean',
        'scripts/update-base-data.mjs',
        'scripts/test_idempotence.py',
        'scripts/validate-calibration.mjs',
        'tests/run-all.mjs',
        'scripts/run-sim.mjs',
        'Manual World Cup BASE_DATA update',
    ],
    'scripts/prediction-audit-lib.mjs': [
        'REQUIRED_LEDGER_FIELDS',
        'MIN_RESOLVED_PREDICTIONS',
        'createPredictionRecord',
        'scorePrediction',
        'updateCalibrationState',
        'applyCalibrationToWdl',
        'calibrationEligiblePredictions',
        'validateNoMarketFields',
    ],
    'scripts/freeze-predictions.mjs': [
        'createPredictionRecord',
        'scorelineDistribution',
        'expectedGoals',
        'appendFrozenPrediction',
    ],
    'scripts/score-predictions.mjs': [
        'scoreLedger',
        'data/prediction-audit.json',
    ],
    'scripts/update-calibration.mjs': [
        'updateCalibrationState',
        'publicCalibrationState',
        'writeArtifact',
        'data/calibration-state.json',
    ],
    'scripts/validate-calibration.mjs': [
        'REQUIRED_LEDGER_FIELDS',
        'MIN_RESOLVED_PREDICTIONS',
        'calibration_status',
        'Brier',
        'log loss',
    ],
    'tests/run-all.mjs': [
        'prediction-audit.test.mjs',
        'scoring.test.mjs',
        'calibration.test.mjs',
        'no-leakage.test.mjs',
        'manual-update-trigger.test.mjs',
    ],
    'scripts/run-sim.mjs': [
        'documentStub',
        'addEventListener',
        'localStorageStub',
        'Initial page load did not run Monte Carlo predictions into Groups and Bracket views.',
        'Initial Monte Carlo representative did not inform the sample path, Groups, and Bracket views.',
        'Last data update footer was not rendered.',
        'Footer metadata did not render app version, data version, copyright, and legal notice.',
        'Last data update footer did not use the latest embedded timestamp.',
        'Today match highlighting did not classify and render schedule dates correctly.',
        'Tournament snapshot schedule progress did not render expected remaining-match fields.',
        'Ensemble model and low-score scoreline sampler were not active and disclosed.',
        'Prediction-audit calibration status was not disclosed or failed closed.',
        'Rank-seeded Elo prior',
        'Monte Carlo loading state did not toggle accessibly.',
        'Monte Carlo controls were not locked during simulation.',
        'Monte Carlo summaries were not invalidated after data/control refresh.',
        'Sample path, Groups, and Bracket were not informed by the Monte Carlo representative run.',
        'Displayed bracket Monte Carlo prediction did not match displayed teams.',
    ],
    'scripts/base-data.mjs': [
        r'/;\r?\nconst BLOCKED_PATCH_KEYS/',
        'JSON.parse(html.slice(from,end))',
    ],
}

def fail(msg):
    print('VALIDATION FAILED:', msg)
    raise SystemExit(1)

html = open(HTML, encoding='utf-8').read()
for marker in REQUIRED_UI:
    if marker not in html:
        fail('missing UI/data marker: %s' % marker)
for marker in REQUIRED_INPUT_UI:
    if marker not in html:
        fail('missing single-input UI marker: %s' % marker)
for marker in REQUIRED_BRACKET_UI:
    if marker not in html:
        fail('missing bracket no-overlap marker: %s' % marker)
if '<title>World Cup 2026 Simulator</title>' in html and 'Whole Tournament Simulator' not in html[:1000]:
    fail('compact shell regression detected')
if os.path.exists(WORKFLOW):
    workflow = open(WORKFLOW, encoding='utf-8').read()
    for marker in REQUIRED_WORKFLOW_STEPS:
        if marker not in workflow:
            fail('missing workflow automation marker: %s' % marker)
else:
    fail('missing daily BASE_DATA workflow')
if os.path.exists(GITIGNORE):
    gitignore = open(GITIGNORE, encoding='utf-8').read().splitlines()
    for entry in REQUIRED_GITIGNORE_ENTRIES:
        if entry not in gitignore:
            fail('missing generated-artifact ignore marker: %s' % entry)
else:
    fail('missing generated-artifact ignore file')
if os.path.exists(README):
    readme = open(README, encoding='utf-8').read()
    if README_VERSION_MARKER not in readme:
        fail('README must point readers to embedded BASE_DATA version instead of duplicating it')
    if README_MANUAL_TRIGGER_MARKER not in readme:
        fail('README must document the emergency manual update trigger')
    if '2026.06.25-patch-32-nav-fit-polish' in readme:
        fail('README contains stale hard-coded patch version')
else:
    fail('missing README')
for path, markers in REQUIRED_SCRIPT_MARKERS.items():
    if not os.path.exists(path):
        fail('missing automation guard script: %s' % path)
    body = open(path, encoding='utf-8').read()
    for marker in markers:
        if marker not in body:
            fail('missing automation guard marker in %s: %s' % (path, marker))
deprecated = 'utc' + 'now'
for root, _, files in os.walk('scripts'):
    for name in files:
        if not name.endswith('.py'):
            continue
        path = os.path.join(root, name)
        body = open(path, encoding='utf-8').read()
        if 'datetime.datetime.' + deprecated in body or '.' + deprecated + '(' in body:
            fail('deprecated naive UTC timestamp helper in %s' % path)
utc_helpers = []
for root, _, files in os.walk('scripts'):
    for name in files:
        if not name.endswith('.py'):
            continue
        path = os.path.join(root, name)
        if re.search(r'^def\s+utc_stamp\s*\(', open(path, encoding='utf-8').read(), re.M):
            utc_helpers.append(path.replace('\\', '/'))
if utc_helpers != ['scripts/automation_utils.py']:
    fail('utc_stamp helper must stay centralized in scripts/automation_utils.py')
for root, _, files in os.walk('scripts'):
    for name in files:
        if not name.endswith('.mjs'):
            continue
        path = os.path.join(root, name)
        body = open(path, encoding='utf-8').read()
        if 'const M=' in body or 'const T=' in body or 'const SRC' in body:
            fail('legacy compact artifact marker in %s' % path)
start = html.index('const BASE_DATA = ') + len('const BASE_DATA = ')
end = html.index(';\nconst BLOCKED_PATCH_KEYS', start)
data = json.loads(html[start:end])
errors = []
teams = data.get('teams')
matches = data.get('matches')
knockout = data.get('knockout')
venues = data.get('venues')
if not isinstance(teams, list) or len(teams) != 48:
    errors.append('expected 48 teams')
else:
    names = [t.get('name') for t in teams]
    if len(set(names)) != 48 or any(not n for n in names): errors.append('team names not unique/complete')
    ids = [t.get('id') for t in teams]
    if len(set(ids)) != 48 or any(not i for i in ids): errors.append('team ids not unique/complete')
    groups = {g:0 for g in 'ABCDEFGHIJKL'}
    for t in teams:
        groups[t.get('group')] = groups.get(t.get('group'), 0) + 1
    for g in 'ABCDEFGHIJKL':
        if groups.get(g) != 4: errors.append('group %s team count %s' % (g, groups.get(g)))
team_names = set(t.get('name') for t in teams or [])
if not isinstance(matches, list) or len([m for m in matches if m.get('stage') == 'group']) != 72:
    errors.append('expected 72 group matches')
else:
    seen = set()
    for m in matches:
        if m.get('stage') != 'group': continue
        no = m.get('no')
        if no in seen: errors.append('duplicate group match no %s' % no)
        seen.add(no)
        if m.get('teamA') not in team_names or m.get('teamB') not in team_names: errors.append('bad team reference on match %s' % no)
        if m.get('teamA') == m.get('teamB'): errors.append('same-team match %s' % no)
        score_a, score_b = m.get('scoreA'), m.get('scoreB')
        if m.get('played') and not (isinstance(score_a, int) and isinstance(score_b, int)): errors.append('played match without integer score %s' % no)
        if m.get('played') and isinstance(score_a, int) and isinstance(score_b, int):
            if score_a < 0 or score_b < 0 or score_a > 15 or score_b > 15:
                errors.append('played match has out-of-range score %s' % no)
        if not m.get('played') and (score_a is not None or score_b is not None):
            errors.append('unplayed match carries fake score %s' % no)
if not isinstance(knockout, list) or len(knockout) != 32:
    errors.append('expected 32 knockout matches')
else:
    knockout_seen = set()
    for m in knockout:
        no = m.get('no') if isinstance(m, dict) else None
        if no in knockout_seen: errors.append('duplicate knockout match no %s' % no)
        knockout_seen.add(no)
if isinstance(matches, list) and isinstance(knockout, list) and len(matches) + len(knockout) != 104:
    errors.append('expected 104 total matches')
if isinstance(matches, list) and isinstance(knockout, list):
    all_nos = [m.get('no') for m in matches + knockout if isinstance(m, dict)]
    if len(all_nos) != len(set(all_nos)):
        errors.append('duplicate match number across group/knockout matches')
if not isinstance(venues, dict) or not venues:
    errors.append('missing venues')
if not isinstance(data.get('sources'), list):
    errors.append('missing sources')
if not isinstance(data.get('maintenance'), dict):
    errors.append('missing maintenance ledger')
calibration = data.get('calibration')
if not isinstance(calibration, dict):
    errors.append('missing embedded calibration state')
else:
    if calibration.get('calibration_status') not in ('insufficient_sample', 'active', 'validation_worsened_rollback'):
        errors.append('invalid calibration status')
    if calibration.get('resolved_predictions', 0) < 30 and calibration.get('calibration_status') != 'insufficient_sample':
        errors.append('calibration must fail closed below minimum sample')
if not isinstance(data.get('modelInputs'), dict) or 'rank-seeded Elo-style rating' not in data.get('modelInputs', {}).get('features', []):
    errors.append('missing rank-seeded Elo-style model input disclosure')
for t in teams or []:
    if 'eloRating' in t:
        try:
            rating = float(t.get('eloRating'))
        except Exception:
            errors.append('non-finite eloRating for %s' % t.get('name'))
            continue
        if not (800 <= rating <= 2400):
            errors.append('out-of-range eloRating for %s' % t.get('name'))
current_stats = data.get('currentStats') if isinstance(data.get('currentStats'), dict) else {}
played_matches = [m for m in matches or [] if m.get('stage') == 'group' and m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
played_goals = sum(m.get('scoreA', 0) + m.get('scoreB', 0) for m in played_matches)
if current_stats:
    if current_stats.get('matchesPlayed') != len(played_matches):
        errors.append('currentStats matchesPlayed does not match embedded played matches')
    if current_stats.get('goalsScored') != played_goals:
        errors.append('currentStats goalsScored does not match embedded played scores')
    source = str(current_stats.get('source', ''))
    if 'all statistics correct as of June 24' in source and current_stats.get('updatedTo') != '2026-06-24':
        errors.append('currentStats source overclaims an older complete snapshot')
    if 'ESPN scoreboard updater refreshed' in source:
        if current_stats.get('attendance') is not None or current_stats.get('attendancePerMatch') is not None:
            errors.append('scoreboard-refreshed currentStats must not retain stale attendance totals')
        if current_stats.get('topScorers'):
            errors.append('scoreboard-refreshed currentStats must not retain stale top-scorer rows')
weather_by_match = data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'), dict) else {}
if weather_by_match:
    played_weather = sorted(
        str(m.get('no')) for m in played_matches
        if str(m.get('no')) in weather_by_match
    )
    if played_weather:
        errors.append('weatherByMatch retains completed match rows: %s' % ', '.join(played_weather[:12]))
if errors:
    fail('; '.join(errors[:12]))
for path in ('data/prediction-audit.json', 'data/calibration-state.json'):
    if not os.path.exists(path):
        fail('missing prediction audit artifact: %s' % path)
    try:
        artifact = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        fail('unreadable prediction audit artifact %s: %s' % (path, e))
    if not isinstance(artifact, dict) or artifact.get('schema') != 1:
        fail('invalid prediction audit artifact schema: %s' % path)
print(json.dumps({'ok': True, 'teams': len(teams), 'groupMatches': 72, 'knockoutMatches': len(knockout), 'workflowGuarded': True, 'singleInputGuarded': True}, indent=2))
