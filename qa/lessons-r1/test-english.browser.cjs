const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const webroot = path.resolve(process.argv[2] || 'pages');
const route = '/v2/english-original-preview/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname); } catch { res.writeHead(400).end();return; }
  let f=path.resolve(webroot,'.'+pathname);
  if(!f.startsWith(webroot+path.sep)){res.writeHead(404).end();return;}
  if(pathname.endsWith('/'))f=path.join(f,'index.html');
  try{
    const bytes=fs.readFileSync(f);
    res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(bytes);
  }catch{res.writeHead(404).end();}
});

test('shared note switch and real lesson integration on three viewports',{timeout:120000},async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch();
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    for(const [width,height] of [[1165,800],[768,1024],[390,844]]){
      const page=await browser.newPage({viewport:{width,height}});
      const outbound=[],failed=[],errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
      await page.route('**/*',r=>{
        if(new URL(r.request().url()).origin===origin)return r.continue();
        outbound.push(r.request().url());return r.abort();
      });
      const title=()=>page.locator('.english-original-unit strong');
      const open=()=>page.locator('#english-original-open');
      const inner=()=>page.frameLocator('iframe[title="英文原創延伸子單元"]');
      const parentToggle=()=>page.locator('dialog .quiz-zhuyin-toggle');
      await page.goto(origin+route);
      assert.equal(await title().locator('rt').count(),0);
      assert.equal(await page.locator('#outer-zhuyin').getAttribute('aria-pressed'),'false');
      // Existing main's plain neighboring card and the optional original card share grammar.
      const offOuterHeight=await open().evaluate(e=>e.getBoundingClientRect().height);
      await page.locator('#outer-zhuyin').click();
      await title().locator('rt').first().waitFor({state:'visible'});
      await page.locator('#outer-zhuyin').click();
      assert.equal(await title().locator('rt').count(),0);
      assert.ok(Math.abs(await open().evaluate(e=>e.getBoundingClientRect().height)-offOuterHeight)<2);
      await open().click();
      await inner().locator('#lessonList article').first().waitFor();
      assert.equal(await inner().locator('#lessonList article').count(),8);
      assert.equal(await inner().locator('#content').isVisible(),false);
      assert.equal(await parentToggle().getAttribute('aria-pressed'),'false');
      const baseHeight=await parentToggle().evaluate(e=>e.closest('header').getBoundingClientRect().height);
      await parentToggle().click();
      await page.locator('dialog strong rt').first().waitFor({state:'visible'});
      assert.ok(await title().locator('rt').count()>0);
      await inner().locator('#navigation h2 rt').first().waitFor({state:'visible'});
      await inner().locator('[data-grade="6"]').click();
      assert.equal(await inner().locator('[data-grade="6"]').getAttribute('aria-pressed'),'true');
      assert.equal(await inner().locator('#content').isVisible(),false);
      await inner().locator('#lessonList article[data-lesson-id="en-g6-02"] button').click();
      await inner().locator('#content h2').first().waitFor();
      assert.equal(await inner().locator('#navigation').isVisible(),false);
      const q=inner().locator('#content>section:last-child>div').first();
      await q.locator('button').first().click();
      await q.locator('[role=status] rt').first().waitFor({state:'visible'});
      await parentToggle().click();
      assert.equal(await page.locator('dialog strong rt').count(),0);
      assert.equal(await title().locator('rt').count(),0);
      assert.equal(await inner().locator('main rt').count(),0);
      assert.ok(Math.abs(await parentToggle().evaluate(e=>e.closest('header').getBoundingClientRect().height)-baseHeight)<2);
      assert.equal(await inner().locator('main').evaluate(e=>document.documentElement.scrollWidth>innerWidth),false);
      await inner().locator('#return-lessons').click();
      assert.equal(await inner().locator('#lessonList article').count(),8);
      assert.equal(await inner().locator('main rt').count(),0);
      await page.locator('dialog .lp-panel-back').click();
      await page.locator('dialog').waitFor({state:'detached'});
      assert.equal(await open().evaluate(e=>document.activeElement===e),true);
      await page.locator('[data-preview-grade="6"]').click();
      await open().click();
      await inner().locator('#lessonList article').first().waitFor();
      assert.equal(await inner().locator('main rt').count(),0);
      assert.equal(await inner().locator('#lessonList article[data-lesson-id="en-g6-02"] button').getAttribute('aria-current'),'true');
      assert.equal(await inner().locator('#content').isVisible(),false);
      await page.goBack();
      await page.locator('dialog').waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>localStorage.length),0);
      assert.deepEqual({failed,errors,outbound},{failed:[],errors:[],outbound:[]});
      await page.close();
    }
  } finally {await browser.close();server.close();}
});
