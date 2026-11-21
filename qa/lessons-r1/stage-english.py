"""Stage the pinned English Original app for isolated acceptance without student data."""
import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODULE = Path('modules/english-original')
ASSETS = ('bootstrap.js','speech-r33.js','english-writer-lease-r29.js','english-progress-r29.js','english-map-r26.js')

def sub(s, old, new):
    if s.count(old) != 1:
        raise ValueError(f'Expected one occurrence of {old[:90]!r}, found {s.count(old)}')
    return s.replace(old,new,1)

def read_at(base, relative):
    return (base/relative).read_text()

def put(base, relative, content):
    target=base/relative
    if target.exists():
        raise ValueError(f'Will not overwrite {target}')
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(content)

ADD = """
function strip(scope){
 for(const node of scope.querySelectorAll('ruby.english-zhuyin')){
  const base=node.querySelector('.english-zhuyin-base');
  if(base)node.replaceWith(scope.ownerDocument.createTextNode(base.textContent));
 }
 scope.normalize();
}
function bind(scope,state){
 if(!scope||!state)return ()=>{};
 let stop=null,enabled=false;
 const sync=()=>{
  const next=state?.get()===true;
  if(enabled===next)return;
  enabled=next;
  if(enabled)stop=install(scope);
  else{stop?.();stop=null;strip(scope);}
 };
 const drop=state?.subscribe(sync);
 sync();
 return ()=>{drop?.();stop?.();if(enabled)strip(scope);};
}
"""

def zhuyin_script(s):
    return sub(s,'const api={tokens,annotate,install};',ADD+'const api={tokens,annotate,install,bind};')

PANEL_CSS = """
[hidden]{display:none!important}
.english-panel-header{display:flex;align-items:center;gap:.7rem;margin:0;width:100%;min-width:0;padding:.4rem .85rem;border-bottom:1px solid #56d7ff55;background:#101739;color:#eff9ff}
.english-panel-header>div{flex:1;min-width:0}
.english-panel-header p{margin:0;font-size:.7rem;font-weight:900;letter-spacing:.16em;color:#69e2ff}
.english-panel-header strong{font-size:1.125rem;line-height:1.2;overflow-wrap:anywhere}
.lp-panel-back,.quiz-zhuyin-toggle{box-sizing:border-box;display:inline-grid;place-items:center;flex:none;min-width:44px;min-height:44px;margin:0;padding:.24em .55em;border-radius:12px;border:1px solid #83b8d4;color:#fff;background:#1a3b63;font:700 16px/1.15 system-ui;cursor:pointer}
.lp-panel-back{border-radius:50%;background:#edf8ff;color:#0c4d73;font-size:22px}
.quiz-zhuyin-toggle[aria-pressed=true]{background:#2cb8e9;color:#06182a}
.lp-panel-back:focus-visible,.quiz-zhuyin-toggle:focus-visible{outline:3px solid #ffd86b;outline-offset:2px}
.english-zhuyin.english-zhuyin{line-height:1.65}
button:has(.english-zhuyin){line-height:1.65}
"""
INNER_CSS = """
#gradeTabs{display:flex;flex-wrap:wrap;gap:.35rem}
#gradeTabs button,.lesson-toolbar button{min-height:44px;padding:6px 11px;font-weight:700}
#navigation>section{margin:0;padding:12px}
#navigation>section>h2{margin:0 0 .45rem}
#content>h2{margin:.3rem 0;padding:.3rem 0}
#lessonList .subject-world-card{min-height:0}
#lessonList button.subject-battle-button{text-align:center}
#lessonList .subject-world-card-head{min-height:3rem}
#lessonList .subject-world-card-sub{font-size:.875rem}
.lesson-toolbar{display:flex;gap:.45rem;flex-wrap:wrap;margin:.4rem 0}
#voiceStatus:empty{display:none}
main{padding-top:.7rem}
@media(max-width:500px){main{padding:10px}.toolbar{padding:6px 0;gap:6px}}
"""

