import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDistricts,insideBank,projectOnEdge,route,triangleY} from '../overlay/v2/modules/chinese-planet/district-layout-r6.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r6/chinese-map-titles.json',import.meta.url)));
const lines=[];
for(const publisher of ['南一','康軒','翰林']){
 const lessons=catalog.filter(x=>x.grade===1&&x.year===115&&x.semester==='上'&&x.vocabularyCount&&x.publisher===publisher).sort((a,b)=>a.number-b.number);
 const L=buildDistricts(lessons),boats=L.edges.filter(x=>x.kind==='bridge');
 assert.deepEqual(L.stations.map(x=>x.course),lessons); assert.equal(boats.length,2);
 assert.ok(Math.max(...L.islandProfiles[0].map(p=>p.x))<Math.min(...L.islandProfiles[1].map(p=>p.x)),'there must be actual gap between islands');
 let pairs=0,maxSlope=0,maxFootError=0,bridgeSamples=0,waterIntervals=0;
 for(const e of L.edges){
  let water=0;
  if(e.kind!=='bridge')for(const p of e.deck.vertices)assert.ok(insideBank(p,0)||insideBank(p,1),'non-bridge ribbon crosses water');
  for(let i=0;i<e.deck.index.length;i+=3){
    const [a,b,c]=e.deck.index.slice(i,i+3).map(j=>e.deck.vertices[j]);
    assert.ok((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)>0,'upward mesh face winding required');
  }
  for(let j=1;j<e.samples.length;j++){
   const a=e.samples[j-1],b=e.samples[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
   assert.ok(d>0); const c={x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,z:(a.z+b.z)*.5};
   if(e.kind==='bridge'){
    if(!insideBank(c,0)&&!insideBank(c,1)){waterIntervals++;water++;}
    for(const shift of [-.40,0,.40]){
     const p={x:c.x-shift*dz/d,z:c.z+shift*dx/d};
     const y=triangleY(p,e.deck); assert.notEqual(y,undefined,'bridge geometry hole');
     maxFootError=Math.max(maxFootError,Math.abs(y-c.y));bridgeSamples++;
    }
    maxSlope=Math.max(maxSlope,Math.abs(b.y-a.y)/d);
   }else{
    assert.ok(insideBank(c,0)||insideBank(c,1),'non-bridge route over water');
    assert.ok(Math.abs(triangleY(c,e.deck)-c.y)<1e-5,'same road/deck interface');
   }
  }
  if(e.kind==='bridge')assert.ok(water>50,'bridge does not span true water gap');
 }
 assert.ok(waterIntervals>100,'both decks must span water rather than decorative culverts');
 assert.ok(maxSlope<.33);assert.ok(maxFootError<.014);
 const verify=(start,end,off)=>{
  const r=route(L,start,end,off);assert.ok(r?.length>1);assert.deepEqual(r[0],L.nodes.get(start));assert.deepEqual(r.at(-1),L.nodes.get(end));
  for(let i=1;i<r.length;i++)assert.ok(Math.hypot(r[i].x-r[i-1].x,r[i].z-r[i-1].z)<.13,'route cuts across unmeshed gap');
  return r;
 };
 for(const from of L.stations)for(const to of L.stations)if(from!==to){
  const r=verify(from.id,to.id);pairs++;
  for(const bridge of boats)verify(from.id,to.id,new Set([bridge.id]));
  if(from.bank!==to.bank){
   assert.ok(r.some(p=>!insideBank(p,0)&&!insideBank(p,1)));
   assert.equal(route(L,from.id,to.id,new Set(boats.map(e=>e.id))),null);
  }
 }
 for(const bridge of boats)for(const [a,b] of [[bridge.a,bridge.b],[bridge.b,bridge.a]]){
  const r=verify(a,b,new Set(boats.filter(x=>x!==bridge).map(x=>x.id)));
  assert.equal(r.length,bridge.samples.length);
  const mid=r[r.length>>1];
  assert.ok(projectOnEdge(mid,bridge).dist<1e-9);
 }
 assert.deepEqual(route(L,'spawn',L.spawnAt),[L.nodes.get(L.spawnAt)]);
 lines.push({publisher,stations:lessons.length,pairs,bridgeSamples,waterIntervals,maxSlope,maxFootError});
}
console.log(JSON.stringify(lines,null,2));
