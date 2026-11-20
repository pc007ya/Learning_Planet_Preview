import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as candidate from '../overlay/v2/modules/english-original/english-garden-world-r8.mjs';
import * as live from '../../maps-r7/overlay/v2/modules/english-original/english-garden-world-r7.mjs';
const raw=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r8.mjs',import.meta.url),'utf8');
const {gardenLayout}=await import('data:text/javascript,'+encodeURIComponent(raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function advance'))));
const titles=JSON.parse(fs.readFileSync(new URL('../../maps-r7/overlay/v2/maps-preview-r7/english-map-titles.json',import.meta.url),'utf8'));
for(let g=1;g<=6;g++){
 const nodes=gardenLayout(titles.filter(x=>x.grade===g)),nav=candidate.createGardenNavigation(nodes);
 const a=candidate.gardenRoadPaths(nodes,nav),b=live.gardenRoadPaths(nodes,nav);
 assert.deepEqual(a,b);
 const walk=candidate.createGardenRoadRouting(a,nav),prior=live.createGardenRoadRouting(b,nav);
 const sites=nodes.map(n=>({x:n.x,z:n.z+.5}));
 let routes=0;
 for(let from of sites)for(let to of sites)if(from!==to){assert.deepEqual(walk(from,to),prior(from,to));routes++;}
 assert.equal(routes,56);
 console.log(JSON.stringify({g,routes}));
}
