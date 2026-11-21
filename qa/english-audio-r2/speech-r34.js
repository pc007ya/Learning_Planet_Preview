(function(root){'use strict';
function chooseVoice(voices){
 const normalized=v=>String(v?.lang||'').replace(/_/g,'-').toLowerCase();
 return [...(voices||[])].filter(v=>v?.localService===true&&/^en(?:-|$)/.test(normalized(v)))
  .sort((a,b)=>(normalized(b)==='en-us')-(normalized(a)==='en-us')||Number(!!b.default)-Number(!!a.default))[0]||null;
}
function create({synth,Utterance,isActive=()=>true,onStatus=()=>{}}={}){
 let generation=0,closed=false,current=null,timer=null;
 const active=()=>{try{return !closed&&isActive()===true;}catch(_){return false;}};
 const status=(text,g)=>{if(g===generation&&active())onStatus(text);};
 const clear=()=>{clearTimeout(timer);timer=null;};
 function stop(inform=false){if(closed)return;generation++;clear();if(current){current.onstart=current.onend=current.onerror=null;current=null;try{synth?.cancel();}catch(_){}}if(inform)status('已停止朗讀。',generation);}
 function speak(text,onComplete){
  if(!active()||typeof text!=='string'||!text.trim()||!/[A-Za-z]/.test(text)||/[\p{Script=Han}\u3100-\u312F\u31A0-\u31BF]/u.test(text))return false;
  stop();const g=generation;
  if(typeof synth?.speak!=='function'||typeof Utterance!=='function'){status('這個瀏覽器無法播放英文朗讀。',g);return false;}
  try{
   const voice=chooseVoice(synth.getVoices?.());
   if(!voice){status('找不到裝置的英文語音。請在裝置設定啟用英文語音後，再按喇叭。',g);return false;}
   const utterance=new Utterance(text);
   utterance.voice=voice;utterance.lang=voice.lang.replace(/_/g,'-');utterance.rate=.8;
   current=utterance;
   const valid=()=>g===generation&&current===utterance&&active();
   let started=false;
   const failed=()=>{if(!valid())return;stop();status('英文語音沒有播完，請再按喇叭重試。',generation);};
   utterance.onstart=()=>{if(!valid())return;started=true;clear();timer=setTimeout(failed,Math.max(15000,text.length*180));status('朗讀中。',g);};
   utterance.onend=()=>{if(!valid())return;if(!started){failed();return;}clear();current=null;status('朗讀完成。',g);onComplete?.();};
   utterance.onerror=failed;
   timer=setTimeout(failed,5000);
   status('正在準備英文朗讀。',g);synth.speak(utterance);return true;
  }catch(_){stop();status('英文語音無法播放，請再按喇叭重試。',generation);return false;}
 }
 return{speak,stop,dispose(){if(closed)return;stop();closed=true;}};
}
const api={create,chooseVoice};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LPEnglishSpeech=api;
})(typeof globalThis!=='undefined'?globalThis:this);
