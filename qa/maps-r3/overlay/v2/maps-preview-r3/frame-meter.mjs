// Optional preview-only render cadence. Count actual draw callbacks, never idle vsync.
export function installFrameMeter(host) {
 const pairs=[globalThis.WebGLRenderingContext,globalThis.WebGL2RenderingContext].filter(Boolean);
 const raf=window.requestAnimationFrame.bind(window);
 let stamp=null,active=null;
 window.requestAnimationFrame=function(cb){return raf(t=>{stamp=t;try{return cb(t);}finally{stamp=null;}});};
 const seen=new WeakSet();
 for(const p of pairs.map(type=>type.prototype))for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
  if(!Object.hasOwn(p,method))continue;
  const orig=p[method];if(typeof orig!=='function'||seen.has(orig))continue;seen.add(orig);
  p[method]=function(...args){
   const result=Reflect.apply(orig,this,args);
   const a=active;
   if(a&&stamp!==null&&a.timestamps.at(-1)!==stamp&&!document.hidden&&this.canvas.closest('#map')){
    if(!a.canvas)a.canvas=this.canvas;
    if(a.canvas===this.canvas)a.timestamps.push(stamp);
   }
   return result;
  };
 }
 const panel=document.createElement('div');panel.id='qa-frame-meter';
 const button=document.createElement('button');button.type='button';button.textContent='量測 5 秒畫面';
 const output=document.createElement('output');output.setAttribute('aria-live','polite');
 panel.append(button,output);host.before(panel);
 button.addEventListener('click',()=>{
  if(active)return;
  const a={timestamps:[],canvas:null};active=a;button.disabled=true;output.textContent='現在開始走動至站點';
  setTimeout(()=>{
   active=null;button.disabled=false;
   const t=a.timestamps,delta=t.slice(1).map((x,i)=>x-t[i]).sort((u,v)=>u-v);
   if(delta.length<20||!a.canvas?.isConnected){output.textContent='畫面樣本不足或切換地圖，請重測';return;}
   const pct=p=>delta[Math.ceil(p*delta.length)-1].toFixed(1);
   const fps=((t.length-1)*1000/(t.at(-1)-t[0])).toFixed(1);
   output.textContent=`實際繪製 ${t.length} 幀 · ${fps} FPS · p95 ${pct(.95)} ms · >50ms ${delta.filter(x=>x>50).length} 次`;
  },5000);
 });
}
