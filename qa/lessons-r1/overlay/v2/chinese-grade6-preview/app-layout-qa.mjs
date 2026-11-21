import { PracticeRound,questionSeconds } from '../modules/chinese-grade6/model.mjs';
import { mountWriting } from '../modules/chinese-grade6/writing.mjs';
import { renderLanguageQuiz } from './quiz-shell-language.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const passage=u=>`<section class="passage" aria-label="原創短文">${u.passage.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`;
function registryPanel(registry){
 if(!registry)return '';
 return `<section class="panel" aria-label="115學年度官方書目核實"><h2>115學年度官方書目核實</h2><p>國語第 ${esc(registry.volume)} 冊 · ${esc(registry.grade)} 年級。保留原有 115 上學期目錄與練習，以下另列書籍層級資料。</p><ul>${registry.publishers.map(p=>`<li><strong>${esc(p.publisher)}</strong>：${esc(p.edition)} · ${esc(p.license)} · 再版修訂文號 ${esc(p.revision)}</li>`).join('')}</ul><p>${esc(registry.scope)}</p><p><a href="${esc(registry.url)}" target="_blank" rel="noopener noreferrer">${esc(registry.sourceTitle)} ↗</a>（文件更新 ${esc(registry.sourceUpdatedAt)}；PDF 第 ${esc(registry.sourcePage)} 頁；核對 ${esc(registry.checkedAt)}）</p></section>`;
}
export function mountPractice(root,bank,sources,{seconds=30,now=()=>Date.now(),schedule=setInterval,cancel=clearInterval,writingOptions={}}={}){
 let round=null,timer=null,screen='home',writing=null,passageOpen=false;
 const leaveWriting=()=>{if(writing&&!writing.canLeave())return false;writing?.destroy();writing=null;return true;};
 const stop=()=>{if(timer!==null)cancel(timer);timer=null;round?.exit();round=null;passageOpen=false;};
 const notice='<p class="notice">六年級基礎閱讀與思辨補充，非出版社課文；未核定對應任何出版社課目的學習目標。不提供注音或朗讀。本頁不儲存姓名、成績或發放獎勵。</p>';
 const heading='<header><button data-action="home">原創練習首頁</button><button data-action="sources">出版社來源對照</button></header>';
 function render(){
  if(round&&(round.phase==='question'||round.phase==='feedback')){
   const q=round.questions[round.index],a=round.phase==='feedback'?round.answers[round.index]:null;
   const previousPassage=root.querySelector('.quiz-reference');
   if(previousPassage)passageOpen=previousPassage.open;
   root.innerHTML=renderLanguageQuiz({title:round.unit.title,count:round.questions.length,index:round.index,
    seconds:round.remaining(),feedback:a&&{...a,explanation:q.explanation},prompt:q.prompt,options:q.options,answer:q.answer,
    passage:`<details class="quiz-reference" ${passageOpen?'open':''}><summary>查看原創短文${a?'':'（計時繼續）'}</summary>${passage(round.unit)}</details>`});
   const nextPassage=root.querySelector('.quiz-reference');
   if(nextPassage&&previousPassage)nextPassage.scrollTop=previousPassage.scrollTop||0;
   return;
  }
  let body='';
  if(screen==='sources')body=`<h1>六上課程來源對照</h1><p>115 上學期 · 36筆出版社目錄資訊，不是已完成教材。教材尚未建置、學習目標待核；不提供出版社課文。逐課對應的印刷版次未核；官方書籍資料另列於下方。</p>${registryPanel(sources.bookRegistry)}${['南一版','康軒版','翰林版'].map(pub=>`<section class="panel"><h2>${pub}</h2><ul>${sources.lessons.filter(l=>l.publisher===pub).map(l=>`<li><a href="${esc(l.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(l.title)} ↗</a><div class="notice">教材尚未建置 · 學習目標待核 · ${esc(l.checkedAt)} 核目錄標題</div></li>`).join('')}</ul></section>`).join('')}`;
  else if(!round)body=`<h1>六年級原創能力練習</h1>${notice}<p>${bank.units.length}課原創閱讀材料、共${bank.units.reduce((sum,u)=>sum+u.questions.length,0)}題。每課一回10題，現有題庫每課10題，不代表已完成全部能力題庫。</p><p>先讀短文，不計時。按開始後每題 ${questionSeconds(seconds)} 秒，沿用一般題首回計時；查看短文時時間仍繼續，答完可看解析。</p><div class="cards">${bank.units.map(u=>`<article class="panel"><h2>${esc(u.title)}</h2><p>${esc(u.objective)}</p><button class="primary" data-unit="${esc(u.id)}">閱讀短文 →</button><button data-writing-unit="${esc(u.id)}">自行摘要與提出證據</button></article>`).join('')}</div>`;
  else {const u=round.unit;body=`<h1>${esc(u.title)}</h1>${notice}<section class="panel">`;
   if(round.phase==='reading')body+=`${passage(u)}<p>讀完再開始：${round.questions.length}題，每題 ${round.seconds} 秒。</p><button class="primary" data-action="start">我讀完了，開始答題</button>`;
   else if(round.phase==='result')body+=`<h2>本回練習結果</h2><p>答對 ${round.answers.filter(a=>a.correct).length}／${round.questions.length} 題</p><p>這是本回作答結果，不代表能力已達成或題庫完成。可回首頁重新閱讀練習。</p><ol>${round.questions.map((item,i)=>`<li>${esc(item.prompt)}<br>你的答案：${esc(round.answers[i].answer??'未作答（逾時）')}<br>正解：${esc(item.answer)}<p>${esc(item.explanation)}</p></li>`).join('')}</ol><button data-action="home">返回原創練習首頁</button>`;
   body+='</section>';}
  root.innerHTML=heading+body;
 }
 function click(event){const headerLink=event.target.closest('header a');if(headerLink&&writing){
  // A new tab/window (or download gesture) does not leave this activity.
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0)||headerLink.target==='_blank')return;
  if(!leaveWriting())event.preventDefault();return;}
 const el=event.target.closest('button');if(!el||!root.contains(el))return;
  if(el.dataset.writingUnit){const u=bank.units.find(x=>x.id===el.dataset.writingUnit);if(!u||!leaveWriting())return;stop();screen='writing';root.innerHTML=heading+'<section id="writing-panel"></section>';writing=mountWriting(root.querySelector('#writing-panel'),u,writingOptions);return;}
  if(el.dataset.unit){if(!leaveWriting())return;const u=bank.units.find(x=>x.id===el.dataset.unit);if(!u)return;stop();screen='practice';round=new PracticeRound(u,seconds,now);render();return;}
  const action=el.dataset.action;
  if(action==='home'||action==='sources'){if(!leaveWriting())return;stop();screen=action;render();return;}
  if(!round)return;
  if(action==='start'&&round.start()){const active=round;timer=schedule(()=>{if(round!==active||!active.active)return;if(active.tick())render();else{const node=root.querySelector('.quiz-timer-circle');if(node&&active.phase==='question'){const left=active.remaining();const value=node.querySelector('.quiz-timer-value');if(value)value.textContent=left;node.dataset.urgent=String(left<=5);node.setAttribute('aria-label','剩餘 '+left+' 秒');}}},250);render();}
  else if(action==='next'&&round.next()){if(round.phase==='result'&&timer!==null){cancel(timer);timer=null;}render();}
  else if(el.dataset.answer!==undefined){const opt=round.questions[round.index].options[Number(el.dataset.answer)];if(round.answer(opt))render();}
 }
 root.addEventListener('click',click);render();
 return {isDirty:()=>!!writing?.isDirty(),getWriting:()=>writing,suspend(){writing?.destroy();writing=null;stop();screen='home';render();},destroy(){writing?.destroy();writing=null;stop();root.removeEventListener('click',click);},getRound:()=>round};
}
const root=typeof document!=='undefined'?document.querySelector('#grade6-app'):null;
if(root){Promise.all(['chinese-grade6-original-skills.json','chinese-grade6-source-map.json'].map(async name=>{const r=await fetch(new URL('../modules/chinese-grade6/'+name,import.meta.url));if(!r.ok)throw Error('load');return r.json();})).then(([bank,sources])=>{
 const app=mountPractice(root,bank,sources,{seconds:questionSeconds(new URLSearchParams(location.search).get('seconds'))});window.addEventListener('pagehide',()=>app.suspend());window.addEventListener('beforeunload',event=>{if(app.isDirty()){event.preventDefault();event.returnValue='';}});
 }).catch(()=>{root.innerHTML='<h1>教材暫時無法載入</h1><p>請重新整理再試，未建立任何作答紀錄。</p>';});}
