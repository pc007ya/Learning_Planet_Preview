import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Vector3} from '../../../pages/v2/modules/math-knowledge/vendor/three-r187/three.module.js';
import {mountWorld as current} from '../../../pages/v2/modules/chinese-planet/world-r7.mjs';
import {mountWorld as baseline} from '../../../pages/v2/modules/chinese-planet/world-r6.mjs';
import {insideBank} from '../../../pages/v2/modules/chinese-planet/district-layout-r7.mjs';
import {stationsOnRing} from '../../../pages/v2/modules/chinese-planet/paths.mjs';
const lessons=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r7/chinese-map-titles.json',import.meta.url)));
const list=[];
for(const publisher of ['南一','康軒','翰林'])for(const [width,height] of [[390,650],[390,844],[768,920],[1024,768],[1440,835],[1920,839]]){
 const compare=[];
 for(const mountWorld of [baseline,current]){
  const stations=stationsOnRing(lessons.filter(x=>x.grade===1&&x.publisher===publisher&&x.year===115&&x.semester==='上'&&x.vocabularyCount).sort((a,b)=>a.number-b.number).map(x=>({...x,kind:'literacy'})));
  const callbacks=new Map();let id=0,scene,camera,fault;
  const doc=new EventTarget(),canvas=new EventTarget();doc.hidden=false;canvas.remove=()=>{};
  const win={devicePixelRatio:1.4,requestAnimationFrame(fn){callbacks.set(++id,fn);return id;},cancelAnimationFrame(id){callbacks.delete(id);},ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:false})};
  const world=mountWorld({append(){},clientWidth:width,clientHeight:height},stations,1,{onArrive(){},onPick(){},onUnavailable:t=>fault=t},{doc,win,makeRenderer:()=>({
    domElement:canvas,setPixelRatio(){},setSize(){},dispose(){},forceContextLoss(){},render(s,c){scene=s;camera=c;s.updateMatrixWorld();c.updateMatrixWorld();}
  })});
  let time=1000;
  function tick(){const [id,fn]=callbacks.entries().next().value;callbacks.delete(id);fn(time);}
  tick();
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity],bridge=[],visibleStationHeights=[];
  function sample(mesh,visit){const pos=mesh.geometry.attributes.position,p=new Vector3();for(let i=0;i<pos.count;i++)visit(p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));}
  function add(p){p.project(camera);min[0]=Math.min(min[0],p.x);min[1]=Math.min(min[1],p.y);max[0]=Math.max(max[0],p.x);max[1]=Math.max(max[1],p.y);}
  scene.traverse(o=>{
   if(!o.isMesh)return;
   if(o.name==='雙島共用橋面')bridge.push(o);
   if(o.name==='島面'||o.name==='岸'||o.name==='雙島共用橋面'||o.name==='雙島共用步道')sample(o,add);
  });
  scene.traverse(g=>{
   if(g.name!=='課程入口建築')return;
   let a=Infinity,b=-Infinity;
   g.traverse(o=>{if(o.isMesh&&!o.userData.hitOnly)sample(o,p=>{const q=p.project(camera);a=Math.min(a,q.y);b=Math.max(b,q.y);});});
   visibleStationHeights.push((b-a)*height/2);
  });
  assert.equal(bridge.length,2);assert.equal(visibleStationHeights.length,stations.length);
  const fill=[(max[0]-min[0])/2,(max[1]-min[1])/2],maxNdc=Math.max(...min.map(Math.abs),...max.map(Math.abs));
  let offshoreViolations=0,activeOnscreen=0,maxHullNdc=0;
  if(mountWorld===current){
   for(let j=1;j<=120;j++){
    time=1000+j*166.67;tick();
    const ferry=scene.getObjectByName('港灣客船'),ducks=scene.children.filter(o=>o.name==='港灣游鴨'),shuttle=scene.getObjectByName('高岸接駁機');
    const project=v=>v.clone().project(camera);
    for(const o of [ferry,...ducks,shuttle]){
     const p=project(o.position);if(Math.abs(p.x)<=.95&&Math.abs(p.y)<=.95)activeOnscreen++;
    }
    for(const [o,halfX,halfZ] of [[ferry,.69,1.55],...ducks.map(o=>[o,.39,.47])]){
     for(const x of [-halfX,0,halfX])for(const z of [-halfZ,0,halfZ]){
      const p=new Vector3(x,0,z).applyAxisAngle(new Vector3(0,1,0),o.rotation.y).add(o.position);
      if(insideBank(p,0)||insideBank(p,1))offshoreViolations++;
      const np=project(p);maxHullNdc=Math.max(maxHullNdc,Math.abs(np.x),Math.abs(np.y));
     }
    }
   }
   assert.ok(maxNdc<.93,'both island geometry and both bridges must fit default');
   const actor=scene.getObjectByName('yuyu-character');
   world.setNear(true);for(let j=0;j<55;j++){time+=16.67;tick();}
   const p=actor.position.clone().project(camera);assert.ok(Math.abs(p.x)<.18&&Math.abs(p.y)<.18,'near mode still follows Yuyu');
   world.setNear(false);for(let j=0;j<105;j++){time+=16.67;tick();}
   assert.ok(actor.position.clone().project(camera).length()>0);
  }
  world.dispose();assert.equal(fault,undefined);
  compare.push({fill,maxNdc,offshoreViolations,activeOnscreen,maxHullNdc,houseHeightPx:visibleStationHeights.reduce((a,b)=>a+b,0)/visibleStationHeights.length});
 }
 assert.ok(compare[1].fill[0]*compare[1].fill[1]>compare[0].fill[0]*compare[0].fill[1]*1.09,JSON.stringify({width,height,compare}));
 assert.equal(compare[1].activeOnscreen,600);assert.equal(compare[1].offshoreViolations,0);
 list.push({publisher,width,height,oldAvgStationPixelHeight:compare[0].houseHeightPx,newAvgStationPixelHeight:compare[1].houseHeightPx,oldLandFill:compare[0].fill,newLandFill:compare[1].fill,maxWorldNdc:compare[1].maxNdc,shoreAssetCentersVisible:compare[1].activeOnscreen,activeCenterSamples:120*5,maxHullNdc:compare[1].maxHullNdc,offshoreViolations:compare[1].offshoreViolations});
}
console.log(JSON.stringify(list,null,2));