def child(s, preview=False):
    s=sub(s,'<main><h1>英文原創延伸</h1>','<main><div id="lesson-controls" class="lesson-toolbar" hidden><button id="return-lessons" type="button" aria-label="返回英文課程列表">← 課程列表</button><button id="stop" type="button">停止朗讀</button></div>')
    s=sub(s,'<button id="stop">停止朗讀</button>','')
    s=sub(s,'<div id="content"></div>','<div id="content" hidden></div>')
    s=sub(s,'let candidateDisposed=false,disposeZhuyin=null;','let candidateDisposed=false,disposeZhuyin=null;')
    s=sub(s,"let unit=DATA.units.find(u=>u.grade===window.LPEnglishCandidateHost.grade)||DATA.units[0],checked=new Set();","let unit=lessonForGrade(window.LPEnglishCandidateHost.grade)||DATA.units[0],checked=new Set();\nfunction lessonForGrade(g){const selection=window.LPEnglishCandidateHost.getSelection?.(g);return DATA.units.find(u=>u.grade===g&&u.id===selection)||DATA.units.find(u=>u.grade===g);}")
    s=sub(s,"function selectLesson(id){if(!hostActive())return;const found=DATA.units.find(u=>u.id===id);if(!found)return;unit=found;$('#grade').value=String(DATA.units.indexOf(unit));render();renderNavigation();}", """function chooseGrade(grade){
 const next=lessonForGrade(grade);if(!next||!hostActive())return;
 unit=next;$('#grade').value=String(DATA.units.indexOf(unit));showList();
}
function showList(){
 if(!hostActive())return;englishSpeech?.stop(true);lessonRenderGeneration++;
 $('#content').replaceChildren();$('#content').hidden=true;$('#lesson-controls').hidden=true;
 $('#navigation').hidden=false;$('.toolbar').hidden=false;renderNavigation();
}
function selectLesson(id){
 if(!hostActive())return;const found=DATA.units.find(u=>u.id===id);if(!found)return;
 unit=found;hostContract.rememberSelection?.(unit.grade,unit.id);
 $('#grade').value=String(DATA.units.indexOf(unit));stopMap();
 $('#content').hidden=false;$('#lesson-controls').hidden=false;
 $('#navigation').hidden=true;$('.toolbar').hidden=true;
 render();refreshProgress();$('#return-lessons').focus();
}""")
    old="const card=el('div','',list);card.className='card';el('h3',u.topic,card);el('button',u.order+' · '+u.title,card).onclick=()=>selectLesson(u.id);const status=el('p',progressLabel(u.id),card);"
    new="""const card=el('article','',list);card.className='card subject-world-card';const head=el('header','',card);head.className='subject-world-card-head';el('strong',u.order+' · '+u.title,head);el('small',u.topic,head).className='subject-world-card-sub';const bottom=el('div','',card);bottom.className='subject-world-card-bottom';const action=el('button','',bottom);action.className='subject-battle-button';action.setAttribute('aria-label','開啟 '+u.title);el('span','✦ 開始練習',action).className='subject-battle-face';action.onclick=()=>selectLesson(u.id);const status=el('p',progressLabel(u.id),bottom);"""
    new=new.replace("card.className='card subject-world-card';","card.className='card subject-world-card';card.dataset.lessonId=u.id;").replace("action.onclick=()=>selectLesson(u.id);","action.onclick=()=>selectLesson(u.id);if(hostContract.getSelection?.(u.grade)===u.id){action.setAttribute('aria-current','true');el('small','上次選擇',head).className='last-lesson';}")
    s=sub(s,old,new)
    s=sub(s,"list.className='grid'","list.className='subject-world-grid'")
    s=sub(s,"b.onclick=()=>selectLesson(DATA.units.find(u=>u.grade===g).id);","b.onclick=()=>chooseGrade(g);")
    s=sub(s,"$('#grade').onchange=e=>{unit=DATA.units[Number(e.target.value)];render();renderNavigation();};","$('#grade').onchange=e=>selectLesson(DATA.units[Number(e.target.value)].id);$('#return-lessons').onclick=()=>{showList();$('#classicView').focus();};")
    s=sub(s,"initializeNavigation();render();refreshProgress();disposeZhuyin=window.LPEnglishZhuyin?.install(document.querySelector('main'));","initializeNavigation();refreshProgress();disposeZhuyin=window.LPEnglishZhuyin?.bind(document.querySelector('main'),hostContract.zhuyin);")
    s=sub(s,'<link rel="stylesheet" href="english-zhuyin.css">','<link rel="stylesheet" href="english-zhuyin.css?v=lesson-controls-r1"><link rel="stylesheet" href="english-panel-r1.css">')
    s=s.replace('src="english-zhuyin.js"','src="english-zhuyin.js?v=lesson-controls-r1"')
    if not preview:return s
    s=sub(s,"let localStore;try{localStore=window.localStorage;if(!localStore)throw Error('unavailable');}catch(e){localStore={getItem(){throw e;},setItem(){throw e;}};}", """const transient=new Map();
const localStore={getItem:k=>transient.get(k)??null,setItem:(k,v)=>transient.set(k,v),removeItem:k=>transient.delete(k)};
const previewLocks={request:(_name,_options,callback)=>Promise.resolve().then(()=>callback({name:'isolated-memory'}))};""")
    s=sub(s,'locks:window.navigator?.locks','locks:previewLocks')
    s=s.replace('進度只存此瀏覽器、目前學習者；依目前學習者分開保存。','預覽作答僅在此視窗暫存；關閉不保存。').replace('主站提供範圍，尚無雲端同步。','不會讀寫正式學員資料。')
    s=s.replace('../../images/','../../../images/').replace('"reviewed-story-cards/','"../../../modules/english-original/reviewed-story-cards/').replace("'./vendor-r26/three.module.js'","'../../../modules/english-original/vendor-r26/three.module.js'")
    s=s.replace('<script type="application/x-lp-deferred" data-auth-script="text/javascript"', '<script').replace('src="english-map-r26.js"></script><script>', 'src="english-map-r26.js"></script><script src="lesson-runtime.js">')
    s=sub(s,'<p id="page-auth-status" role="status">正在確認登入…</p>','')
    s=sub(s,'<div data-auth-content hidden inert>','<div>')
    start='<script src="lesson-runtime.js">'
    prefix, rest=s.split(start,1)
    inner, after=rest.split('</script>',1)
    after=re.sub(r'<script type="module" data-page-access[^>]+></script>','',after)
    csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\';script-src \'self\';style-src \'self\' \'unsafe-inline\';img-src \'self\' data: blob:;connect-src \'self\';worker-src \'none\';form-action \'none\';base-uri \'none\'">'
    return prefix.replace('<meta charset="utf-8">','<meta charset="utf-8">'+csp)+start+'</script>'+after,inner

