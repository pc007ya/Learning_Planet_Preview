/** Original English garden. Footprints are shared by rendering and collision tests. */
export function themeFor(unit){
 const t=unit.title.toLowerCase();
 if(/happy school day/.test(t))return 'plaza';
 if(/color|show/.test(t))return 'art';
 if(/old|time|calendar|routine|often|morning|saturday|sunday/.test(t))return 'clock';
 if(/toy|play|club/.test(t))return 'play';
 if(/animal/.test(t))return 'animal';
 if(/body|rest/.test(t))return 'sport';
 if(/feel|friend|family|picnic|like|share|help|visitor/.test(t))return 'garden';
 if(/fruit|shop|milk|apple|clothes/.test(t))return 'market';
 if(/park|season|sunflower|beach|trip/.test(t))return 'nature';
 if(/classroom|school|class|pencil|bag|room/.test(t))return 'school';
 return 'library';
}
export function coastFactor(a){return .98+.075*Math.sin(a*3)+.045*Math.cos(a*5);}
export function gardenFootprints(nodes){return nodes.map(n=>({x:n.x,z:n.z-.6,r:.94,unitId:n.id,theme:themeFor(n)}));}
export function gardenEntries(nodes){return nodes.map((n,i)=>{const prev=nodes[(i+nodes.length-1)%nodes.length],next=nodes[(i+1)%nodes.length],dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;return{x:n.x-dz/len*.45,z:n.z+.5+dx/len*.45,r:.18};});}
// Tread height comes from the same envelope as the rendered bridge. Actors
// approach from either side and do not clip through the raised deck.
export const GARDEN_BRIDGE = Object.freeze({
 walkHalfWidth:.38, deckHalfWidth:.56, flatHalfLength:.8, end:1.10,
 groundY:.08, deckY:.211
});
export function gardenSurfaceHeight({x,z}){
 const b=GARDEN_BRIDGE,t=Math.min(1,Math.max(0,(b.end-Math.abs(z))/(b.end-b.flatHalfLength)));
 const edge=Math.min(1,Math.max(0,(b.deckHalfWidth-Math.abs(x))/(b.deckHalfWidth-b.walkHalfWidth)));
 return b.groundY+(b.deckY-b.groundY)*t*t*(3-2*t)*edge*edge*(3-2*edge);
}
// Greedy line-of-sight simplification followed by local quadratic fillets.
// Every returned segment still passes the same coast/water/collision test;
// if a corner cannot be rounded safely, retain it.
export function smoothGardenPath(from, points, clear){
 const poly=[from];
 for(let i=0;i<points.length;){
  let j=points.length-1;
  while(j>i&&!clear(poly.at(-1),points[j]))--j;
  poly.push(points[j]); i=j+1;
 }
 const out=[];
 const towards=(a,b,r)=>{
  const len=Math.hypot(b.x-a.x,b.z-a.z)||1;
  return {x:a.x+(b.x-a.x)*r/len,z:a.z+(b.z-a.z)*r/len};
 };
 for(let i=1;i<poly.length-1;i++){
  const a=poly[i-1],b=poly[i],c=poly[i+1];
  const r=Math.min(.28,Math.hypot(a.x-b.x,a.z-b.z)/3,Math.hypot(c.x-b.x,c.z-b.z)/3);
  if(r<.02){out.push(b);continue;}
  const u=towards(b,a,r),v=towards(b,c,r),arc=[u];
  for(let k=1;k<=4;k++){
   const t=k/4,h=1-t;
   arc.push({x:h*h*u.x+2*h*t*b.x+t*t*v.x,z:h*h*u.z+2*h*t*b.z+t*t*v.z});
  }
  if(clear(out.at(-1)??from,u)&&arc.every((p,k)=>!k||clear(arc[k-1],p))&&clear(v,c))out.push(...arc);
  else out.push(b);
 }
 out.push(poly.at(-1));
 return out;
}
export function createGardenNavigation(nodes){
 const obstacles=[...gardenFootprints(nodes),...gardenEntries(nodes),{x:-6.1,z:.1,r:.64},{x:5.8,z:-1.9,r:.64}],step=.2;
 const safe=p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x/7.35,p.z/4.15)<coastFactor(Math.atan2(p.z/4.15,p.x/7.35))&&(!((p.x/3.48)**2+(p.z/.94)**2<1)||Math.abs(p.x)<GARDEN_BRIDGE.walkHalfWidth)&&!obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r);
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.035));for(let i=0;i<=n;i++){const t=i/n;if(!safe({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}))return false;}return true;};
 const grid=new Map(),key=(x,z)=>`${x},${z}`;
 for(let x=-37;x<=37;x++)for(let z=-21;z<=21;z++){const p={x:x*step,z:z*step,gx:x,gz:z};if(safe(p))grid.set(key(x,z),p);}
 function nearest(p){let found=null,d=Infinity;for(const n of grid.values()){const dist=Math.hypot(p.x-n.x,p.z-n.z);if(dist<d&&clear(p,n)){found=n;d=dist;}}return found;}
 function path(from,to){if(!safe(from)||!safe(to))return null;if(clear(from,to))return[to];const start=nearest(from),goal=nearest(to);if(!start||!goal)return null;const open=[start],closed=new Set(),cost=new Map([[start,0]]),previous=new Map();while(open.length){open.sort((a,b)=>cost.get(a)+Math.hypot(a.x-goal.x,a.z-goal.z)-cost.get(b)-Math.hypot(b.x-goal.x,b.z-goal.z));const p=open.shift();if(p===goal){const out=[to];for(let n=goal;n;n=previous.get(n))out.unshift({x:n.x,z:n.z});return smoothGardenPath(from,out,clear);}closed.add(p);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;const n=grid.get(key(p.gx+dx,p.gz+dz));if(!n||closed.has(n)||!clear(p,n))continue;const v=cost.get(p)+Math.hypot(dx,dz)*step;if(v<(cost.get(n)??Infinity)){cost.set(n,v);previous.set(n,p);if(!open.includes(n))open.push(n);}}}return null;}
 return {safe,clear,path,obstacles};
}
// Derive visible routes from the same traversable paths the player uses.
export function gardenRoadPaths(nodes,nav=createGardenNavigation(nodes)){
 const stations=nodes.map(n=>({x:n.x,z:n.z+.5}));
 if(!stations.length)return [];
 const join=(a,b)=>nav.path(a,b);
 const loop=[stations[0]];
 for(let i=0;i<stations.length&&stations.length>1;i++){
  const leg=join(stations[i],stations[(i+1)%stations.length]);
  if(leg)loop.push(...leg);else return [];
 }
 const paths=loop.length>1?[{name:'village-loop',points:loop}]:[];
 for(const side of [-1,1]){
  const mouth={x:0,z:side*(GARDEN_BRIDGE.end+.015)};
  const options=stations.filter(p=>Math.sign(p.z)===side).sort((a,b)=>Math.hypot(a.x,a.z-mouth.z)-Math.hypot(b.x,b.z-mouth.z));
  for(const station of options){
   const leg=join(mouth,station);
   if(leg){// The road must overlap the last visible wooden tread, not just stop
    // at the nominal deck limit. Keep the approach to the old mouth intact.
    const cap={x:0,z:side*(GARDEN_BRIDGE.end-.055)};
    paths.push({name:side<0?'north-bridge-access':'south-bridge-access',points:[cap,mouth,...leg]});break;}
  }
 }
 return paths;
}
// Use the painted paths as a bidirectional graph for automatic station
// walks. Always include the physical bridge deck, never cut across the lawn
// or water between station stops. A free-roaming player rejoins the nearest
// visible safe point before following the route.
export function createGardenRoadRouting(roads,nav){
 const vertices=new Map();
 const same=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<1e-7;
 const key=({x,z})=>`${x.toFixed(7)},${z.toFixed(7)}`;
 function node(p){
  const id=key(p);let v=vertices.get(id);
  if(!v){v={x:p.x,z:p.z,links:new Map()};vertices.set(id,v);}
  return v;
 }
 function link(a,b){
  if(a===b||!nav.clear(a,b))return;
  const d=Math.hypot(a.x-b.x,a.z-b.z);a.links.set(b,d);b.links.set(a,d);
 }
 function add(points){
  let prev=node(points[0]);
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.16));
   for(let j=1;j<=n;j++){
    const t=j/n,v=node(j===n?b:{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    link(prev,v);prev=v;
   }
  }
 }
 for(const road of roads)add(road.points);
 const north=roads.find(r=>r.name==='north-bridge-access'),south=roads.find(r=>r.name==='south-bridge-access');
 if(north&&south)add([north.points[0],south.points[0]]);
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 return function routeOnRoad(from,to){
  if(!nav.safe(from)||!nav.safe(to))return null;
  const goal=vertices.get(key(to));
  if(!goal)return null;
  if(same(from,to))return [to];
  let start=vertices.get(key(from)),approach=[];
  if(!start){
   let best=Infinity;
   for(const v of vertices.values()){
    const d=distance(from,v);
    if(d<best&&nav.clear(from,v)){start=v;best=d;}
   }
  }
  if(!start){
   // Terrain walking is only a local lead-in when obstacles hide the paved
   // graph (for example standing behind a cottage). Do not shortcut stops.
   const nearest=[...vertices.values()].sort((a,b)=>distance(from,a)-distance(from,b));
   for(const v of nearest.slice(0,16)){
    const lead=nav.path(from,v);
    if(lead){start=v;approach=lead;break;}
   }
  }
  if(!start)return null;
  const open=[start],cost=new Map([[start,0]]),prev=new Map(),closed=new Set();
  while(open.length){
   open.sort((a,b)=>(cost.get(a)+distance(a,goal))-(cost.get(b)+distance(b,goal)));
   const v=open.shift();
   if(v===goal){
    const chain=[{x:to.x,z:to.z}];
    for(let p=prev.get(v);p;p=prev.get(p))chain.unshift({x:p.x,z:p.z});
    if(approach.length)chain.unshift(...approach.slice(0,-1));
    if(same(chain[0],from))chain.shift();
    // Remove only collinear samples. Unconstrained smoothing would drive
    // the actor off the centerline, especially on bridge-access curves.
    const out=[];
    for(const p of chain){
     const a=out.length>1?out.at(-2):from,b=out.at(-1);
     if(b){
      const u=distance(a,b),w=distance(b,p),chord=distance(a,p);
      if(u+w-chord<1e-9&&nav.clear(a,p))out.pop();
     }
     out.push(p);
    }
    return out.length?out:[to];
   }
   closed.add(v);
   for(const [n,d] of v.links){
    if(closed.has(n))continue;
    const next=cost.get(v)+d;
    if(next<(cost.get(n)??Infinity)){cost.set(n,next);prev.set(n,v);if(!open.includes(n))open.push(n);}
   }
  }
  return null;
 };
}
function sampleRoad(points){
 const sampled=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=sampled.at(-1),b=points[i],d=Math.hypot(b.x-a.x,b.z-a.z);
  if(d<1e-5)continue;
  const count=Math.ceil(d/.035);
  for(let j=1;j<=count;j++){const t=j/count;sampled.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
 }
 return sampled;
}
export function gardenRoadRibbon(points,nav){
 const samples=sampleRoad(points),rows=[];
 for(let i=0;i<samples.length;i++){
  const p=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];
  const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz)||1;
  function edge(side){
   for(const w of [.24,.18,.12,.08,.04,.02,0]){
    const candidate={x:p.x+side*dz/dist*w,z:p.z-side*dx/dist*w};
    if(nav.clear(p,candidate)&&(!rows.length||nav.clear(rows.at(-1)[side===1?0:1],candidate)))return candidate;
   }
   return p;
  }
  rows.push([edge(1),edge(-1)]);
 }
 return rows;
}
function triangleCoverage(a,b,c,nav){
 const d=8;
 for(let i=0;i<=d;i++)for(let j=0;j<=d-i;j++){
  const k=d-i-j;
  if(!nav.safe({x:Math.fround((a.x*i+b.x*j+c.x*k)/d),z:Math.fround((a.z*i+b.z*j+c.z*k)/d)}))return false;
 }
 return true;
}
// Shrink only affected joins, preserving continuous ribbon rows between spans.
export function gardenRoadMeshData(points,nav){
 const rows=gardenRoadRibbon(points,nav),centers=sampleRoad(points);
 const zip=(a,b)=>[[a[0],a[1],b[0]],[a[1],b[1],b[0]]];
 for(let pass=0;pass<12;pass++){
  const narrow=new Set();
  for(let i=1;i<rows.length;i++)
   if(zip(rows[i-1],rows[i]).some(tri=>!triangleCoverage(...tri,nav))){narrow.add(i-1);narrow.add(i);}
  if(!narrow.size)break;
  for(const i of narrow)rows[i]=rows[i].map(p=>({x:(p.x+centers[i].x)/2,z:(p.z+centers[i].z)/2}));
 }
 const bridgeAccess=points[0].x===0&&Math.abs(Math.abs(points[0].z)-(GARDEN_BRIDGE.end-.055))<1e-7;
 const vertices=rows.flatMap(row=>row.flatMap(p=>{
  const blend=bridgeAccess&&Math.abs(p.x)<GARDEN_BRIDGE.walkHalfWidth?
   Math.min(1,Math.max(0,(GARDEN_BRIDGE.end+.07-Math.abs(p.z))/.035)):0;
  const y=.102+(.075-.102)*blend;
  return [Math.fround(p.x),y,Math.fround(p.z)];
 })),indices=[];
 for(let i=1;i<rows.length;i++){
  const a=(i-1)*2,b=i*2;
  for(const ids of [[a,a+1,b],[a+1,b+1,b]]){
   const [u,v,w]=ids.map(k=>({x:vertices[k*3],z:vertices[k*3+2]}));
   const normalY=(v.z-u.z)*(w.x-u.x)-(v.x-u.x)*(w.z-u.z);
   if(Math.abs(normalY)<=1e-10||!triangleCoverage(u,v,w,nav))continue;
   if(normalY>0)indices.push(...ids);else indices.push(ids[0],ids[2],ids[1]);
  }
 }
 return {vertices,indices};
}
// Flocks stay in the pond; the ferry always uses a distinct outer-water loop.
export function gardenDuckPose(t,i){
 const a=t*.55-i*.44;
 return {x:-1.72+.88*Math.cos(a),z:.32*Math.sin(a),y:.165+Math.sin(t*2-i)*.018,
  heading:Math.atan2(-.32*Math.cos(a),-.88*Math.sin(a))};
}
export function gardenFerryPose(t){
 const a=t*.16+.63;
 return {x:10.94*Math.cos(a),z:6.98*Math.sin(a),y:-.44+.024*Math.sin(t*2.1),
  heading:Math.atan2(-6.98*Math.cos(a),-10.94*Math.sin(a))};
}
// Clip rounded junction bulbs to the same navigation geometry as the road.
export function gardenJunctionCorners(roads,nav){
 const named=roads.find(r=>r.name==='village-loop');if(!named)return [];
 const loop=named.points.slice(0,-1),out=[];
 const seen=new Set();
 for(let i=0;i<loop.length;i++){
  const p=loop[i],a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];
  const u={x:p.x-a.x,z:p.z-a.z},v={x:b.x-p.x,z:b.z-p.z};
  const scale=Math.hypot(u.x,u.z)*Math.hypot(v.x,v.z);
  if(!scale||(u.x*v.x+u.z*v.z)/scale>.72)continue;
  const id=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;if(seen.has(id))continue;seen.add(id);
  const edge=[];
  for(let j=0;j<20;j++){
   const t=j*Math.PI/10;
   let q=p;
   for(const r of [.24,.19,.14,.09,.045]){
    const c={x:Math.fround(p.x+Math.cos(t)*r),z:Math.fround(p.z+Math.sin(t)*r)};
    if(nav.clear(p,c)){q=c;break;}
   }
   edge.push(q);
  }
  const triangles=[];
  for(let j=0;j<edge.length;j++){
   const a=edge[(j+1)%edge.length],b=edge[j];
   if(a===p||b===p||!triangleCoverage(p,a,b,nav))continue;
   triangles.push([p,a,b]);
  }
  if(triangles.length)out.push(triangles);
 }
 return out;
}
export const ENGLISH_HEADLAND_FORMS=Object.freeze([
 [[-.20,.44,.02,.24,.33,.21],[.19,.42,.08,.24,.29,.27],[.02,.61,-.12,.21,.22,.21]],
 [[-.13,.37,.02,.34,.25,.24],[.03,.53,.02,.28,.16,.21],[.08,.66,.03,.18,.11,.16]],
 [[-.20,.54,-.03,.14,.46,.14],[.09,.66,-.11,.15,.57,.15],[.22,.47,.14,.13,.35,.13]],
 [[-.16,.44,.02,.29,.21,.23],[.05,.61,-.03,.24,.18,.23],[.20,.74,-.07,.17,.13,.16]],
 [[-.24,.55,.02,.11,.42,.16],[.22,.56,.02,.12,.43,.16],[0,.91,.02,.29,.11,.16]],
 [[-.17,.52,.01,.18,.31,.22],[.12,.50,-.05,.22,.28,.20],[.04,.75,-.12,.14,.29,.14],[.20,.70,.08,.13,.19,.11]]
]);
export const ENGLISH_GRADE_LANDSCAPES=Object.freeze([
 Object.freeze({grass:0x8bb78c,sand:0xe8cf9b,rock:0x967559,water:0x55aeb6,tree:0x599567}),
 Object.freeze({grass:0xa6c18a,sand:0xe9d394,rock:0xa48054,water:0x60aab9,tree:0x648d58}),
 Object.freeze({grass:0x7fb8a0,sand:0xd2c29d,rock:0x817c66,water:0x459fa8,tree:0x45866e}),
 Object.freeze({grass:0xaabb87,sand:0xe3c595,rock:0x9f765d,water:0x68afaf,tree:0xa28654}),
 Object.freeze({grass:0x9cbfa9,sand:0xe0d4b0,rock:0x7e8880,water:0x65adae,tree:0x5c8f81}),
 Object.freeze({grass:0x96b3a8,sand:0xc8cfb0,rock:0x737c86,water:0x518aa6,tree:0x537d77})
]);
// Decorative promontories live outside the walkable ellipse and inside
// the ferry orbit. Separate grade silhouettes, not paths or clickable stops.
export const ENGLISH_GRADE_SHORE_PROMONTORIES=Object.freeze([
 [[5.7,-4.27,.94,.59,1.05,1.12],[8.12,-1.35,.73,.52,.64,.46]],   // coastal village
 [[-6.2,-3.62,.91,.67,.93,.67],[-5.45,4.4,.89,.54,.56,1.91]],   // orchard bluff
 [[5.7,-4.27,.91,.59,1.26,.34],[-8.25,-1.45,.86,.57,1.12,2.61]], // rocky inlet
 [[-6.2,-3.62,.91,.59,.64,1.61],[6.1,3.93,.95,.55,.88,.78]],    // sandstone tiers
 [[-5.45,4.4,.91,.55,.73,2.21],[8.12,-1.35,.72,.56,1.04,2.67]],// misty grove
 [[6.1,3.93,.89,.55,1.19,1.47],[-8.25,-1.45,.81,.56,1.34,2.21]] // slate headlands
]);
export function gardenShorePromontoryRings(grade){
 const gi=Math.min(5,Math.max(0,(grade??1)-1));
 return ENGLISH_GRADE_SHORE_PROMONTORIES[gi].map(([x,z,rx,rz,height,yaw],i)=>{
  const k=1+gi+i*2;
  return [[1,-.59],[1.03,-.35],[.92,-.29],[.79,-.24],[.70,height*.23],[.52,height*.56],[.29,height*.67],[0,height*.69]].map(([r,y],row)=>
   Array.from({length:36},(_,j)=>{
    const a=j/36*Math.PI*2,shape=1+.08*Math.sin(3*a+k*.92)+.05*Math.cos(5*a-k*.62);
    const ux=Math.cos(a)*r*rx*shape,uz=Math.sin(a)*r*rz*shape;
    const shift=row/7;
    return [x+ux*Math.cos(yaw)-uz*Math.sin(yaw)-shift*.12*Math.sign(x), y+r*.06*Math.sin(2*a+k),z+ux*Math.sin(yaw)+uz*Math.cos(yaw)-shift*.08*Math.sign(z)];
   }));
 });
}
export function buildGarden(T,{scene,nodes,mesh,color,own,nav=createGardenNavigation(nodes),roads=gardenRoadPaths(nodes,nav),grade=nodes[0]?.grade}){
 const landscape=ENGLISH_GRADE_LANDSCAPES[grade-1]??ENGLISH_GRADE_LANDSCAPES[0];
 const headlandForms=ENGLISH_HEADLAND_FORMS[grade-1]??ENGLISH_HEADLAND_FORMS[0];
 const palette={cream:color(0xf1d8ad),wood:color(0x78513b),teal:color(0x3e9297),leaf:color(landscape.tree),water:color(landscape.water,{roughness:.32}),gold:color(0xe9b74b),pink:color(0xcc8394),blue:color(0x7093bf),ink:color(0x304b57),glass:color(0xa8d9d9),lightWood:color(0xd29b6f),chalk:color(0xfff3cf),bark:color(0x574b41)};
 function box(p,size,mat,pos){return mesh(p,new T.BoxGeometry(...size),mat,pos);}
 const spheres=new Map();
 function ball(p,r,mat,pos,scale=[1,1,1]){
  const lod=r<.075?8:r<.24?12:20;
  if(!spheres.has(lod))spheres.set(lod,new T.SphereGeometry(1,lod,lod===20?14:lod===12?8:6));
  const m=mesh(p,spheres.get(lod),mat,pos);
  m.scale.set(...scale.map(v=>r*v));m.castShadow=r>=.15;return m;
 }
 function cylinder(p,rt,rb,h,mat,pos,sides=20){return mesh(p,new T.CylinderGeometry(rt,rb,h,sides),mat,pos);}
 function group(x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);scene.add(g);return g;}
 function shape(rx,rz){const s=new T.Shape();for(let i=0;i<128;i++){const a=i/128*Math.PI*2,k=coastFactor(a),x=Math.cos(a)*rx*k,z=Math.sin(a)*rz*k;if(i)s.lineTo(x,-z);else s.moveTo(x,-z);}s.closePath();return s;}
 function land(rx,rz,depth,y,mat){const g=new T.ExtrudeGeometry(shape(rx,rz),{depth,bevelEnabled:true,bevelSize:.12,bevelThickness:.035,bevelSegments:3,steps:1});g.translate(0,0,-depth);const m=mesh(scene,g,mat,[0,y,0]);m.rotation.x=-Math.PI/2;return m;}
 land(8.05,4.8,.62,-.12,color(landscape.rock));land(8.03,4.78,.16,-.015,color(landscape.sand));land(7.8,4.52,.08,.035,color(landscape.grass));
 // Batched terrain mesh: low wet-rock bands, pale tidal edge and raised
 // grass shelves in one draw per promontory. All existing roads are intact.
 const layers=[new T.Color(landscape.rock).multiplyScalar(.6),
  new T.Color(landscape.rock),new T.Color(landscape.sand),
  new T.Color(landscape.sand).lerp(new T.Color(landscape.rock),.6),
  new T.Color(landscape.rock),new T.Color(landscape.grass).multiplyScalar(.88),
  new T.Color(landscape.grass)];
 const shoreMat=color(0xffffff,{vertexColors:true});
 gardenShorePromontoryRings(grade).forEach((rings,j)=>{
  const pos=[],rgb=[];
  for(let r=0;r<rings.length-1;r++)for(let k=0;k<rings[r].length;k++){
   const l=(k+1)%rings[r].length,a=rings[r][k],b=rings[r][l],
    c=rings[r+1][k],d=rings[r+1][l];
   const tint=layers[r].clone().multiplyScalar(1+.035*Math.sin(k*.53+j));
   for(const pt of r===rings.length-2?[a,c,b]:[a,c,b,b,c,d]){
    pos.push(...pt);rgb.push(tint.r,tint.g,tint.b);
   }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
  geometry.computeVertexNormals();
  const form=mesh(scene,geometry,shoreMat);form.name=`english-coast-shelf-${grade??1}-${j}`;
 });

 // Shallow bay in the meadow; the middle wooden footbridge is the only pond crossing.
 const pond=mesh(scene,new T.CircleGeometry(1,64),palette.water,[0,.09,0]);pond.rotation.x=-Math.PI/2;pond.scale.set(3.35,.79,1);
 const shore=mesh(scene,new T.TorusGeometry(1,.055,8,64),color(0xd4c293),[0,.085,0]);shore.rotation.x=-Math.PI/2;shore.scale.set(3.4,.86,1);
 const road=color(0xd6c29d);
 for(const {name,points} of roads){
  const {vertices,indices}=gardenRoadMeshData(points,nav);
  const ribbon=new T.BufferGeometry();
  ribbon.setAttribute('position',new T.Float32BufferAttribute(vertices,3));ribbon.setIndex(indices);ribbon.computeVertexNormals();
  const roadMesh=mesh(scene,ribbon,road);roadMesh.name=`english-road-${name}`;roadMesh.castShadow=false;
 }
 const rounded=gardenJunctionCorners(roads,nav).flat(2);
 if(rounded.length){
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(rounded.flatMap(p=>[p.x,.1005,p.z]),3));
  geo.computeVertexNormals();
  const caps=mesh(scene,geo,road);caps.name='english-road-rounded-junctions';caps.castShadow=false;
 }
 const b=GARDEN_BRIDGE,deckWidth=b.deckHalfWidth*2,sideOf=Math.sign;
 // Alternating timber treads with tiny seams, a continuous dark stringer,
 // lower rail, and rounded post caps. All treads follow the walking grade.
 const timber=color(0xa87955),trim=color(0x664634),cap=color(0xd4a36d);
 for(let i=-7;i<=7;i++){
  const z=i*.145,y=gardenSurfaceHeight({x:0,z});
  if(Math.abs(i)===7){
   // Ramp end reaches the nominal deck edge with its top aligned to the
   // walk profile, rather than burying the tilted board in the grass.
   const start=sideOf(z)*.9445,end=sideOf(z)*b.end,center=(start+end)/2;
   const ramp=new T.BoxGeometry(deckWidth,.07,Math.abs(end-start));
   const position=ramp.attributes.position;
   for(let k=0;k<position.count;k++)position.setY(k,
    gardenSurfaceHeight({x:0,z:center+position.getZ(k)})+(position.getY(k)>0?0:-.07));
   ramp.computeVertexNormals();
   mesh(scene,ramp,timber,[0,0,center]);
   continue;
  }
  const tread=box(scene,[deckWidth,.07,.141],i%3?timber:cap,[0,y-.036,z]);
  tread.rotation.x=-Math.atan2(gardenSurfaceHeight({x:0,z:z+.02})-gardenSurfaceHeight({x:0,z:z-.02}),.04);
 }
 for(const x of [-.53,.53]){
  box(scene,[.045,.08,2.24],trim,[x,.127,0]);
  box(scene,[.04,.055,2.18],timber,[x,.45,0]);
  box(scene,[.028,.025,2.15],trim,[x,.32,0]);
  for(const z of [-1,-.5,0,.5,1]){
   const y=gardenSurfaceHeight({x:0,z});
   cylinder(scene,.034,.04,.49-y,trim,[x,(.49+y)/2,z],10);
   ball(scene,.044,cap,[x,.49,z],[1,.6,1]);
  }
 }
 function tree(x,z,size=1,tint=palette.leaf){cylinder(scene,.055*size,.09*size,.62*size,palette.wood,[x,.38*size,z],10);ball(scene,.31*size,tint,[x,.88*size,z],[1,1.2,1]);ball(scene,.23*size,tint,[x-.15*size,.74*size,z+.08*size]);}
 function flower(x,z,c=palette.pink){cylinder(scene,.01,.013,.22,palette.leaf,[x,.18,z],6);for(let j=0;j<5;j++){const a=j/5*Math.PI*2;ball(scene,.042,c,[x+Math.cos(a)*.045,.31,z+Math.sin(a)*.045]);}ball(scene,.025,palette.gold,[x,.32,z]);}
 // Shore decorations stay outside the navigation boundary, including their canopy.
 for(let i=0;i<34;i++){const a=i/34*Math.PI*2,x=Math.cos(a)*7.6*coastFactor(a),z=Math.sin(a)*4.42*coastFactor(a);if(i%3===0)tree(x,z,.75+(i%4)*.1,i%2?palette.leaf:color(0x6a9c8d));else if(i%3===1)ball(scene,.18,color(0x949c8a),[x,.15,z],[1.4,.7,1]);else for(let k=0;k<3;k++)flower(x+k*.1,z, i%2?palette.pink:palette.gold);}
 function door(g,x=0,z=.33){box(g,[.17,.34,.035],palette.wood,[x,.24,z]);ball(g,.018,palette.gold,[x+.05,.24,z+.03]);}
 function window(g,x,y,z){box(g,[.16,.18,.025],palette.teal,[x,y,z]);box(g,[.018,.18,.035],palette.cream,[x,y,z+.01]);box(g,[.16,.018,.035],palette.cream,[x,y,z+.01]);}
 function roof(g,mat,y=.9){const r=mesh(g,new T.ConeGeometry(.67,.4,4),mat,[0,y,0]);r.rotation.y=Math.PI/4;return r;}
 function school(g){
  const blue=color(0x447e88),mortar=color(0xe9b478),brick=color(0xbe7a61);
  box(g,[1.02,.14,.67],mortar,[0,.17,0]);
  box(g,[.94,.52,.58],palette.cream,[0,.48,0]);
  box(g,[.97,.08,.64],brick,[0,.72,0]);
  roof(g,blue,.91).scale.set(1,.82,.88);
  box(g,[.28,.36,.29],brick,[0,.84,.17]);roof(g,blue,1.1).scale.set(.34,.45,.36);
  const bell=ball(g,.066,palette.gold,[0,.92,.329],[.9,1.1,.65]);bell.name='school-bell';
  for(const x of [-.31,.31]){
   window(g,x,.53,.306);box(g,[.24,.05,.065],mortar,[x,.409,.327]);
   box(g,[.068,.23,.032],brick,[x*.61,.53,.307]);
  }
  box(g,[.28,.09,.18],mortar,[0,.125,.37]);door(g,0,.312);
  for(const x of [-.19,.19])cylinder(g,.027,.04,.37,mortar,[x,.36,.34],8);
  box(g,[.44,.055,.17],blue,[0,.575,.345]);
 }
 function art(g){box(g,[.55,.44,.5],palette.cream,[-.16,.3,0]);roof(g,palette.pink,.72).scale.set(.7,.8,.85);const easel=box(g,[.36,.44,.035],palette.wood,[.32,.4,.25]);easel.rotation.x=-.12;box(g,[.3,.33,.04],color(0xfff1d3),[.32,.46,.28]);for(let i=0;i<4;i++)ball(g,.048,[palette.teal,palette.gold,palette.pink,palette.blue][i],[.24+i%2*.14,.39+Math.floor(i/2)*.14,.31]);for(const x of [-.1,.08])cylinder(g,.075,.07,.19,[palette.blue,palette.gold][x>0?1:0],[x,.18,.4]);}
 function clock(g){box(g,[.55,.95,.55],palette.cream,[0,.56,0]);roof(g,palette.blue,1.2).scale.set(.7,.7,.7);const face=cylinder(g,.23,.23,.045,color(0xfff1d3),[0,.86,.3],32);face.rotation.x=Math.PI/2;box(g,[.02,.17,.04],palette.wood,[0,.91,.34]);const hand=box(g,[.13,.02,.04],palette.wood,[.055,.86,.34]);door(g,0,.3);for(const x of [-.4,.4]){cylinder(g,.07,.07,.28,palette.pink,[x,.2,0]);ball(g,.12,palette.gold,[x,.44,0]);}}
 function play(g){const colors=[palette.teal,palette.pink,palette.gold];for(let i=0;i<3;i++){box(g,[.3,.3,.3],colors[i],[i*.28-.28,.25,0]);const cap=mesh(g,new T.ConeGeometry(.21,.28,4),colors[(i+1)%3],[i*.28-.28,.53,0]);cap.rotation.y=Math.PI/4;}box(g,[.3,.08,.8],palette.blue,[.33,.29,.2]).rotation.x=.42;for(const x of [-.43,-.16])ball(g,.09,palette.wood,[x,.18,.4]);box(g,[.45,.17,.23],palette.gold,[-.29,.3,.4]);}
 function animal(g){for(const x of [-.5,.5])for(const z of [-.43,.43])cylinder(g,.025,.025,.28,palette.wood,[x,.2,z],8);for(const z of [-.43,.43])box(g,[1.02,.045,.04],palette.wood,[0,.3,z]);const hay=color(0xcda451);box(g,[.3,.23,.3],hay,[-.27,.19,-.18]);for(const [x,z,c]of[[.13,.15,0xf7ead1],[-.2,.23,0xb8a497]]){const mat=color(c);ball(g,.16,mat,[x,.24,z],[1,.85,1.3]);ball(g,.1,mat,[x,.37,z+.12]);for(const dx of [-.045,.045])ball(g,.035,mat,[x+dx,.51,z+.12],[.7,2.2,.7]);for(const dx of [-.035,.035])ball(g,.012,palette.wood,[x+dx,.4,z+.2]);}}
 function sport(g){box(g,[1.05,.04,.85],color(0xc47f65),[0,.1,0]);const line=color(0xf8e8c4);for(const x of [-.44,.44])box(g,[.02,.01,.72],line,[x,.125,0]);for(const z of [-.35,.35])box(g,[.9,.01,.02],line,[0,.125,z]);for(const x of [-.36,.36])cylinder(g,.025,.025,.75,palette.wood,[x,.47,-.32],8);box(g,[.75,.035,.035],line,[0,.84,-.32]);box(g,[.6,.4,.015],color(0x9ebaae,{transparent:true,opacity:.55}),[0,.59,-.33]);ball(g,.13,palette.gold,[.2,.25,.2]);}
 function garden(g){for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(g,.17,i%2?palette.pink:palette.gold,[Math.cos(a)*.35,.19,Math.sin(a)*.35],[1,.45,1]);}cylinder(g,.21,.27,.22,palette.cream,[0,.2,0]);const heart=new T.Shape();heart.moveTo(0,0);heart.bezierCurveTo(-.38,.24,-.17,.6,0,.34);heart.bezierCurveTo(.17,.6,.38,.24,0,0);const h=mesh(g,new T.ExtrudeGeometry(heart,{depth:.08,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1}),palette.pink,[0,.39,0]);h.rotation.y=-.15;}
 function market(g){
  const rose=color(0xb95968);
  box(g,[.98,.075,.65],palette.lightWood,[0,.18,0]);
  box(g,[.78,.29,.4],palette.cream,[0,.34,.05]);box(g,[.86,.06,.53],palette.wood,[0,.51,.05]);
  for(const x of [-.43,.43])for(const z of [-.27,.31])cylinder(g,.022,.027,.66,palette.wood,[x,.55,z],8);
  for(let i=0;i<7;i++){
   const x=(i-3)*.131,mat=i%2?palette.chalk:rose;
   const sail=box(g,[.133,.054,.699],mat,[x,.905,.035]);sail.rotation.x=.2;
   const fringe=box(g,[.13,.085,.038],mat,[x,.81,.381]);fringe.rotation.x=.12;
  }
  for(let row=0;row<2;row++)for(let i=0;i<3;i++){
   const x=(i-1)*.23,z=row*.17-.08,fruit=[palette.leaf,palette.gold,rose][i];
   ball(g,.046,fruit,[x,.589,z],[1.03,.91,1.04]);ball(g,.033,fruit,[x+.043,.585,z+.05]);
  }
  for(const x of [-.18,.18])box(g,[.25,.065,.035],palette.lightWood,[x,.31,.263]);
 }
 function nature(g){cylinder(g,.3,.4,.2,palette.wood,[0,.17,0]);for(let i=0;i<5;i++){const a=i*1.3,x=Math.sin(a)*.3,z=Math.cos(a)*.3;cylinder(g,.018,.02,.65,palette.leaf,[x,.56,z],8);for(let j=0;j<7;j++){const t=j*Math.PI*2/7;ball(g,.07,palette.gold,[x+Math.cos(t)*.12,.9+Math.sin(t)*.12,z]);}ball(g,.085,palette.wood,[x,.9,z+.015]);}}
 function library(g){
  const indigo=color(0x576282),vellum=color(0xe8c994);
  box(g,[.98,.11,.68],vellum,[0,.18,0]);
  // Octagonal reading room and curved roof give it a different silhouette from the school.
  cylinder(g,.48,.5,.49,palette.cream,[0,.46,0],8).rotation.y=Math.PI/8;
  cylinder(g,.52,.53,.094,indigo,[0,.72,0],8).rotation.y=Math.PI/8;
  const dome=mesh(g,new T.SphereGeometry(.49,20,10,0,Math.PI*2,0,Math.PI/2),indigo,[0,.764,0]);
  dome.scale.y=.73;
  ball(g,.059,palette.gold,[0,1.13,0]);
  for(const x of [-.31,.31]){
   box(g,[.155,.20,.034],palette.ink,[x,.55,.424]);
   box(g,[.106,.152,.041],palette.glass,[x,.55,.438]);
   box(g,[.008,.153,.048],vellum,[x,.55,.444]);
  }
  door(g,0,.477);
  // A pair of open book covers with lagged pages as the entry emblem.
  for(const side of [-1,1]){
   const cover=box(g,[.15,.115,.025],palette.pink,[side*.072,.766,.45]);
   cover.rotation.z=-side*.21;
   const pages=box(g,[.133,.094,.02],palette.chalk,[side*.071,.768,.469]);pages.rotation.z=-side*.21;
  }
 }
 function plaza(g){cylinder(g,.39,.45,.16,palette.cream,[0,.15,0]);cylinder(g,.33,.33,.03,palette.water,[0,.25,0]);cylinder(g,.08,.13,.55,palette.cream,[0,.45,0]);ball(g,.14,palette.gold,[0,.8,0]);for(const x of [-.42,.42]){box(g,[.2,.06,.48],palette.wood,[x,.26,0]);for(const z of [-.16,.16])box(g,[.04,.22,.04],palette.wood,[x,.13,z]);}}
 const builders={school,art,clock,play,animal,sport,garden,market,nature,library,plaza};
 const footprints=gardenFootprints(nodes);
 for(const f of footprints){const g=group(f.x,.1,f.z);g.name=`english-${f.theme}-${f.unitId}`;g.scale.setScalar(1.25);builders[f.theme](g);}
 // These side silhouettes fit in existing collision disks. Shapes, not
 // just colors, distinguish each grade; no added obstacles or remote assets.
 const cliff=color(landscape.rock),outcrop=color(landscape.sand),stoneLeaf=color(landscape.tree);
 for(const [idx,[x,z]] of [[-6.1,.1],[5.8,-1.9]].entries()){
  const head=group(x,0,z);head.name=`english-headland-${grade??1}-${idx}`;
  ball(head,.51,cliff,[0,.19,0],[1,.75,.9]);
  headlandForms.forEach(([x,y,z,sx,sy,sz],i)=>{
   const form=grade===3||grade===4?
    cylinder(head,sx*.77,sx,sy*2,i%2?outcrop:cliff,[idx?-x:x,y,z],grade===3?5:7):
    ball(head,.24,i%2?outcrop:stoneLeaf,[idx?-x:x,y,z],[sx/.24,sy/.24,sz/.24]);
   form.name=`english-headland-form-${i}`;
  });
 }
 // Clustered shrubs inside each landmark's already-blocked footprint, never over a road.
 footprints.forEach((f,i)=>{for(let k=0;k<3;k++){const a=Math.PI+k*.6;ball(scene,.12,i%2?palette.leaf:color(0x8da56b),[f.x+Math.cos(a)*.67,.16,f.z+Math.sin(a)*.67],[1.2,.7,1]);}});
 // Water lilies, small ripples and a family swimming in an independent oval.
 for(const x of [-2.69,-1.04,1.5,2.4]){
  const lily=mesh(scene,new T.CircleGeometry(.16,16),palette.leaf,[x,.11,.53*Math.sin(x)]);
  lily.rotateX(-Math.PI/2);lily.castShadow=false;
  ball(scene,.055,palette.pink,[x,.16,.53*Math.sin(x)]);
 }
 const wakeMat=color(0xb6dcda,{roughness:1}),headMat=color(0xf3d378),beakMat=color(0xd98748);
 const ducks=[];
 for(let i=0;i<3;i++){
  const g=group(),size=i?.84:1.24;g.name=i?'english-duckling':'english-duck';g.scale.setScalar(size);
  ball(g,.117,headMat,[0,0,0],[1.28,.88,1]);ball(g,.068,headMat,[.112,.085,0]);
  mesh(g,new T.ConeGeometry(.028,.064,8),beakMat,[.186,.079,0]).rotation.z=-Math.PI/2;
  for(const side of [-1,1])ball(g,.009,palette.ink,[.142,.102,side*.05]).castShadow=false;
  const ripple=mesh(g,new T.RingGeometry(.16,.18,20),wakeMat,[-.06,-.066,0]);ripple.rotateX(-Math.PI/2);ripple.castShadow=false;ripple.scale.x=1.36;
  ducks.push({g,ripple,size});
 }
 const ferry=group();ferry.name='english-mail-ferry';ferry.scale.setScalar(1.22);
 const hull=ball(ferry,.53,palette.teal,[0,.11,0],[1.13,.36,.63]);hull.name='ferry-hull';
 ball(ferry,.46,palette.cream,[0,.21,0],[1.15,.10,.65]);
 box(ferry,[.36,.23,.37],palette.cream,[-.03,.34,0]);box(ferry,[.41,.07,.42],palette.pink,[-.03,.48,0]);
 for(const z of [-.191,.191])box(ferry,[.20,.118,.028],palette.glass,[-.018,.36,z]).castShadow=false;
 cylinder(ferry,.027,.037,.16,palette.ink,[-.19,.54,0],8);
 // A bow pennant and high-contrast life rings make its job readable at full view.
 cylinder(ferry,.013,.014,.38,palette.wood,[.31,.38,0],7);
 const pennant=mesh(ferry,new T.CircleGeometry(.092,3),color(0xe9b74b,{side:T.DoubleSide}),[.37,.54,0]);pennant.rotation.z=-Math.PI/6;
 const ringGeo=new T.TorusGeometry(.052,.016,6,12);
 for(const z of [-.246,.246]){
  const ring=mesh(ferry,ringGeo,palette.pink,[.27,.255,z]);ring.castShadow=false;
 }
 const foam=mesh(ferry,new T.RingGeometry(.36,.39,28),wakeMat,[-.33,-.094,0]);foam.rotateX(-Math.PI/2);foam.scale.x=1.84;foam.castShadow=false;
 // Raised color contours and headland plants give the shore depth outside
 // the walking boundary without adding obstructions to the shared route.
 const stone=color(0xa5a98a),lichen=color(0x6c9f78);
 for(const idx of [0,1,7,13,14,18,22,27,28,33]){
  const a=idx*Math.PI*2/34,q=coastFactor(a);
  const x=Math.cos(a)*7.80*q,z=Math.sin(a)*4.61*q;
  ball(scene,.23,stone,[x,.095,z],[1.37,.64,.9]).castShadow=false;
  ball(scene,.134,lichen,[x,.175,z],[1.27,.49,.87]).castShadow=false;
 }
 function animate(t){
  ducks.forEach(({g,ripple,size},i)=>{const {x,y,z,heading}=gardenDuckPose(t,i);g.position.set(x,y,z);g.rotation.y=heading;ripple.position.y=(.104-y)/size;});
  const {x,y,z,heading}=gardenFerryPose(t);ferry.position.set(x,y,z);ferry.rotation.y=heading;foam.position.y=(-.535-y)/ferry.scale.y;
 }
 animate(0);
 return {animate};
}
