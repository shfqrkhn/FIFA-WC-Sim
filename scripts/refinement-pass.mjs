#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REFINEMENT_TRIGGER = 'Iterate until reaching THE END. ';
export const MAX_PASSES = 3;

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const selfTest = args.includes('--self-test');
const candidateFiles = [
  'docs/index.html',
  'data/latest-update.json',
  'data/update-health.json',
  'data/prediction-audit.json',
  'data/calibration-state.json'
];

function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

export function acceptedTrigger(value) {
  return value === REFINEMENT_TRIGGER;
}

function triggerValue() {
  return argValue('--trigger') ?? process.env.REFINEMENT_TRIGGER ?? '';
}

function sha(file) {
  return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
}

function snapshot(files = candidateFiles) {
  return new Map(files.map(file => [file, sha(file)]));
}

function sameSnapshot(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}

function listFiles(dir, suffix) {
  return fs.readdirSync(dir).filter(file => file.endsWith(suffix)).map(file => path.join(dir, file));
}

function run(label, command, commandArgs = []) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' });
  if (verbose && result.stdout) process.stdout.write(result.stdout);
  if (verbose && result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    return { ok: false, label, detail: result.error.message };
  }
  if ((result.status ?? 1) !== 0) {
    return {
      ok: false,
      label,
      detail: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `exit ${result.status}`
    };
  }
  return { ok: true, label };
}

function runPython(label, script, scriptArgs = []) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  const missing = [];
  for (const command of candidates) {
    const result = spawnSync(command, [script, ...scriptArgs], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') {
      missing.push(command);
      continue;
    }
    if (verbose && result.stdout) process.stdout.write(result.stdout);
    if (verbose && result.stderr) process.stderr.write(result.stderr);
    if (result.error) return { ok: false, label, detail: result.error.message };
    if ((result.status ?? 1) !== 0) {
      return { ok: false, label, detail: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `exit ${result.status}` };
    }
    return { ok: true, label };
  }
  return { ok: false, label, detail: `Python interpreter not found. Tried: ${missing.join(', ')}` };
}

function checkAllSyntax() {
  for (const file of listFiles('scripts', '.py')) {
    const result = runPython(`python syntax ${file}`, '-m', ['py_compile', file]);
    if (!result.ok) return result;
  }
  for (const file of [...listFiles('scripts', '.mjs'), ...listFiles('tests', '.mjs')]) {
    const result = run(`node syntax ${file}`, process.execPath, ['--check', file]);
    if (!result.ok) return result;
  }
  return { ok: true, label: 'syntax' };
}

function runGate(label, command, commandArgs = []) {
  return command === 'python'
    ? runPython(label, commandArgs[0], commandArgs.slice(1))
    : run(label, command, commandArgs);
}

function runPass() {
  const steps = [
    () => run('self-heal update-base-data no-fetch', process.execPath, ['scripts/update-base-data.mjs', '--no-fetch']),
    checkAllSyntax,
    () => runGate('validate base data', 'python', ['scripts/validate_base_data.py']),
    () => run('validate wrapper', process.execPath, ['scripts/validate.mjs']),
    () => run('validate build shape', process.execPath, ['scripts/build-html.mjs']),
    () => run('validate calibration', process.execPath, ['scripts/validate-calibration.mjs']),
    () => run('unit and regression tests', process.execPath, ['tests/run-all.mjs']),
    () => run('simulation smoke', process.execPath, ['scripts/run-sim.mjs']),
    () => runGate('deterministic idempotence', 'python', ['scripts/test_idempotence.py']),
    () => run('diff whitespace check', 'git', ['diff', '--check'])
  ];
  for (const step of steps) {
    const result = step();
    if (!result.ok) return result;
  }
  return { ok: true, label: 'pass' };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  if (selfTest) {
    if (!acceptedTrigger(REFINEMENT_TRIGGER)) fail('self-test trigger rejected');
    if (acceptedTrigger(REFINEMENT_TRIGGER.trimEnd())) fail('self-test accepted missing trailing space');
    console.log('refinement-pass self-test passed');
    return;
  }
  if (!acceptedTrigger(triggerValue())) {
    fail(`Refinement pass requires exact trigger phrase: ${JSON.stringify(REFINEMENT_TRIGGER)}`);
  }
  let previous = snapshot();
  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const result = runPass();
    if (!result.ok) {
      fail(`[refinement-pass] ${result.label} failed\n${result.detail}`);
    }
    const current = snapshot();
    if (sameSnapshot(previous, current)) {
      process.stdout.write('THE END\n');
      return;
    }
    previous = current;
  }
  fail(`[refinement-pass] did not converge after ${MAX_PASSES} passes`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
