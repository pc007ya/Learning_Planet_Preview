// PREVIEW ONLY: local DEMO learning access, never a Firebase identity.
const root = new URL('../', import.meta.url);
const path = decodeURIComponent(location.pathname.slice(root.pathname.length));
const script = document.querySelector('script[data-page-access]');
const content = document.querySelector('[data-auth-content]');
const status = document.getElementById('page-auth-status');
const allowed = new Set(__LEARNING_PAGE_ALLOWLIST__);
let started;
function lock() { if(content) { content.hidden=true;content.inert=true; } }
async function update() {
  lock();
  if(!location.pathname.startsWith(root.pathname) || !allowed.has(path)) {
    if(status) {status.hidden=false;status.textContent='預覽站不開放教師與管理功能。';} return;
  }
  if(!window.LP_PREVIEW_READY || localStorage.getItem('preview-demo-active') !== 'yes') { location.replace(root.href); return; }
  if(content) {content.hidden=false;content.inert=false;content.dataset.authUid='preview-demo-local';}
  try {
    if(!started) started=script?.dataset.entry ? import(new URL(script.dataset.entry,document.baseURI).href) : Promise.resolve();
    await started;
    if(!window.LP_PREVIEW_READY || localStorage.getItem('preview-demo-active') !== 'yes') {lock();location.replace(root.href);return;}
    if(status) status.hidden=true;
  } catch {
    lock();if(status){status.hidden=false;status.textContent='預覽教材載入失敗，請返回入口重試。';}
  }
}
window.addEventListener('pagehide',lock);
window.addEventListener('pageshow',event=>{if(event.persisted) update();});
window.addEventListener('storage',event=>{if(event.key === 'learning-planet-preview.v1:preview-demo-active') update();});
await update();
