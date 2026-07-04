import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read('docs/RELEASE_ARTIFACT_POLICY.md');
const readme = read('README.md');

for (const phrase of [
  'Release Artifact Policy',
  'source-backed generated data',
  'data/manual-overrides.json',
  'data/latest-simulation.json',
  'data/scoreboards/',
  'Invented match',
  'betting',
  'npm run ui:smoke',
  'protected-path scan'
]) {
  assert(policy.includes(phrase), `release artifact policy missing: ${phrase}`);
}

assert(readme.includes('No account') === false, 'FIFA README should not inherit unrelated account claims.');
assert(readme.includes('betting') && readme.includes('These are not used'), 'README must keep betting/market exclusion.');
assert(existsSync(join(root, 'docs', 'RELEASE_ARTIFACT_POLICY.md')), 'release policy doc missing.');

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const forbiddenTracked = tracked.filter((file) =>
  /(^|\/)(node_modules|offline|linkedin-post-package|test-results|playwright-report|\.codex-remote-attachments)(\/|$)/.test(file) ||
  /(^|\/)data\/(manual-overrides\.json|latest-simulation\.json|scoreboards)(\/|$)/.test(file) ||
  /(^|\/).*\.((env)|(pem)|(key)|(p12)|(pfx))$/i.test(file)
);
assert(forbiddenTracked.length === 0, `forbidden tracked paths: ${forbiddenTracked.join(', ')}`);

console.log('public surface policy tests passed');
