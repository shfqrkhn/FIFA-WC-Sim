#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const COMMIT_CANDIDATES = [
  'docs/index.html',
  'data/latest-update.json',
  'data/update-health.json',
  'data/prediction-audit.json',
  'data/calibration-state.json',
  'data/backtest-audit.json'
  ,'data/comparative-results.json'
];

export const VALIDATION_WORKFLOWS = [
  'base-data-pr-check.yml',
  'security-check.yml'
];

export const VALIDATION_STATUS_CONTEXTS = {
  'base-data-pr-check.yml': 'base-data-pr-check',
  'security-check.yml': 'npm-audit'
};

const VALIDATION_POLL_MS = 5000;
const VALIDATION_TIMEOUT_MS = 10 * 60 * 1000;

export function parsePublishArgs(argv = [], env = process.env) {
  const options = {
    branch: env.BASE_DATA_PR_BRANCH || 'automation/base-data-update',
    title: env.BASE_DATA_PR_TITLE || 'World Cup BASE_DATA update',
    message: env.BASE_DATA_COMMIT_MESSAGE || 'World Cup BASE_DATA update',
    base: env.BASE_DATA_PR_BASE || 'main',
    token: env.GH_TOKEN || env.GITHUB_TOKEN || '',
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--branch') {
      options.branch = argv[++i] || '';
    } else if (arg === '--title') {
      options.title = argv[++i] || options.title;
    } else if (arg === '--message') {
      options.message = argv[++i] || options.message;
    } else if (arg === '--base') {
      options.base = argv[++i] || options.base;
    } else if (arg.startsWith('--branch=')) {
      options.branch = arg.slice('--branch='.length);
    } else if (arg.startsWith('--title=')) {
      options.title = arg.slice('--title='.length);
    } else if (arg.startsWith('--message=')) {
      options.message = arg.slice('--message='.length);
    } else if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

export function validateAutomationBranch(branch) {
  const value = String(branch || '').trim();
  if (!/^automation\/[A-Za-z0-9._/-]+$/.test(value) || value.includes('..') || value.includes('//')) {
    throw new Error('BASE_DATA PR branch must be under automation/ and use safe git ref characters.');
  }
  return value;
}

function usage() {
  return [
    'Usage: node scripts/publish-base-data-pr.mjs --branch automation/name --title "Title" --message "Commit message"',
    '',
    'Publishes validated BASE_DATA artifacts to a bot branch and opens or updates a pull request.',
    'No changes are published when the validated candidate artifacts are unchanged.'
  ].join('\n');
}

function run(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio || 'inherit',
    encoding: options.stdio === 'pipe' ? 'utf8' : undefined,
    env: options.env || process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && label) {
    const detail = result.stderr ? `\n${result.stderr.trim()}` : '';
    throw new Error(`${label} failed with exit ${result.status}${detail}`);
  }
  return result;
}

function git(args, label, options = {}) {
  return run('git', args, label, options);
}

function gh(args, label, token) {
  try {
    return run('gh', args, label, {
      stdio: 'pipe',
      env: { ...process.env, GH_TOKEN: token }
    });
  } catch (error) {
    const message = explainGitHubActionsPrPermission(error.message);
    if (message !== error.message) throw new Error(message, { cause: error });
    throw error;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function repositorySlug(options) {
  if (options.repository) return options.repository;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], 'gh repo view', options.token).stdout.trim();
}

function currentHeadSha() {
  return git(['rev-parse', 'HEAD'], 'git rev-parse HEAD', { stdio: 'pipe' }).stdout.trim();
}

function postCommitStatus(options, sha, context, state, description, targetUrl = '') {
  const repo = repositorySlug(options);
  const args = [
    'api',
    '--method',
    'POST',
    `repos/${repo}/statuses/${sha}`,
    '-f',
    `state=${state}`,
    '-f',
    `context=${context}`,
    '-f',
    `description=${description.slice(0, 140)}`
  ];
  if (targetUrl) args.push('-f', `target_url=${targetUrl}`);
  gh(args, `gh status ${context}`, options.token);
}

function latestWorkflowDispatchRun(options, workflow, sha) {
  const result = gh([
    'run',
    'list',
    '--workflow',
    workflow,
    '--branch',
    options.branch,
    '--event',
    'workflow_dispatch',
    '--json',
    'databaseId,headSha,status,conclusion,url,createdAt',
    '--limit',
    '10'
  ], `gh run list ${workflow}`, options.token);
  const runs = JSON.parse(result.stdout || '[]');
  return runs.find(run => run.headSha === sha) || null;
}

function waitForWorkflowDispatchRun(options, workflow, sha) {
  const deadline = Date.now() + VALIDATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const run = latestWorkflowDispatchRun(options, workflow, sha);
    if (run?.status === 'completed') return run;
    sleep(VALIDATION_POLL_MS);
  }
  throw new Error(`Timed out waiting for ${workflow} workflow_dispatch validation on ${sha}.`);
}

