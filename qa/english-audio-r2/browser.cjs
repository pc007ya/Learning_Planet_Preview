const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
 for(const [width,height] of [[1165,800],[768,1024],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[],outbound=[];
  const origin=process.env.BASE_URL;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();outbound.push(r.request().url());return r.abort();});
  await page.addInitScript(()=>{
   window.sim={voice:false,spoken:[],current:null};
   Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class {constructor(text){this.text=text;}}});
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    getVoices:()=>[{lang:'zh-TW',localService:true,default:true},{lang:'en-US',localService:false},...(sim.voice?[{lang:'en-GB',localService:true,default:true},{lang:'en-US',localService:true}]:[])],
    speak:u=>{sim.spoken.push([u.text,u.lang,u.voice.localService]);sim.current=u;},cancel:()=>{sim.current=null;}
   }});
  });
  await page.goto(origin+'/v2/english-original-audio-r2/');
  await page.locator('#english-original-open').click();
  const f=page.frameLocator('iframe');
  await f.locator('[data-lesson-id="en-g1-01"] button').click();
  const quiz=f.locator('#content>section:last-child');
  const q9=quiz.locator(':scope>div').nth(8);
  const q10=quiz.locator(':scope>div').nth(9);
  const play=q9.getByRole('button',{name:'播放第 9 題'});
  const book=q9.getByRole('button',{name:'book'});
  assert.equal(await book.isDisabled(),true);
  await play.click();
  await q9.getByRole('status').filter({hasText:'找不到裝置的英文語音'}).waitFor({state:'visible'});
  assert.equal(await book.isDisabled(),true);
  const evalf=fn=>f.locator('body').evaluate(fn);
  assert.deepEqual(await evalf(()=>sim.spoken),[]);
  await evalf(()=>{sim.voice=true;});
  // 注音打開也不能把翻譯、選項或注音送進語音。
  await page.locator('dialog .quiz-zhuyin-toggle').click();
  await play.click();
  await evalf(()=>sim.current.onstart());
  assert.equal(await book.isDisabled(),true);
  await q10.getByRole('button',{name:'播放第 10 題'}).click();
  await evalf(()=>{sim.current.onstart();sim.current.onend();});
  assert.equal(await book.isDisabled(),true);
  assert.equal(await q10.getByRole('button',{name:'bag'}).isEnabled(),true);
  await play.click();
  await evalf(()=>{sim.current.onstart();sim.current.onend();});
  assert.equal(await book.isEnabled(),true);
  await book.click();
  await q9.getByRole('status').filter({hasText:/答.*對/}).waitFor();
  assert.equal(await play.isEnabled(),true);
  const hits=await f.locator('#content button.english-speaker').evaluateAll(list=>list.map(b=>({text:b.textContent,svg:b.querySelectorAll('svg').length,aria:b.getAttribute('aria-label'),size:[b.getBoundingClientRect().width,b.getBoundingClientRect().height]})));
  assert.ok(hits.length>20);
  for(const b of hits){assert.equal(b.text,'');assert.equal(b.svg,1);assert.ok(b.aria);assert.ok(b.size[0]>=44&&b.size[1]>=44);}
  assert.deepEqual(await evalf(()=>sim.spoken),[['book','en-US',true],['bag','en-US',true],['book','en-US',true]]);
  await play.click();
  await f.locator('#return-lessons').click();
  assert.equal(await evalf(()=>sim.current),null);
  assert.deepEqual({errors,outbound},{errors:[],outbound:[]});
  await page.close();
 }
 console.log('English audio R2: actual Chromium UI, speech API simulated, passed 3 viewports');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
