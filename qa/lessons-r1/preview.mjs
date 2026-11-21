import './modules/english-original/english-zhuyin.js';
import {openEnglishOriginal} from './modules/english-original/launch.mjs';
import {createReadingState} from './english-controls.mjs';

const zhuyin=createReadingState();
const primary=document.querySelector('#english-original-open');
const toggle=document.querySelector('#outer-zhuyin');
const status=document.querySelector('#preview-status');
const controller=new AbortController();
let grade=1;
let opening=false;
let close=null;

window.LPEnglishZhuyin.bind(document.querySelector('.english-original-unit'),zhuyin);
function updateToggle(){toggle.setAttribute('aria-pressed',String(zhuyin.get()));toggle.setAttribute('aria-label',zhuyin.get()?'關閉注音':'開啟注音');}
zhuyin.subscribe(updateToggle);
updateToggle();
toggle.onclick=()=>zhuyin.toggle();
for(const button of document.querySelectorAll('[data-preview-grade]')){
  button.onclick=()=>{
    grade=Number(button.dataset.previewGrade);
    for(const other of document.querySelectorAll('[data-preview-grade]'))other.setAttribute('aria-pressed',String(other===button));
  };
}
primary.onclick=async()=>{
  if(opening||close||controller.signal.aborted)return;
  opening=true;
  primary.setAttribute('aria-busy','true');
  try{
    const activeGrade=grade;
    let closed=false;
    const dismiss=await openEnglishOriginal({
      learnerId:'isolated-lessons-qa',
      grade,
      isActive:()=>!controller.signal.aborted&&grade===activeGrade,
      zhuyin,
      onClose:()=>{closed=true;close=null;primary.removeAttribute('aria-busy');}
    });
    if(!closed)close=dismiss;
  }catch{
    status.textContent='課程載入失敗，請重試。';
    primary.removeAttribute('aria-busy');
  }finally{opening=false;}
};
window.addEventListener('pagehide',()=>{controller.abort();void close?.(true);},{once:true});
