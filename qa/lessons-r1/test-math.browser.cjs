const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.BASE_URL,b=await chromium.launch();
 try{
  const p=await b.newPage({viewport:{width:390,height:700}}),bad=[];
  p.on('pageerror',e=>bad.push(e.message));
  await p.route('**/*',r=>{
   if(!r.request().url().startsWith('data:image/')&&new URL(r.request().url()).origin!==base){bad.push(r.request().url());return r.abort();}
   return r.continue();
  });
  await p.goto(base+'/v2/math-quiz-preview/');
  const toggle=p.locator('#toggle'),draw=p.locator('#figure');
  const src=()=>draw.getAttribute('src');
  const original=await src();
  assert.equal(await p.locator('#stem ruby').count(),0);
  await toggle.click();await p.waitForFunction(()=>document.querySelector('#toggle').getAttribute('aria-pressed')==='true');
  assert.equal(await p.locator('#stem ruby').count(),7);
  const labeled=decodeURIComponent((await src()).split(',').slice(1).join(','));
  assert.match(labeled,/<tspan/);
  for(const label of ['百','十','個'])assert(labeled.includes(label));
  const answer=p.locator('#options button').filter({hasText:/^18$/});
  await answer.click();await p.locator('#submit').click();
  assert(await p.locator('#explain ruby').count()>=10);
  await toggle.click();
  assert.equal(await p.locator('#stem ruby, #explain ruby').count(),0);
  assert.equal(await src(),original);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(bad,[]);
  console.log('Math u109 preview: real question, all seven stem readings, diagram labels, result toggle, and original SVG recovery.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
