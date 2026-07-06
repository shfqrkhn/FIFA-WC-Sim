import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  FIFA_UI_BASE_URL: process.env.FIFA_UI_BASE_URL || 'https://shfqrkhn.github.io/FIFA-WC-Sim/',
  FIFA_UI_EXHAUSTIVE: process.env.FIFA_UI_EXHAUSTIVE || '1'
};

const result = spawnSync(command, ['playwright', 'test', 'tests/ui-smoke.spec.mjs'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
});

process.exit(result.status ?? 1);