export function changedCandidateFiles() {
  const result = git(['diff', '--name-only', '--', ...COMMIT_CANDIDATES], 'git diff', { stdio: 'pipe' });
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

export function explainGitHubActionsPrPermission(message) {
  const text = String(message || '');
  const marker = 'GitHub Actions is not permitted to create or approve pull requests';
  if (!text.includes(marker)) return text;
  return [
    text,
    '',
    'Repository setting required: Settings > Actions > General > Workflow permissions must allow GitHub Actions to create and approve pull requests.',
    'The workflow already requests contents: write and pull-requests: write; the repository-level setting is still required for bot PR creation.'
  ].join('\n');
}

export function buildPullRequestBody({ branch, changedFiles }) {
  return [
    'Automated BASE_DATA update proposal.',
    '',
    'This PR contains only validated generated World Cup artifacts:',
    ...changedFiles.map(file => `- ${file}`),
    '',
    'Validation ran before this branch was published. The workflow preserves source-backed data, immutable frozen predictions, no future leakage, and no betting/odds/markets content.',
    '',
    `Bot branch: ${branch}`
  ].join('\n');
}

function writeSummary(lines) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  fs.appendFileSync(target, `${lines.join('\n')}\n`);
}

function publishBranch(options, changedFiles) {
  git(['config', 'user.name', 'github-actions[bot]'], 'git config user.name');
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], 'git config user.email');
  git(['checkout', '-B', options.branch], 'git checkout automation branch');
  git(['add', '-A', '--', ...COMMIT_CANDIDATES], 'git add validated artifacts');
  git(['commit', '-m', options.message], 'git commit validated artifacts');

  const push = git(['push', '--force-with-lease', 'origin', `HEAD:${options.branch}`], '', { stdio: 'pipe' });
  if (push.status !== 0) {
    git(['push', '--force', 'origin', `HEAD:${options.branch}`], 'git push automation branch');
  }

  const bodyPath = path.join(os.tmpdir(), `base-data-pr-${Date.now()}.md`);
  fs.writeFileSync(bodyPath, buildPullRequestBody({ branch: options.branch, changedFiles }));

  const existing = gh([
    'pr',
    'list',
    '--base',
    options.base,
    '--head',
    options.branch,
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    '.[0].number // ""'
  ], 'gh pr list', options.token).stdout.trim();

  if (existing) {
    gh(['pr', 'edit', existing, '--title', options.title, '--body-file', bodyPath], 'gh pr edit', options.token);
    dispatchValidationWorkflows(options);
    writeSummary(['', `BASE_DATA update PR refreshed: #${existing}`, 'BASE_DATA validation workflows dispatched.']);
    console.log(`BASE_DATA update PR refreshed: #${existing}`);
    return;
  }

  const created = gh([
    'pr',
    'create',
    '--base',
    options.base,
    '--head',
    options.branch,
    '--title',
    options.title,
    '--body-file',
    bodyPath
  ], 'gh pr create', options.token).stdout.trim();
  dispatchValidationWorkflows(options);
  writeSummary(['', `BASE_DATA update PR created: ${created}`, 'BASE_DATA validation workflows dispatched.']);
  console.log(`BASE_DATA update PR created: ${created}`);
}

export function dispatchValidationWorkflows(options, workflows = VALIDATION_WORKFLOWS) {
  const sha = currentHeadSha();
  for (const workflow of workflows) {
    const context = VALIDATION_STATUS_CONTEXTS[workflow];
    if (context) postCommitStatus(options, sha, context, 'pending', `${workflow} validation dispatched`);
    gh(['workflow', 'run', workflow, '--ref', options.branch], `gh workflow run ${workflow}`, options.token);
  }
  for (const workflow of workflows) {
    const context = VALIDATION_STATUS_CONTEXTS[workflow];
    if (!context) continue;
    const run = waitForWorkflowDispatchRun(options, workflow, sha);
    const ok = run.conclusion === 'success';
    postCommitStatus(
      options,
      sha,
      context,
      ok ? 'success' : 'failure',
      `${workflow} ${run.conclusion || 'did not pass'}`,
      run.url || ''
    );
    if (!ok) throw new Error(`${workflow} validation failed with conclusion: ${run.conclusion || 'unknown'}`);
  }
}

export function runPublishBaseDataPr(options) {
  if (options.help) {
    console.log(usage());
    return 0;
  }
  options.branch = validateAutomationBranch(options.branch);
  const changedFiles = changedCandidateFiles();
  if (!changedFiles.length) {
    console.log('No validated BASE_DATA changes to publish.');
    writeSummary(['', 'No validated BASE_DATA changes to publish.']);
    return 0;
  }
  if (!options.token) {
    throw new Error('GITHUB_TOKEN or GH_TOKEN is required to open or update the BASE_DATA pull request.');
  }
  publishBranch(options, changedFiles);
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    process.exit(runPublishBaseDataPr(parsePublishArgs(process.argv.slice(2))));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
