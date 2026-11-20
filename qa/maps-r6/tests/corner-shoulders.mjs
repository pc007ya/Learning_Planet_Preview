import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as c from '../overlay/v2/modules/english-original/english-garden-world-r6.mjs';
import * as b from '../../maps-r5/overlay/v2/modules/english-original/english-garden-world-r5.mjs';
const raw=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r6.mjs',import.meta.url),'utf8');
const {gardenLayout}=await import('data:text/javascript,'+encodeURIComponent(raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function advance'))));
const data=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r6/english-map-titles.json',import.meta.url),'utf8'));
const lowerRight={x:5,z:1.3},upper={x:-2.7,z:-1.9},
 dist=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
const radius=(triangles,p)=>Math.max(...triangles.filter(tri=>dist(tri[0],p)<1e-6).flat().map(q=>dist(q,p)),0);
for(let grade=1;grade<=6;grade++){
 const nodes=gardenLayout(data.filter(x=>x.grade===grade)),nav=c.createGardenNavigation(nodes);
 const road=c.gardenRoadPaths(nodes,nav),baseline=b.gardenRoadPaths(nodes,b.createGardenNavigation(nodes));
 assert.deepEqual(road,baseline);
 for(let i=0;i<road.length;i++)assert.deepEqual(c.gardenRoadMeshData(road[i].points,nav),b.gardenRoadMeshData(baseline[i].points,nav),'center ribbon or bridge ramp changed');
 const before=b.gardenJunctionCorners(baseline,nav).flat(),after=c.gardenJunctionCorners(road,nav).flat();
 assert.equal(radius(before,upper),0);
 assert.ok(radius(after,upper)>.28);
 assert.ok(radius(after,lowerRight)>radius(before,lowerRight)+.075);
 assert.ok(after.length<=140,'cap geometry expanded unexpectedly');
 for(const [p,q,r] of after){
  const d=18;
  for(let i=0;i<=d;i++)for(let j=0;j<=d-i;j++){
   const k=d-i-j;
   assert.ok(nav.safe({x:Math.fround((p.x*i+q.x*j+r.x*k)/d),z:Math.fround((p.z*i+q.z*j+r.z*k)/d)}),'cap overlays nonwalkable terrain');
  }
 }
 console.log(JSON.stringify({grade,baselineTriangles:before.length,candidateTriangles:after.length,
   lowerRightRadius:[radius(before,lowerRight),radius(after,lowerRight)].map(x=>+x.toFixed(3)),upperRadius:+radius(after,upper).toFixed(3)}));
}
