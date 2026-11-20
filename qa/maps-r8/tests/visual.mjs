import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as c from '../overlay/v2/modules/english-original/english-garden-world-r8.mjs';
import * as b from '../../maps-r7/overlay/v2/modules/english-original/english-garden-world-r7.mjs';
import * as T from '../../../pages/v2/modules/math-knowledge/vendor/three-r187/three.module.js';
const raw=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r8.mjs',import.meta.url),'utf8');
const {gardenLayout,gardenStationSignPosition,gardenCameraFit}=await import('data:text/javascript,'+encodeURIComponent(raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function easeGardenZoom'))));
const titles=JSON.parse(fs.readFileSync(new URL('../../maps-r7/overlay/v2/maps-preview-r7/english-map-titles.json',import.meta.url),'utf8'));
function build(fn,nodes,nav,grade){
 const scene=new T.Scene(),owned=new Set(),own=x=>(owned.add(x),x),
  color=(c,x)=>own(new T.MeshStandardMaterial({color:c,...x})),
  mesh=(p,g,m,at=[0,0,0])=>{const obj=new T.Mesh(own(g),m);obj.position.set(...at);p.add(obj);return obj};
 fn(T,{scene,nodes,nav,grade,color,mesh,own}).animate(0);
 scene.updateMatrixWorld(true);
 let tris=0,meshes=0;
 scene.traverse(o=>{if(o.isMesh){meshes++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
 return {scene,owned,tris,meshes};
}
const v=new T.Vector3();const mark=(camera,x,y,z)=>v.set(x,y,z).project(camera).clone();
function rect(points){return [Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.y))];}
function overlap([x0,x1,y0,y1],[a0,a1,b0,b1]){return Math.max(0,Math.min(x1,a1)-Math.max(x0,a0))*Math.max(0,Math.min(y1,b1)-Math.max(y0,b0));}
for(let grade=1;grade<=6;grade++){
 const nodes=gardenLayout(titles.filter(t=>t.grade===grade)),nav=c.createGardenNavigation(nodes);
 const before=build(b.buildGarden,nodes,nav,grade),after=build(c.buildGarden,nodes,nav,grade);
 const bm=after.scene.getObjectByName('english-dyed-meadow').material;
 assert.ok(bm.map?.isDataTexture);
 assert.equal(bm.map.image.data.length,36864);
 const rgb=new Set(),data=bm.map.image.data;
 for(let i=0;i<data.length;i+=4)rgb.add(data.slice(i,i+3).join(','));
 assert.ok(rgb.size>=55);
 assert.ok(after.meshes-before.meshes<=20&&after.tris-before.tris<=3400);
 for(const obj of after.scene.children.filter(o=>/^english-wetland/.test(o.name)))obj.traverse(m=>{
  if(!m.isMesh)return;
  const a=m.geometry.attributes.position,bbox=new T.Box3().setFromObject(m);
  for(let i=0;i<a.count;i++){
   v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);
   assert.ok(v.x>1.7&&v.z>-.5&&v.z<.5&&!nav.safe({x:v.x,z:v.z}));
  }
  for(const x of [bbox.min.x,bbox.max.x])for(const z of [bbox.min.z,bbox.max.z])
   assert.ok(((x/3.48)**2+(z/.94)**2)<1);
 });
 const r=c.gardenRoadPaths(nodes,nav),o=b.gardenRoadPaths(nodes,nav);
 const oldRoute=b.createGardenRoadRouting(o,nav),newRoute=c.createGardenRoadRouting(r,nav);
 const st=nodes.map(n=>({x:n.x,z:n.z+.5}));
 let routes=0;for(const a of st)for(const z of st)if(a!==z){assert.deepEqual(oldRoute(a,z),newRoute(a,z));routes++;}
 const {aspect,overview}=gardenCameraFit(1920,839),phi=.63,theta=.08,camera=new T.PerspectiveCamera(43,aspect,.1,100);
 camera.position.set(overview*Math.sin(phi)*Math.sin(theta),overview*Math.cos(phi),overview*Math.sin(phi)*Math.cos(theta));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const stair=rect([-.53,.53].flatMap(x=>[.78,1.12].flatMap(z=>[.08,.27].map(y=>mark(camera,x,y,z)))));
 const signRect=(o,w=1.3)=>rect([-.5,.5].flatMap(x=>[-.5,.5].map(y=>v.set(w*x,.65*y,0).applyQuaternion(camera.quaternion).add(new T.Vector3(o.x,o.y,o.z)).project(camera).clone())));
 const n=nodes[6],newPos=gardenStationSignPosition(n),oldPos={x:n.x,y:2.16,z:n.z-.6};
 const oldOverlap=overlap(stair,signRect(oldPos)),newOverlap=overlap(stair,signRect(newPos));
 assert.ok(newOverlap<oldOverlap*.3);
 assert.ok(nodes.filter(o=>o!==n).every(n=>overlap(signRect(newPos),signRect(gardenStationSignPosition(n)))===0));
 console.log(JSON.stringify({grade,deltaDraws:after.meshes-before.meshes,deltaTriangles:after.tris-before.tris,paletteColors:rgb.size,routes,stairOverlap:[oldOverlap,newOverlap].map(a=>Math.round(a*1920*839/4))}));
 for(const r of [...before.owned,...after.owned])r.dispose();
}
