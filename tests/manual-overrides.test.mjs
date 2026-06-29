import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function readBaseData(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const marker = 'const BASE_DATA = ';
  const start = html.indexOf(marker) + marker.length;
  const tail = html.slice(start);
  const endMarker = tail.match(/;\r?\nconst BLOCKED_PATCH_KEYS/);
  assert.ok(endMarker, 'BASE_DATA end marker not found');
  return JSON.parse(html.slice(start, start + endMarker.index));
}

function runPython(args, env = {}, expectedStatus = 0) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const command of candidates) {
    const result = spawnSync(command, ['scripts/apply_manual_overrides.py', ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env }
    });
    if (result.error?.code === 'ENOENT') continue;
    assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
    return result;
  }
  assert.fail('Python interpreter not found');
}

const dir = mkdtempSync(join(tmpdir(), 'fifa-manual-overrides-'));
try {
  const htmlPath = join(dir, 'index.html');
  const missingPath = join(dir, 'missing.json');
  const overridePath = join(dir, 'manual-overrides.json');
  copyFileSync('docs/index.html', htmlPath);

  const noOp = runPython(['--file', missingPath], { FIFA_WC_HTML_PATH: htmlPath });
  assert.match(noOp.stdout, /"manualOverrides": "absent"/);

  writeFileSync(overridePath, JSON.stringify({
    schema: 1,
    matches: [{ no: 73, availability: { A: { status: 'manual_verified', keyAbsences: 1 } } }]
  }), 'utf8');
  runPython(['--file', overridePath], { FIFA_WC_HTML_PATH: htmlPath }, 1);

  writeFileSync(overridePath, JSON.stringify({
    schema: 1,
    sources: [{ name: 'Verified test source', url: 'https://www.fifa.com/', use: 'test' }],
    matches: [{
      no: 73,
      source: 'Verified test source',
      sourceUrl: 'https://www.fifa.com/',
      availability: {
        A: {
          status: 'manual_verified',
          source: 'Verified test source',
          sourceUrl: 'https://www.fifa.com/',
          keyAbsences: 1,
          confirmedSuspensions: 1
        }
      }
    }]
  }), 'utf8');
  runPython(['--file', overridePath], { FIFA_WC_HTML_PATH: htmlPath });
  const data = readBaseData(htmlPath);
  const match = data.knockout.find(m => m.no === 73);
  assert.equal(match.availability.A.status, 'manual_verified');
  assert.equal(match.availability.A.keyAbsences, 1);
  assert.equal(match.availability.A.confirmedSuspensions, 1);
  assert.ok(data.sources.some(s => s.name === 'Verified test source'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('manual override tests passed');
