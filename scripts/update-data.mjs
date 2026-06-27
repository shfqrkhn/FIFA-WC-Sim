#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Compatibility wrapper. The rollback-capable implementation lives in:
// scripts/update-base-data.mjs
// Its guarded steps include:
// scripts/apply_scoreboard.py
// scripts/enrich_predictions.py
// scripts/enrich_rest_travel.py
// scripts/enrich_weather.py
// scripts/enrich_data_quality.py
// scripts/update_health.py
const result = spawnSync(process.execPath, ['scripts/update-base-data.mjs', ...process.argv.slice(2)], {
  stdio: 'inherit'
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
