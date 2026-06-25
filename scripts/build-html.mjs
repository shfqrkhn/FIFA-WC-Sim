#!/usr/bin/env node
import fs from 'node:fs';

const htmlPath = 'docs/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('World Cup 2026 Simulator')) {
  throw new Error('docs/index.html does not look like the simulator artifact.');
}
if (!html.includes('const M=')) {
  throw new Error('Embedded match array const M is missing.');
}
fs.writeFileSync(htmlPath, html);
console.log('Standalone HTML artifact ready.');
