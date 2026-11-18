"""LOCAL FIXTURES ONLY. Guard/parser integration, NOT full application/UI QA.
Requires a separately permitted working Chromium environment. No live CDN/backend.
Service workers BLOCKED here. SW requires separate offline/egress-isolated run.
"""
import asyncio,json,threading,re,os,sys
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OVERLAY=ROOT/'overlay';OUT=ROOT/'browser-results'
BOOT=(ROOT/'preview-bootstrap.js').read_text()
GUARD=(OVERLAY/'auth-v2/page-access.mjs').read_text()
STORY=(OVERLAY/'modules/story-entry.mjs').read_text()
PAGES=json.loads(re.search(r'new Set\((\[.*\])\)',GUARD)[1]);BOOKS=json.loads(re.search(r'new Set\((\[.*\])\)',STORY)[1])
READERS={'amusement-park-storybook.html': 'modules/little-star/little-star.js?v=shared-reader-20261024', 'bridge-construction-storybook.html': 'modules/little-star/little-star.js?v=local-20261012-books34-36-r1', 'little-robot-storybook.html': 'modules/little-star/little-star.js?v=local-20261012-books34-36-r1', 'lost-lighthouse-storybook.html': 'modules/little-star/little-star.js?v=local-20261012-books34-36-r1', 'magic-ball-storybook.html': 'modules/little-star/little-star.js?local-20261012-books34-36-r1', 'magic-potion-storybook.html': 'modules/little-star/little-star.js?v=local-20261012-book36-r2', 'market-storybook.html': 'modules/little-star/little-star.js?local-20261012-books34-36-r1', 'mixed-up-museum-storybook.html': 'modules/little-star/little-star.js?v=local-20261012-books34-36-r1', 'picky-bear-storybook.html': 'modules/little-star/little-star.js?v=local-20261015-books38-39-main1', 'princess-weekend-storybook.html': 'modules/book-49/reader.js?v=49-portrait-webp-20261013', 'science-homework-storybook.html': 'modules/little-star/little-star.js?v=local-20261015-books38-39-main1', 'snow-before-storybook.html': 'modules/little-star/little-star.js?v=local-20261012-books34-36-r1', 'story-planet.html': 'modules/story-planet/story-planet.js?v=center-cover-20261026', 'underwater-world-storybook.html': 'modules/little-star/little-star.js?v=shared-reader-20261024'}
PREFIX='/Learning_Planet_Preview/'
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  path=urlparse(self.path).path; rel=path.removeprefix(PREFIX);mime='text/html'
  if path=='/original-fixture':body='<title>Synthetic original</title>'
  elif path=='/sentinel.js':mime='text/javascript';body='window.__externalExecuted=true;'
  elif path in ['/parser/success','/parser/failure']:
   body='<html><head><meta charset="utf-8"><script>'+BOOT+'</script><script>window.__inlineExecuted=true;</script><script src="/sentinel.js"></script><script type="module">window.__moduleExecuted=true;</script></head><body>fixture sentinel</body></html>'
  elif path==PREFIX:body='<title>DEMO fixture home</title><p>Preview fixture home, not live app</p>'
  elif path==PREFIX+'auth-v2/page-access.mjs':mime='text/javascript';body=GUARD
  elif path==PREFIX+'modules/story-entry.mjs':mime='text/javascript';body=STORY
  elif path==PREFIX+'auth-v2/page-script-loader.mjs':mime='text/javascript';body=(OVERLAY/'auth-v2/page-script-loader.mjs').read_text()
  elif rel in BOOKS:
   body=(ROOT/'story-fixtures'/rel).read_text()
   body=re.sub(r'(<head\b[^>]*>)',lambda m:m[0]+'<script>'+BOOT+'</script>',body,count=1)
  elif rel in PAGES:
   story=False
   attrs=('data-story-reader="'+READERS[rel]+'" src="modules/story-entry.mjs"') if story else 'data-page-access data-entry="qa-reader.mjs" src="'+('../'*(len(Path(rel).parts)-1))+'auth-v2/page-access.mjs"'
   # Match actual source document base for relative entry modules.
   body='<html><head><meta charset="utf-8"><script>'+BOOT+'</script></head><body><p id="page-auth-status">locked</p><main id="story-app" data-auth-content hidden inert></main><script type="module" '+attrs+'></script></body></html>'
  elif path.startswith(PREFIX) and (path.endswith('qa-reader.mjs') or any(path==PREFIX+urlparse(v).path for v in READERS.values())):
   mime='text/javascript';body='await window.__recordReader();window.__readerLoads=(window.__readerLoads||0)+1;'
  else:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body.encode())
