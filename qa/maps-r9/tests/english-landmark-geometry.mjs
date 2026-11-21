import assert from 'node:assert/strict';
import fs from 'node:fs';
async function importFirst(files) {
 for(const file of files){const u=new URL(file,import.meta.url);if(fs.existsSync(u))return await import(u);}
 throw Error('Missing fixture: '+files.join(' or '));
}
function readFirst(files) {
 for(const file of files){const u=new URL(file,import.meta.url);if(fs.existsSync(u))return fs.readFileSync(u,'utf8');}
 throw Error('Missing fixture: '+files.join(' or '));
}
const T=await importFirst(['../../../pages/v2/modules/math-knowledge/vendor/three-r187/three.module.js','../../chinese-art-r6-local/modules/math-knowledge/vendor/three-r187/three.module.js']);
const root='../overlay/v2/modules/english-original/';
const fresh=await importFirst([root+'english-garden-world-r9.mjs']);
const old=await importFirst(['../../maps-r8/overlay/v2/modules/english-original/english-garden-world-r8.mjs','../../r8-overlay/v2/modules/english-original/english-garden-world-r8.mjs']);
const {STATION_LANDMARK_VARIANTS}=await importFirst([root+'english-station-landmarks-r9.mjs']);
const raw=readFirst([root+'english-exploration-r9.mjs']);
const before=readFirst(['../../maps-r8/overlay/v2/modules/english-original/english-exploration-r8.mjs','../../r8-overlay/v2/modules/english-original/english-exploration-r8.mjs']);
assert.equal(raw.replace('buildGarden,gardenStationLabel','buildGarden,themeFor').replace('english-garden-world-r9','english-garden-world-r8').replace('gardenStationLabel(n)','themeFor(n).toUpperCase()'),before,'Explorer changes must not alter camera, route, station hits, or controls.');
const {gardenLayout,gardenStationSignPosition,gardenCameraFit}=await import('data:text/javascript,'+encodeURIComponent(raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function easeGardenZoom'))));
const titles=JSON.parse(readFirst(['../../maps-r7/overlay/v2/maps-preview-r7/english-map-titles.json','../../r7-overlay/v2/maps-preview-r7/english-map-titles.json']));
function build(world,nodes,nav,grade){
 const scene=new T.Scene(),owned=new Set(),own=x=>(owned.add(x),x),
 color=(c,x)=>own(new T.MeshStandardMaterial({color:c,...x})),
 mesh=(p,g,m,at=[0,0,0])=>{const obj=new T.Mesh(own(g),m);obj.position.set(...at);p.add(obj);return obj;};
 world.buildGarden(T,{scene,nodes,nav,grade,color,mesh,own}).animate(0);scene.updateMatrixWorld(true);
 return {scene,dispose:()=>{owned.forEach(x=>x.dispose());}};
}
const size=64;
const axes=[[.22,.52,1],[-.86,.51,.65],[1,.48,.65]].map(([x,y,z])=>{
 const n=new T.Vector3(x,y,z).normalize(),a=new T.Vector3(0,1,0).cross(n).normalize(),b=n.clone().cross(a);return[a,b];
});
const getPoints=(g,fn)=>{
 const v=new T.Vector3();
 g.traverse(m=>{
  if(!m.isMesh)return;
  const attr=m.geometry.attributes.position,idx=m.geometry.index;
  const coords=Array.from({length:attr.count},(_,i)=>v.fromBufferAttribute(attr,i).applyMatrix4(m.matrixWorld).clone().sub(g.position));
  fn(coords,idx);
 });
};
function scanMasks(g){
 // Compare silhouettes with all materials removed. Each camera is normalized
 // to square world 2.25 units centered at each group's stationary anchor.
 const masks=axes.map(()=>new Uint8Array(size*size));
 getPoints(g,(v,idx)=>{
  for(const [k,[a,b]] of axes.entries()){
   const points=v.map(p=>[(p.dot(a)/2.25+.5)*size,(p.dot(b)/2.25+.20)*size]);
   for(let j=0;j<(idx?.count??points.length);j+=3){
    const [a,b,c]=[j,j+1,j+2].map(i=>points[idx?.getX(i)??i]);
    const turn=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
    const area=turn(a,b,...c);
    if(Math.abs(area)<1e-8)continue;
    const sx=Math.sign(area);
    for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(size-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++){
     for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(size-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++){
      if(sx*turn(a,b,x+.5,y+.5)>=0&&sx*turn(b,c,x+.5,y+.5)>=0&&sx*turn(c,a,x+.5,y+.5)>=0)masks[k][x+y*size]=1;
     }
    }
   }
  }
 });
 return masks;
}
function distance(a,b){
 let d=0;
 for(let k=0;k<a.length;k++){
  let overlap=0,un=0;
  for(let j=0;j<a[k].length;j++){un+=a[k][j]|b[k][j];overlap+=a[k][j]&b[k][j];}
  assert(un>0);
  d+=1-overlap/un;
 }
 return d/a.length;
}
assert.equal(titles.length,48);
const counts=[], minDistances=[];
for(let grade=1;grade<=6;grade++){
 const nodes=gardenLayout(titles.filter(t=>t.grade===grade));
 assert.equal(nodes.length,8);
 const nav=fresh.createGardenNavigation(nodes);
 const a=build(old,nodes,nav,grade),b=build(fresh,nodes,nav,grade);
 const kinds=nodes.map(fresh.stationLandmarkKind);
 assert.equal(new Set(kinds).size,8);
 assert.equal(new Set(nodes.map(fresh.gardenStationLabel)).size,8);
 assert.deepEqual(fresh.gardenFootprints(nodes),old.gardenFootprints(nodes));
 assert.deepEqual(fresh.gardenEntries(nodes),old.gardenEntries(nodes));
 const roads=fresh.gardenRoadPaths(nodes,nav),r8=old.gardenRoadPaths(nodes,nav);
 assert.deepEqual(roads,r8);
 const route=fresh.createGardenRoadRouting(roads,nav),prior=old.createGardenRoadRouting(r8,nav);
 const stops=nodes.map(n=>({x:n.x,z:n.z+.5}));
 let routes=0;for(const f of stops)for(const t of stops)if(f!==t){assert.deepEqual(route(f,t),prior(f,t));routes++;}
 const oldPaths=[],newPaths=[],change=[];
 let addedMeshes=0,addedTriangles=0;
 for(const [i,n] of nodes.entries()){
  const oldKind=old.themeFor(n),aModel=a.scene.getObjectByName('english-'+oldKind+'-'+n.id),bModel=b.scene.getObjectByName('english-'+kinds[i]+'-'+n.id);
  assert(aModel&&bModel);
  const pre=scanMasks(aModel),post=scanMasks(bModel);
  oldPaths.push([oldKind,pre]);
  newPaths.push([kinds[i],post]);
  if(!STATION_LANDMARK_VARIANTS[n.id]){assert.deepEqual(post,pre);continue;}
  assert(distance(pre,post)>.19,'Override must significantly change visible geometry: '+n.id);
  const label=gardenStationSignPosition(n);
  const {overview,aspect}=gardenCameraFit(1920,839);
  const camera=new T.PerspectiveCamera(43,aspect,.1,100),phi=.63,theta=.08;
  camera.position.set(overview*Math.sin(phi)*Math.sin(theta),overview*Math.cos(phi),overview*Math.sin(phi)*Math.cos(theta));
  camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const fp=fresh.gardenFootprints([n])[0];
  let maxRadial=0,maxY=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxVisibleY=-Infinity;
  getPoints(bModel,(mesh)=>{for(const p of mesh){
   maxRadial=Math.max(maxRadial,Math.hypot(p.x,p.z));
   maxY=Math.max(maxY,p.y+bModel.position.y);
   assert(!nav.safe({x:p.x+fp.x,z:p.z+fp.z}),'Landmark vertex outside keep-out disk: '+n.id);
   const screen=p.clone().add(bModel.position).project(camera);
   minX=Math.min(minX,screen.x);maxX=Math.max(maxX,screen.x);minY=Math.min(minY,screen.y);maxVisibleY=Math.max(maxVisibleY,screen.y);
  }});
  assert(maxRadial<=fp.r&&maxY<label.y-.25,JSON.stringify({id:n.id,maxRadial,maxY,fp,label}));
  assert(minX>=-.85&&maxX<=.85&&minY>=-.78&&maxVisibleY<=.78,JSON.stringify({id:n.id,minX,maxX,minY,maxVisibleY}));
  assert((maxVisibleY-minY)*839*.5>=26&&(maxX-minX)*1920*.5>=24,'Landmark too small in overview: '+n.id);
  const cost=g=>{let meshes=0,tris=0;getPoints(g,(p,i)=>{meshes++;tris+=(i?.count??p.length)/3;});return [meshes,tris];};
  const [oldMeshes,oldTris]=cost(aModel),[newMeshes,newTris]=cost(bModel);
  addedMeshes+=newMeshes-oldMeshes;addedTriangles+=newTris-oldTris;
  change.push([n.id,oldKind,kinds[i],+maxRadial.toFixed(3)]);
 }
 const oldUnique=new Set(oldPaths.map(([kind])=>kind));
 assert.equal(8-oldUnique.size+(grade===6?1:0),change.length);
 const ds=b.scene.children.filter(o=>o.name.startsWith('english-district-'));
 assert.equal(ds.length,2);
 for(const g of ds){
  const inherited=a.scene.getObjectByName(g.name);
  assert(inherited,'Missing preserved district anchor');
  const mask=scanMasks(g);assert.deepEqual(mask,scanMasks(inherited));
  newPaths.push([g.name.split('-').slice(3).join('-'),mask]);
 }
 assert.equal(new Set(newPaths.map(([kind])=>kind)).size,10);
 let nearest={value:Infinity};
 for(const [i,[ka,ma]] of newPaths.entries())for(const [kb,mb] of newPaths.slice(i+1)){
  const v=distance(ma,mb);
  if(v<nearest.value)nearest={value:v,pair:[ka,kb]};
  assert(v>.10,'Indistinguishable morphologies: '+JSON.stringify({grade,ka,kb,v}));
 }
 assert(addedMeshes<=23&&addedTriangles<=4200,JSON.stringify({grade,addedMeshes,addedTriangles}));
 assert.equal(routes,56);
 counts.push(change.length);minDistances.push(nearest);
 console.log(JSON.stringify({grade,routes,oldUnique:oldUnique.size,newUnique:kinds.length,nearest,addedMeshes,addedTriangles,change}));
 a.dispose();b.dispose();
}
assert.deepEqual(counts,[0,3,3,3,3,6]);
