import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3,Raycaster} from '../../../pages/v2/modules/math-knowledge/vendor/three-r187/three.module.js';
import {mountWorld} from '../../../pages/v2/modules/chinese-planet/world-r7.mjs';
import {stationsOnRing} from '../../../pages/v2/modules/chinese-planet/paths.mjs';
import {buildDistricts,route} from '../overlay/v2/modules/chinese-planet/district-layout-r7.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r7/chinese-map-titles.json',import.meta.url)));
const reports=[];
for(const publisher of ['南一','康軒','翰林']){
 const stations=stationsOnRing(catalog.filter(x=>x.grade===1&&x.publisher===publisher&&x.year===115&&x.semester==='上'&&x.vocabularyCount)
 .sort((a,b)=>a.number-b.number).map(x=>({...x,kind:'literacy'})));
 const layout=buildDistricts(stations);
 const bridges=layout.edges.filter(e=>e.kind==='bridge');
 const callbacks=new Map();let fid=0,scene,frames=0,actor,unavailable;
 const doc=new EventTarget(),canvas=new EventTarget();doc.hidden=false;canvas.remove=()=>{};canvas.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:690});
 const win={devicePixelRatio:2,requestAnimationFrame(fn){callbacks.set(++fid,fn);return fid;},cancelAnimationFrame(id){callbacks.delete(id);},ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:false})};
 const arrivals=[];
 const world=mountWorld({append(){},clientWidth:1200,clientHeight:690},stations,1,{onArrive:id=>arrivals.push(id),onPick(){},onUnavailable:x=>{unavailable=x;}},{doc,win,makeRenderer:()=>({
  domElement:canvas,setPixelRatio(){},setSize(){},dispose(){},forceContextLoss(){},render(s){
   frames++;if(!scene){scene=s;actor=s.getObjectByName('yuyu-character');scene.updateMatrixWorld(true);}
  }
 })});
 let t=1000;
 function advance(){const [i,fn]=callbacks.entries().next().value;callbacks.delete(i);fn(t);t+=16.66;}
 advance();
 const deck=[],road=[],island=[],foundations=[];
 scene.traverse(o=>{if(o.name==='雙島共用橋面')deck.push(o);if(o.name==='雙島共用步道'||o.name==='圓形接點')road.push(o);if(o.name==='島面')island.push(o);if(o.name==='雙島房屋地基')foundations.push(o);});
 assert.equal(deck.length,2); assert.equal(island.length,2);
 const scan=(x,z,targets)=>new Raycaster(new Vector3(x,7,z),new Vector3(0,-1,0),0,15).intersectObjects(targets,false)[0]?.point.y;
 let floatingFootingVertices=0;
 for(const house of foundations){
  const pos=house.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
   const v=new Vector3().fromBufferAttribute(pos,i).applyMatrix4(house.matrixWorld);
   if(scan(v.x,v.z,island)===undefined)floatingFootingVertices++;
  }
 }
 assert.equal(floatingFootingVertices,0,'house pier status');
 let minFoot=Infinity,maxFoot=0,deckSamples=0;
 for(const edge of bridges)for(let i=1;i<edge.samples.length;i++){
  const a=edge.samples[i-1],b=edge.samples[i],dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);
  for(const shift of [-.4,0,.4]){
   const x=(a.x+b.x)/2-shift*dz/n,z=(a.z+b.z)/2+shift*dx/n,y=(a.y+b.y)/2;
   const top=scan(x,z,deck),land=scan(x,z,island);
   assert.ok(top!==undefined, 'Missing actual deck raycast hit');
   if(land!==undefined)assert.ok(land<=top+.007,`Terrain rises through actual deck: ${JSON.stringify({publisher,i,shift,land,top})}`);
   assert.ok(Math.abs(top-y-.020)<.002);
   deckSamples++;
  }
 }
 let expected=arrivals.length, prior=layout.spawnAt;
 const index={};
 for(const s of layout.stations)index[s.course.id]=s;
 let usedBridges=new Set(), blockingSelections=0;
 const legs=[...stations,...stations.filter((_,i)=>i%2===1).reverse(),...stations.filter((_,i)=>i%2===0)];
 for(const station of legs){
  const dst=index[station.id];
  const expectedPath=route(layout,prior,dst.id);
  if(expectedPath.some(p=>p.y>.005&&p.y<.755)) usedBridges.add(Math.sign(expectedPath.find(p=>p.y>.005&&p.y<.755).z));
  assert.ok(world.select(station));assert.equal(world.select(stations[0]),false);blockingSelections++;expected++;
  for(let i=0;i<800&&arrivals.length<expected;i++){
   advance();
   const {x,y,z}=actor.position,surface=scan(x,z,[...deck,...road]);
   assert.ok(surface!==undefined,`Actor moved outside actual navigation mesh ${JSON.stringify({x,y,z})}`);
   const d=y-surface;minFoot=Math.min(minFoot,d);maxFoot=Math.max(maxFoot,d);
   assert.ok(d>=-.014&&d<.050,`Actor foot mismatch ${d}`);
  }
  assert.equal(arrivals.at(-1),station.id);
  assert.ok(Math.hypot(actor.position.x-dst.porch.x,actor.position.z-dst.porch.z)<.006);
  prior=dst.id;
 }
 world.dispose();assert.equal(unavailable,undefined);
 reports.push({publisher,frames,arrivals:arrivals.length,floatingFootingVertices,deckSamples,blockingSelections,minFoot,maxFoot,bridgeSides:usedBridges.size});
}
console.log(JSON.stringify(reports,null,2));
