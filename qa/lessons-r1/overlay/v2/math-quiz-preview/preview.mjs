import {load,render,mathFoundationPicture} from './quiz-readings.mjs';

const F=window.MathFoundations,q=F.question('u109',0,()=>.36);
q.picture='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(F.picture(q));
const $=id=>document.getElementById(id);
// Host-compatible rendering contract. No production app, login, progress, or external traffic.
const element=Symbol('element');
const React={createElement:(type,props,...children)=>({element,type,props:{...props,children}}),isValidElement:node=>node?.element===element,cloneElement:(node,props,children)=>({...node,props:{...node.props,...props,children}})};
function dom(content){
 if(Array.isArray(content)){const f=document.createDocumentFragment();content.forEach(item=>f.append(dom(item)));return f;}
 if(React.isValidElement(content)){
  const e=document.createElement(content.type);
  for(const[k,v] of Object.entries(content.props)) if(k==='className')e.className=v;else if(k.startsWith('aria-'))e.setAttribute(k,v);
  e.append(dom(content.props.children));return e;
 }
 return document.createTextNode(content??'');
}
let enabled=false,choice=null,locked=false;
const show=(e,value)=>e.replaceChildren(dom(enabled?render(String(value),React,{mathFoundation:true}):String(value)));
$('title').textContent=q.title;
$('figure').alt=q.stem;
q.opts.forEach((value,i)=>{
 const b=document.createElement('button');b.type='button';b.dataset.answer=String(i);
 b.addEventListener('click',()=>{if(!locked){choice=i;paint();}});$('options').append(b);
});
$('submit').addEventListener('click',()=>{if(choice!==null&&!locked){locked=true;paint();}});
$('toggle').addEventListener('click',async()=>{
 if(enabled){enabled=false;paint();return;}
 $('toggle').disabled=true;
 try{await load();enabled=true;}
 catch{$('toggle').title='注音載入失敗，請再試一次';}
 finally{$('toggle').disabled=false;paint();}
});
function paint(){
 $('toggle').setAttribute('aria-pressed',String(enabled));
 $('toggle').setAttribute('aria-label',enabled?'關閉注音顯示':'開啟注音顯示');
 show($('stem'),q.stem);
 const img=enabled?mathFoundationPicture(q,F):q.picture;
 if($('figure').getAttribute('src')!==img)$('figure').src=img;
 Array.from($('options').children).forEach((b,i)=>{
  show(b,q.opts[i]);b.disabled=locked;b.setAttribute('aria-pressed',String(i===choice));
  b.toggleAttribute('data-right',locked&&q.opts[i]===q.ans);
 });
 $('submit').disabled=locked||choice===null;
 $('submit').textContent=locked?'已提交':choice===null?'先選答案':'提交答案';
 show($('result'),locked?`你的答案：${q.opts[choice]}　正確答案：${q.ans}`:'選擇答案並按「提交」，這裡會顯示解題方法。');
 show($('explain'),locked?q.explain:'');
}
paint();
