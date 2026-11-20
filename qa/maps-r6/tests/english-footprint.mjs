import fs from 'node:fs';
import {createGardenNavigation,gardenRoadPaths,gardenRoadMeshData,GARDEN_BRIDGE,createGardenRoadRouting} from '../overlay/v2/modules/english-original/english-garden-world-r6.mjs';
const raw=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r6.mjs',import.meta.url),'utf8');
const {gardenLayout}=await import('data:text/javascript,'+encodeURIComponent(raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function advance'))));
const data=JSON.parse(fs.readFileSync(new URL('../overlay/v2/maps-preview-r6/english-map-titles.json',import.meta.url),'utf8'));
const dist=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
for(const grade of [1,2,3,4,5,6]){
 const nodes=gardenLayout(data.filter(x=>x.grade===grade)),nav=createGardenNavigation(nodes),roads=gardenRoadPaths(nodes,nav),route=createGardenRoadRouting(roads,nav);
 const station=nodes.map(n=>({x:n.x,z:n.z+.5}));
 const ts=roads.flatMap(r=>{
  const m=gardenRoadMeshData(r.points,nav);
  const out=[];
  for(let i=0;i<m.indices.length;i+=3){
   const [a,b,c]=m.indices.slice(i,i+3).map(q=>({x:m.vertices[q*3],z:m.vertices[q*3+2]}));
   out.push({a,b,c,minx:Math.min(a.x,b.x,c.x),maxx:Math.max(a.x,b.x,c.x),minz:Math.min(a.z,b.z,c.z),maxz:Math.max(a.z,b.z,c.z)});
  }return out;});
 const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x),eps=3e-5;
 const on=(p)=>Math.abs(p.x)<=GARDEN_BRIDGE.deckHalfWidth&&Math.abs(p.z)<=1.078||ts.some(({a,b,c,minx,maxx,minz,maxz})=>p.x>=minx-eps&&p.x<=maxx+eps&&p.z>=minz-eps&&p.z<=maxz+eps&&((cross(a,b,p)>=-eps&&cross(b,c,p)>=-eps&&cross(c,a,p)>=-eps)||(cross(a,b,p)<=eps&&cross(b,c,p)<=eps&&cross(c,a,p)<=eps)));
 console.assert(nav.clear({x:0,z:-1.05},{x:0,z:1.05}));
 const routes=[];
 for(let from=0;from<8;from++)for(let to=0;to<8;to++)if(from!==to){
  let a=station[from],gap=0,total=0;const path=route(a,station[to]);
  for(const b of path){
   const dx=b.x-a.x,dz=b.z-a.z,d=dist(a,b),n=Math.max(1,Math.ceil(d/.025));
   for(let i=1;i<=n;i++)if(!on({x:a.x+dx*(i-.5)/n,z:a.z+dz*(i-.5)/n}))gap+=d/n;
   total+=d;a=b;
  }routes.push({from:from+1,to:to+1,gap:+gap.toFixed(4),total:+total.toFixed(3)});
 }
 if(routes.some(x=>x.gap>.00001))throw new Error(JSON.stringify(routes.filter(x=>x.gap)));
 console.log(JSON.stringify({grade,tested:routes.length,withGap:routes.filter(x=>x.gap>.001).length,largeGap:routes.filter(x=>x.gap>.25).length,samples:routes.filter(x=>x.from===1&&x.to===5||x.from===5&&x.to===8),worst:routes.sort((a,b)=>b.gap-a.gap).slice(0,4)},null,2));
}
