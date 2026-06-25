#!/usr/bin/env node
import fs from 'node:fs';
export function readArtifact(path='docs/index.html'){
  const html=fs.readFileSync(path,'utf8');
  const marker='const BASE_DATA = ';
  const start=html.indexOf(marker);
  if(start<0)throw new Error('BASE_DATA missing');
  const from=start+marker.length;
  const end=html.indexOf(';\nconst BLOCKED_PATCH_KEYS',from);
  if(end<from)throw new Error('BASE_DATA end missing');
  return {html,from,end,data:JSON.parse(html.slice(from,end))};
}
export function writeArtifact(state,path='docs/index.html'){
  fs.writeFileSync(path,state.html.slice(0,state.from)+JSON.stringify(state.data)+state.html.slice(state.end));
}
