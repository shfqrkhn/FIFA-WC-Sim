import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read('docs/REPO_ZIP_POLICY.md');
const evidence = read('docs/EVIDENCE_RECEIPT.md');
const handoff = read('docs/AI_MAINTAINER_HANDOFF.md');
const readme = read('README.md');
const codeqlWorkflow = read('.github/workflows/codeql.yml');
const codeqlConfig = read('.github/codeql/codeql-config.yml');
const pkg = JSON.parse(read('package.json'));

assert(pkg.scripts?.['qa:full'] === 'npm test && npm run qa && npm run ui:smoke', 'package must expose the full public QA gate.');

const forbiddenPathPattern =
  /(^|\/)(node_modules|offline|linkedin-post-package|test-results|playwright-report|\.codex-remote-attachments)(\/|$)|(^|\/)scripts\/__pycache__(\/|$)|(^|\/)data\/(manual-overrides\.json|latest-simulation\.json|scoreboards)(\/|$)|(^|\/).*\.((env)|(pem)|(key)|(p12)|(pfx))$/i;
const forbiddenLoosePathPattern = /(^|\/)(exports?|backups?|logs?|scratch)(\/|$)/i;

function gitArchiveEntries() {
  const archive = execFileSync('git', ['archive', '--format=tar', 'HEAD'], {
    cwd: root,
    maxBuffer: 128 * 1024 * 1024
  });
  const entries = [];
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
    const sizeRaw = header.toString('utf8', 124, 136).replace(/\0.*$/, '').trim();
    const size = sizeRaw ? parseInt(sizeRaw, 8) : 0;
    const fullName = [prefix, name].filter(Boolean).join('/');
    if (fullName) entries.push(fullName.replace(/\\/g, '/'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

const archiveEntries = gitArchiveEntries();
const requiredArchiveEntries = [
  'README.md',
  'docs/index.html',
  'docs/REPO_ZIP_POLICY.md',
  'docs/EVIDENCE_RECEIPT.md',
  'data/latest-update.json',
  'data/update-health.json',
  'data/prediction-audit.json',
  'data/calibration-state.json',
  'data/backtest-audit.json',
  'package.json',
  'scripts/validate_base_data.py',
  'tests/public-surface-policy.test.mjs'
];
const forbiddenArchiveEntries = archiveEntries.filter((file) => forbiddenPathPattern.test(file) || forbiddenLoosePathPattern.test(file));

assert(forbiddenArchiveEntries.length === 0, `forbidden generated archive paths: ${forbiddenArchiveEntries.join(', ')}`);
for (const file of requiredArchiveEntries) {
  assert(archiveEntries.includes(file), `generated repository archive must include public/runtime path: ${file}`);
}

for (const phrase of [
  'Repository ZIP Policy',
  'source-backed generated data',
  'data/manual-overrides.json',
  'data/latest-simulation.json',
  'data/scoreboards/',
  'Invented match',
  'betting',
  'npm run qa:full',
  'protected-path scan',
  'git archive'
]) {
  assert(policy.includes(phrase), `repository ZIP policy missing: ${phrase}`);
}

assert(readme.includes('No account') === false, 'FIFA README should not inherit unrelated account claims.');
assert(readme.includes('betting') && readme.includes('These are not used'), 'README must keep betting/market exclusion.');
assert(readme.includes('[Download current main ZIP](https://github.com/shfqrkhn/FIFA-WC-Sim/archive/refs/heads/main.zip)'), 'README must link the repository ZIP.');
assert(!readme.includes('/releases/latest'), 'README must not link GitHub Releases.');
assert(existsSync(join(root, 'docs', 'REPO_ZIP_POLICY.md')), 'repository ZIP policy doc missing.');
assert(existsSync(join(root, 'docs', 'EVIDENCE_RECEIPT.md')), 'evidence receipt doc missing.');
for (const phrase of ['PASS_WITH_LIMITATIONS', 'NO_GO', 'Source-backed match data', 'No betting/odds/markets', 'Frozen predictions/no future leakage']) {
  assert(evidence.includes(phrase), `evidence receipt missing: ${phrase}`);
}
for (const phrase of ['Claim Firewall Invariant', 'Claim Boundaries', 'must map', 'NOT_RUN', 'BLOCKED', 'current repo state']) {
  assert(evidence.includes(phrase), `evidence receipt missing claim firewall term: ${phrase}`);
}
for (const phrase of ['Currentness Watchdog', 'stale, missing, inaccessible', 'downgrade the affected claim', 'source/repo/GitHub state']) {
  assert(evidence.includes(phrase), `evidence receipt missing currentness watchdog term: ${phrase}`);
}
for (const phrase of ['Safe-To-Publish Receipt', 'clean synced tree', 'no GitHub Releases', 'no protected tracked paths', 'no open secret/dependabot/code-scanning alerts', 'code-scanning not-applicable/no-analysis state', 'remaining risks']) {
  assert(evidence.includes(phrase), `evidence receipt missing safe-to-publish term: ${phrase}`);
}
assert(evidence.includes("git rev-list --left-right --count 'HEAD...@{u}'"), 'evidence receipt must preserve the PowerShell-safe upstream delta command.');
assert(evidence.includes('gh release list --limit 5'), 'evidence receipt must require a GitHub Releases absence check.');
assert(evidence.includes('git archive'), 'evidence receipt must tie repository ZIP safety to generated archive evidence.');
for (const phrase of ['Runtime app code scanning', '.github/workflows/codeql.yml', 'CodeQL JavaScript analysis', 'PASS_WITH_LIMITATIONS']) {
  assert(evidence.includes(phrase), `evidence receipt missing code scanning term: ${phrase}`);
}
for (const phrase of ['github/codeql-action/init@v4', 'github/codeql-action/analyze@v4', 'languages: javascript-typescript', 'security-events: write', 'config-file: ./.github/codeql/codeql-config.yml']) {
  assert(codeqlWorkflow.includes(phrase), `CodeQL workflow missing: ${phrase}`);
}
for (const phrase of ['paths-ignore:', 'tests/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']) {
  assert(codeqlConfig.includes(phrase), `CodeQL config missing: ${phrase}`);
}
for (const phrase of ['Input Accessibility Evidence', 'keyboard only', 'mouse/pointer only', 'touch only', 'platform-limited input only', 'focus/label review', 'platform text-entry support', 'Input accessibility']) {
  assert(evidence.includes(phrase), `evidence receipt missing input accessibility term: ${phrase}`);
}
for (const phrase of ['Single Input Directive Evidence', 'keyboard only', 'mouse/pointer only', 'touch only', 'platform-limited input only', 'No critical workflow may require', 'Single input operation']) {
  assert(evidence.includes(phrase), `evidence receipt missing single input directive term: ${phrase}`);
}
for (const phrase of ['Design Language Evidence', 'Signature Ecosystem Evidence', 'shared `shfqrkhn` ecosystem', 'Signature ecosystem fit', 'modern minimalist', 'Uiverse', 'Open Props', 'Design language/UI safety', 'browser JS popups', 'component overlap']) {
  assert(evidence.includes(phrase), `evidence receipt missing design language term: ${phrase}`);
}
for (const phrase of ['Recovery And Data Safety Evidence', 'import, export, reset', 'corrupt-cache', 'malformed saved-data', 'fail-closed', 'Recovery/data safety']) {
  assert(evidence.includes(phrase), `evidence receipt missing recovery/data safety term: ${phrase}`);
}
for (const phrase of ['Mission-Critical Reliability Evidence', 'self-checking', 'crash-recoverable', 'state-explicit', 'TDD/SDD', 'Autonomous AI-assisted development', 'Mission-critical reliability']) {
  assert(evidence.includes(phrase), `evidence receipt missing mission-critical reliability term: ${phrase}`);
}
for (const phrase of ['Source Gap Disclosure Evidence', 'outside products', 'source-backed manual override', 'Unknown kickoff times', 'scorer rows', 'referee assignments', 'provenance, freshness, and failure behavior']) {
  assert(evidence.includes(phrase), `evidence receipt missing source gap disclosure term: ${phrase}`);
}
for (const phrase of ['OmniOS Transfer Contract', 'Product truth', 'Execution truth', 'Evidence truth', 'Operations truth', 'Transfer truth', 'GitHub Releases stay absent']) {
  assert(handoff.includes(phrase), `handoff missing OmniOS transfer contract term: ${phrase}`);
}
for (const phrase of ['Ecosystem truth', 'shared signature design system', 'Design truth', 'modern minimalist', 'MIT UI libraries/resources', 'browser JS popups', 'arbitrary component copy-paste']) {
  assert(handoff.includes(phrase), `handoff missing design truth term: ${phrase}`);
}
for (const phrase of ['Reliability truth', 'self-checking', 'crash-recoverable', 'state-explicit', 'TDD/SDD-backed', 'remove complexity']) {
  assert(handoff.includes(phrase), `handoff missing reliability truth term: ${phrase}`);
}
for (const phrase of ['Single input truth', 'keyboard only', 'mouse/pointer only', 'touch only', 'platform-limited input only', 'combined input-mode path']) {
  assert(handoff.includes(phrase), `handoff missing single input truth term: ${phrase}`);
}
for (const phrase of ['Doctrine Delta Decision', 'promote', 'reject', 'quarantine', 'keep_local', 'source-backed, reusable, non-secret', 'explicitly approves publication']) {
  assert(handoff.includes(phrase), `handoff missing doctrine delta term: ${phrase}`);
}

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const forbiddenTracked = tracked.filter((file) => forbiddenPathPattern.test(file) || forbiddenLoosePathPattern.test(file));
assert(forbiddenTracked.length === 0, `forbidden tracked paths: ${forbiddenTracked.join(', ')}`);

console.log('public surface policy tests passed');
