import assert from 'node:assert/strict';
import fs from "node:fs";
import {createGardenNavigation,gardenRoadPaths,gardenRoadMeshData,GARDEN_BRIDGE,createGardenRoadRouting,ENGLISH_GRADE_LANDSCAPES} from '../overlay/v2/modules/english-original/english-garden-world-r8.mjs';
const raw=fs.readFileSync(new URL('../overlay/v2/modules/english-original/english-exploration-r8.mjs',import.meta.url),'utf8'), fn=raw.slice(raw.indexOf('export function gardenLayout'),raw.indexOf('export function advance'));
const {gardenLayout}=await import('data:text/javascript,'+encodeURIComponent(fn));
const grade=Number(process.argv[2]), data=JSON.parse(fs.readFileSync(new URL('../../maps-r7/overlay/v2/maps-preview-r7/english-map-titles.json',import.meta.url),'utf8'));
const nodes=gardenLayout(data.filter(u=>u.grade===grade));
const stations=nodes.map(p=>({x:p.x,z:p.z+.5})),nav=createGardenNavigation(nodes);
const roads=gardenRoadPaths(nodes,nav),routeOnRoad=createGardenRoadRouting(roads,nav);
const segs=roads.flatMap(r=>r.points.slice(1).map((p,i)=>[r.points[i],p]));segs.push([{x:0,z:-GARDEN_BRIDGE.end},{x:0,z:GARDEN_BRIDGE.end}]);
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=(a,b,t)=>({x:a.x+t*(b.x-a.x),z:a.z+t*(b.z-a.z)});
const near=(p,a,b)=>{const v=(b.x-a.x)**2+(b.z-a.z)**2;if(!v)return d(p,a);return d(p,point(a,b,Math.min(1,Math.max(0,((p.x-a.x)*(b.x-a.x)+(p.z-a.z)*(b.z-a.z))/v))));};
const detail=[];let offRoadStarts=0;
for(const from of [{x:0,z:0},{x:0,z:2},{x:-5.6,z:0},{x:6,z:.6}]){if(!nav.safe(from))continue;for(const to of stations){const path=routeOnRoad(from,to);assert(path?.length,JSON.stringify({from,to}));assert(path.every((p,k)=>nav.clear(path[k-1]??from,p)));offRoadStarts++;}}let unreachable=0, clips=0;
for(let i=0;i<8;i++)for(let j=0;j<8;j++)if(i!==j){let start=stations[i];const path=routeOnRoad(start,stations[j]);if(!path){unreachable++;continue;}
let meters=0,maxOff=0,off=0,bridge=false;
for(const p of path){const step=d(start,p),n=Math.ceil(step/.035);if(!nav.clear(start,p))clips++;meters+=step;for(let k=1;k<=n;k++){const s=point(start,p,k/n);if(Math.abs(s.x)<GARDEN_BRIDGE.walkHalfWidth&&Math.abs(s.z)<.1)bridge=true;const dist=Math.min(...segs.map(([a,b])=>near(s,a,b)));maxOff=Math.max(maxOff,dist);if(dist>.30)off+=step/n;}start=p;}
detail.push({from:i+1,to:j+1,meters:+meters.toFixed(2),offMeters:+off.toFixed(2),maxOff:+maxOff.toFixed(2),bridge});}
assert.equal(detail.length,56);assert.equal(unreachable,0);assert.equal(clips,0);assert(detail.some(x=>x.bridge));// Short fillets may depart the center while staying inside the paved footprint.
assert(detail.every(r=>r.maxOff<=.08));assert.equal(new Set(ENGLISH_GRADE_LANDSCAPES.map(x=>x.grass)).size,6);
console.log(JSON.stringify({grade,offRoadStarts,roads:roads.map(r=>({name:r.name,triangles:gardenRoadMeshData(r.points,nav).indices.length/3})),paths:detail.length,unreachable,unsafeCenterSegments:clips,offRoadRoutes:detail.filter(r=>r.offMeters>.5).length,bridgeRoutes:detail.filter(r=>r.bridge).length,examples:detail.sort((a,b)=>b.offMeters-a.offMeters).slice(0,6)},null,2));
