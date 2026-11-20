import * as THREE from '../math-knowledge/vendor/three-r187/three.module.js';
import {mergeGeometries} from '../math-mission-map/v11/vendor/BufferGeometryUtils.js';
import {createYuyu} from '../math-mission-map/v11/planet-yuyu.mjs';
import {ROAD_RADIUS,PORCH_RADIUS,HOUSE_RADIUS,RIBBON_WIDTH,polar,canWalk,walkRoute} from './paths.mjs';

const themes=[
 [0x7dbea0,0x336d62,0xe97465,0xffcb70,0xea97b9],
 [0x9fbf79,0x446c50,0xdd7948,0xf9c76d,0xf0a881],
 [0x79b4bd,0x345b73,0x4f91b0,0xfece80,0xaa92cc],
 [0x9faccf,0x4d547e,0x7b6ab4,0xf7bd6c,0xc49fda],
 [0xb1ad83,0x595c46,0x975d6c,0xf9d88b,0xe8896d],
 [0x7c9ba4,0x3d5167,0x506c90,0xf1c481,0xa98ec5]
];
export function mountWorld(container,stations,grade,{onArrive,onPick,onUnavailable,onZoom},{
 makeRenderer=options=>new THREE.WebGLRenderer(options),
 win=container.ownerDocument.defaultView,
 doc=container.ownerDocument,
}={}){
 const scene=new THREE.Scene(), palette=themes[grade-1]||themes[0], level=Math.max(1,Math.min(6,grade));
 scene.background=new THREE.Color(0x24475d);
 scene.fog=new THREE.FogExp2(0x24475d,.008);
 const cam=new THREE.PerspectiveCamera(40,1,.1,160);
 const renderer=makeRenderer({alpha:false,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,1.40));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 container.append(renderer.domElement);
 const geometries=new Set(),materials=new Set(),materialCache=new Map();
 let dead=false,observer=null,frame=0,cleanupListeners=()=>{};
 function dispose(){
  if(dead)return;dead=true;
  if(frame)win.cancelAnimationFrame(frame);
  observer?.disconnect();cleanupListeners();
  renderer.domElement.remove();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  renderer.dispose();renderer.forceContextLoss();
 }
 try{
 const own=x=>{(x.isMaterial?materials:geometries).add(x);return x;};
 const color=(value,opts={})=>{
  const key=JSON.stringify([value,opts]);if(!materialCache.has(key))materialCache.set(key,own(new THREE.MeshStandardMaterial({color:value,roughness:.84,...opts})));return materialCache.get(key);
 };
 function mesh(parent,geom,mat,pos){const m=new THREE.Mesh(own(geom),mat);if(pos)m.position.set(...pos);parent.add(m);return m;}
 const boxGeo=new THREE.BoxGeometry(1,1,1), sphereGeo=new THREE.SphereGeometry(1,11,7), cylGeo=new THREE.CylinderGeometry(1,1,1,10);
 const cub=(group,x,y,z,w,h,d,mat)=>{const m=mesh(group,boxGeo,mat,[x,y,z]);m.scale.set(w,h,d);return m;};
 const oval=(group,x,y,z,w,h,d,mat)=>{const m=mesh(group,sphereGeo,mat,[x,y,z]);m.scale.set(w,h,d);return m;};
 const tube=(group,x,y,z,w,h,d,mat)=>{const m=mesh(group,cylGeo,mat,[x,y,z]);m.scale.set(w,h,d);return m;};
 const hemi=new THREE.HemisphereLight(0xffeee0,0x657b91,2.3);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffdfaf,2.5);sun.position.set(-10,18,4);scene.add(sun);
 const rim=new THREE.DirectionalLight(0x93cfec,.85);rim.position.set(11,10,-12);scene.add(rim);
 const lawn=color(palette[0]),base=color(palette[1]),sand=color(0xe4c289),path=color(0xf4d9a7),wood=color(0x8a5447),paper=color(0xffebc2),dark=color(0x433d48),gold=color(palette[3],{emissive:palette[3],emissiveIntensity:.28});
 const roof=[color(palette[2]),color(palette[4]),color(0x438f8d)],foliage=[color(palette[1]),color(0x699876),color(palette[4])];
 const rocks=[color(0x6d7f87),color(0x94a4a4),color(0x5e717b)];
 const terrain=new THREE.Group();scene.add(terrain);
 // One continuous shoreline mesh. The lane and its house foundations
 // deliberately stay on a level annulus; raised hinterland does not alter moves.
 const phase=(level-1)*1.29;
 const shore=a=>17.25+.43*Math.sin(3*a+phase)+.31*Math.cos(5*a-.34*phase)+.22*Math.sin(8*a+phase);
 const smooth=x=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
 const floor=(x,z)=>{
  const r=Math.hypot(x,z),a=Math.atan2(x,z);
  if(r<8.5){const shape=Math.sin(a*2+phase),peak=(.13+level*.083)*(.48+.52*shape*shape);return smooth((8.5-r)/2.1)*smooth((r-2.7)/2.2)*peak;}
  if(r>15.25&&r<16.7){const shape=Math.sin(a*3+phase);return smooth((r-15.25)/.45)*smooth((16.7-r)/.59)*(.15+level*.048)*shape*shape;}
  return 0;
 };
 function bands(parent,rings,mat,steps=96,name=''){
  const points=[],idx=[],uv=[];
  for(const ring of rings)for(let j=0;j<steps;j++){const a=j*2*Math.PI/steps;const [r,y]=ring(a);const [x,z]=polar(a,r);points.push(x,y,z);uv.push(j/steps,y);}
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<steps;j++){
   const a=i*steps+j,b=i*steps+(j+1)%steps,c=a+steps,d=b+steps;
   idx.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const m=mesh(parent,geo,mat);m.name=name;return m;
 }
 const land=(a,r)=>[r,floor(...polar(a,r))];
 const centers=[.002,.8,2.7,3.5,4.6,5.6,6.6,7.4,8.25,9.1,10.9,12.4,14.9,15.6,16.1];
 const terrainMat=own(new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,vertexColors:true}));
 const landTop=bands(terrain,[...centers.map(r=>a=>land(a,r)),a=>[shore(a)-.3,-.13]],terrainMat,96,'字旅島地面');
 const positions=landTop.geometry.getAttribute('position'), colors=[];
 const verdure=new THREE.Color(palette[0]), shaded=verdure.clone().lerp(new THREE.Color(palette[1]),.33), dry=verdure.clone().lerp(new THREE.Color(0xdac37a),.36);
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z),a=Math.atan2(x,z), mottling=.35+.25*Math.sin(x*.9+Math.cos(z*.8))+.2*Math.sin(z*1.13+phase);
  const tone=verdure.clone().lerp(r>13.4?dry:shaded,mottling);
  colors.push(tone.r,tone.g,tone.b);
 }
 landTop.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const edges=[
  [-.13,-.31,-.30,-.07,color(0xc5a576)],[-.31,-.53,-.07,.09,sand],
  [-.53,-.74,.09,.14,color(0xa88167)],[-.74,-1.31,.14,.03,base],
  [-1.31,-2.10,.03,-.54,dark]
 ];
 for(const [hi,low,s0,s1,mat] of edges)bands(terrain,[a=>[shore(a)+s0,hi],a=>[shore(a)+s1,low]],mat,96,'海岸地層');
 function flatRing(parent,r,w,mat,y){const m=mesh(parent,new THREE.RingGeometry(r-w,r+w,120),mat,[0,y,0]);m.rotation.x=-Math.PI/2;return m;}
 const sea=mesh(scene,new THREE.PlaneGeometry(240,240),color(0x347b8d,{roughness:.77}),[0,-1.34,0]);sea.rotation.x=-Math.PI/2;
 bands(terrain,[a=>[shore(a),-1.29],a=>[shore(a)+1.28,-1.29]],color(0x68a8aa),96,'淺水灣');
 for(let i=0;i<2;i++){
  const w=a=>.025+.053*Math.pow(.5+.5*Math.sin(a*11+phase+i),2);
  const r=a=>shore(a)+.51+i*1.08+.09*Math.sin(a*7+phase);
  bands(terrain,[a=>[r(a)-w(a),-1.27],a=>[r(a)+w(a),-1.27]],color(i?0x89bec4:0xbed9cf),120,'潮線');
 }
 flatRing(terrain,ROAD_RADIUS,RIBBON_WIDTH+.095,color(0xbc9e72),.008);
 flatRing(terrain,ROAD_RADIUS,RIBBON_WIDTH,path,.014);
 const plan=new THREE.Group();scene.add(plan);
 const books=(group,x,y,z,turn)=>{
  const b=new THREE.Group();b.position.set(x,y,z);b.rotation.y=turn;group.add(b);
  for(let j=0;j<3;j++){
    cub(b,0,j*.145,0,1.04,.113,.64,roof[j]);cub(b,.045,j*.145+.015,.09,.94,.066,.52,paper);
    cub(b,-.479,j*.145+.025,0,.09,.165,.67,roof[j]);
  }return b;
 };
 function tree(x,z,s,i){
  const group=new THREE.Group();group.position.set(x,floor(x,z),z);group.scale.setScalar(s);terrain.add(group);
  tube(group,0,.43,0,.095,.86,.095,wood);
  if((i+level)%4===0||level===4){
   for(let k=0;k<3;k++){const g=mesh(group,new THREE.ConeGeometry(.57-.105*k,.52,10),foliage[k===2?1:0],[.03*k,.72+.27*k,0]);g.rotation.y=k*.30;}
  }else{
   oval(group,-.18,1.02,.08,.51,.58,.42,foliage[i%3]);oval(group,.27,.89,-.12,.43,.42,.4,foliage[(i+1)%3]);
   oval(group,.1,1.34,.06,.39,.44,.39,foliage[i%3]);
   if(level===1||level===5)for(let k=0;k<5;k++){const [xx,zz]=polar(k*2.4,.26);oval(group,xx,1.43+.11*Math.sin(k*2),zz,.11,.09,.11,foliage[2]);}
  }
 }
 for(let i=0;i<31;i++){
  const a=i*2.399963, r=i%4===0?15.9:3.5+(i*173%49)/10;
  const [x,z]=polar(a,r);
  if(r>12&&r>shore(a)-.72)continue;
  if(r>12&&stations.some(s=>Math.abs(Math.atan2(Math.sin(s.angle-a),Math.cos(s.angle-a)))<.12))continue;
  tree(x,z,.68+(i*73%48)/100,i);
 }
 for(let i=0;i<22;i++){
  const a=i*2.399963+1.61,r=i%2?shore(a)-.32:6.6,[x,z]=polar(a,r);
  const crag=mesh(terrain,new THREE.DodecahedronGeometry(.37+(i%3)*.10),rocks[i%3],[x,floor(x,z)+(r>15?-.14:.09),z]);crag.scale.set(1,.66,.82);crag.rotation.set(i*.22,i*1.39,i*.18);
 }
 // Central reading court: stepped terrace, ornamental pond and stacked volumes.
 for(const r of [2.68,2.29,1.83])tube(terrain,0,.048+(2.68-r)*.12,0,r,.105,r,sand);
 tube(terrain,0,.23,0,1.54,.10,1.54,color(0x5babb5));
 flatRing(terrain,1.52,.075,paper,.292);
 tube(terrain,0,.30,0,.55,.16,.55,wood);books(terrain,0,.57,0,.23);
 for(let i=0;i<10;i++){const [x,z]=polar(i*Math.PI/5,2.45);oval(terrain,x,.16,z,.10,.13,.10,gold);}
 const stone=color(0x8f9291),bronze=color(0x89705b),lacquer=color(0xa65140),ridge=color(0x413b52);
 const darkRed=color(0x8c3f3f),shell=color(0xcf804e),shade=color(0x618773),white=color(0xffe3bd);
 const pickables=[];
 function timber(group,a,b,r,mat){
  const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),d=w.clone().sub(v);const c=v.addScaledVector(d,.5);
  const sh=tube(group,c.x,c.y,c.z,r,d.length(),r,mat);sh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return sh;
 }
 // Eaves curve upward at the corners, with real ridges and matching trim.
 function hip(g,y,w,d,h,mat){
  const v=[],idx=[],uv=[],n=12;
  for(let u=0;u<=n;u++){
   const q=u/n,t=2*q-1,limit=1-.33*Math.abs(t)**3;
   for(let j=0;j<=n;j++){
    const p=j/n,o=2*p-1;
    const x=t*w*.5,z=o*d*.5*limit;
    const edge=.10*Math.abs(t)**5*Math.abs(o)**2;
    v.push(x,y+h*(1-Math.abs(o)**.73)*(1-.2*Math.abs(t)**5)+edge,z);uv.push(q,p);
    if(u<n&&j<n){const a=u*(n+1)+j,b=a+1,c=a+n+1,e=c+1;idx.push(a,b,c,b,e,c);}
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  mesh(g,geo,mat);
  for(const side of [-1,1]){
   const coords=[];
   for(let k=0;k<=10;k++){const t=k/5-1;coords.push([t*w*.5,y+.10*Math.abs(t)**5,side*d*.5*(1-.33*Math.abs(t)**3)]);}
   for(let k=1;k<coords.length;k++)timber(g,coords[k-1],coords[k],.027,ridge);
  }
  cub(g,0,y+h,0,w*.76,.061,.08,ridge);
  for(const side of [-1,1])oval(g,side*w*.39,y+h,0,.07,.084,.061,gold);
 }
 function columns(g,x,z,y,h,mat){
  tube(g,x,y+h*.5,z,.055,h,.055,mat);
  cub(g,x,y+.035,z,.17,.07,.17,stone);
  cub(g,x,y+h-.04,z,.14,.08,.14,wood);
 }
 function lantern(g,x,y,z,scale=1){
  timber(g,[x,y+.24*scale,z],[x,y+.09*scale,z],.016,wood);
  oval(g,x,y,z,.10*scale,.12*scale,.10*scale,lacquer);
  tube(g,x,y+.085*scale,z,.061*scale,.029*scale,.061*scale,gold);
  timber(g,[x,y-.08*scale,z],[x,y-.17*scale,z],.020,gold);
 }
 for(const [i,s] of stations.entries()){
  const [x,z]=polar(s.angle,HOUSE_RADIUS),[px,pz]=polar(s.angle,(ROAD_RADIUS+PORCH_RADIUS)/2);
  const g=new THREE.Group();g.position.set(x,.02,z);g.rotation.y=s.angle+Math.PI;plan.add(g);
  const connector=cub(plan,px,.016,pz,RIBBON_WIDTH*1.98,.023,PORCH_RADIUS-ROAD_RADIUS+.38,path);connector.rotation.y=s.angle;
  const [porchX,porchZ]=polar(s.angle,PORCH_RADIUS-.06);
  tube(plan,porchX,.019,porchZ,.70,.021,.70,path);
  const form=s.kind==='outline'?3:s.kind==='original'?(i%3===0?1:4):(i+level*2)%5,front=roof[(i+level)%3];
  const foot=form===3?.73:.89;
  const foundation=cub(g,0,.078,0,foot*2,.16,1.62,stone);
  cub(g,0,.165,0,foot*1.84,.075,1.42,sand);
  cub(g,0,.077,.915,.53,.145,.37,stone);
  const walls=cub(g,0,.66,-.07,1.36,.96,1.13,form===2?lacquer:paper);
  const door=cub(g,0,.51,.509,.39,.666,.051,wood);
  const accent=form===4?darkRed:lacquer;
  for(const side of [-1,1]){
   columns(g,side*.73,.60,.18,.95,accent);
   cub(g,side*.429,.68,.524,.35,.36,.04,wood);
   cub(g,side*.429,.68,.551,.285,.29,.027,gold);
   for(const q of [-1,0,1])cub(g,side*.429+q*.069,.68,.571,.023,.29,.016,wood);
   for(const q of [-1,1])cub(g,side*.429,.68+q*.051,.572,.29,.019,.014,wood);
   oval(g,side*.067,.53,.543,.024,.026,.029,bronze);
  }
  cub(g,0,1.005,.614,.60,.16,.083,accent);
  for(let t=0;t<3;t++)cub(g,.105*(t-1),1.011,.664,.049,.039,.012,gold);
  if(form===0){
   hip(g,1.15,1.97,1.66,.44,front);
   cub(g,-.67,.37,.27,.26,.29,.57,white);cub(g,.67,.37,.27,.26,.29,.57,white);
   lantern(g,-.6,1.01,.817);lantern(g,.6,1.01,.817);
  }else if(form===1){
   hip(g,1.12,1.95,1.57,.29,front);
   cub(g,0,1.48,-.11,.85,.47,.78,paper);
   cub(g,0,1.50,.301,.46,.29,.058,lacquer);
   hip(g,1.75,1.27,1.16,.28,front);oval(g,0,2.07,0,.07,.139,.07,gold);
  }else if(form===2){
   hip(g,1.15,1.84,1.64,.38,front);
   for(const side of [-1,1]){
    cub(g,side*.70,.63,.06,.12,.89,1.22,white);
    cub(g,side*.75,1.16,-.19,.16,.15,.99,white);cub(g,side*.75,1.31,-.35,.155,.15,.67,white);
   }
   lantern(g,.42,.97,.85,1.16);
  }else if(form===3){
   // Index-only archive: open kiosk, horizontally striped brass sign.
   walls.visible=false;door.visible=false;walls.position.z=-.96;walls.scale.set(1.32,.94,.17);walls.visible=true;
   door.position.z=-.838;
   for(const side of [-1,1])columns(g,side*.61,-.66,.18,.95,wood);
   hip(g,1.14,1.87,1.61,.31,front);
   books(g,0,.34,.12,.19);lantern(g,0,.94,.75,1.07);
  }else{
   hip(g,1.18,1.96,1.62,.41,front);
   for(const side of [-1,1]){cub(g,side*.67,.43,.59,.28,.12,.65,wood);lantern(g,side*.55,.98,.86);}
   const stack=books(g,-.18,1.68,-.17,-.15);stack.scale.setScalar(.71);
  }
  // Convex raycast hull spans the roof and body; no visual/rendering contribution.
  const hit=cub(g,0,.93,0,1.70,1.78,1.51,stone);hit.visible=false;hit.userData.hitOnly=true;hit.userData.station=s.id;pickables.push(hit);
 }
 // Off-road details never collide with course access.
 for(let i=0;i<16;i++){
  const a=i*2.39996+1.4,r=i%2?8.14:16.1,[x,z]=polar(a,r);
  if(r>12&&r>shore(a)-.72)continue;
  if(r>12&&stations.some(s=>Math.abs(Math.atan2(Math.sin(s.angle-a),Math.cos(s.angle-a)))<.15))continue;
  const bloom=color(i%2?0xef85a8:0xf3ca72);
  for(let j=0;j<5;j++){const [dx,dz]=polar(j*1.2566,.115);oval(terrain,x+dx,floor(x,z)+.104,z+dz,.10,.072,.10,bloom);}
  oval(terrain,x,floor(x,z)+.133,z,.061,.061,.061,gold);
 }
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4 + .15,[x,z]=polar(a,7.4);
  const bench=new THREE.Group();bench.position.set(x,floor(x,z)+.01,z);bench.rotation.y=a;terrain.add(bench);
  cub(bench,0,.28,0,.71,.1,.27,wood);cub(bench,0,.46,-.11,.71,.23,.08,wood);
  for(const sign of [-1,1])cub(bench,sign*.24,.13,0,.085,.26,.18,wood);
 }
 // Sightseeing pier spans land to shallows. The course lane stays separate.
 const facing=.77+level*.22;
 const dock=new THREE.Group();dock.rotation.y=facing;terrain.add(dock);
 const dockStart=shore(facing)-1.00, dockEnd=shore(facing)+2.68;
 function dockY(r){const t=(r-dockStart)/(dockEnd-dockStart);return .05+Math.sin(Math.PI*t)*.33;}
 for(let i=0;i<=20;i++){
  const r=dockStart+(dockEnd-dockStart)*i/20,y=dockY(r);
  cub(dock,0,y,r,1.25,.088,.166,i%3===0?lacquer:wood);
  for(const d of [-1,1]){
   if(i%4===0){
    tube(dock,d*.495,(y-1.35)*.5,r,.043,y+1.35,.043,bronze);
    tube(dock,d*.495,y+.325,r,.043,.65,.043,wood);
    oval(dock,d*.495,y+.67,r,.070,.071,.070,gold);
   }
   if(i>0){const prev=r-(dockEnd-dockStart)/20;timber(dock,[d*.495,dockY(prev)+.49,prev],[d*.495,y+.49,r],.025,wood);}
  }
 }
 cub(dock,0,-.047,dockEnd+.60,2.15,.16,1.33,wood);
 for(const d of [-1,1]){
  columns(dock,d*.75,dockEnd+.9,.02,1.55,lacquer);
  lantern(dock,d*.75,1.18,dockEnd+.9);
  tube(dock,d*.75,-.62,dockEnd+.6,.10,1.22,.10,bronze);
 }
 const gate=new THREE.Group();gate.position.set(0,.12,dockEnd+1.55);dock.add(gate);hip(gate,1.53,2.05,1.16,.33,roof[0]);
 // Main civic landmark changes by grade (school, tea garden, pavilion, etc).
 const court=new THREE.Group();court.rotation.y=-.58+level*.37;terrain.add(court);
 if(level===2||level===4||level===6){
  court.position.set(0,.28,0);
  for(const side of [-1,1])for(const z of [-.85,.85]){
   columns(court,side*.80,z,0,1.59,lacquer);lantern(court,side*.80,1.38,z,1.36);
  }
  hip(court,1.59,2.64,2.40,.58,roof[0]);
  if(level===6){cub(court,0,1.98,0,1.20,.35,.96,white);hip(court,2.19,1.61,1.48,.45,roof[1]);}
 }else{
  court.position.set(0,.30,0);
  for(const d of [-1,1]){
   const x=d*1.76,z=.20;columns(court,x,z,0,1.70,lacquer);lantern(court,x,1.36,z,1.42);
  }
  hip(court,1.75,3.89,1.16,.36,roof[1]);
  cub(court,0,1.49,.23,1.79,.25,.16,lacquer);
  for(let i=0;i<5;i++)cub(court,(i-2)*.26,1.49,.35,.085,.10,.016,gold);
 }
 const amber=color(0xed933d), ivory=color(0xffdfa5), ink=color(0x43394d), waterWake=color(0xaed3c9);
 const ducks=[];
 for(let i=0;i<3;i++){
  const duck=new THREE.Group();scene.add(duck);ducks.push(duck);
  duck.scale.setScalar(i?(.67-.08*i):1);
  oval(duck,0,0,0,.34,.22,.47,ivory);oval(duck,0,.235,.28,.24,.24,.23,ivory);
  oval(duck,0,.19,.478,.132,.061,.168,amber);oval(duck,0,.144,.521,.11,.041,.11,gold);
  for(const side of [-1,1]){
   oval(duck,.162*side,.28,.405,.034,.042,.034,ink);
   oval(duck,.181*side,.295,.424,.013,.013,.012,paper);
   const wing=oval(duck,.274*side,.032,-.084,.086,.154,.29,sand);wing.rotation.x=-.19;
  }
  const tail=oval(duck,0,.097,-.34,.19,.13,.24,ivory);tail.rotation.x=-.49;
  oval(duck,0,-.15,-.43,.15,.017,.49,waterWake);
 }
 const sampan=new THREE.Group();scene.add(sampan);
 const hull=oval(sampan,0,-.065,0,.49,.235,1.07,wood);
 oval(sampan,0,.046,.01,.455,.12,.995,bronze);oval(sampan,0,.141,0,.362,.047,.847,sand);
 for(const side of [-1,1]){
  timber(sampan,[side*.08,.15,-.78],[side*.407,.14,-.25],.026,wood);
  timber(sampan,[side*.407,.14,-.25],[side*.36,.17,.43],.026,wood);
  timber(sampan,[side*.36,.17,.43],[side*.08,.224,.93],.026,wood);
  for(const dz of [-.47,.33])timber(sampan,[side*.31,.13,dz],[side*.27,.65,dz],.025,wood);
 }
 hip(sampan,.61,.69,.93,.16,roof[0]);lantern(sampan,0,.42,.42,.64);
 oval(sampan,0,-.11,-1.11,.235,.017,.72,waterWake);
 const shuttle=new THREE.Group();scene.add(shuttle);
 const glass=color(0x88cbd8,{metalness:.16,roughness:.40});
 oval(shuttle,0,0,-.05,.52,.28,1.03,roof[0]);oval(shuttle,0,.205,.22,.35,.21,.56,glass);
 oval(shuttle,0,-.11,.14,.39,.08,.81,paper);
 for(const side of [-1,1]){
  const wing=oval(shuttle,side*.50,-.065,-.29,.55,.071,.40,bronze);wing.rotation.y=side*.40;
  oval(shuttle,side*.65,-.032,-.31,.157,.14,.52,dark);
  oval(shuttle,side*.65,-.035,-.76,.113,.111,.10,gold);
  oval(shuttle,side*.96,-.01,-.50,.068,.052,.091,gold);
 }
 const fox=new THREE.Group();terrain.add(fox);
 const foxA=.84+level*.87,[fx,fz]=polar(foxA,6.1);
 fox.position.set(fx,floor(fx,fz),fz);fox.rotation.y=foxA-.48;
 oval(fox,0,.226,-.065,.173,.17,.29,shell);oval(fox,0,.374,.171,.15,.151,.145,shell);
 oval(fox,0,.325,.251,.121,.072,.119,white);oval(fox,0,.344,.354,.052,.029,.047,ink);
 for(const sign of [-1,1]){
  const ear=mesh(fox,new THREE.ConeGeometry(.078,.19,8),darkRed,[sign*.094,.536,.138]);ear.rotation.z=sign*-.18;
  oval(fox,sign*.098,.385,.274,.02,.026,.021,ink);
  for(const z of [-.24,.108])oval(fox,sign*.12,.095,z,.066,.092,.070,darkRed);
 }
 const brush=oval(fox,.12,.214,-.34,.12,.112,.25,shell);brush.rotation.y=-.46;
 const brushEnd=oval(fox,.185,.22,-.532,.095,.09,.103,white);brushEnd.rotation.y=-.49;
 // Bake non-moving architecture and plants by material (one draw call per
 // material instead of hundreds of per-house meshes). Keep original click hulls.
 function batch(sources,target) {
  target.updateMatrixWorld(true);
  const byMaterial=new Map(),invert=target.matrixWorld.clone().invert();
  for(const source of sources){
   source.updateMatrixWorld(true);
   source.traverse(item=>{
    if(!item.isMesh||!item.visible||item.userData.hitOnly)return;
    const mat=item.material,base=item.geometry;
    const plain=!mat.vertexColors&&!mat.map&&!mat.emissive.getHex()&&mat.roughness===.84&&mat.metalness===0&&mat.side===THREE.FrontSide;
    const key=plain?(base.index?'opaque-indexed':'opaque-flat'):mat,parts=byMaterial.get(key)||[];
    const geom=base.clone().applyMatrix4(invert.clone().multiply(item.matrixWorld));
    if(plain){const channels=new Float32Array(geom.attributes.position.count*3),c=mat.color;
     for(let k=0;k<channels.length;k+=3){channels[k]=c.r;channels[k+1]=c.g;channels[k+2]=c.b;}
     geom.setAttribute('color',new THREE.BufferAttribute(channels,3));
    }
    parts.push({item,geom});byMaterial.set(key,parts);
   });
  }
  for(const [key,parts] of byMaterial){
   if(parts.length>1){
    const fused=mergeGeometries(parts.map(p=>p.geom),false);
    if(fused){
     const mat=typeof key==='string'?color(0xffffff,{vertexColors:true}):key;
     mesh(target,fused,mat);for(const {item} of parts)item.visible=false;
    }
   }
   for(const {geom} of parts)geom.dispose();
  }
 }
 batch([terrain,plan],scene);
 for(const group of [...ducks,sampan,shuttle])batch([group],group);
 const actor=createYuyu(THREE,{own,color,mesh});
 scene.add(actor.root);
 const initial=polar(-.65,ROAD_RADIUS);actor.root.position.set(initial[0],.028,initial[1]);actor.root.scale.setScalar(.84);
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(), target=new THREE.Vector3(),viewTarget=new THREE.Vector3();let last=0,route=[],index=0,wanted=null,near=false,yaw=-.53;
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function select(station){
  if(dead)return false;
  const p=actor.root.position;
  // Selection is only permitted from the spawn or after arrival; the model still guards its road mask.
  if(wanted)return false;
  if(!canWalk(p.x,p.z,stations))return false;
  const next=walkRoute([p.x,p.z],station);
  if(next.some(([x,z])=>!canWalk(x,z,stations)))return false;
  wanted=station.id;route=next;index=0;return true;
 }
 function resize(){if(dead)return;const w=container.clientWidth,h=container.clientHeight;if(w&&h){cam.aspect=w/h;cam.updateProjectionMatrix();renderer.setSize(w,h,false);}}
 observer=new win.ResizeObserver(resize);observer.observe(container);resize();
 function pointer(e){
  if(dead||e.button!==0)return;
  const box=renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX-box.left)/box.width)*2-1,1-((e.clientY-box.top)/box.height)*2);
  ray.setFromCamera(ndc,cam);const selected=ray.intersectObjects(pickables,false)[0]?.object.userData.station;
  if(selected)onPick(selected);
 }
 const onContextLoss=e=>{e.preventDefault();dispose();onUnavailable('3D 顯示中斷，可切回練習簿或重新開啟。');};
 const tick=(t)=>{
  frame=0;if(dead||doc.hidden){last=0;return;}
  try{
  const dt=last?Math.min(.044,(t-last)/1000):0;last=t;
  let move=dt*6.0,moved=0;
  while(move>0&&index<route.length){
   const p=actor.root.position,[x,z]=route[index],dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
   if(d>.004){yaw=Math.atan2(dx,dz);const step=Math.min(move,d);p.x+=dx*step/d;p.z+=dz*step/d;move-=step;moved+=step;}
   if(Math.hypot(x-p.x,z-p.z)<.004)index++;else break;
  }
  actor.root.rotation.y+=Math.atan2(Math.sin(yaw-actor.root.rotation.y),Math.cos(yaw-actor.root.rotation.y))*Math.min(1,dt*15);
  actor.animate(t/1000,moved>0,reduced);
  if(wanted&&index>=route.length){const id=wanted;wanted=null;onArrive(id);}
  const clock=reduced?0:t/1000;
  for(const [i,duck] of ducks.entries()){
   const da=clock*.11-.70-.093*i,[dx,dz]=polar(da,19.77+i*.16);
   duck.position.set(dx,-1.18+Math.sin(clock*4+i)*.032,dz);duck.rotation.y=da+Math.PI*.50;
  }
  const ba=-clock*.134+1.13,[bx,bz]=polar(ba,21.8);sampan.position.set(bx,-1.13+Math.sin(clock*2)*.046,bz);sampan.rotation.set(Math.sin(clock*1.8)*.023,ba-Math.PI*.50,Math.sin(clock*1.4)*.035);
  const sa=clock*.20+2.1,[sx,sz]=polar(sa,19.3);shuttle.position.set(sx,3.0+Math.sin(clock*1.6)*.33,sz);shuttle.rotation.set(.065,sa+Math.PI*.50,-.11);
  const p=actor.root.position;
  target.set(near?p.x*.82:0,near?.45:0,near?p.z*.82:0);
  const a=reduced||!dt?1:1-Math.exp(-dt*4);
  viewTarget.lerp(target,a);
  const fit=Math.max(.95,1.13/Math.max(.4,cam.aspect));
  const scale=near?.54*Math.max(1,.77/Math.max(.4,cam.aspect)):fit;
  cam.position.x+=(viewTarget.x+21*scale-cam.position.x)*a;
  cam.position.y+=(viewTarget.y+39*scale-cam.position.y)*a;
  cam.position.z+=(viewTarget.z+31*scale-cam.position.z)*a;
  cam.lookAt(viewTarget);renderer.render(scene,cam);
  if(!dead)frame=win.requestAnimationFrame(tick);
  }catch(error){dispose();onUnavailable('3D 顯示中斷，可切回練習簿或重新開啟。');console.warn('Chinese 3D renderer interrupted:',error);}
 };
 const wake=()=>{if(!dead&&!doc.hidden&&!frame)frame=win.requestAnimationFrame(tick);};
 doc.addEventListener('visibilitychange',wake);
 renderer.domElement.addEventListener('pointerup',pointer);renderer.domElement.addEventListener('webglcontextlost',onContextLoss);wake();
 cleanupListeners=()=>{
  doc.removeEventListener('visibilitychange',wake);renderer.domElement.removeEventListener('pointerup',pointer);
  renderer.domElement.removeEventListener('webglcontextlost',onContextLoss);
 };
 return {select,setNear(value){near=!!value;onZoom?.(near);},dispose};
 }catch(error){dispose();throw error;}
}
