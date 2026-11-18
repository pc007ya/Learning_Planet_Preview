"""Actual IndexedDB/SW, only inside Docker --network none. No external route mock."""
import asyncio,base64,io,json,os,socket,threading,traceback
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('QA_RESULTS',str(ROOT/'browser-results')));OUT.mkdir(exist_ok=True)
SW=(ROOT/'overlay/entry-image-cache-sw.js').read_text()
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
rev={'a':'r1','b':'r1'};hits={'a':0,'b':0};available=True
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  path=self.path.split('?')[0];part=path.strip('/').split('/');scope=part[0] if part else ''
  if scope not in rev:self.send_error(404);return
  mime='text/html'
  if path.endswith('entry-image-cache-sw.js'):body=SW.encode();mime='text/javascript'
  elif path.endswith('entry-image-manifest.js'):
   body=('self.LP_ENTRY_IMAGE_MANIFEST='+json.dumps({'maxBytes':10000,'assets':{'image.png':rev[scope],'http://192.0.2.1/blocked.png':'test-only'}})).encode();mime='text/javascript'
  elif path.endswith('image.png'):
   hits[scope]+=1
   if not available:self.send_error(503);return
   body=PNG;mime='image/png'
  else:body=b'<!doctype html><title>Synthetic image cache</title>'
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
SEED="""async ({name,key,revision})=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>ok(r.result);r.onerror=no});await new Promise((ok,no)=>{const t=db.transaction('images','readwrite');t.objectStore('images').put({revision,blob:new Blob(['SENTINEL'],{type:'image/png'}),savedAt:Date.now(),lastUsed:Date.now()},key);t.oncomplete=ok;t.onerror=no});db.close()}"""
READ="""async ({name,key})=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>ok(r.result);r.onerror=no});const value=await new Promise((ok,no)=>{const t=db.transaction('images','readonly');const r=t.objectStore('images').get(key);r.onsuccess=()=>ok(r.result?{revision:r.result.revision,size:r.result.blob.size}:null);r.onerror=no});db.close();return value}"""
async def main():
 global available
 report={'scope':'Actual synthetic SW + native IndexedDB, transport egress disabled','checks':[]}
 # Fail before launching a browser unless Linux has no external interface.
 interfaces=set(os.listdir('/sys/class/net'))
 if interfaces!={'lo'}:raise RuntimeError('SW suite requires Docker --network none; interfaces='+str(interfaces))
 probe=socket.socket();probe.settimeout(1);errno=probe.connect_ex(('192.0.2.1',443));probe.close()
 if errno==0:raise RuntimeError('Unexpected external connectivity')
 report['interfaces']=sorted(interfaces);report['external_probe_errno']=errno
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 try:
  async with async_playwright() as p:
   browser=await getattr(p,os.environ.get('QA_BROWSER','chromium')).launch(headless=True)
   ctx=await browser.new_context(service_workers='allow')
   a=await ctx.new_page();b=await ctx.new_page();await a.goto(base+'/a/');await b.goto(base+'/b/')
   db_a='learning-planet-preview-entry-images.v1:'+base+'/a/'
   db_b='learning-planet-preview-entry-images.v1:'+base+'/b/'
   old={'name':'learning-planet-entry-images','key':'ORIGINAL_SENTINEL','revision':'original'}
   sibling={'name':db_b,'key':base+'/b/image.png','revision':'r1'}
   await a.evaluate(SEED,old);await a.evaluate(SEED,sibling)
   for page in [a,b]:
    await page.evaluate("async()=>{await navigator.serviceWorker.register('./entry-image-cache-sw.js',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready}")
    await page.wait_for_function('navigator.serviceWorker.controller!==null')
   assert (await a.evaluate(READ,old))['revision']=='original'
   assert (await a.evaluate(READ,sibling))['revision']=='r1'
   report['checks'].append('Activating both scopes preserves original and sibling cache')
   first=await a.evaluate("async()=>{const r=await fetch('./image.png');await r.arrayBuffer();return r.status}")
   assert first==200
   await a.wait_for_function("""async name=>{const db=await new Promise(ok=>{const r=indexedDB.open(name,1);r.onsuccess=()=>ok(r.result)});const value=await new Promise(ok=>{const r=db.transaction('images').objectStore('images').get(location.origin+'/a/image.png');r.onsuccess=()=>ok(r.result)});db.close();return !!value}""",arg=db_a)
   counts=hits.copy();available=False
   cached=await a.evaluate("async()=>{const r=await fetch('./image.png');return {status:r.status,cache:r.headers.get('X-LP-Image-Cache'),size:(await r.blob()).size}}")
   assert cached['status']==200 and cached['cache']=='indexeddb' and cached['size']==len(PNG)
   assert hits==counts
   report['checks'].append('Cached A image succeeds with local network image unavailable; no image request')
   await a.reload();await a.wait_for_function('navigator.serviceWorker.controller!==null')
   again=await a.evaluate("async()=>{const r=await fetch('./image.png');return r.headers.get('X-LP-Image-Cache')}")
   assert again=='indexeddb' and hits==counts
   report['checks'].append('Reload retains native IndexedDB cache')
   available=True;rev['a']='r2'
   await a.evaluate("""async()=>{const changed=new Promise(ok=>navigator.serviceWorker.addEventListener('controllerchange',ok,{once:true}));const r=await navigator.serviceWorker.getRegistration();await r.update();await changed}""")
   await a.wait_for_function("""async name=>{const db=await new Promise(ok=>{const r=indexedDB.open(name,1);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('images').objectStore('images').get(location.origin+'/a/image.png');r.onsuccess=()=>ok(r.result)});db.close();return !v}""",arg=db_a)
   assert (await b.evaluate(READ,sibling))['revision']=='r1'
   assert (await b.evaluate(READ,old))['revision']=='original'
   report['checks'].append('Revision update prunes A only, preserves B and original')
   # Original worker may attempt a synthetic TEST-NET URL; transport has no egress.
   await a.evaluate("navigator.serviceWorker.controller.postMessage({type:'cache-loaded-entry-images',paths:['http://192.0.2.1/blocked.png']})")
   await a.wait_for_timeout(500)
   assert await a.evaluate(READ,{'name':db_a,'key':'http://192.0.2.1/blocked.png'}) is None
   report['checks'].append('Worker cannot cache synthetic external URL with transport egress disabled')
   report['status']='PASSED';report['hits']=hits
   await browser.close()
 except Exception:report['status']='FAILED';report['error']=traceback.format_exc()
 finally:server.shutdown();(OUT/'sw-offline-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
 return report.get('status')=='PASSED'
if __name__=='__main__':
 import sys
 sys.exit(0 if asyncio.run(main()) else 1)