def launcher(s):
    s=sub(s,"import './english-zhuyin.js';","import './english-zhuyin.js?v=lesson-controls-r1';")
    s=sub(s,'isActive=()=>false,onClose=()=>{}','isActive=()=>false,onClose=()=>{},zhuyin=null')
    s=sub(s,'let session=null,openingGeneration=0;','let session=null,openingGeneration=0,lastLearner=null;\nconst selectedByGrade=new Map();')
    a=' const bar=document.createElement'
    b="\n frame.title="
    before,tail=s.split(a,1);_,after=tail.split(b,1)
    s=before+""" const bar=document.createElement('header'),copy=document.createElement('div'),tag=document.createElement('p'),title=document.createElement('strong'),button=document.createElement('button'),readingButton=document.createElement('button');
 bar.className='english-panel-header';tag.textContent='ENGLISH PLANET';title.textContent='英文星球・原創延伸';copy.append(tag,title);
 button.className='lp-panel-back';button.textContent='←';button.setAttribute('aria-label','返回英文星球');button.title='返回英文星球';button.type='button';
 readingButton.className='quiz-control quiz-zhuyin-toggle';readingButton.type='button';readingButton.textContent='ㄅ';
 const syncReading=()=>{const enabled=zhuyin?.get()===true;readingButton.setAttribute('aria-pressed',String(enabled));readingButton.setAttribute('aria-label',enabled?'關閉注音':'開啟注音');};
 const unsubscribe=zhuyin?.subscribe(syncReading);readingButton.onclick=()=>zhuyin?.toggle();syncReading();
 const panelStyle=document.createElement('link');panelStyle.rel='stylesheet';panelStyle.href=new URL('./english-panel-r1.css',import.meta.url).href;
 bar.append(button,copy,readingButton,zhuyinStyle,panelStyle);
 const disposeReading=window.LPEnglishZhuyin?.bind(bar,zhuyin);
"""+b+after
    s=sub(s,'./index.html?v=20261117-unit-ui','./index.html?v=lesson-controls-r1')
    s=sub(s,' const controller=new AbortController()',' if(lastLearner!==learnerId){lastLearner=learnerId;selectedByGrade.clear();}\n const controller=new AbortController()')
    s=sub(s,'return{learnerId,grade,isActive:active,signal:controller.signal}',"""return{learnerId,grade,isActive:active,signal:controller.signal,zhuyin,
 getSelection:g=>active()&&lastLearner===learnerId?selectedByGrade.get(g):undefined,
 rememberSelection:(g,id)=>{if(active()&&lastLearner===learnerId&&Number.isInteger(g)&&g>=1&&g<=6&&typeof id==='string'&&new RegExp('^en-g'+g+'-[0-9]{2}$').test(id))selectedByGrade.set(g,id);}
 }""")
    s=sub(s,'closed=true;registry.delete(token);','closed=true;disposeReading?.();unsubscribe?.();registry.delete(token);')
    return s

