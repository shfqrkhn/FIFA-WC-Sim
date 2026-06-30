#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runPythonScript } from './node-python.mjs';

export const MANUAL_UPDATE_TRIGGER = 'WC_DATA_RESCUE';
export const COMMIT_CANDIDATES = [
  'docs/index.html',
  'data/latest-update.json',
  'data/update-health.json',
  'data/prediction-audit.json',
  'data/calibration-state.json',
  'data/backtest-audit.json'
];

function usage() {
  return [
    `Usage: node scripts/manual-update-trigger.mjs --trigger ${MANUAL_UPDATE_TRIGGER} [--no-fetch] [--commit] [--push]`,
    '',
    'Runs the same guarded BASE_DATA update path as automation, then validates before any optional commit.',
    '--no-fetch keeps the run deterministic and uses embedded/cached data only.',
    '--commit commits only validated candidate artifacts if they changed.',
    '--push implies --commit and pushes the resulting local commit.'
  ].join('\n');
}

export function parseManualUpdateArgs(argv = [], env = process.env) {
  const options = {
    trigger: env.FIFA_WC_UPDATE_TRIGGER || '',
    noFetch: false,
    commit: false,
    push: false,
    help: false,
    scoreboardFiles: [],
    commitMessage: 'Manual World Cup BASE_DATA update'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--trigger') {
      options.trigger = argv[++i] || '';
    } else if (arg.startsWith('--trigger=')) {
      options.trigger = arg.slice('--trigger='.length);
    } else if (arg === '--no-fetch') {
      options.noFetch = true;
    } else if (arg === '--commit') {
      options.commit = true;
    } else if (arg === '--push') {
      options.push = true;
      options.commit = true;
    } else if (arg === '--message') {
      options.commitMessage = argv[++i] || options.commitMessage;
    } else if (arg === '--scoreboard') {
      options.scoreboardFiles.push(argv[++i] || '');
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.trigger) {
      options.trigger = arg;
    } else {
      options.scoreboardFiles.push(arg);
    }
  }
  options.scoreboardFiles = options.scoreboardFiles.filter(Boolean);
  return options;
}

export function isAuthorizedManualUpdateTrigger(value) {
  return String(value || '').trim() === MANUAL_UPDATE_TRIGGER;
}

export function updateBaseDataArgs(options) {
  return [
    ...options.scoreboardFiles,
    ...(options.noFetch ? ['--no-fetch'] : [])
  ];
}

function snapshot(paths) {
  return new Map(paths.map(filePath => [
    filePath,
    fs.existsSync(filePath) ? fs.readFileSync(filePath) : null
  ]));
}

function restore(files) {
  for (const [filePath, content] of files) {
    if (content === null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
      continue;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

function run(command, args, label) {
  console.log(`\n[manual-update] ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runGit(args, label, stdio = 'inherit') {
  const result = spawnSync('git', args, { stdio, encoding: stdio === 'pipe' ? 'utf8' : undefined });
  if (result.error) throw result.error;
  if (label && result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
  return result;
}

function gitQuietDiff(args) {
  const result = spawnSync('git', args, { stdio: 'pipe' });
  if (result.error) throw result.error;
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`git ${args.join(' ')} failed with exit ${result.status}`);
}

function assertCandidateFilesClean() {
  const unstaged = gitQuietDiff(['diff', '--quiet', '--', ...COMMIT_CANDIDATES]);
  const staged = gitQuietDiff(['diff', '--cached', '--quiet', '--', ...COMMIT_CANDIDATES]);
  if (unstaged || staged) {
    throw new Error('Candidate data artifacts already have local changes; commit, stash, or inspect them before running the rescue update.');
  }
}

function changedCandidateFiles() {
  const result = runGit(['diff', '--name-only', '--', ...COMMIT_CANDIDATES], '', 'pipe');
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function runValidationPipeline(options) {
  const steps = [
    ['update BASE_DATA', () => run(process.execPath, ['scripts/update-base-data.mjs', ...updateBaseDataArgs(options)], 'update BASE_DATA')],
    ['idempotence', () => runPythonScript('scripts/test_idempotence.py')],
    ['calibration validation', () => run(process.execPath, ['scripts/validate-calibration.mjs'], 'calibration validation')],
    ['prediction audit tests', () => run(process.execPath, ['tests/run-all.mjs'], 'prediction audit tests')],
    ['simulation smoke', () => run(process.execPath, ['scripts/run-sim.mjs'], 'simulation smoke')],
    ['BASE_DATA validation', () => runPythonScript('scripts/validate_base_data.py')],
    ['extract/build validation', () => run(process.execPath, ['scripts/build-html.mjs'], 'extract/build validation')]
  ];
  for (const [label, step] of steps) {
    const status = step();
    if (status !== 0) throw new Error(`${label} failed with exit ${status}`);
  }
}

function commitAndMaybePush(options) {
  const changed = changedCandidateFiles();
  if (!changed.length) {
    console.log('\n[manual-update] No validated candidate artifacts changed.');
    return;
  }
  console.log(`\n[manual-update] Changed candidate artifacts:\n${changed.map(file => `- ${file}`).join('\n')}`);
  if (!options.commit) {
    console.log('[manual-update] Validation passed. Re-run with --commit to commit these artifacts.');
    return;
  }
  runGit(['add', '-A', '--', ...COMMIT_CANDIDATES], 'git add');
  runGit(['commit', '-m', options.commitMessage], 'git commit');
  if (options.push) runGit(['push'], 'git push');
}

export function runManualUpdate(options) {
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (!isAuthorizedManualUpdateTrigger(options.trigger)) {
    console.error(`Manual update refused. Provide exact trigger word: ${MANUAL_UPDATE_TRIGGER}`);
    return 2;
  }
  assertCandidateFilesClean();
  const before = snapshot(COMMIT_CANDIDATES);
  try {
    runValidationPipeline(options);
  } catch (error) {
    restore(before);
    console.error(`\n[manual-update] ${error.message}`);
    console.error('[manual-update] Restored candidate artifacts from the pre-run snapshot.');
    return 1;
  }
  commitAndMaybePush(options);
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    process.exit(runManualUpdate(parseManualUpdateArgs(process.argv.slice(2))));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
