import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const read = p => fs.readFileSync(p, 'utf8');
const base = new URL('../../../pages/',import.meta.url);
const page = new URL('v2/maps-preview-r9/index.html',base);
const loader = new URL('viewer.mjs',page);
const html = read(page), source = read(loader);
assert.match(html,/data-map="math"/);
assert.match(html,/data-map="chinese"/);
assert.match(html,/data-map="english"/);
assert.match(html,/worker-src 'none'/);
assert.match(html,/connect-src 'self' blob:/);
assert.match(html,/form-action 'none'/);
for(const filename of ['chinese-planet/map-r9.mjs','english-original/english-exploration-r9.mjs','math-mission-map/v11/planet-v11.mjs']){
 assert.ok(source.includes(`import('../modules/${filename}')`),filename);
}
for(const pattern of [/import\('([^']+)'\)/g,/load\('([^']+\.json)'\)/g]){
 for(const [,p] of source.matchAll(pattern)){
  const u=new URL(p,loader);
  assert.ok(u.href.startsWith(base.href),p);
  assert.ok(fs.statSync(fileURLToPath(u)).size>0,p);
 }
}
assert.equal(source.replaceAll('map-r9.mjs','map-r7.mjs').replaceAll('english-exploration-r9.mjs','english-exploration-r8.mjs'),
 read(new URL('v2/maps-preview-r8/viewer.mjs',base)));
console.log('R9 uses existing map interactions, titles, math baseline and same-origin-only preview.');
