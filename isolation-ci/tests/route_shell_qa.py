"""Real public route-shell -> fetched root document chain, exact artifact only."""
import asyncio,json,os,threading,traceback
from pathlib import Path
from urllib.parse import urlparse
from http.server import ThreadingHTTPServer
from playwright.async_api import async_playwright
from ui_offline_qa import Handler,SOURCE,PREFIX
OUT=Path(os.environ.get('QA_RESULTS','/results'));OUT.mkdir(exist_ok=True)
FONT='https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Noto+Sans+TC:wght@500;700;900&display=swap'
async def main():
 assert os.environ.get('QA_EXACT_ARTIFACT')=='1'
 assert set(os.listdir('/sys/class/net'))=={'lo'}
 routes=sorted(p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*.html') if 'route-shell.js' in p.read_text(errors='replace'))
 assert routes and not any(p.startswith(('admin/','teacher/')) for p in routes)
 report={'scope':'Exact public route-shell login/DEMO bootstrap re-entry only; not deep lesson/3D functionality','routes':routes,'results':[]}
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 try:
  async with async_playwright() as p:
   for engine in ['chromium','webkit']:
    browser=await getattr(p,engine).launch(headless=True)
    for rel in routes:
     ctx=await browser.new_context(service_workers='block')
     blocked=[];errors=[];root_requests=[]
     async def gate(route):
      u=urlparse(route.request.url)
      if u.scheme=='http' and u.netloc==urlparse(base).netloc:await route.continue_()
      else:blocked.append(route.request.url);await route.abort('blockedbyclient')
     await ctx.route('**/*',gate);await ctx.route_web_socket('**/*',lambda ws:ws.close())
     original=await ctx.new_page();await original.goto(base+'/original-fixture')
     await original.evaluate("localStorage.setItem('production-route-sentinel','UNCHANGED')")
     page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
     page.on('request',lambda r:root_requests.append(r.url) if r.url==base+PREFIX+'index.html' else None)
     await page.goto(base+PREFIX+rel)
     await page.locator('.login-auth-card input').first.wait_for(state='visible',timeout=60000)
     assert root_requests,'Actual route-shell did not fetch root HTML'
     assert await page.evaluate("window.LP_PREVIEW_READY&&window.__LP_PREVIEW_ISOLATION_V1__.verify()&&!document.body.innerText.includes('預覽隔離未能啟動')")
     await page.locator('.login-auth-card input').nth(0).fill('DEMO')
     await page.locator('.login-auth-card input').nth(1).fill('DEMO')
     await page.get_by_role('button',name='登入學習星球',exact=True).click()
     await page.wait_for_function("!document.querySelector('.login-auth-card')&&!!document.querySelector('.app-home-btn,.home-subject-card')",timeout=30000)
     assert await page.evaluate("window.LP_PREVIEW_READY&&window.__LP_PREVIEW_ISOLATION_V1__.verify()&&window.LearningPlanetAuthV2.auth.currentUser===null&&!window.LearningPlanetFirebase.isReady()")
     assert await original.evaluate("localStorage.getItem('production-route-sentinel')")=='UNCHANGED'
     assert not errors,errors
     assert not [u for u in blocked if u!=FONT],blocked
     report['results'].append({'engine':engine,'path':rel,'root_fetches':len(root_requests),'login_visible':True,'demo_enters_app':True,'original_unchanged':True,'errors':errors,'blocked':blocked,'body_excerpt':(await page.locator('body').inner_text())[:500]})
     await ctx.close()
    await browser.close()
   report['status']='ROUTE_BOOTSTRAP_PASSED'
 except Exception:
  report['status']='FAILED';report['failure']=traceback.format_exc()
 finally:
  (OUT/'route-shell-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
 return report['status']=='ROUTE_BOOTSTRAP_PASSED'
if __name__=='__main__':raise SystemExit(0 if asyncio.run(main()) else 1)
