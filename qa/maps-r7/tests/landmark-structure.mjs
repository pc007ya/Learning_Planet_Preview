import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as c from '../overlay/v2/modules/english-original/english-garden-world-r7.mjs';
import * as b from '../../maps-r6/overlay/v2/modules/english-original/english-garden-world-r6.mjs';
import * as T from '../../../pages/v2/modules/math-knowledge/vendor/three-r187/three.module.js';
const explorer=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r7.mjs',import.meta.url),'utf8');
const {gardenLayout,gardenCameraFit}=await import('data:text/javascript,'+encodeURIComponent(explorer.slice(explorer.indexOf('export function gardenLayout'),explorer.indexOf('export function easeGardenZoom'))));
const data=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r7/english-map-titles.json',import.meta.url),'utf8'));
function build(fn,nodes,nav,grade) {
 const scene=new T.Scene(),owned=new Set(),own=x=>(owned.add(x),x),
 color=(c,args={})=>own(new T.MeshStandardMaterial({color:c,...args})),
 mesh=(parent,geometry,material,pos=[0,0,0])=>{
  const m=new T.Mesh(own(geometry),material);m.position.set(...pos);parent.add(m);return m;};
 fn(T,{scene,nodes,nav,grade,color,mesh,own}).animate(0);
 scene.updateMatrixWorld(true);
 let draws=0,tris=0;
 scene.traverse(o=>{if(o.isMesh){draws++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
 return {scene,owned,draws,tris};
}
const distinct=new Set(),vec=new T.Vector3();
for(let grade=1;grade<=6;grade++){
 const nodes=gardenLayout(data.filter(x=>x.grade===grade)),nav=c.createGardenNavigation(nodes);
 const cb=build(b.buildGarden,nodes,nav,grade),cc=build(c.buildGarden,nodes,nav,grade);
 assert.ok(cc.draws-cb.draws<=35);assert.ok(cc.tris-cb.tris<=3000);
 const anchors=cc.scene.children.filter(x=>x.name.startsWith('english-district-'));
 assert.equal(anchors.length,2);
 distinct.add(anchors.map(m=>m.name.split('-').slice(3).join('-')).join(','));
 for(const ancho of anchors){
   const footprint=ancho.position;
   let tallest=0,radius=0;
   ancho.traverse(m=>{if(m.isMesh){
     const opts=m.geometry.attributes.position;
     for(let i=0;i<opts.count;i++){
       vec.fromBufferAttribute(opts,i).applyMatrix4(m.matrixWorld);
       const r=Math.hypot(vec.x-footprint.x,vec.z-footprint.z);
       assert.ok(r<.64&& !nav.safe({x:vec.x,z:vec.z}),'landmark exceeds original collision footprint');
       radius=Math.max(radius,r);tallest=Math.max(tallest,vec.y);
     }
   }});
   assert.ok(tallest>=1.03);
   for(const [w,h] of [[1920,839],[390,680]]){
    const {aspect,overview:r}=gardenCameraFit(w,h),phi=.63,theta=.08,camera=new T.PerspectiveCamera(43,aspect,.1,100);
    camera.position.set(r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta));
    camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    for(const y of [.1,tallest]){
     vec.set(footprint.x,y,footprint.z).project(camera);
     assert.ok(Math.abs(vec.x)<.97&&Math.abs(vec.y)<.95,'district anchor outside initial camera');
    }
   }
 }
 for(let k=0;k<1000;k++){
   const a=k/1000*2*Math.PI,d=c.gardenVisualShoreFactor(a,grade)-b.coastFactor(a);
   assert.ok(d>=0&&d<=.019);
 }
 const layers=c.gardenShorePromontoryRings(grade),previous=b.gardenShorePromontoryRings(grade);
 const maxY=rings=>Math.max(...rings.flat(2).map(x=>x[1]));
 assert.ok(maxY(layers)>maxY(previous)+.35);
 for(const group of layers)for(const points of group)for(const [x,y,z] of points){
  assert.ok(!nav.safe({x,z}));
  for(let t=0;t<192;t++){
   const f=c.gardenFerryPose(t/192*2*Math.PI/.16),dx=x-f.x,dz=z-f.z;
   const lx=Math.cos(f.heading)*dx-Math.sin(f.heading)*dz,lz=Math.sin(f.heading)*dx+Math.cos(f.heading)*dz;
   assert.ok(lx < -1.32 || lx > .78 || Math.abs(lz)>.53);
  }
 }
 const southeast=c.gardenVisualShoreFactor(.55,grade)-b.coastFactor(.55);
 assert.ok(southeast>.009);
 const bounds=(scene,prefix)=>{const phi=.63,theta=.08,w=1920,h=839,{aspect,overview:r}=gardenCameraFit(w,h),cam=new T.PerspectiveCamera(43,aspect,.1,100);
  cam.position.set(r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta));cam.lookAt(0,0,0);cam.updateMatrixWorld(true);
  return scene.children.filter(o=>o.name.startsWith(prefix)).map(group=>{
   let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
   group.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;
    for(let i=0;i<a.count;i++){vec.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).project(cam);x0=Math.min(x0,vec.x);x1=Math.max(x1,vec.x);y0=Math.min(y0,vec.y);y1=Math.max(y1,vec.y);}
   });
   return [Math.round((x1-x0)/2*w),Math.round((y1-y0)/2*h)];
  });
 };
 console.log(JSON.stringify({grade,anchors:anchors.map(m=>m.name),deltaDraws:cc.draws-cb.draws,deltaTriangles:cc.tris-cb.tris,southeast:+southeast.toFixed(4),rises:[+maxY(previous).toFixed(2),+maxY(layers).toFixed(2)],screenBoundsBefore:bounds(cb.scene,'english-headland-'),screenBoundsAfter:bounds(cc.scene,'english-district-')}));
 for(const v of [...cb.owned,...cc.owned])v.dispose();
}
assert.equal(distinct.size,6);
