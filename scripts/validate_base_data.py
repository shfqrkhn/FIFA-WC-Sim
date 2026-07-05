import json, math, os, re, sys

HTML = 'docs/index.html'
README = 'README.md'
PRIVATE_HANDOFF = 'OMNI_HANDOVER.md'
WORKFLOW = '.github/workflows/daily-base-data-update.yml'
MATCH_WINDOW_WORKFLOW = '.github/workflows/match-window-data-update.yml'
BASE_DATA_PR_CHECK_WORKFLOW = '.github/workflows/base-data-pr-check.yml'
SECURITY_WORKFLOW = '.github/workflows/security-check.yml'
UI_SMOKE_WORKFLOW = '.github/workflows/ui-smoke.yml'
GITIGNORE = '.gitignore'
PACKAGE = 'package.json'
PACKAGE_LOCK = 'package-lock.json'
REQUIRED_UI = [
    '<title>FIFA World Cup 2026 \u2014 Whole Tournament Simulator</title>',
    'Whole Tournament Simulator',
    'data-tab="groups"',
    'data-tab="bracket"',
    'data-tab="prob"',
    'Chances table',
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
    'function renderForecastAuditCard',
    'Benchmark scoring',
    'data-forecast-audit',
    'frozen-prediction bucket adjustment',
    'Source-backed availability and incentive inputs',
    'function availabilityFactor',
    'function trustedModelSource',
    'id="appVersion"',
    'id="dataVersion"',
    'id="lastDataUpdate"',
    'id="copyrightNotice"',
    'id="legalNotice"',
    'footerMeta',
    'footerSupport',
    'https://github.com/sponsors/shfqrkhn?o=esb',
    'target="_blank"',
    'rel="noopener noreferrer"',
    'sponsorLink',
    'id="todayView"',
    'id="predictionSettings"',
    'advancedControls',
    '.advancedControls:not([open]) .settingsControls{display:none}',
    'settingsControls',
    'function todayMatches',
    'function renderTodayMatches',
    'function matchTimeLabel',
    'function matchKickoffSortValue',
    'function todayMatchSort',
    'timeZoneName',
    'todayMatch',
    'function fixedKnockoutResult',
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
    'function freshnessWarningHtml',
    'freshnessWarn',
    'Data freshness check:',
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
    'matchTimeVenueLabel',
    'title="${meta}"',
    'title="${teamA}"',
]
REQUIRED_WORKFLOW_STEPS = [
    "on:\n  workflow_dispatch:\n  schedule:",
    "cron: '37 11 * * *'",
    "cron: '37 17 * * *'",
    'actions/setup-node@v6',
    'python3 -m py_compile scripts/*.py',
    'node --check "$f"',
    'node scripts/update-base-data.mjs',
    'python3 scripts/test_idempotence.py',
    'node scripts/validate-calibration.mjs',
    'node tests/run-all.mjs',
    'node scripts/run-sim.mjs',
    'python3 scripts/validate_base_data.py',
    'scripts/write-workflow-summary.mjs',
    'actions: write',
    'pull-requests: write',
    'statuses: write',
    'scripts/publish-base-data-pr.mjs',
    'automation/daily-base-data-update',
    'GH_TOKEN: ${{ github.token }}',
    'concurrency:',
    'group: base-data-update-${{ github.ref }}',
    'data/update-health.json',
    'data/prediction-audit.json',
    'data/calibration-state.json',
    'data/backtest-audit.json',
]
REQUIRED_MATCH_WINDOW_WORKFLOW_STEPS = [
    "on:\n  workflow_dispatch:\n  schedule:",
    "cron: '*/30 11-23 * 6,7 *'",
    "cron: '*/30 8-10 * 6,7 *'",
    "cron: '*/30 0-7 * 6,7 *'",
    'actions/setup-node@v6',
    'node --check scripts/match-window-update.mjs',
    'node scripts/match-window-update.mjs',
    'python3 scripts/validate_base_data.py',
    'node scripts/validate-calibration.mjs',
    'node tests/run-all.mjs',
    'node scripts/run-sim.mjs',
    'scripts/write-workflow-summary.mjs',
    'actions: write',
    'pull-requests: write',
    'statuses: write',
    'scripts/publish-base-data-pr.mjs',
    'automation/match-window-base-data-update',
    'GH_TOKEN: ${{ github.token }}',
    'concurrency:',
    'group: base-data-update-${{ github.ref }}',
]
REQUIRED_BASE_DATA_PR_CHECK_WORKFLOW_STEPS = [
    'name: BASE_DATA PR check',
    'pull_request:',
    'workflow_dispatch:',
    'actions/setup-node@v6',
    "node-version: '24'",
    'python3 -m py_compile scripts/*.py',
    'node --check "$f"',
    'python3 scripts/validate_base_data.py',
    'node scripts/validate-calibration.mjs',
    'node tests/run-all.mjs',
    'node scripts/run-sim.mjs',
]
REQUIRED_SECURITY_WORKFLOW_STEPS = [
    'name: Security Check',
    'pull_request:',
    'actions/setup-node@v6',
    "node-version: '24'",
    'npm audit --audit-level=moderate',
]
REQUIRED_UI_SMOKE_WORKFLOW_STEPS = [
    'name: Static UI smoke',
    'workflow_dispatch',
    'branches: [main]',
    'actions/setup-node@v6',
    "node-version: '24'",
    'npm ci',
    'npx playwright install --with-deps chromium',
    'npm run ui:smoke',
    'actions/upload-artifact@v7',
]
REQUIRED_GITIGNORE_ENTRIES = [
    'data/scoreboards/',
    'data/manual-overrides.json',
    'data/latest-simulation.json',
    'node_modules/',
    'playwright-report/',
    'test-results/',
    'linkedin-post-package/',
    'offline/omnios-documents/',
    'offline/prediction-hub/',
    PRIVATE_HANDOFF,
    '.codex-remote-attachments/',
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
        "HTML_PATH = os.environ.get('FIFA_WC_HTML_PATH'",
        "NO_FETCH = '--no-fetch' in sys.argv",
        'SCHEDULE_LOOKAHEAD_DAYS',
        'datetime.datetime.now(datetime.timezone.utc).date()',
        'if not NO_FETCH and (applied or schedule_applied or team_applied or FETCH_FAILURES):',
        "'fetchFailures': FETCH_FAILURES",
        'def latest_played_day(matches):',
        'def fetch_window_end_day(data, today):',
        'def event_kickoff_utc(event):',
        'def event_team_names(event):',
        'def apply_event_schedule_to_match(match, event):',
        'def apply_event_teams_to_match(match, teams):',
        'def resolve_knockout_slots(data):',
        'def allocate_third_slots(q, knockout):',
        'def event_winner(comps):',
        'def refresh_current_stats(data, played, goals, stamp, updated_to):',
        "'ESPN public scoreboard for completed World Cup matches through",
        'knockout final score tied without winner/advance flag',
        'scoreboard file invalid shape',
        'isinstance(payload, list)',
        'status_type = status.get(',
        'data/latest-update.json',
    ],
    'scripts/update_health.py': [
        'from automation_utils import utc_stamp',
        'data/latest-update.json',
        'data/prediction-audit.json',
        'data/calibration-state.json',
        'data/backtest-audit.json',
        "'predictionAudit'",
        "'backtestAudit'",
        "'latestUpdate':latest",
        "'overdueUnplayedMatches'",
        "'nextScheduledMatchDay'",
    ],
    'scripts/test_idempotence.py': ['scripts/test_deterministic.py'],
    'scripts/test_deterministic.py': [
        "scripts/apply_scoreboard.py','--no-fetch",
        'scripts/enrich_predictions.py',
        'scripts/enrich_rest_travel.py',
        "scripts/enrich_weather.py','--no-fetch",
        'scripts/enrich_data_quality.py',
        'scripts/update_health.py',
        'data/backtest-audit.json',
        'scripts/backtest-audit.mjs',
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
        'nowArgs',
        'function snapshot',
        'function restore',
        'scripts/apply_manual_overrides.py',
        'scripts/freeze-predictions.mjs',
        'scripts/apply_scoreboard.py',
        'freeze newly scheduled pre-match predictions',
        'scripts/enrich_predictions.py',
        'scripts/enrich_rest_travel.py',
        'scripts/enrich_weather.py',
        'scripts/enrich_data_quality.py',
        'scripts/score-predictions.mjs',
        'scripts/update-calibration.mjs',
        'scripts/backtest-audit.mjs',
        'scripts/update_health.py',
        'scripts/validate-calibration.mjs',
        'scripts/build-html.mjs',
        'scripts/validate.mjs',
    ],
    'scripts/enrich_predictions.py': [
        'datetime.datetime.now(datetime.timezone.utc).date().isoformat()',
    ],
    'scripts/match-window-update.mjs': [
        'PRE_KICKOFF_SLOTS_MIN',
        'POST_KICKOFF_SLOTS_MIN',
        'ACTIVE_LOCK_END_MIN',
        'evaluateMatchWindow',
        'active_match_lock',
        'freeze_only',
        'scripts/update-base-data.mjs',
        'scripts/update_health.py',
        'scripts/validate_base_data.py',
        '--now',
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
    'scripts/publish-base-data-pr.mjs': [
        'COMMIT_CANDIDATES',
        'validateAutomationBranch',
        'VALIDATION_WORKFLOWS',
        'automation/base-data-update',
        'No validated BASE_DATA changes to publish',
        'GITHUB_TOKEN',
        'GH_TOKEN',
        'workflow',
        'base-data-pr-check.yml',
        'security-check.yml',
        '--force-with-lease',
        'gh',
        'pr create',
        'pr edit',
        'source-backed data',
        'no betting/odds/markets',
    ],
    'scripts/refinement-pass.mjs': [
        'REFINEMENT_TRIGGER',
        'Iterate until reaching THE END. ',
        'MAX_PASSES = 3',
        'scripts/update-base-data.mjs',
        'scripts/test_idempotence.py',
        "process.stdout.write('THE END\\n')",
    ],
    'scripts/qa.mjs': [
        'scripts/refinement-pass.mjs',
        'Iterate until reaching THE END. ',
    ],
    'scripts/apply_manual_overrides.py': [
        "DEFAULT_OVERRIDE_PATH",
        "data/manual-overrides.json",
        "manual override file must be an object with schema: 1",
        "requires source",
        "validate_availability",
        "manual_verified",
        "def apply_team_override",
        "def apply_match_override",
        "def apply_current_stats_override",
        "topScorersSource",
    ],
    'scripts/write-workflow-summary.mjs': [
        'BASE_DATA update summary',
        'Overdue unplayed matches',
        'Calibration status',
        'Backtest sample status',
        'data/update-health.json',
    ],
    'scripts/prediction-audit-lib.mjs': [
        'REQUIRED_LEDGER_FIELDS',
        'MIN_RESOLVED_PREDICTIONS',
        'createPredictionRecord',
        'scorePrediction',
        'updateCalibrationState',
        'applyCalibrationToWdl',
        'benchmarkMetrics',
        'uniform_wdl',
        'rank_prior',
        'calibrationEligiblePredictions',
        'validateNoMarketFields',
        'kept_previous_validated_bucket_calibration',
        'raw_model_only_previous_validation_worsened',
        'settled < created',
        'kickoff <= asOf',
        'sane integer scores',
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
        'teamMap',
        'writeArtifact',
        'data/calibration-state.json',
    ],
    'scripts/backtest-audit.mjs': [
        'buildBacktestAuditReport',
        'calibrationEligiblePredictions',
        'benchmarkMetrics',
        'by_confidence_bucket',
        'raw_vs_uniform_wdl',
        'raw_vs_rank_prior',
        'Prospective backtest from frozen pre-match predictions only',
        'data/backtest-audit.json',
        'validateNoMarketFields',
    ],
    'scripts/validate-calibration.mjs': [
        'REQUIRED_LEDGER_FIELDS',
        'MIN_RESOLVED_PREDICTIONS',
        'calibration_status',
        'benchmark_metrics',
        'Brier',
        'log loss',
        'invalid audit timestamps',
        'time-inconsistent audit timestamps',
        'sane integer score',
        '--audit',
        '--state',
        '--html',
        'calibrationEligiblePredictions',
        'publicCalibrationState',
        'FAILURE_TYPES',
        'predicted_scoreline_distribution',
        'predicted_advancement_probs',
        'predicted_wdl_probs keys',
        'invalid prediction_id format',
        'invalid source_snapshot_hash format',
        'VALID_BUCKETS',
        'stage does not match embedded fixture',
        'duplicate predicted_scoreline_distribution',
        'probabilities exceed 1',
        'missing prediction audit file',
        'invalid actual_result',
        'actual_result does not match score',
        'invalid scoring metrics',
        'scoring metrics do not match frozen probabilities',
        'active calibration has invalid bucket adjustment',
        'must not remain insufficient_sample',
        'matchKickoffMs',
        'resolved_predictions',
        'min_resolved_predictions',
        'invalid freeze timestamps',
        'references unknown match_id',
        'settled score does not match embedded result',
        'unsettled after embedded match is played',
        'unsettled result/scoring fields',
        'public calibration state',
        'calibration benchmark_metrics do not match eligible frozen predictions',
    ],
    'tests/run-all.mjs': [
        'prediction-audit.test.mjs',
        'scoring.test.mjs',
        'calibration.test.mjs',
        'backtest-audit.test.mjs',
        'no-leakage.test.mjs',
        'validate-calibration.test.mjs',
        'manual-update-trigger.test.mjs',
        'manual-overrides.test.mjs',
        'match-window-update.test.mjs',
    ],
    'tests/validate-calibration.test.mjs': [
        'scripts/validate-calibration.mjs',
        'references unknown match_id',
        'does not match eligible settled predictions',
        'must not remain insufficient_sample',
        'settled before embedded match is played',
        'invalid freeze timestamps',
        'invalid predicted_scoreline_distribution',
        'invalid predicted_advancement_probs keys',
        'invalid predicted_wdl_probs keys',
        'invalid source_snapshot_hash format',
        'invalid actual_result',
        'benchmark_metrics',
        'missing prediction audit file',
    ],
    'tests/backtest-audit.test.mjs': [
        'buildBacktestAuditReport',
        'resolved_predictions',
        'rejected_predictions',
        'raw_vs_uniform_wdl',
        'historical replay',
    ],
    'tests/match-window-update.test.mjs': [
        'pre_kickoff',
        'pre_kickoff_freeze_only_active_lock',
        'active_match_lock',
        'post_match',
        'stale_result_recovery',
        'STALE_RESULT_RECOVERY_END_MIN',
        'outside_match_window',
    ],
    'scripts/run-sim.mjs': [
        'documentStub',
        'addEventListener',
        'localStorageStub',
        'Initial page load did not run Monte Carlo predictions into Groups and Bracket views.',
        'Initial Monte Carlo representative did not inform the sample path, Groups, and Bracket views.',
        'Last data update footer was not rendered.',
        'Footer metadata did not render app version, data version, copyright, and legal notice.',
        'GitHub sponsor link was not embedded as a nonessential footer control.',
        'Last data update footer did not use the latest embedded timestamp.',
        'Today match highlighting did not classify and render schedule dates correctly.',
        'Tournament snapshot schedule progress did not render expected remaining-match fields.',
        'Ensemble model and low-score scoreline sampler were not active and disclosed.',
        'availabilityFactor',
        'group-table incentive',
        'Prediction-audit calibration status was not disclosed or failed closed.',
        'Benchmark scoring',
        'Rank-seeded Elo prior',
        'Monte Carlo loading state did not toggle accessibly.',
        'Monte Carlo controls were not locked during simulation.',
        'Prediction settings were not collapsed behind the visible run button.',
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
if 'Odds table' in html or re.search(r'>\s*Odds\s*<', html):
    fail('visible probability UI must use Chances terminology, not Odds')
if os.path.exists(WORKFLOW):
    workflow = open(WORKFLOW, encoding='utf-8').read()
    for marker in REQUIRED_WORKFLOW_STEPS:
        if marker not in workflow:
            fail('missing workflow automation marker: %s' % marker)
else:
    fail('missing daily BASE_DATA workflow')
if os.path.exists(MATCH_WINDOW_WORKFLOW):
    workflow = open(MATCH_WINDOW_WORKFLOW, encoding='utf-8').read()
    for marker in REQUIRED_MATCH_WINDOW_WORKFLOW_STEPS:
        if marker not in workflow:
            fail('missing match-window workflow marker: %s' % marker)
else:
    fail('missing match-window BASE_DATA workflow')
if os.path.exists(BASE_DATA_PR_CHECK_WORKFLOW):
    workflow = open(BASE_DATA_PR_CHECK_WORKFLOW, encoding='utf-8').read()
    for marker in REQUIRED_BASE_DATA_PR_CHECK_WORKFLOW_STEPS:
        if marker not in workflow:
            fail('missing BASE_DATA PR check workflow marker: %s' % marker)
else:
    fail('missing BASE_DATA PR check workflow')
if os.path.exists(SECURITY_WORKFLOW):
    workflow = open(SECURITY_WORKFLOW, encoding='utf-8').read()
    for marker in REQUIRED_SECURITY_WORKFLOW_STEPS:
        if marker not in workflow:
            fail('missing security workflow marker: %s' % marker)
else:
    fail('missing security workflow')
if os.path.exists(UI_SMOKE_WORKFLOW):
    workflow = open(UI_SMOKE_WORKFLOW, encoding='utf-8').read()
    for marker in REQUIRED_UI_SMOKE_WORKFLOW_STEPS:
        if marker not in workflow:
            fail('missing UI smoke workflow marker: %s' % marker)
else:
    fail('missing static UI smoke workflow')
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
    if '[Download current main ZIP](https://github.com/shfqrkhn/FIFA-WC-Sim/archive/refs/heads/main.zip)' not in readme:
        fail('README must link the repository ZIP instead of GitHub Releases')
    if '/releases/latest' in readme:
        fail('README must not link GitHub Releases')
    if '**License:** MIT' not in readme:
        fail('README must expose the MIT license above the fold')
    if 'python -m http.server 8080' not in readme:
        fail('README must document the local static-server command')
    if 'Use a local server instead of opening `index.html` directly' not in readme:
        fail('README must prevent direct-file launch confusion')
    if 'offline/prediction-hub/' not in readme:
        fail('README must document the private prediction-hub guardrail')
    if 'npm run qa' not in readme or 'npm run ui:smoke' not in readme or 'manual-overrides.example.json' not in readme:
        fail('README must document QA wrapper, UI smoke, and manual override schema')
    if 'match-window' not in readme or 'active-match lock' not in readme:
        fail('README must document match-window automation and active-match lock')
    if 'benchmark metrics' not in readme or 'must remain untracked' not in readme:
        fail('README must document private-file guardrails and calibration benchmarks')
    if '### Chances' not in readme or '### Odds' in readme or '**Odds**' in readme:
        fail('README probability section must use Chances terminology')
    if '2026.06.25-patch-32-nav-fit-polish' in readme:
        fail('README contains stale hard-coded patch version')
else:
    fail('missing README')
app_version_match = re.search(r"const APP_VERSION='v([^']+)'", html)
if not app_version_match:
    fail('missing APP_VERSION constant')
app_version = app_version_match.group(1)
for path in [PACKAGE, PACKAGE_LOCK]:
    if not os.path.exists(path):
        fail('missing package metadata file: %s' % path)
    meta = json.load(open(path, encoding='utf-8'))
    if meta.get('version') != app_version:
        fail('%s version must match APP_VERSION %s' % (path, app_version))
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
        if not isinstance(m, dict):
            errors.append('bad knockout match row %s' % no)
            continue
        if m.get('teamA') and m.get('teamA') not in team_names:
            errors.append('bad knockout teamA reference on match %s' % no)
        if m.get('teamB') and m.get('teamB') not in team_names:
            errors.append('bad knockout teamB reference on match %s' % no)
        if m.get('teamA') and m.get('teamA') == m.get('teamB'):
            errors.append('same-team knockout match %s' % no)
        score_a, score_b = m.get('scoreA'), m.get('scoreB')
        if m.get('played') and not (isinstance(score_a, int) and isinstance(score_b, int)):
            errors.append('played knockout match without integer score %s' % no)
        if m.get('played') and isinstance(score_a, int) and isinstance(score_b, int):
            if score_a < 0 or score_b < 0 or score_a > 15 or score_b > 15:
                errors.append('played knockout match has out-of-range score %s' % no)
            if not m.get('teamA') or not m.get('teamB'):
                errors.append('played knockout match missing concrete teams %s' % no)
            winner, loser = m.get('winner'), m.get('loser')
            if winner not in {m.get('teamA'), m.get('teamB')} or loser not in {m.get('teamA'), m.get('teamB')} or winner == loser:
                errors.append('played knockout match missing valid winner/loser %s' % no)
            if score_a != score_b:
                expected = m.get('teamA') if score_a > score_b else m.get('teamB')
                if winner != expected:
                    errors.append('played knockout winner disagrees with score %s' % no)
        if not m.get('played') and (score_a is not None or score_b is not None):
            errors.append('unplayed knockout match carries fake score %s' % no)
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
    benchmarks = calibration.get('benchmark_metrics')
    if not isinstance(benchmarks, dict):
        errors.append('missing calibration benchmark_metrics')
    else:
        for key in ('raw_model', 'uniform_wdl', 'rank_prior'):
            row = benchmarks.get(key)
            if not isinstance(row, dict) or not isinstance(row.get('count'), int) or row.get('count') < 0:
                errors.append('invalid calibration benchmark %s' % key)
            elif row.get('count') == 0:
                if row.get('brier_score') is not None or row.get('log_loss') is not None:
                    errors.append('empty calibration benchmark %s must have null metrics' % key)
            elif not isinstance(row.get('brier_score'), (int, float)) or not isinstance(row.get('log_loss'), (int, float)) or not math.isfinite(row.get('brier_score')) or not math.isfinite(row.get('log_loss')):
                errors.append('non-finite calibration benchmark %s' % key)
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
all_match_rows = (matches or []) + (knockout or [])
played_matches = [m for m in all_match_rows if m.get('played') and isinstance(m.get('scoreA'), int) and isinstance(m.get('scoreB'), int)]
played_goals = sum(m.get('scoreA', 0) + m.get('scoreB', 0) for m in played_matches)
if current_stats:
    if current_stats.get('matchesPlayed') != len(played_matches):
        errors.append('currentStats matchesPlayed does not match embedded played matches')
    if current_stats.get('goalsScored') != played_goals:
        errors.append('currentStats goalsScored does not match embedded played scores')
    source = str(current_stats.get('source', ''))
    if 'all statistics correct as of June 24' in source and current_stats.get('updatedTo') != '2026-06-24':
        errors.append('currentStats source overclaims an older complete snapshot')
    if 'ESPN scoreboard updater refreshed' in source or 'ESPN public scoreboard' in source:
        if current_stats.get('attendance') is not None or current_stats.get('attendancePerMatch') is not None:
            errors.append('scoreboard-refreshed currentStats must not retain stale attendance totals')
        scorer_source = str(current_stats.get('topScorersSource', ''))
        if current_stats.get('topScorers') and (not scorer_source or 'not refreshed' in scorer_source.lower()):
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
for path in ('data/prediction-audit.json', 'data/calibration-state.json', 'data/backtest-audit.json'):
    if not os.path.exists(path):
        fail('missing audit artifact: %s' % path)
    try:
        artifact = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        fail('unreadable audit artifact %s: %s' % (path, e))
    if not isinstance(artifact, dict) or artifact.get('schema') != 1:
        fail('invalid audit artifact schema: %s' % path)
print(json.dumps({'ok': True, 'teams': len(teams), 'groupMatches': 72, 'knockoutMatches': len(knockout), 'workflowGuarded': True, 'singleInputGuarded': True}, indent=2))
