import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as c from '../overlay/v2/modules/english-original/english-garden-world-r6.mjs';
import * as b from '../../maps-r5/overlay/v2/modules/english-original/english-garden-world-r5.mjs';
const explorer=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r6.mjs',import.meta.url),'utf8');
const {gardenLayout,advance,isAtGardenStation}=await import('data:text/javascript,'+encodeURIComponent(explorer.slice(explorer.indexOf('export function gardenLayout'),explorer.indexOf('// Fit the island'))));
const data=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r6/english-map-titles.json',import.meta.url),'utf8'));
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function degrees(a,b,c){
 const den=d(a,b)*d(b,c);return den<1e-10?0:Math.acos(Math.max(-1,Math.min(1,((b.x-a.x)*(c.x-b.x)+(b.z-a.z)*(c.z-b.z))/den)))*180/Math.PI;
}
const length=pts=>pts.slice(1).reduce((total,p,i)=>total+d(pts[i],p),0);
const maxTurn=points=>Math.max(0,...points.slice(1,-1).map((p,i)=>degrees(points[i],p,points[i+2])));
const nearBridge=points=>points.slice(1).map((p,i)=>[points[i],p]).filter(([a,b])=>Math.min(a.x,b.x)<=.67&&Math.max(a.x,b.x)>=-.67&&Math.min(a.z,b.z)<=1.18&&Math.max(a.z,b.z)>=-1.18);
for(let grade=1;grade<=6;grade++){
 const nodes=gardenLayout(data.filter(x=>x.grade===grade)),nav=c.createGardenNavigation(nodes);
 const roads=c.gardenRoadPaths(nodes,nav),baseRoads=b.gardenRoadPaths(nodes,nav);
 assert.deepEqual(roads,baseRoads);
 for(let idx=0;idx<roads.length;idx++)assert.deepEqual(c.gardenRoadMeshData(roads[idx].points,nav),b.gardenRoadMeshData(roads[idx].points,nav));
 const before=b.createGardenRoadRouting(baseRoads,nav),after=c.createGardenRoadRouting(roads,nav);
 const s=nodes.map(({x,z})=>({x,z:z+.5}));
 let pairs=0,snaps=0,bridgeMatches=0,frameSteps=0,maxOverhead=0,maxSaved=0;
 const all=[];
 for(let i=0;i<s.length;i++)for(let j=0;j<s.length;j++)if(i!==j){
  pairs++;
  const baseline=[s[i],...before(s[i],s[j])],candidate=[s[i],...after(s[i],s[j])];
  assert.deepEqual(candidate.at(-1),s[j]);
  const delta=length(candidate)-length(baseline);
  assert.ok(delta<=1e-8);
  maxOverhead=Math.max(maxOverhead,delta);maxSaved=Math.max(maxSaved,-delta);
  assert.deepEqual(nearBridge(candidate),nearBridge(baseline));
  if(nearBridge(candidate).some(([a,b])=>Math.sign(a.z)!==Math.sign(b.z)))bridgeMatches++;
  const oldTurn=maxTurn(baseline),newTurn=maxTurn(candidate);
  assert.ok(newTurn<=oldTurn+1e-5);
  all.push({from:i+1,to:j+1,oldTurn:+oldTurn.toFixed(2),newTurn:+newTurn.toFixed(2)});
  const pos={...s[i]},queue=candidate.slice(1);
  for(let frame=0;queue.length&&frame<2500;frame++){
   const prev={...pos};advance(pos,queue,1/60,nav);
   assert.ok(nav.clear(prev,pos));
   const h=c.gardenSurfaceHeight(pos);
   assert.ok(h>=c.GARDEN_BRIDGE.groundY-1e-9&&h<=c.GARDEN_BRIDGE.deckY+1e-9);
   frameSteps++;
  }
  assert.equal(queue.length,0);assert.ok(isAtGardenStation(pos,nodes[j]));snaps++;
 }
 for(const [from,to,limit] of [[4,6,74],[3,6,56],[4,7,56]]){
  const r=all.find(a=>a.from===from&&a.to===to);assert.ok(r.oldTurn>=126&&r.newTurn<limit);
 }
 console.log(JSON.stringify({grade,pairs,snaps,bridgeMatches,frameSteps,maxOverhead:+maxOverhead.toFixed(6),maxSaved:+maxSaved.toFixed(6),three:all.filter(r=>(r.from===4&&[6,7].includes(r.to))||(r.from===3&&r.to===6))}));
}
