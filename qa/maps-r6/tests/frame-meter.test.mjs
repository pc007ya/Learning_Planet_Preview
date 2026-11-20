import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFrameMeter} from '../overlay/v2/maps-preview-r6/frame-meter.mjs';

test('counts distinct RAF timestamps only once and ignores hidden or non-map draws',()=>{
 let callback, timer;const visibleCanvas={closest:s=>s==='#map',isConnected:true};
 class GL {constructor(canvas){this.canvas=canvas;}drawElements(){return 1;}drawArrays(){return 2;}}
 class GL2 extends GL {drawElementsInstanced(){return 3;}}
 const badges=[];
 const old={doc:globalThis.document,win:globalThis.window,GL:globalThis.WebGLRenderingContext,GL2:globalThis.WebGL2RenderingContext,timer:globalThis.setTimeout};
 try{
  globalThis.document={hidden:false,createElement:name=>{const q={append(){},setAttribute(){},addEventListener(k,v){this[k]=v;},textContent:''};badges.push([name,q]);return q;}};
  globalThis.window={requestAnimationFrame:f=>{callback=f;return 1;}};globalThis.WebGLRenderingContext=GL;globalThis.WebGL2RenderingContext=GL2;
  globalThis.setTimeout=(f,ms)=>{assert.equal(ms,5000);timer=f;};
  installFrameMeter({before(){}});
  const target=new GL2(visibleCanvas), ignored=new GL({closest:()=>null});
  badges.find(p=>p[0]==='button')[1].click();
  for(let i=1;i<=25;i++){window.requestAnimationFrame(()=>{assert.equal(ignored.drawArrays(),2);assert.equal(target.drawElements(),1);assert.equal(target.drawElementsInstanced(),3);});callback(i*16.666);}
  document.hidden=true;window.requestAnimationFrame(()=>target.drawArrays());callback(451);
  timer();assert.match(badges.find(p=>p[0]==='output')[1].textContent,/25 幀 · 60\.0 FPS · p95 16\.7 ms · >50ms 0 次 · 繪製跨度 0\.40 秒/);
 }finally{globalThis.document=old.doc;globalThis.window=old.win;globalThis.WebGLRenderingContext=old.GL;globalThis.WebGL2RenderingContext=old.GL2;globalThis.setTimeout=old.timer;}
});
