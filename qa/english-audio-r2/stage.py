import hashlib,json,re,sys
from pathlib import Path
from shutil import copytree,copyfile

here=Path(__file__).resolve().parent
preview=Path(sys.argv[1])/'v2'
source=preview/'english-original-preview'
out=preview/'english-original-audio-r2'
mod='modules/english-original'
copytree(source,out)
runtime=out/mod/'lesson-runtime.js'
s=runtime.read_text()
def sub(a,b):
 global s
 if s.count(a)!=1:raise ValueError(f'{a[:80]}: {s.count(a)} occurrences')
 s=s.replace(a,b,1)
sub('function say(text){return englishSpeech.speak(text);}', '''let activeSpeakerStatus=null;
function say(text,onComplete,status){if(activeSpeakerStatus)activeSpeakerStatus.textContent='';activeSpeakerStatus=status;return englishSpeech.speak(text,onComplete);}
const svgNS='http://www.w3.org/2000/svg';
function speaker(parent,label,text,onComplete){
 const button=el('button','',parent);
 button.type='button';button.className='english-speaker';button.setAttribute('aria-label',label);
 const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M3 9v6h4l5 4V5L7 9H3Zm12 0a4.3 4.3 0 0 1 0 6m2.5-8.5a8 8 0 0 1 0 11');
 path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
 svg.append(path);button.append(svg);
 const status=el('span','',parent);status.className='english-speaker-status';status.setAttribute('role','status');
 button.onclick=()=>say(text,onComplete,status);
 return button;
}''')
sub("el('h2','閱讀與句型檢查',quiz);","el('h2','閱讀與句型檢查',quiz);el('p','聽力題：按喇叭，聽完才選答案。',quiz);")
sub("const status=$('#voiceStatus');if(status)status.textContent=text;", "const status=activeSpeakerStatus?.isConnected?activeSpeakerStatus:$('#voiceStatus');if(status)status.textContent=text;")
for a,b in [
 ("el('button','聽新詞',box).onclick=()=>say(w.word);","speaker(box,'聽單字：'+w.word,w.word);"),
 ("el('button','聽例句',box).onclick=()=>say(w.example);","speaker(box,'聽例句',w.example);"),
 ("el('button','聽完整例句',box).onclick=()=>say(w.originalExample);","speaker(box,'聽完整例句',w.originalExample);"),
 ("phon.examples.forEach(w=>el('button','聽例字：'+w,sec).onclick=()=>say(w));","const examples=el('ul','',sec);examples.className='english-phonics-examples';phon.examples.forEach(w=>{const row=el('li','',examples);el('span',w,row);speaker(row,'聽例字：'+w,w);});"),
 ("el('button','聽完整單字',box).onclick=()=>say(w.word);","speaker(box,'聽拼寫單字',w.word);"),
 ("el('button','聽示範句',sec).onclick=()=>say(s.model);","speaker(sec,'聽口說示範句',s.model);"),
 ("el('button','聽單字',c).onclick=()=>say(v.word);","speaker(c,'聽單字：'+v.word,v.word);"),
 ("el('button','朗讀整篇',read).onclick=()=>say(unit.passage.join(' '));","speaker(read,'朗讀整篇短文',unit.passage.join(' '));"),
 ("el('button','重聽',p).onclick=()=>say(s);","speaker(p,'朗讀例句',s);"),
 ("if(q.spokenPrompt)el('button','播放題目單字',c).onclick=()=>say(q.spokenPrompt);","const answers=[];let heard=!q.spokenPrompt;if(q.spokenPrompt)speaker(c,'播放第 '+(i+1)+' 題',q.spokenPrompt,()=>{if(renderToken!==lessonRenderGeneration||checked.has(i))return;heard=true;for(const button of answers)button.disabled=false;});"),
 ("b.disabled=Number.isInteger(saved);b.onclick=()=>{if(renderToken!==lessonRenderGeneration||checked.has(i))return;","answers.push(b);b.disabled=Number.isInteger(saved)||!heard;b.onclick=()=>{if(renderToken!==lessonRenderGeneration||checked.has(i)||!heard)return;"),
 ("c.querySelectorAll('button').forEach(n=>n.disabled=true);","answers.forEach(n=>n.disabled=true);"),
]:
 sub(a,b)
runtime.write_text(s)
p=out/mod/'index.html'
doc=p.read_text().replace('src="speech-r33.js"','src="speech-r34.js"').replace('>停止朗讀</button>',' aria-label="停止朗讀" class="english-speaker english-speaker-stop"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></button>')
p.write_text(doc)
(out/'index.html').write_text((out/'index.html').read_text().replace('驗收預覽：使用原創課程資料。不登入、不保存學員進度。','英文朗讀驗收版：喇叭只播放裝置本機的英文語音；不登入、不保存學員進度。'))
(out/mod/'speech-r33.js').unlink()
copyfile(here/'speech-r34.js',out/mod/'speech-r34.js')
with (out/mod/'english-panel-r1.css').open('a') as f:
 f.write('''
.english-speaker.english-speaker{box-sizing:border-box;min-width:44px;min-height:44px;display:inline-grid;place-items:center;vertical-align:middle;padding:8px;border:1px solid #91adc6;border-radius:12px;color:#effbff;background:#1a3b63;cursor:pointer}
.english-speaker svg{width:24px;height:24px;display:block;pointer-events:none}
.english-speaker:focus-visible{outline:3px solid #ffd86b;outline-offset:2px}
.english-speaker-status{display:block;font-size:.875rem;color:#e9f6ff}
.english-speaker-status:empty{display:none}
.english-phonics-examples{list-style:none;display:flex;gap:.5rem;flex-wrap:wrap;padding:0}
.english-phonics-examples li{display:flex;align-items:center;gap:.3rem;padding-left:.35rem}
''')
files={p.relative_to(preview.parent).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file()}
(out/'release-manifest.json').write_text(json.dumps(files,sort_keys=True)+'\n')
total=sum(p.stat().st_size for p in preview.parent.rglob('*') if p.is_file())
assert total<1_000_000_000,total
print(f'English audio R2: {len(files)} files verified for publication; total staged {total} bytes')