def css_from_host(source):
    lines=[]
    for line in source.splitlines():
        s=line.strip()
        if re.match(r'^\.subject-(?:world-grid|world-explore-icon|world-card(?:\b|::|:|-head|-sub|-bottom)|battle-button|battle-face)',s) and not s.startswith('.subject-world-card-extra') and '{' in s and s.endswith('}'):
            lines.append(s)
    if len(lines)<12:
        raise ValueError('standard host rule extraction empty')
    return ':root{--subject-world-accent:#51d5fa}\n'+'\n'.join(lines)+'\n'

def host_card(preview=False):
    if preview:
        a,b,c,d='英文原創延伸','課文・單字・拼寫・口說','依年級選課。本次作答暫存，關閉不保留。非出版社同步教材。','進入子單元'
        action='id="english-original-open"'
    else:
        a,b,c,d=('{{ englishOriginalTitle }}','{{ englishOriginalSubtitle }}','{{ englishOriginalDescription }}','{{ englishOriginalStart }}')
        action='onClick="{{ openEnglishOriginal }}"'
    return f'''<article class="subject-world-card english-original-unit" style="display:flex;flex-direction:column;gap:12px">
 <div class="subject-world-card-head" style="display:flex;align-items:center;gap:12px">
  <span class="subject-world-explore-icon" aria-hidden="true">Aa</span><div style="min-width:0">
   <strong style="display:block;font-size:17px;font-weight:900">{a}</strong><span class="subject-world-card-sub" style="font-size:12px;font-weight:800">{b}</span>
  </div>
 </div>
 <p class="subject-world-card-sub">{c}</p>
 <div class="subject-world-card-bottom"><button type="button" {action} class="subject-battle-button"><span class="subject-battle-face"><span aria-hidden="true">✦</span> {d}</span></button></div>
</article>'''

def host(s):
    a='<sc-if value="{{ showEnglishOriginal }}" hint-placeholder-val="{{ false }}">'
    trail='        </sc-if>\n          <sc-for list="{{ units }}"'
    left,tail=s.split(a,1);_,right=tail.split(trail,1)
    s=left+a+'\n'+host_card()+'\n'+trail+right
    marker='          </sc-for>\n        </div>\n        </details>\n        <sc-if value="{{ showMathKnowledge }}"'
    toggle='<sc-if value="{{ showEnglishOriginal }}" hint-placeholder-val="{{ false }}"><button type="button" class="quiz-control quiz-zhuyin-toggle" onClick="{{ toggleQuizZhuyin }}" aria-pressed="{{ quizZhuyinEnabled }}" aria-label="{{ quizZhuyinAria }}" title="{{ quizZhuyinTitle }}" disabled="{{ quizZhuyinLoading }}"><b>ㄅ</b></button></sc-if>'
    s=sub(s,marker,marker.replace('          </sc-for>\n','          </sc-for>\n          '+toggle+'\n',1))
    s=re.sub(r'^\s*\.english-original-unit[^\n]*\n','\n',s,flags=re.M)
    s=sub(s,'  componentDidUpdate(prevProps, prevState) {','  componentDidUpdate(prevProps, prevState) {\n    this.englishOriginalReadingSync?.();')
    s=sub(s,'./modules/english-original/launch.mjs?v=20261117-unit-ui','./modules/english-original/launch.mjs?v=lesson-controls-r1')
    s=sub(s,'{learnerId,grade,isActive,onClose:()=>{dismissed=true;',
          '{learnerId,grade,isActive,zhuyin:{get:()=>this.state.quizZhuyin,subscribe:fn=>{const old=this.englishOriginalReadingSync;const next=()=>{old?.();fn();};this.englishOriginalReadingSync=next;return()=>{if(this.englishOriginalReadingSync===next)this.englishOriginalReadingSync=old;};},toggle:()=>this.toggleQuizZhuyin()},onClose:()=>{dismissed=true;')
    s=sub(s,'      openEnglishOriginal: ()=>this.openEnglishOriginal(),','''      openEnglishOriginal: ()=>this.openEnglishOriginal(),
      englishOriginalTitle: this.quizReading("英文原創延伸"),
      englishOriginalSubtitle: this.quizReading("課文・單字・拼寫・口說"),
      englishOriginalDescription: this.quizReading("依年級選課，本機保存進度；非出版社同步教材。"),
      englishOriginalStart: this.quizReading("進入子單元"),''')
    return s

