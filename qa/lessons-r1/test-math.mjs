import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {load,tokens,render,mathFoundationPicture} from '../../pages/v2/math-quiz-preview/quiz-readings.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
globalThis.fetch=async url=>{
 assert.match(String(url),/math-quiz-preview\/readings\.json$/);
 return {ok:true,json:async()=>JSON.parse(read('../../pages/v2/math-quiz-preview/readings.json'))};
};
await load();
const F=vm.runInNewContext(read('../../pages/v2/math-quiz-preview/model.js')+'\nglobalThis.MathFoundations');
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),isValidElement:node=>!!node?.type,cloneElement:(node,props,children)=>({...node,props:{...node.props,...props,children}})};
const opts={mathFoundation:true};
const zh=t=>tokens(t,opts).map(o=>o.reading);
const han=t=>tokens(t,opts).filter(o=>/\p{Script=Han}/u.test(o.char));
const decode=url=>decodeURIComponent(url.split(',').slice(1).join(','));
function labels(svg){return [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/gu)].map(m=>m[1]);}
function plainUri(q){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(F.picture(q,['calendar','dates'].includes(q.kind)?0:q.steps));}

test('screenshot case reads all seven characters, renders changed SVG labels and leaves plain SVG untouched',()=>{
 const q=F.question('u109',0,()=>.36);q.picture=plainUri(q);
 assert.equal(q.ans,18);
 assert.deepEqual(zh(q.stem),['ㄨㄟˋ','ㄓˊ','ㄆㄢˊ','ㄅㄧㄠˇ','ㄕˋ','ㄉㄨㄛ','ㄕㄠˇ','']);
 assert.equal(han(q.explain).filter(n=>!n.reading).length,0);
 const expected=['百','十','個'];assert.deepEqual(labels(decode(q.picture)).slice(0,3),expected);
 const url=mathFoundationPicture(q,F),readings=decode(url);
 for(const value of expected){
  const label=readings.match(new RegExp(`<text[^>]*aria-label="${value}"[^>]*>(.*?)</text>`,'u'))?.[1];
  assert.match(label,/aria-hidden="true"/u);
 }
 assert.equal(mathFoundationPicture(q,F),url);
 assert.equal(q.picture,plainUri(q));assert.notEqual(url,q.picture);
 assert.equal(mathFoundationPicture({...q,unitId:'unreviewed'},F),q.picture);
 assert.deepEqual(zh('32 − 17'),Array.from({length:7},()=> ''));
});
test('reviewed fallback stays math-foundation-only; rich answers keep semantics and nonmath polyphones remain blank',()=>{
 assert.equal(tokens('值')[0].reading,'');
 for(const word of ['重慶','長安','行列'])assert.equal(tokens(word)[0].reading,'');
 assert.equal(tokens('重疊')[0].reading,'ㄔㄨㄥˊ');
 const handler=()=>true;
 const generic=render(React.createElement('button',{onClick:handler},'值'),React);
 const math=render(React.createElement('button',{onClick:handler},'值'),React,opts);
 assert.deepEqual(generic.props.children,[['值']]);
 assert.equal(math.props.children[0][0].type,'ruby');assert.equal(math.props.onClick,handler);
 const external=React.createElement('svg',{},'日');assert.equal(render(external,React,opts),external);
});
test('810 actual generated items have no missing Han readings and annotated pictures retain underlying geometry',()=>{
 let count=0;
 for(const u of F.units)for(let i=0;i<30;i++)for(const rng of [()=>0,()=>.42,()=>.9999]){
  const q=F.question(u.id,i,rng);q.picture=plainUri(q);
  const a=decode(q.picture),b=decode(mathFoundationPicture(q,F)); count++;
  for(const value of [u.title,q.stem,q.explain,q.hint,...q.opts,...labels(a)])assert.ok(han(value).every(n=>n.reading),u.id+' '+value);
  const noText=s=>s.replace(/<text[^>]*>.*?<\/text>/gu,'');
  assert.equal(noText(a),noText(b),u.id+' altered diagram geometry');
  assert.equal((b.match(/<text[^>]*\baria-label=/gu)||[]).length,labels(a).filter(a=>han(a).length).length);
 }
 assert.equal(count,810);
});