async def seed_original(ctx,base,active):
 original=await ctx.new_page()
 await original.goto(base+'/original-fixture')
 await original.evaluate("localStorage.setItem('production-sentinel','UNCHANGED')")
 if active:await original.evaluate("localStorage.setItem('learning-planet-preview.v1:preview-demo-active','yes')")
 return original
async def verify_original(original):
 # Reuse the SAME page without navigation or reseeding: corruption must remain visible.
 assert await original.evaluate("localStorage.getItem('production-sentinel')")=='UNCHANGED', 'Original sentinel was modified or deleted'
async def run():
 OUT.mkdir(exist_ok=True);report={'scope':'synthetic parser + 62 direct learning guards + 14 actual-HTML page-access/loader/story-entry chains; mock readers only','external_attempts':[],'results':[],'sw':'NOT RUN: workers blocked, separate egress-isolated suite required','full_ui':'NOT RUN: no real app or CDN'}
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 try:
  async with async_playwright() as p:
   browser=await getattr(p,os.environ.get('QA_BROWSER','chromium')).launch(headless=True)
   async def context(fail=False,active=True):
    ctx=await browser.new_context(service_workers='block')
    async def gate(route):
     u=urlparse(route.request.url)
     if u.scheme=='http' and u.netloc==urlparse(base).netloc:await route.continue_()
     else:report['external_attempts'].append(route.request.url);await route.abort('blockedbyclient')
    await ctx.route('**/*',gate)
    await ctx.route_web_socket('**/*',lambda ws:ws.close())
    # Fault injection only, never repair or seed data from an init script.
    if fail:await ctx.add_init_script("if(location.pathname==='/parser/failure')Object.defineProperty(window,'localStorage',{value:localStorage,configurable:false});")
    executions=[]
    await ctx.expose_binding('__recordReader',lambda source:executions.append(source['page']))
    original=await seed_original(ctx,base,active)
    return ctx,original,executions
   for fail in [False,True]:
    ctx,original,executions=await context(fail);page=await ctx.new_page();await page.goto(base+'/parser/'+('failure' if fail else 'success'));await page.wait_for_timeout(500)
    value=await page.evaluate('({ready:!!window.LP_PREVIEW_READY,inline:!!window.__inlineExecuted,external:!!window.__externalExecuted,module:!!window.__moduleExecuted,error:document.body.innerText.includes("預覽隔離未能啟動")})')
    report['results'].append({'parser_observation':fail,'value':value})
    assert value['ready']==(not fail);assert value['inline']==(not fail);assert value['external']==(not fail);assert value['module']==(not fail)
    if fail:assert value['error']
    await verify_original(original)
    report['results'].append({'parser_failure':fail,'observed':value});await ctx.close()
   for active in [False,True]:
    ctx,original=await context(active=active)
    for path in PAGES:
     page=await ctx.new_page();await page.goto(base+PREFIX+path);await page.wait_for_timeout(150)
     if active:
      await page.wait_for_function('window.__readerLoads===1',timeout=3000)
      await page.evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))');await page.wait_for_timeout(100)
      assert await page.evaluate('window.__readerLoads')==1
      await page.wait_for_function("Array.from(document.querySelectorAll('[data-auth-content]')).every(e=>!e.hidden&&!e.inert)&&document.getElementById('page-auth-status').hidden",timeout=3000)
      if path in BOOKS:
       assert await page.locator('script[data-auth-script]').count()==0
       assert await page.locator('script[data-story-reader][type=module]').count()==1
     else:await page.wait_for_url(base+PREFIX)
     assert sum(p is page for p in executions)==(1 if active else 0), 'Reader execution count persists across redirect'
     await verify_original(original)
     report['results'].append({'guard':path,'demo':active,'reader_executions':sum(p is page for p in executions),'pass':True});await page.close()
    await ctx.close()
   await browser.close()
   report['status']='PASSED'
 except Exception as e:
  import traceback
  report['blocked_or_failure']=traceback.format_exc();report['status']='NOT PASSED'
 finally:(OUT/'offline-fixture-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
 return report.get('status')=='PASSED'
if __name__=='__main__':sys.exit(0 if asyncio.run(run()) else 1)
