if(new URLSearchParams(location.search).get('qa')==='1'){try{const meter=await import('../maps-preview-r7/frame-meter.mjs');meter.installFrameMeter(document.querySelector('#status'));}catch(e){console.warn('Frame meter unavailable',e);}}
const screen=document.querySelector('#map'),tools=document.querySelector('#tools'),status=document.querySelector('#status');
const tabs=[...document.querySelectorAll('button[data-map]')];
let run=0,clear=()=>{},mode='math',grade=1;
const file=path=>new URL(path,import.meta.url);
async function load(path){const r=await fetch(file(path));if(!r.ok)throw Error('資源載入失敗');return r.json();}
function button(name,fn){const m=document.createElement('button');m.type='button';m.textContent=name;m.onclick=fn;tools.append(m);return m;}
function select(label,choices,change){const s=document.createElement('select');s.setAttribute('aria-label',label);for(const [value,title] of choices){const o=document.createElement('option');o.value=value;o.textContent=title;s.append(o);}s.onchange=()=>change(s.value);tools.append(s);return s;}
function level(n){const s=select('年級',Array.from({length:n},(_,i)=>[i+1,`${i+1} 年級`]),v=>{grade=+v;open(mode);});s.value=grade;}
function tell(message){status.textContent=message;}
async function open(name){
 const tick=++run;clear();clear=()=>{};screen.replaceChildren();screen.className='';screen.parentElement.dataset.map=name;tools.replaceChildren();
 mode=name;tell('正在載入地圖…');
 for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.map===name));
 const alive=()=>tick===run;
 const error=()=>{if(alive())tell('無法顯示 3D。請確認瀏覽器支援 WebGL 2。');};
 try{
  if(name==='chinese'){
   const [api,lessons]=await Promise.all([import('../modules/chinese-planet/map-r9.mjs'),load('../maps-preview-r7/chinese-map-titles.json')]);
   if(!alive())return;
   const arrival=id=>tell('已到達站點 '+id+'。預覽不開啟正式課程或寫入進度。');
   const map=api.mountChinesePlanet(screen,{lessons,lessonDisplayTitle:l=>l.displayTitle||l.title,initialGrade:grade,onClose:()=>open('math'),openLiteracy:arrival,openOriginal:arrival,showCatalogDetails:s=>arrival(s.title)});
   clear=()=>map.destroy();tell('國文星球。請依地圖內的「準備／抵達」提示操作。');return;
  }
  if(name==='english'){
   const [api,THREE,all]=await Promise.all([import('../modules/english-original/english-exploration-r9.mjs'),import('../modules/math-knowledge/vendor/three-r187/three.module.js'),load('../maps-preview-r7/english-map-titles.json')]);
   if(!alive())return;
   level(6);
   const units=all.filter(u=>u.grade===grade);
   const apiMap=api.createExplorer(screen,{THREE,units,onSelect:id=>tell('已到達 '+(units.find(u=>u.id===id)?.title||id)),onError:error});
   clear=()=>apiMap.dispose();tell('英文星球。點選站牌或使用方向鍵。');return;
  }
  const n=Math.min(3,grade);grade=n;
  const [api,scene]=await Promise.all([import('../modules/math-mission-map/v11/planet-v11.mjs'),load('../modules/math-mission-map/v11/assets/grade'+n+'-scene.json')]);
  if(!alive())return;
  level(3);
  const map=api.createV11PlanetScene(screen,{grade:n,assetBaseUrl:file('../modules/math-mission-map/v11/assets/').href,sceneData:scene,manualLanding:true,onError:error,onArrive:s=>tell('已到達 '+(s?.title||s?.courseId||'站點'))});
  clear=()=>map.dispose();
  const dest=select('站點',scene.stationsData.map(x=>[x.id,x.title]),()=>{});
  button('步行前往',()=>{if(!map.navigate(dest.value))tell('請等降落完成後前往站點。');});
  button('全景',()=>map.setMode('overview'));button('跟隨',()=>map.setMode('follow'));
  button('＋',()=>map.zoomBy(1.12));button('－',()=>map.zoomBy(1/1.12));
  if(await map.ready&&alive()){map.beginLanding();tell('數學星球。降落後可選站點步行。');}
 }catch(e){console.error(e);error();}
}
for(const tab of tabs)tab.addEventListener('click',()=>{grade=1;open(tab.dataset.map);});
addEventListener('pagehide',()=>{++run;clear();});
open('math');
