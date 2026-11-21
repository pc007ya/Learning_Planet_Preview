// Extracted layout contract from Learning Planet index.html: quiz-master-shell,
// quiz-progress, quiz-timer-circle, quiz-card, answer-slot and quiz-feedback.
// Grade 6 supplies presentation data; it owns reading, deadlines and scoring.
const esc=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
export function renderLanguageQuiz({title,count,index,seconds,feedback,prompt,options,answer,passage}){
 const label=index+1, pct=100*label/count;
 const remaining=feedback?0:seconds;
 return `<div class="language-quiz-focus"><div class="quiz-master-shell" data-screen-label="練習題">
 <div class="quiz-progress">
 <button type="button" class="quiz-back-button" data-action="home" aria-label="返回單元列表">←</button>
 <div class="quiz-progress-copy"><div><span>${esc(title)}</span><span>第 ${label} / ${count} 題</span></div>
 <div class="quiz-progress-track" role="progressbar" aria-label="答題進度" aria-valuemin="0" aria-valuemax="${count}" aria-valuenow="${label}"><div style="width:${pct}%"></div></div></div>
 <div class="quiz-timer-tools"><div class="quiz-timer-circle timer" ${feedback?'aria-label="計時結束"':'role="timer" aria-label="剩餘 '+remaining+' 秒"'} data-urgent="${!feedback&&remaining<=5}"><span class="quiz-timer-value">${feedback?'—':remaining}</span><small>${feedback?'結束':'秒'}</small></div></div>
 </div>
 <section class="quiz-card" aria-label="題目">
 <h2 class="quiz-heading">${esc(prompt)}</h2>${passage}
 <div class="quiz-options answer-slot-grid">${options.map((opt,i)=>{
  const state=!feedback?'open':opt===answer?'correct':opt===feedback.answer?'wrong':'neutral';
  return `<button type="button" class="answer-slot" data-answer="${i}" data-slot-state="${state}" ${feedback?'disabled':''}><span class="answer-slot-content">${esc(opt)}</span>${state==='correct'?'<span aria-label="正確答案">✓</span>':state==='wrong'?'<span aria-label="作答錯誤">×</span>':''}</button>`;
 }).join('')}</div>
 ${feedback?`<div class="quiz-feedback" role="status" data-correct="${feedback.correct}"><strong>本題分析 · ${feedback.timedOut?'時間到':feedback.correct?'答對了':'再看看短文'}</strong><p>你的答案：${esc(feedback.answer??'未作答')}　正解：${esc(answer)}</p><p>${esc(feedback.explanation)}</p><button type="button" data-action="next">${label===count?'查看本回結果':'下一題'}</button></div>`:''}
 </section></div></div>`;
}
