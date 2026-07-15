import assert from 'node:assert/strict';
import {
  buildPullRequestBody,
  autoMergeArgs,
  COMMIT_CANDIDATES,
  deploymentWorkflowArgs,
  explainGitHubActionsPrPermission,
  parsePublishArgs,
  VALIDATION_STATUS_CONTEXTS,
  VALIDATION_WORKFLOWS,
  validateAutomationBranch,
  validateWorkflowFile
} from '../scripts/publish-base-data-pr.mjs';

assert.ok(COMMIT_CANDIDATES.includes('docs/index.html'));
assert.ok(COMMIT_CANDIDATES.includes('data/update-health.json'));
assert.ok(COMMIT_CANDIDATES.includes('data/prediction-audit.json'));
assert.deepEqual(VALIDATION_WORKFLOWS, ['base-data-pr-check.yml', 'security-check.yml']);
assert.deepEqual(VALIDATION_STATUS_CONTEXTS, {
  'base-data-pr-check.yml': 'base-data-pr-check',
  'security-check.yml': 'npm-audit'
});

const parsed = parsePublishArgs([
  '--branch',
  'automation/match-window-base-data-update',
  '--title',
  'Match-window World Cup BASE_DATA update',
  '--message',
  'Match-window World Cup BASE_DATA update'
], { GITHUB_TOKEN: 'test-token' });
assert.equal(parsed.branch, 'automation/match-window-base-data-update');
assert.equal(parsed.title, 'Match-window World Cup BASE_DATA update');
assert.equal(parsed.message, 'Match-window World Cup BASE_DATA update');
assert.equal(parsed.token, 'test-token');
assert.equal(parsed.autoMerge, false);
assert.equal(parsed.deployWorkflow, '');
assert.equal(parsed.recoverOnly, false);
assert.equal(parsePublishArgs(['--auto-merge'], {}).autoMerge, true);
assert.equal(parsePublishArgs(['--recover-only'], {}).recoverOnly, true);
assert.equal(parsePublishArgs(['--deploy-workflow', 'deploy-pages.yml'], {}).deployWorkflow, 'deploy-pages.yml');
assert.deepEqual(autoMergeArgs(19), ['pr', 'merge', '19', '--auto', '--merge', '--delete-branch=false']);
assert.throws(() => autoMergeArgs('x'), /invalid/);
assert.deepEqual(deploymentWorkflowArgs('deploy-pages.yml'), ['workflow', 'run', 'deploy-pages.yml', '--ref', 'main']);
assert.equal(validateWorkflowFile('deploy-pages.yml'), 'deploy-pages.yml');
assert.throws(() => validateWorkflowFile('../deploy.yml'), /safe workflow/);

assert.equal(validateAutomationBranch('automation/daily-base-data-update'), 'automation/daily-base-data-update');
assert.throws(() => validateAutomationBranch('main'), /automation/);
assert.throws(() => validateAutomationBranch('automation/../main'), /automation/);
assert.throws(() => parsePublishArgs(['--unknown'], {}), /Unknown option/);

const body = buildPullRequestBody({
  branch: 'automation/daily-base-data-update',
  changedFiles: ['docs/index.html', 'data/latest-update.json']
});
assert.match(body, /validated generated World Cup artifacts/);
assert.match(body, /source-backed data/);
assert.match(body, /immutable frozen predictions/);
assert.match(body, /no future leakage/);
assert.match(body, /no betting\/odds\/markets/);
assert.match(body, /docs\/index\.html/);

const explained = explainGitHubActionsPrPermission('pull request create failed: GraphQL: GitHub Actions is not permitted to create or approve pull requests');
assert.match(explained, /Workflow permissions/);
assert.match(explained, /repository-level setting/);

console.log('publish BASE_DATA PR tests passed');
