import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Vector3} from '../../../pages/v2/modules/math-knowledge/vendor/three-r187/three.module.js';
import {chineseStations} from '../../../pages/v2/modules/chinese-planet/chinese-stations.mjs';
import {stationsOnRing} from '../../../pages/v2/modules/chinese-planet/paths.mjs';
import {buildDistricts} from '../../../pages/v2/modules/chinese-planet/district-layout-r7.mjs';
import {CHINESE_LANDMARK_FORMS as forms} from '../../../pages/v2/modules/chinese-planet/lesson-landmarks-r9.mjs';
import {mountWorld} from '../../../pages/v2/modules/chinese-planet/world-r9.mjs';

const json=rel=>JSON.parse(fs.readFileSync(new URL(rel,import.meta.url)));
const lessons=json('../../../pages/v2/maps-preview-r7/chinese-map-titles.json');
const midgrade=json('../../../pages/v2/data/kangxuan-midgrade-115-catalog.json');
const originalUnits=json('../../../pages/v2/modules/chinese-grade6/chinese-grade6-original-skills.json').units;
const scopes=[];
const publishers=['南一','康軒','翰林'];
for(let grade=1;grade<=5;grade++)for(const publisher of publishers){
 const terms=(grade===3||grade===4)&&publisher==='康軒'?['上','下']:['上'];
 for(const semester of terms)scopes.push({grade,track:'publisher',year:115,semester,publisher});
}
scopes.push({grade:6,track:'original'});
function launch(stations,grade,width,height){
 const doc=new EventTarget(),canvas=new EventTarget(),callbacks=new Map(), picks=[],arrivals=[];
 doc.hidden=false;canvas.remove=()=>{};canvas.getBoundingClientRect=()=>({left:0,top:0,width,height});
 let fid=0,scene,cam,unavailable,clock=1000,fixticks=0;
 const win={devicePixelRatio:1,requestAnimationFrame(fn){callbacks.set(++fid,fn);return fid;},cancelAnimationFrame(id){callbacks.delete(id);},ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:true})};
 const world=mountWorld({append(){},clientWidth:width,clientHeight:height},stations,grade,
  {onPick:id=>picks.push(id),onArrive:id=>arrivals.push(id),onUnavailable:x=>{unavailable=x;}},
  {doc,win,makeRenderer:()=>({domElement:canvas,setPixelRatio(){},setSize(){},dispose(){},forceContextLoss(){},render(s,c){
   scene=s;cam=c;scene.updateMatrixWorld(true);cam.updateMatrixWorld(true);
  }})});
 function tick(){
  const next=callbacks.entries().next().value;assert.ok(next,unavailable||'renderer did not schedule a frame');
  const [id,fn]=next;callbacks.delete(id);fn(clock);clock+=32;fixticks++;
 }
 tick();
 return {scene,cam,world,picks,arrivals,tick,get fixticks(){return fixticks;},
  click(p){
   const b=new Event('pointerup');
   Object.assign(b,{button:0,clientX:(p.x+1)*width/2,clientY:(1-p.y)*height/2});
   canvas.dispatchEvent(b);
  }};
}
// Material-blind silhouettes from three normalised viewing angles. Center
// each projection and scale isotropically so a recolor/resize cannot pass.
const R=64,up=new Vector3(0,1,0);
const views=[[.22,.52,1],[-.86,.51,.65],[1,.48,.65]].map(x=>{
 const forward=new Vector3(...x).normalize(),right=up.clone().cross(forward).normalize();
 return [right,forward.clone().cross(right)];
});
function masks(group){
 const inverse=group.matrixWorld.clone().invert();
 const baked=[];
 group.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData.hitOnly)return;
  const local=inverse.clone().multiply(mesh.matrixWorld),attribute=mesh.geometry.attributes.position;
  const points=Array.from({length:attribute.count},(_,i)=>new Vector3().fromBufferAttribute(attribute,i).applyMatrix4(local));
  baked.push({points,index:mesh.geometry.index});
 });
 return views.map(([right,up])=>{
  const contours=baked.map(({points,index})=>({index,points:points.map(p=>[p.dot(right),p.dot(up)])}));
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const {points} of contours)for(const [x,y] of points){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const rescale=(R-6)/Math.max(x1-x0,y1-y0),ox=(x1+x0)*.5,oy=(y1+y0)*.5;
  const result=new Uint8Array(R*R);
  const area=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
  for(const row of contours){
   const p=row.points.map(([x,y])=>[(x-ox)*rescale+R*.5,(y-oy)*rescale+R*.5]),index=row.index;
   for(let j=0;j<(index?.count??p.length);j+=3){
    const [a,b,c]=[j,j+1,j+2].map(i=>p[index?.getX(i)??i]);
    const signed=area(a,b,...c);
    if(Math.abs(signed)<1e-8)continue;
    const sign=Math.sign(signed);
    for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(R-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++)
     for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(R-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++)
      if(sign*area(a,b,x+.5,y+.5)>=0&&sign*area(b,c,x+.5,y+.5)>=0&&sign*area(c,a,x+.5,y+.5)>=0)result[y*R+x]=1;
   }
  }
  return result;
 });
}
function different(a,b){
 return a.reduce((sum,am,v)=>{
  const bm=b[v];let intersection=0,union=0;
  for(let i=0;i<am.length;i++){intersection+=am[i]&bm[i];union+=am[i]|bm[i];}
  assert.ok(union);return sum+(1-intersection/union)/a.length;
 },0);
}
const scenicNames=['臨海瞭望碼頭','中央字旅廣場','上岸藏書樓','雙棚港灣市集','下岸茶園'];
const summary=[];
for(const scope of scopes){
 const {grade}=scope;
 const stations=stationsOnRing(chineseStations({lessons,lessonDisplayTitle:x=>x.title,midgrade,originalUnits},scope));
 const expectCount=grade===1?{'南一':8,'翰林':7,'康軒':6}[scope.publisher]:scope.publisher==='康軒'&&(grade===3||grade===4)?14:12;
 const tag=[grade,scope.publisher??'原創',scope.semester??''].join('/');
 assert.equal(stations.length,expectCount,tag);
 assert.ok(stations.length<=forms.length,tag+' needs another unique structural form');
 const deviceSizes=[[1920,839],[1024,768],[390,700]];
 for(const [w,h] of deviceSizes){
  const s=launch(stations,grade,w,h),houses=[];
  s.scene.traverse(o=>{if(o.name==='課程入口建築')houses.push(o);});
  assert.equal(houses.length,stations.length);
  const geometrySignatures=new Set(), minProjected={width:Infinity,height:Infinity};
  let overviewPicks=0,nearPicks=0;
  for(const [i,house] of houses.entries()){
   assert.equal(house.userData.landmarkForm,forms[i],tag);
   const art=house.getObjectByName('獨立課程地標'),hit=house.children.find(x=>x.userData.hitOnly);
   assert.ok(hit&&!hit.visible&&hit.userData.station===stations[i].id,tag+' wrong target');
   assert.ok(art.children.length>=4);
   // Fingerprint actual transforms AND mesh positions, ignoring materials and shared plinth.
   const meshShapes=[];
   art.traverse(node=>{
    if(!node.isMesh)return;
    const a=node.geometry.attributes.position,sign=[];
    for(const j of [0,1,2,a.count-1])sign.push(a.getX(j),a.getY(j),a.getZ(j));
    meshShapes.push([a.count,node.position.toArray(),node.quaternion.toArray(),node.scale.toArray(),sign]);
   });
   geometrySignatures.add(JSON.stringify(meshShapes));
   const artBox=new Box3().setFromObject(art), hitBox=new Box3().setFromObject(hit);
   assert.ok(hitBox.clone().expandByScalar(.00001).containsBox(artBox),tag+' incomplete upper hit bounds '+forms[i]);
   const p0=artBox.getCenter(new Vector3()), p1=p0.clone();p1.y=artBox.max.y-.14;
   for(const p of [p0,p1]){
    const projected=p.clone().project(s.cam);
    assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,tag+' clipped overview center/top '+forms[i]);
    s.click(projected);assert.equal(s.picks.at(-1),stations[i].id,tag+' invalid overview click '+forms[i]);overviewPicks++;
   }
   const projectedBounds=new Box3();
   art.traverse(o=>{
    if(!o.isMesh)return;
    const q=o.geometry.attributes.position;
    for(let j=0;j<q.count;j++)projectedBounds.expandByPoint(new Vector3().fromBufferAttribute(q,j).applyMatrix4(o.matrixWorld).project(s.cam));
   });
   const extents=projectedBounds.getSize(new Vector3());minProjected.width=Math.min(minProjected.width,extents.x*w*.5);minProjected.height=Math.min(minProjected.height,extents.y*h*.5);
   assert.ok(extents.x*w*.5>8&&extents.y*h*.5>8,tag+' landmark projected below recognizable size');
  }
  assert.equal(geometrySignatures.size,houses.length,tag+' duplicated landmark geometry (ignore colors)');
  assert.equal(new Set(houses.map(x=>x.userData.landmarkForm)).size,houses.length);
  let nearest=null,shapePairs=0;
  if(w===1920){
   const models=houses.map(g=>[g.userData.landmarkForm,masks(g.getObjectByName('獨立課程地標'))]);
   for(const name of scenicNames){const group=s.scene.getObjectByName(name);if(group)models.push([name,masks(group)]);}
   for(let i=0;i<models.length;i++)for(let j=0;j<i;j++){
    const [a,am]=models[i],[b,bm]=models[j],distance=different(am,bm);
    // At least 10% average foreground disagreement independently of palette.
    assert.ok(distance>.10,tag+' indistinguishable silhouette: '+[a,b,distance]);
    if(!nearest||distance<nearest.distance)nearest={names:[a,b],distance};
    shapePairs++;
   }
  }
  for(const i of [0,stations.length>>1,stations.length-1]){
   const station=stations[i];
   const priorArrivalCount=s.arrivals.length;
   assert.ok(s.world.select(station));assert.equal(s.world.select(stations[0]),false);
   for(let j=0;j<450&&s.arrivals.length===priorArrivalCount;j++)s.tick();
   assert.equal(s.arrivals.at(-1),station.id,tag+' wrong arrival');
   const actor=s.scene.getObjectByName('yuyu-character');
   const porch=grade===1?buildDistricts(stations)?.stations.find(o=>o.course.id===station.id)?.porch:{x:12.5*Math.sin(station.angle),z:12.5*Math.cos(station.angle)};
   assert.ok(Math.hypot(actor.position.x-porch.x,actor.position.z-porch.z)<.006,tag+' wrong porch');
   s.world.setNear(true);s.tick();
   const center=new Box3().setFromObject(houses[i].getObjectByName('獨立課程地標')).getCenter(new Vector3()).project(s.cam);
   assert.ok(Math.abs(center.x)<1&&Math.abs(center.y)<1,tag+' did not see reached landmark in near view');
   s.click(center);assert.equal(s.picks.at(-1),station.id,tag+' invalid near click');nearPicks++;
   s.world.setNear(false);
  }
  s.world.dispose();
  summary.push({scope:tag,window:[w,h],total:houses.length,unique:geometrySignatures.size,overviewPicks,nearPicks,arrivals:s.arrivals.length,minimumSize:Object.values(minProjected).map(n=>Math.round(n)),cpuFrames:s.fixticks,shapePairs,nearest});
 }
}
console.log(JSON.stringify(summary,null,2));
