const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chooseVoice,create}=require('./speech-r34.js');
const zh={lang:'zh-TW',default:true,localService:true};
const remote={lang:'en-US',localService:false};
const us={lang:'en_US',localService:true};
const gb={lang:'en-GB',localService:true,default:true};
test('prioritize installed US English, never use remote or non-English',()=>{
 assert.equal(chooseVoice([zh,gb,remote,us]),us);
 assert.equal(chooseVoice([zh,remote,gb]),gb);
 assert.equal(chooseVoice([zh,remote]),null);
});
test('language, exact source, stop/replace/error, disabled host and absent English',()=>{
 let pending,loaded=[zh,remote],complete=0;
 const events=[];
 const synth={getVoices:()=>loaded,speak:u=>pending=u,cancel(){pending=null;}};
 class Utterance{constructor(text){this.text=text;}}
 const speech=create({synth,Utterance,onStatus:s=>events.push(s)});
 assert.equal(speech.speak('book'),false);
 assert.equal(pending,undefined);
 loaded=[zh,remote,gb,us];
 assert.equal(speech.speak('book 中文'),false);
 assert.ok(speech.speak('book',()=>complete++));
 assert.equal(pending.voice,us);
 assert.equal(pending.lang,'en-US');
 assert.equal(pending.text,'book');
 const stale=pending.onend;
 pending.onstart();
 assert.ok(speech.speak('bag',()=>complete++));
 stale();assert.equal(complete,0);
 pending.onstart();pending.onend();assert.equal(complete,1);
 assert.ok(speech.speak('book',()=>complete++));
 pending.onend();assert.equal(complete,1);
 assert.ok(speech.speak('book',()=>complete++));
 pending.onstart();pending.onerror({error:'voice-unavailable'});
 assert.equal(complete,1);
 assert.match(events.at(-1),/沒有播完/);
 speech.dispose();assert.equal(speech.speak('book'),false);
});
test('all 48 lessons use English-only source and correct listening keys',()=>{
 const src=fs.readFileSync(path.resolve(process.argv[2]||'pages','v2/english-original-audio-r2/modules/english-original/lesson-runtime.js'),'utf8');
 const units=JSON.parse(src.match(/^const DATA=(.*);$/m)[1]).units;
 assert.equal(units.length,48);
 let count=0, clips=0;
 for(const u of units){
  const text=[
   ...u.vocabulary.map(w=>w.word),
   ...(u.themeSupplement||[]).flatMap(w=>[w.word,w.example]),
   ...(u.coreSupplement||[]).map(w=>w.originalExample),
   ...(u.skillExtension.phonics?.examples||[]),
   ...u.skillExtension.spellingTargets.map(w=>w.word),
   u.skillExtension.speaking.model,u.passage.join(' '),...u.sentences
  ];
  const listening=u.questions.filter(q=>q.spokenPrompt);
  assert.equal(listening.length,2,u.id);
  for(const q of listening){assert.equal(q.options[q.answer],q.spokenPrompt,u.id);text.push(q.spokenPrompt);count++;}
  for(const s of text){assert.equal(typeof s,'string',u.id);assert.ok(/[A-Za-z]/.test(s)&&!/[\p{Script=Han}\u3100-\u312F\u31A0-\u31BF]/u.test(s),u.id+': '+s);clips++;}
 }
 assert.equal(count,96);
 assert.ok(clips>1000);
});
