#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runPythonScript } from './node-python.mjs';

const args = process.argv.slice(2);
const noFetch = args.includes('--no-fetch');
const scoreboardArgs = args.filter(arg => arg !== '--no-fetch');
const fetchArgs = noFetch ? ['--no-fetch'] : [];
const COMMIT_CANDIDATES = [
  'docs/index.html',
  'data/latest-update.json',
  'data/update-health.json',
  'data/prediction-audit.json',
  'data/calibration-state.json'
];

function snapshot(paths) {
  return new Map(paths.map(path => [
    path,
    fs.existsSync(path) ? fs.readFileSync(path) : null
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

function runNode(script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const steps = [
  ['validate baseline', () => runPythonScript('scripts/validate_base_data.py')],
  ['freeze pre-match predictions', () => runNode('scripts/freeze-predictions.mjs')],
  ['apply scoreboard', () => runPythonScript('scripts/apply_scoreboard.py', [...scoreboardArgs, ...fetchArgs])],
  ['enrich predictions', () => runPythonScript('scripts/enrich_predictions.py')],
  ['enrich rest/travel', () => runPythonScript('scripts/enrich_rest_travel.py')],
  ['enrich weather', () => runPythonScript('scripts/enrich_weather.py', fetchArgs)],
  ['enrich data quality', () => runPythonScript('scripts/enrich_data_quality.py')],
  ['score frozen predictions', () => runNode('scripts/score-predictions.mjs')],
  ['update calibration', () => runNode('scripts/update-calibration.mjs')],
  ['update health artifact', () => runPythonScript('scripts/update_health.py')],
  ['validate updated data', () => runPythonScript('scripts/validate_base_data.py')],
  ['validate prediction audit calibration', () => runNode('scripts/validate-calibration.mjs')],
  ['validate extract/build shape', () => runNode('scripts/build-html.mjs')],
  ['validate wrapper', () => runNode('scripts/validate.mjs')]
];

const before = snapshot(COMMIT_CANDIDATES);
console.log(`Starting BASE_DATA update (${noFetch ? 'no-fetch' : 'fetch-enabled'}).`);
for (const [label, step] of steps) {
  console.log(`\n[update-base-data] ${label}`);
  let status = 1;
  try {
    status = step();
  } catch (error) {
    console.error(`[update-base-data] ${label} threw: ${error.message}`);
    restore(before);
    process.exit(1);
  }
  if (status !== 0) {
    console.error(`[update-base-data] ${label} failed with exit ${status}; restored commit-candidate files.`);
    restore(before);
    process.exit(status);
  }
}
console.log('\nBASE_DATA update completed and validated.');
