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
    'Transparency ledger',
    'Integrity audit',
    'Maintenance ledger',
    'const BASE_DATA = ',
    'upcoming fixtures show consensus outcome',
    'formatGroupMCPrediction',
    'formatKnockoutMCPrediction',
    'recordMonteCarloPredictions',
    'chooseMonteCarloRepresentativeRun',
    'representative',
    'Probability board, Run Result, Groups, and Bracket updated',
    'const APP_VERSION',
    'MODEL_DEFAULTS',
    'hydrateModelDisclosure',
    'ensembleBreakdown',
    'scorelineDistribution',
    'poissonBucketPmf',
    'dixonColesTau',
    'id="appVersion"',
    'id="dataVersion"',
    'id="lastDataUpdate"',
    'id="copyrightNotice"',
    'id="legalNotice"',
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
    '.bracketScroller{overflow-x:auto',
    'grid-template-columns:repeat(6,minmax(240px,1fr))',
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
    "cron: '37 7,8,9 11-30 6 *'",
    "cron: '37 7,8,9 1-20 7 *'",
    'python3 scripts/validate_base_data.py',
    'node --check "$f"',
    'node scripts/build-html.mjs',
    'node scripts/validate.mjs',
    'python3 scripts/apply_scoreboard.py',
    'python3 scripts/enrich_predictions.py',
    'python3 scripts/enrich_rest_travel.py',
    'python3 scripts/enrich_weather.py',
    'python3 scripts/enrich_data_quality.py',
    'python3 scripts/update_health.py',
    'node scripts/update-data.mjs --no-fetch',
    'python3 scripts/test_idempotence.py',
    'node scripts/run-sim.mjs',
    'data/update-health.json',
]
REQUIRED_GITIGNORE_ENTRIES = [
    'data/scoreboards/',
    'data/latest-simulation.json',
]
README_VERSION_MARKER = "shown in the deployed app's Maintenance view from embedded `BASE_DATA`"
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
        'scripts/apply_scoreboard.py',
        'scripts/enrich_predictions.py',
        'scripts/enrich_rest_travel.py',
        'scripts/enrich_weather.py',
        'scripts/enrich_data_quality.py',
        'scripts/update_health.py',
    ],
    'scripts/run-sim.mjs': [
        'documentStub',
        'addEventListener',
        'localStorageStub',
        'Initial page load did not run Monte Carlo predictions into Groups and Bracket views.',
        'Initial Monte Carlo representative did not inform Run Result, Groups, and Bracket views.',
        'Last data update footer was not rendered.',
        'Footer metadata did not render app version, data version, copyright, and legal notice.',
        'Last data update footer did not use the latest embedded timestamp.',
        'Ensemble model and low-score scoreline sampler were not active and disclosed.',
        'Monte Carlo loading state did not toggle accessibly.',
        'Monte Carlo controls were not locked during simulation.',
        'Monte Carlo summaries were not invalidated after data/control refresh.',
        'Run Result, Groups, and Bracket were not informed by the Monte Carlo representative run.',
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
        if m.get('played') and not (isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)): errors.append('played match without integer score %s' % no)
if not isinstance(knockout, list) or len(knockout) != 32:
    errors.append('expected 32 knockout matches')
if not isinstance(venues, dict) or not venues:
    errors.append('missing venues')
if not isinstance(data.get('sources'), list):
    errors.append('missing sources')
if not isinstance(data.get('maintenance'), dict):
    errors.append('missing maintenance ledger')
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
print(json.dumps({'ok': True, 'teams': len(teams), 'groupMatches': 72, 'knockoutMatches': len(knockout), 'workflowGuarded': True, 'singleInputGuarded': True}, indent=2))
