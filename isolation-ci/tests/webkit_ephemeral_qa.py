"""Diagnose ephemeral WebKit IndexedDB Blob storage and safe public-image fallback."""
import asyncio,json,os,threading,traceback
from pathlib import Path
from http.server import ThreadingHTTPServer
from playwright.async_api import async_playwright
import sw_offline_qa as fixture
OUT=Path(os.environ.get('QA_RESULTS','/results'));OUT.mkdir(exist_ok=True)
PROBE="""async ({name,key,blob})=>{
 const db=await new Promise((ok,no)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(new Error(r.error?.name+': '+r.error?.message))});
 const outcome=await new Promise(resolve=>{
  const tx=db.transaction('images','readwrite');let failure=null;
  const req=tx.objectStore('images').put(blob?new Blob(['SYNTHETIC'],{type:'image/png'}):'UNCHANGED',key);
  req.onerror=()=>{failure={name:req.error?.name,message:req.error?.message}};
  tx.onabort=()=>resolve({ok:false,error:failure||{name:tx.error?.name,message:tx.error?.message}});
  tx.oncomplete=()=>resolve({ok:true});
 });db.close();return outcome;
}"""
READ_SCALAR="""async ({name,key})=>{const db=await new Promise(ok=>{const r=indexedDB.open(name,1);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('images').objectStore('images').get(key);r.onsuccess=()=>ok(r.result)});db.close();return v}"""
async def main():
 report={'scope':'Fresh ephemeral Linux WebKit only; synthetic scalar vs Blob baseline and candidate SW public-image fallback'}
 if set(os.listdir('/sys/class/net'))!={'lo'}:raise RuntimeError('Requires network-none container')
 server=ThreadingHTTPServer(('127.0.0.1',0),fixture.Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 try:
  async with async_playwright() as p:
   browser=await p.webkit.launch(headless=True);ctx=await browser.new_context(service_workers='allow')
   page=await ctx.new_page();await page.goto(base+'/a/')
   report['scalar']=await page.evaluate(PROBE,{'name':'learning-planet-entry-images','key':'ORIGINAL_SENTINEL','blob':False})
   report['blob']=await page.evaluate(PROBE,{'name':'webkit-ephemeral-baseline','key':'blob','blob':True})
   assert report['scalar']['ok'], 'Scalar IndexedDB itself unavailable; cannot attribute failure to Blob'
   await page.evaluate("localStorage.setItem('synthetic-progress-sentinel','UNCHANGED')")
   await page.evaluate("async()=>{await navigator.serviceWorker.register('./entry-image-cache-sw.js',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready}")
   await page.wait_for_function('navigator.serviceWorker.controller!==null')
   response_js="async()=>{const r=await fetch('./image.png');return {status:r.status,cache:r.headers.get('X-LP-Image-Cache'),size:(await r.arrayBuffer()).byteLength}}"
   report['first_image']=await page.evaluate(response_js)
   # Await original message handler completion through the same test-only ack.
   await page.evaluate("async()=>{const channel=new MessageChannel();const done=new Promise(ok=>channel.port1.onmessage=e=>{if(e.data.complete)ok()});navigator.serviceWorker.controller.postMessage({type:'cache-loaded-entry-images',paths:['image.png']},[channel.port2]);await done;channel.port1.close()}")
   report['second_image']=await page.evaluate(response_js)
   for r in [report['first_image'],report['second_image']]:assert r['status']==200 and r['size']==len(fixture.PNG)
   assert await page.evaluate(READ_SCALAR,{'name':'learning-planet-entry-images','key':'ORIGINAL_SENTINEL'})=='UNCHANGED'
   assert await page.evaluate("localStorage.getItem('synthetic-progress-sentinel')")=='UNCHANGED'
   report['original_and_progress_sentinels']='UNCHANGED';report['local_image_requests']=fixture.hits['a']
   if not report['blob']['ok']:
    assert report['second_image']['cache'] is None and fixture.hits['a']>=2
    report['status']='DEGRADED_SAFE'
    report['meaning']='Ephemeral WebKit cannot persist Blob baseline; candidate keeps public image loading via local network without mutating original cache or progress. No offline image reuse in this mode.'
   else:
    assert report['second_image']['cache']=='indexeddb'
    report['status']='PASSED'
   await browser.close()
 except Exception:report['status']='FAILED';report['error']=traceback.format_exc()
 finally:server.shutdown();(OUT/'webkit-ephemeral-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
 return report.get('status') in ['PASSED','DEGRADED_SAFE']
if __name__=='__main__':
 import sys
 sys.exit(0 if asyncio.run(main()) else 1)
