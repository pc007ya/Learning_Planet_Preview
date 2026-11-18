"""Actual public app shell/subject smoke with all transport egress disabled."""
import asyncio,json,mimetypes,os,threading,traceback
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=Path('/source');OVERLAY=ROOT/'overlay'
OUT=Path(os.environ.get('QA_RESULTS','/results'));OUT.mkdir(exist_ok=True)
PREFIX='/Learning_Planet_Preview/'
EXACT=os.environ.get('QA_EXACT_ARTIFACT')=='1'
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  path=unquote(urlparse(self.path).path)
  if path=='/original-fixture':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<title>Synthetic original sentinel</title>');return
  if EXACT and path.startswith('/Learning_Planet_Assets/'):
   rel=path[len('/Learning_Planet_Assets/'):]
   if '..' in Path(rel).parts:self.send_error(403);return
   p=Path('/assets')/rel
   if not p.is_file():self.send_error(404);return
   self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(str(p))[0] or 'application/octet-stream');self.end_headers();self.wfile.write(p.read_bytes());return
  if not path.startswith(PREFIX):self.send_error(404);return
  rel=path[len(PREFIX):] or 'index.html'
  if '..' in Path(rel).parts:self.send_error(403);return
  p=(SOURCE if EXACT else OVERLAY)/rel
  if not p.is_file() and not EXACT:p=SOURCE/rel
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
    # Floating planet buttons never satisfy Playwright's pointer stability check.
    # Use the real keyboard activation path, not forced DOM event dispatch.
    button=page.locator('.home-subject-card[data-subject="'+subject+'"]')
    await button.focus();await button.press('Enter')
    expected={'chinese':'國文','english':'英文','math':'數學'}[subject]
    await page.locator('.subject-world-filter[data-world="'+expected+'"]:visible').wait_for(timeout=15000)
    await page.wait_for_timeout(3000)
    active=await page.locator('.subject-world-tabs button[data-active="true"]:visible').inner_text()
    assert expected in active, 'Wrong active subject tab: '+active
    unique={'chinese':'國語生字練習簿','english':'元音','math':'小一知識星圖'}[subject]
    assert unique in await page.locator('body').inner_text(), 'Missing subject-specific content: '+unique
    report['checks'].append({'subject':subject,'active_tab':active,'unique_content':unique,'screen':(await page.locator('body').inner_text())[:3000],'canvases':await page.locator('canvas').count(),'broken_images':await page.locator('img').evaluate_all('(xs)=>xs.filter(x=>x.src&&x.complete&&x.naturalWidth===0).length')})
    await page.screenshot(path=str(OUT/('ui-'+subject+'.png')),full_page=True)
    await page.locator('.app-home-btn:visible').first.click()
    await page.locator('.home-subject-card[data-subject="chinese"]').wait_for(state='visible',timeout=10000)
   assert await original.evaluate("localStorage.getItem('learning-planet.student-profiles.v1')")=='SYNTHETIC_ORIGINAL'
   assert await original.evaluate("localStorage.getItem('firebase:authUser:synthetic')")=='SYNTHETIC_AUTH'
   report['checks'].append('Original synthetic data and auth sentinel unchanged')
   # Capture every failure first; only expected offline external resources are classified.
   font='https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Noto+Sans+TC:wght@500;700;900&display=swap'
   report['expected_offline_external']=[u for u in report['external_blocked'] if u==font]
   report['unexpected_external']=[u for u in report['external_blocked'] if u!=font]
   assert not report['unexpected_external'], 'Unexpected external/API request attempt'
   assert not report['errors'], 'Uncaught application errors; see captured errors'
   assert not report['http_failures'], 'Local application resource HTTP failures; see captured list'
   assert all(not isinstance(c,dict) or c.get('broken_images',0)==0 for c in report['checks']), 'Broken image(s) detected'
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
