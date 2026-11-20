import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as candidate from '../overlay/v2/modules/english-original/english-garden-world-r7.mjs';
import * as live from '../../maps-r6/overlay/v2/modules/english-original/english-garden-world-r6.mjs';
const raw=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r7.mjs',import.meta.url),'utf8');
const {gardenLayout}=await import('data:text/javascript,'+encodeURIComponent(raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function advance'))));
const titles=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r7/english-map-titles.json',import.meta.url),'utf8'));
for(let g=1;g<=6;g++){
 const nodes=gardenLayout(titles.filter(t=>t.grade===g)),nav=candidate.createGardenNavigation(nodes),
 roads=candidate.gardenRoadPaths(nodes,nav),oldRoads=live.gardenRoadPaths(nodes,nav);
 assert.deepEqual(roads,oldRoads);
 let faces=0,pointCount=0,paths=0;
 for(const [idx,r] of roads.entries()){
  const old=live.gardenRoadMeshData(oldRoads[idx].points,nav),fresh=candidate.gardenRoadMeshData(r.points,nav);
  assert.deepEqual(fresh.indices.slice(0,old.indices.length),old.indices);
  assert.deepEqual(fresh.vertices.slice(0,old.vertices.length),old.vertices);
  if(r.name!=='village-loop'){assert.deepEqual(fresh,old);continue;}
  assert.ok(fresh.indices.length>old.indices.length);
  const baseCount=old.vertices.length/3;
  const ext=fresh.indices.slice(old.indices.length);
  faces+=ext.length/3;
  const oldEdgeSet=new Set(),edge=(a,b)=>a<b?a+':'+b:b+':'+a;
  for(let n=0;n<old.indices.length;n+=3){
   const t=old.indices.slice(n,n+3);for(let i=0;i<3;i++)oldEdgeSet.add(edge(t[i],t[(i+1)%3]));
  }
  for(let t=0;t<ext.length;t+=3){
   const ids=ext.slice(t,t+3),p=ids.map(i=>({x:fresh.vertices[i*3],y:fresh.vertices[i*3+1],z:fresh.vertices[i*3+2]}));
   assert.ok(ids.some(i=>i>=baseCount));
   assert.ok(ids.some((x,i)=>oldEdgeSet.has(edge(x,ids[(i+1)%3]))),'new strip triangle disconnected');
   for(let i=0;i<3;i++)oldEdgeSet.add(edge(ids[i],ids[(i+1)%3]));
   assert.ok(p.every(v=>v.y===.102&&v.x>1.50&&v.z>.20));
   const d=16;
   for(let i=0;i<=d;i++)for(let j=0;j<=d-i;j++){
    const k=d-i-j;
    assert.ok(nav.safe({x:Math.fround((p[0].x*i+p[1].x*j+p[2].x*k)/d),z:Math.fround((p[0].z*i+p[1].z*j+p[2].z*k)/d)}));
    pointCount++;
   }
  }
 }
 const oldRoute=live.createGardenRoadRouting(oldRoads,nav),newRoute=candidate.createGardenRoadRouting(roads,nav);
 const pts=nodes.map(p=>({x:p.x,z:p.z+.5}));
 for(const a of pts)for(const b of pts)if(a!==b){assert.deepEqual(newRoute(a,b),oldRoute(a,b));paths++;}
 console.log(JSON.stringify({grade:g,faces,pointCount,paths}));
}
