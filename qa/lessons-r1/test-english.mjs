import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot=path.resolve(process.env.PREVIEW_PAGES||'pages');
const preview=path.join(repoRoot,'v2','english-original-preview');
const main=(p)=>fs.readFileSync(path.join(preview,p),'utf8');
const mod=(p)=>main('modules/english-original/'+p);
const shell=main('index.html'), launcher=mod('launch.mjs'), lesson=mod('index.html'), runtime=mod('lesson-runtime.js');
test('immutable source is shared with preview and student data remains isolated',()=>{
 for(const page of [shell,lesson]){
  assert.match(page,/default-src 'none';script-src 'self';/);
  assert.doesNotMatch(page,/auth-v2|firebase|firestore|https?:/i);
 }
 assert.match(shell,/本次作答暫存，關閉不保留/);
 assert.doesNotMatch(runtime,/localStorage|sessionStorage|firebase|firestore/);
 assert.match(runtime,/const transient=new Map/);
 assert.doesNotMatch(runtime,/https?:\/\//);
 assert.match(launcher,/return\{learnerId,grade,isActive:active,signal:controller.signal,zhuyin,/);
 assert.match(launcher,/lastLearner!==learnerId.*selectedByGrade.clear/);
 assert.match(launcher,/getSelection:g=>active\(\)&&lastLearner===learnerId/);
 assert.match(mod('bootstrap.js'),/parent\.location\.origin===window\.location\.origin/);
 assert.match(launcher,/source!==frame.contentWindow/);
});
test('shared control gates actual annotation and sections',()=>{
 assert.match(shell,/class="subject-world-card english-original-unit"/);
 assert.match(shell,/id="outer-zhuyin"[^>]*aria-pressed="false"/);
 assert.doesNotMatch(shell,/<ruby\b/);
 assert.match(launcher,/lp-panel-back/);
 assert.match(launcher,/quiz-zhuyin-toggle/);
 assert.match(launcher,/unsubscribe\?\.\(\)/);
 assert.match(launcher,/previousFocus\?\.isConnected/);
 assert.match(launcher,/waitForOverlayHistory/);
 assert.match(runtime,/LPEnglishZhuyin\?\.bind\(document.querySelector\('main'\),hostContract.zhuyin\)/);
 assert.match(mod('english-zhuyin.js'),/else\{stop\?\.\(\);stop=null;strip\(scope\);}/);
 assert.match(runtime,/function chooseGrade/);
 assert.match(runtime,/function showList/);
 assert.match(runtime,/lessonRenderGeneration\+\+/);
 assert.match(runtime,/progressStore.answer\(renderedUnit.id,i,j\)/);
 assert.match(runtime,/englishSpeech\.speak/);
 const dataLine=runtime.split('\n').find(l=>l.startsWith('const DATA='));
 const data=JSON.parse(dataLine.slice(11,-1));
 const original=fs.readFileSync(path.join(repoRoot,'v2','modules','english-original','index.html'),'utf8');
 const fromSource=original.split('\n').find(l=>l.startsWith('const DATA='));
 assert.equal(dataLine.replaceAll('"../../../modules/english-original/reviewed-story-cards/','"reviewed-story-cards/'),fromSource);
 assert.equal(data.units.length,48);
 for(let grade=1;grade<7;grade++)assert.equal(data.units.filter(u=>u.grade===grade).length,8);
 assert.ok(data.units.every(u=>u.questions.length===10&&u.skillExtension));
 for(const source of [runtime,mod('english-zhuyin.js'),mod('bootstrap.js')])new vm.Script(source);
});
