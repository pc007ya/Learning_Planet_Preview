"""Engine diagnostic, NOT acceptance. Frozen prior public isolated artifact; no backend."""
import asyncio,json,os,sys,threading,traceback,subprocess,re
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,'/tests/isolation-ci/tests')
from ui_offline_qa import Handler,PREFIX
from playwright.async_api import async_playwright
OUT=Path('/results');OUT.mkdir(exist_ok=True)
async def main():
 assert set(os.listdir('/sys/class/net'))=={'lo'}
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 report={'scope':'Linux WebKit crash diagnosis only. Prior candidate b03dffa6 root, NOT route/deployment acceptance. Software Mesa env and removed storage bootstrap are test controls only, never product changes; native storage exists only in fresh synthetic no-egress context.','modes':[]}
 async with async_playwright() as p:
  for mode in ['root-software-rendering','root-native-storage']:
   def memory():
    result={}
    for k in ['memory.events','memory.peak','memory.current','memory.max']:
     q=Path('/sys/fs/cgroup')/k
     if q.exists():result[k]=q.read_text()
    result['processes']=subprocess.check_output(['ps','-eo','pid,comm,rss'],text=True)
    v=os.statvfs('/dev/shm');result['shm_available']=v.f_bavail*v.f_frsize
    return result
   record={'mode':mode,'crashes':[],'errors':[],'external_blocked':[],'before':memory(),'samples':[]}
   async def sample():
    while True:
     record['samples'].append(memory());await asyncio.sleep(1)
   sampler=asyncio.create_task(sample())
   browser=await p.webkit.launch(headless=True,env={**os.environ,**({'LIBGL_ALWAYS_SOFTWARE':'true','GALLIUM_DRIVER':'llvmpipe'} if mode=='root-software-rendering' else {})})
   ctx=await browser.new_context(service_workers='block')
   async def gate(route):
    if mode=='root-native-storage' and route.request.url==base+PREFIX:
     html=Path('/source/index.html').read_text()
     html,n=re.subn(r'<script>// Insert synchronously.*?</script>','<script>window.LP_PREVIEW_ONLY=true;window.LP_PREVIEW_READY=true;</script>',html,count=1,flags=re.S)
     assert n==1
     await route.fulfill(status=200,content_type='text/html',body=html)
    elif route.request.url.startswith(base+'/'):await route.continue_()
    else:record['external_blocked'].append(route.request.url);await route.abort('blockedbyclient')
   await ctx.route('**/*',gate);await ctx.route_web_socket('**/*',lambda ws:ws.close())
   page=await ctx.new_page()
   page.on('crash',lambda _:record['crashes'].append('target crashed'))
   page.on('pageerror',lambda e:record['errors'].append(str(e)))
   try:
    if mode.startswith('minimal'):
     await page.goto(base+'/original-fixture')
     await page.set_content('<button id="start">start</button><p id="out"></p><script>document.querySelector("button").onclick=()=>{'+('try{const r=document.documentElement;if(r.requestFullscreen){const x=r.requestFullscreen({navigationUI:"hide"});if(x&&x.catch)x.catch(()=>{});}else if(r.webkitRequestFullscreen)r.webkitRequestFullscreen();}catch(e){}' if mode=='minimal-fullscreen' else '')+'setTimeout(()=>{document.getElementById("out").textContent="DONE"},5000)};</script>')
     await page.locator('button').click()
     await page.get_by_text('DONE',exact=True).wait_for(timeout=15000)
    else:
     await page.goto(base+PREFIX)
     await page.locator('.login-auth-card input').first.wait_for(state='visible',timeout=60000)
     if mode=='root-no-fullscreen':
      await page.evaluate("document.documentElement.requestFullscreen=()=>Promise.resolve();document.documentElement.webkitRequestFullscreen=()=>{}")
     await page.locator('.login-auth-card input').nth(0).fill('DEMO')
     await page.locator('.login-auth-card input').nth(1).fill('DEMO')
     await page.get_by_role('button',name='登入學習星球',exact=True).click()
     await page.wait_for_function("!document.querySelector('.login-auth-card')&&!!document.querySelector('.app-home-btn,.home-subject-card')",timeout=30000)
    record['outcome']='COMPLETED'
   except Exception:record['outcome']='FAILED';record['failure']=traceback.format_exc()
   try:
    record['body']=await page.locator('body').inner_text(timeout=3000)
    await page.screenshot(path=str(OUT/(mode+'.png')),full_page=True,timeout=5000)
   except Exception as e:record['snapshot_error']=str(e)
   sampler.cancel()
   record['after']=memory()
   report['modes'].append(record)
   await browser.close()
 (OUT/'webkit-crash-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
asyncio.run(main())
