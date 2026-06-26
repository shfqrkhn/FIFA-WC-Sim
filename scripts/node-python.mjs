#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const PYTHON_CANDIDATES = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

export function runPythonScript(script, args = []) {
  const display = [script, ...args].join(' ');
  const missing = [];
  for (const command of PYTHON_CANDIDATES) {
    const result = spawnSync(command, [script, ...args], { stdio: 'inherit' });
    if (result.error?.code === 'ENOENT') {
      missing.push(command);
      continue;
    }
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  console.error(`Python interpreter not found for ${display}. Tried: ${missing.join(', ')}`);
  return 1;
}
