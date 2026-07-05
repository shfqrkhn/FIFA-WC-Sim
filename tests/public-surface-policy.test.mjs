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

for (const phrase of [
  'Repository ZIP Policy',
  'source-backed generated data',
  'data/manual-overrides.json',
  'data/latest-simulation.json',
  'data/scoreboards/',
  'Invented match',
  'betting',
  'npm run qa:full',
  'protected-path scan'
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
for (const phrase of ['Runtime app code scanning', '.github/workflows/codeql.yml', 'CodeQL JavaScript analysis', 'PASS_WITH_LIMITATIONS']) {
  assert(evidence.includes(phrase), `evidence receipt missing code scanning term: ${phrase}`);
}
for (const phrase of ['github/codeql-action/init@v4', 'github/codeql-action/analyze@v4', 'languages: javascript-typescript', 'security-events: write', 'config-file: ./.github/codeql/codeql-config.yml']) {
  assert(codeqlWorkflow.includes(phrase), `CodeQL workflow missing: ${phrase}`);
}
for (const phrase of ['paths-ignore:', 'tests/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']) {
  assert(codeqlConfig.includes(phrase), `CodeQL config missing: ${phrase}`);
}
for (const phrase of ['Input Accessibility Evidence', 'keyboard-only', 'mouse/pointer-only', 'touch-only', 'focus/label review', 'tap-target/no-overflow', 'Input accessibility']) {
  assert(evidence.includes(phrase), `evidence receipt missing input accessibility term: ${phrase}`);
}
for (const phrase of ['Recovery And Data Safety Evidence', 'import, export, reset', 'corrupt-cache', 'malformed saved-data', 'fail-closed', 'Recovery/data safety']) {
  assert(evidence.includes(phrase), `evidence receipt missing recovery/data safety term: ${phrase}`);
}
for (const phrase of ['Source Gap Disclosure Evidence', 'outside products', 'source-backed manual override', 'Unknown kickoff times', 'scorer rows', 'referee assignments', 'provenance, freshness, and failure behavior']) {
  assert(evidence.includes(phrase), `evidence receipt missing source gap disclosure term: ${phrase}`);
}
for (const phrase of ['OmniOS Transfer Contract', 'Product truth', 'Execution truth', 'Evidence truth', 'Operations truth', 'Transfer truth', 'GitHub Releases stay absent']) {
  assert(handoff.includes(phrase), `handoff missing OmniOS transfer contract term: ${phrase}`);
}
for (const phrase of ['Doctrine Delta Decision', 'promote', 'reject', 'quarantine', 'keep_local', 'source-backed, reusable, non-secret', 'explicitly approves publication']) {
  assert(handoff.includes(phrase), `handoff missing doctrine delta term: ${phrase}`);
}

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const forbiddenTracked = tracked.filter((file) =>
  /(^|\/)(node_modules|offline|linkedin-post-package|test-results|playwright-report|\.codex-remote-attachments)(\/|$)/.test(file) ||
  /(^|\/)data\/(manual-overrides\.json|latest-simulation\.json|scoreboards)(\/|$)/.test(file) ||
  /(^|\/).*\.((env)|(pem)|(key)|(p12)|(pfx))$/i.test(file) ||
  /(^|\/)(exports?|backups?|logs?|scratch)(\/|$)/i.test(file)
);
assert(forbiddenTracked.length === 0, `forbidden tracked paths: ${forbiddenTracked.join(', ')}`);

console.log('public surface policy tests passed');
