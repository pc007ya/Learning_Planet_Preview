import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
const base=new URL('../../pages/v2/',import.meta.url);
const ui=new URL('chinese-grade6-preview/',base);
const {mountPractice}=await import(new URL('app-layout-qa.mjs',ui));
const read=path=>readFile(new URL(path,base),'utf8');
const bank=JSON.parse(await read('modules/chinese-grade6/chinese-grade6-original-skills.json'));
const sources=JSON.parse(await read('modules/chinese-grade6/chinese-grade6-source-map.json'));
assert.equal(sources.lessons.length,36);
assert.match(await read('modules/chinese-grade6/style.css'),/\.writing-field/);
const main=bank.units.find(u=>u.title==='找證據，不急著下結論');
assert(main);
function makeUI(seconds=30){
 let now=0,click,html='',ref=null,timer=null,cancels=0;
 const callbacks=[];
 const root={
  get innerHTML(){return html;},
  set innerHTML(v){html=v;ref=v.includes('class="quiz-reference"')?{open:/class="quiz-reference"\s+open/.test(v)}:null;timer=v.includes('quiz-timer-circle')?makeTimer():null;},
  addEventListener(k,f){assert.equal(k,'click');click=f;},
  removeEventListener(){click=undefined;},contains(){return true;},
  querySelector(s){return s==='.quiz-reference'?ref:s==='.quiz-timer-circle'?timer:null;},
 };
 function makeTimer(){
  const child={textContent:html.match(/class="quiz-timer-value">([^<]+)/)?.[1]};
  return{dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelector:s=>s==='.quiz-timer-value'?child:null};
 }
 const app=mountPractice(root,bank,{lessons:[]},{seconds,now:()=>now,
  schedule(fn){callbacks.push(fn);return callbacks.length;},cancel(){cancels++;}});
 const hit=dataset=>{const el={dataset};click({target:{closest(s){return s==='button'?el:null;}}});};
 return{root,app,hit,callbacks,setNow(v){now=v;},get cancels(){return cancels;}};
}
test('existing round drives common quiz view; real 10-question lesson keeps deadlines and feedback',()=>{
 const t=makeUI();const act=action=>t.hit({action});
 t.hit({unit:main.id});const r=t.app.getRound();
 t.setNow(300000);assert.equal(r.phase,'reading');assert.equal(r.answers.length,0);assert.equal(t.callbacks.length,0);
 assert.match(t.root.innerHTML,/我讀完了，開始答題/);assert.doesNotMatch(t.root.innerHTML,/quiz-timer/);
 act('start');act('start');assert.equal(t.callbacks.length,1);
 for(const cls of ['quiz-master-shell','quiz-progress','quiz-timer-circle','quiz-card','answer-slot-grid'])assert(t.root.innerHTML.includes(cls));
 assert.match(t.root.innerHTML,/class="quiz-timer-value">30</);
 assert.match(t.root.innerHTML,/第 1 \/ 10 題/);
 t.root.querySelector('.quiz-reference').open=true;
 t.setNow(329999);t.callbacks[0]();
 assert.equal(r.remaining(),1);
 assert.equal(t.root.querySelector('.quiz-timer-circle').attrs['aria-label'],'剩餘 1 秒');
 assert.equal(t.root.querySelector('.quiz-reference').open,true);
 t.setNow(330000);
 t.hit({answer:String(r.questions[0].options.indexOf(r.questions[0].answer))});
 t.callbacks[0]();t.hit({answer:'0'});
 assert.equal(r.answers.length,1);assert.deepEqual(r.answers[0],{questionId:r.questions[0].id,answer:null,correct:false,timedOut:true});
 assert.match(t.root.innerHTML,/本題分析 · 時間到/);assert.match(t.root.innerHTML,/data-slot-state="correct"/);assert.equal(t.root.querySelector('.quiz-reference').open,true);
 act('next');act('next');assert.equal(r.index,1);assert.equal(r.remaining(),30);assert.match(t.root.innerHTML,/第 2 \/ 10 題/);
 for(let i=1;i<10;i++){t.hit({answer:String(r.questions[i].options.indexOf(r.questions[i].answer))});act('next');}
 assert.equal(r.phase,'result');assert.match(t.root.innerHTML,/答對 9／10 題/);assert.equal(t.cancels,1);
 t.app.destroy();
});
test('Back cancels pending ticks and opens fresh untimed reading',()=>{
 const t=makeUI(45);t.hit({unit:main.id});t.hit({action:'start'});
 const stale=t.app.getRound();assert.match(t.root.innerHTML,/class="quiz-timer-value">45</);
 t.hit({action:'home'});assert.equal(stale.active,false);assert.equal(t.cancels,1);
 t.hit({unit:main.id});t.setNow(100000);t.callbacks[0]();
 assert.equal(t.app.getRound().phase,'reading');assert.equal(t.app.getRound().answers.length,0);
});
test('fixture bounded to same-origin assets and uses existing round/writing modules; no storage/reward machinery',async()=>{
 const probe=await Promise.all(['index.html','app-layout-qa.mjs','quiz-shell-language.mjs'].map(n=>readFile(new URL(n,ui),'utf8')));
 assert.match(probe[0],/connect-src 'self';/);
 assert.match(probe[0],/form-action 'none'/);
 assert.match(probe[1],/from '\.\.\/modules\/chinese-grade6\/model.mjs'/);
 assert.match(probe[1],/from '\.\.\/modules\/chinese-grade6\/writing.mjs'/);
 assert.doesNotMatch(probe.join('\n'),/https?:|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bfetch\s*\([^n]/i);
});