def preview_page():
    choices=''.join(f'<button type="button" data-preview-grade="{n}" aria-pressed="{str(n==1).lower()}">{g}年級</button>' for n,g in enumerate('一二三四五六',1))
    return '''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data: blob:;frame-src 'self';connect-src 'self';worker-src 'none';form-action 'none';base-uri 'none'">
<title>英文星球｜原創延伸驗收</title><link rel="stylesheet" href="modules/english-original/english-panel-r1.css"><link rel="stylesheet" href="modules/english-original/english-zhuyin.css">
<style>body{margin:0;background:#101936 url('../images/home/planets/english-planet-v1.jpg') center/cover fixed;color:#eff9ff;font:16px/1.55 system-ui}main{margin:0 auto;max-width:1120px;padding:12px;box-sizing:border-box}main>.english-panel-header{box-sizing:border-box}nav{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}nav>button{background:#192d54;border:1px solid #829bb9;border-radius:12px;color:#fff;min-height:44px;padding:4px 11px;font:700 15px system-ui}nav>button[aria-pressed=true]{background:#167899}#preview-notice{font-size:13px;color:#eef7ff;text-shadow:0 1px #000}</style>
<main><header class="english-panel-header"><div><p>ENGLISH PLANET</p><strong>英文星球</strong></div><button id="outer-zhuyin" class="quiz-control quiz-zhuyin-toggle" type="button" aria-pressed="false" aria-label="開啟注音">ㄅ</button></header>
<p id="preview-notice">驗收預覽：使用原創課程資料。不登入、不保存學員進度。</p>
<nav aria-label="選擇年級">'''+choices+'''</nav><div class="subject-world-grid">'''+host_card(True)+'''</div><p id="preview-status" role="status"></p></main><script type="module" src="preview.mjs"></script></html>'''

def render(src, out, preview):
    hp=read_at(src,'index.html')
    css=css_from_host(hp)+PANEL_CSS+INNER_CSS
    put(out,MODULE/'english-panel-r1.css',css)
    put(out,MODULE/'english-zhuyin.js',zhuyin_script(read_at(src,MODULE/'english-zhuyin.js')))
    put(out,MODULE/'english-zhuyin.css',read_at(src,MODULE/'english-zhuyin.css'))
    put(out,MODULE/'launch.mjs',launcher(read_at(src,MODULE/'launch.mjs')))
    page=child(read_at(src,MODULE/'index.html'),preview)
    if preview:
        doc, runtime=page
        put(out,MODULE/'index.html',doc)
        put(out,MODULE/'lesson-runtime.js',runtime)
        put(out,'index.html',preview_page())
        for f in ('preview.mjs','english-controls.mjs'):
            put(out,f,read_at(HERE,f))
        for f in ASSETS:
            put(out,MODULE/f,read_at(src,MODULE/f))
        put(out,'modules/science-curriculum/overlay-history.mjs',read_at(src,'modules/science-curriculum/overlay-history.mjs'))
    else:
        put(out,MODULE/'index.html',page)
        put(out,'index.html',host(hp))

if __name__=='__main__':
    if len(sys.argv)==4 and sys.argv[1]=='--candidate':
        render(Path(sys.argv[2]),Path(sys.argv[3]),False)
    elif len(sys.argv)==2:
        source=Path(sys.argv[1])/'v2'
        render(source,source/'english-original-preview',True)
    else:
        raise SystemExit('usage: stage-english.py pages OR stage-english.py --candidate source output')
