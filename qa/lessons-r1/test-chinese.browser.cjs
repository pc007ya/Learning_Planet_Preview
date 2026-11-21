const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.BASE_URL,b=await chromium.launch();
 const bad=[];
 try{
  for(const viewport of [{width:1180,height:800},{width:1024,height:675},{width:390,height:700}]){
   const c=await b.newContext({viewport});
   await c.route('**/*',r=>{
    if(new URL(r.request().url()).origin!==base){bad.push(r.request().url());return r.abort();}
    return r.continue();
   });
   const p=await c.newPage();p.on('pageerror',e=>bad.push(e.message));
   await p.clock.install();
   await p.goto(base+'/v2/chinese-grade6-preview/?seconds=30');
   const card=p.locator('.cards article').filter({hasText:'找證據，不急著下結論'});
   await card.getByRole('button',{name:/閱讀短文/}).click();
   assert.equal(await p.getByRole('timer').count(),0);
   await p.clock.fastForward(300000);
   await p.getByRole('button',{name:'我讀完了，開始答題'}).click();
   assert.match(await p.getByRole('timer').innerText(),/30/);
   assert.equal(await p.getByRole('progressbar').getAttribute('aria-valuenow'),'1');
   await p.locator('summary').filter({hasText:'查看原創短文'}).click();
   await p.clock.fastForward(30000);
   assert.match(await p.locator('.quiz-feedback').innerText(),/時間到/);
   assert.equal(await p.locator('details.quiz-reference').getAttribute('open'),'');
   await p.getByRole('button',{name:'下一題'}).click();
   assert.equal(await p.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
   assert.match(await p.getByRole('timer').innerText(),/30/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.getByRole('button',{name:'返回單元列表'}).click();
   assert.equal(await p.getByRole('timer').count(),0);
   assert.equal(await p.evaluate(()=>localStorage.length),0);
   await c.close();
  }
  assert.deepEqual(bad,[]);
  console.log('Chinese Grade 6 rendered quiz: 3 viewport checks, timeout, Next, Back, and no external requests or local storage writes.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
