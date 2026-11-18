"""Actual public app shell/subject smoke with all transport egress disabled."""
import asyncio,json,mimetypes,os,threading,traceback
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=Path('/source');OVERLAY=ROOT/'overlay'
OUT=Path(os.environ.get('QA_RESULTS','/results'));OUT.mkdir(exist_ok=True)
PREFIX='/Learning_Planet_Preview/'
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  path=unquote(urlparse(self.path).path)
  if path=='/original-fixture':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<title>Synthetic original sentinel</title>');return
  if not path.startswith(PREFIX):self.send_error(404);return
  rel=path[len(PREFIX):] or 'index.html'
  if '..' in Path(rel).parts:self.send_error(403);return
  p=OVERLAY/rel
  if not p.is_file():p=SOURCE/rel
  if not p.is_file():self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(str(p))[0] or 'application/octet-stream');self.end_headers();self.wfile.write(p.read_bytes())
async def main():
 report={'scope':'Actual public app DEMO login, home and subject-entry smoke only; no full course, video, map-performance or Safari claim','external_blocked':[],'errors':[],'http_failures':[],'checks':[]}
 if set(os.listdir('/sys/class/net'))!={'lo'}:raise RuntimeError('Requires Docker --network none')
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True)
   ctx=await browser.new_context(viewport={'width':1365,'height':900},service_workers='block')
   async def gate(route):
    u=urlparse(route.request.url)
    if u.scheme=='http' and u.netloc==urlparse(base).netloc:await route.continue_()
    else:report['external_blocked'].append(route.request.url);await route.abort('blockedbyclient')
   await ctx.route('**/*',gate);await ctx.route_web_socket('**/*',lambda ws:ws.close())
   original=await ctx.new_page();await original.goto(base+'/original-fixture')
   await original.evaluate("localStorage.setItem('learning-planet.student-profiles.v1','SYNTHETIC_ORIGINAL');localStorage.setItem('firebase:authUser:synthetic','SYNTHETIC_AUTH')")
   page=await ctx.new_page()
   page.on('pageerror',lambda e:report['errors'].append(str(e)))
   page.on('response',lambda r:report['http_failures'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
   await page.goto(base+PREFIX,wait_until='domcontentloaded')
   await page.locator('.login-auth-card input').first.wait_for(state='visible',timeout=60000)
   await page.screenshot(path=str(OUT/'ui-login.png'),full_page=True)
   assert await page.evaluate('window.LP_PREVIEW_READY&&window.LearningPlanetAuthV2.auth.currentUser===null&&!window.LearningPlanetFirebase.isReady()')
   await page.locator('.login-auth-card input').nth(0).fill('DEMO')
   await page.locator('.login-auth-card input').nth(1).fill('DEMO')
   await page.get_by_role('button',name='登入學習星球',exact=True).click()
   await page.locator('.home-subject-card[data-subject="chinese"]').wait_for(state='visible',timeout=30000)
   await page.screenshot(path=str(OUT/'ui-home.png'),full_page=True)
   report['checks'].append('Actual DEMO login reaches actual home; offline auth remains null')
   for subject in ['chinese','english','math']:
    await page.locator('.home-subject-card[data-subject="'+subject+'"]').click()
    await page.wait_for_timeout(3000)
    report['checks'].append({'subject':subject,'screen':(await page.locator('body').inner_text())[:3000],'canvases':await page.locator('canvas').count(),'broken_images':await page.locator('img').evaluate_all('(xs)=>xs.filter(x=>x.src&&x.complete&&x.naturalWidth===0).length')})
    await page.screenshot(path=str(OUT/('ui-'+subject+'.png')),full_page=True)
    await page.locator('.app-home-btn:visible').first.click()
    await page.locator('.home-subject-card[data-subject="chinese"]').wait_for(state='visible',timeout=10000)
   assert await original.evaluate("localStorage.getItem('learning-planet.student-profiles.v1')")=='SYNTHETIC_ORIGINAL'
   assert await original.evaluate("localStorage.getItem('firebase:authUser:synthetic')")=='SYNTHETIC_AUTH'
   report['checks'].append('Original synthetic data and auth sentinel unchanged')
   report['status']='SMOKE_PASSED';await browser.close()
 except Exception:
  report['status']='FAILED';report['error']=traceback.format_exc()
  try:await page.screenshot(path=str(OUT/'ui-failure.png'),full_page=True);report['last_body']=(await page.locator('body').inner_text())[:6000]
  except Exception:pass
 finally:server.shutdown();(OUT/'ui-offline-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
 return report.get('status')=='SMOKE_PASSED'
if __name__=='__main__':
 import sys
 sys.exit(0 if asyncio.run(main()) else 1)
