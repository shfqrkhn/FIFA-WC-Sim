#!/usr/bin/env node
import { runPythonScript } from './node-python.mjs';

const args = process.argv.slice(2);
const noFetch = args.includes('--no-fetch');
const scoreboardArgs = args.filter(arg => arg !== '--no-fetch');
const noFetchArg = noFetch ? ['--no-fetch'] : [];

const steps = [
  ['scripts/validate_base_data.py'],
  ['scripts/apply_scoreboard.py', ...scoreboardArgs, ...noFetchArg],
  ['scripts/enrich_predictions.py'],
  ['scripts/enrich_rest_travel.py'],
  ['scripts/enrich_weather.py', ...noFetchArg],
  ['scripts/enrich_data_quality.py'],
  ['scripts/update_health.py'],
  ['scripts/validate_base_data.py']
];

for (const [script, ...scriptArgs] of steps) {
  const status = runPythonScript(script, scriptArgs);
  if (status !== 0) process.exit(status);
}
