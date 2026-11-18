// PREVIEW ONLY: local DEMO learning access, never a Firebase identity.
const root = new URL('../', import.meta.url);
const path = decodeURIComponent(location.pathname.slice(root.pathname.length));
const script = document.querySelector('script[data-page-access]');
const content = document.querySelector('[data-auth-content]');
const status = document.getElementById('page-auth-status');
const allowed = new Set(["amusement-park-storybook.html", "bear-storybook.html", "bears-storybook.html", "birthday-storybook.html", "bridge-construction-storybook.html", "chinese-115-midgrade-catalog.html", "chinese-grade6.html", "chinese-practice.html", "chinese-zhuyin-supplement.html", "cloud-storybook.html", "dragon-storybook.html", "earth-orbit-v01.html", "elf-storybook.html", "english-storybook.html", "experiments/3d/earth-moon/classic.html", "experiments/3d/earth-moon/index.html", "experiments/3d/earth-moon/tides/classic.html", "experiments/3d/earth-moon/tides/index.html", "experiments/3d/force-motion/index.html", "experiments/3d/index.html", "experiments/3d/magnet/index.html", "experiments/3d/ocean-buoyancy/index.html", "experiments/3d/plants/index.html", "experiments/3d/weather/index.html", "fairy-storybook.html", "fox-storybook.html", "genie-storybook.html", "giant-storybook.html", "gifted-learning-path.html", "knight-storybook.html", "little-robot-storybook.html", "lost-lighthouse-storybook.html", "magic-ball-storybook.html", "magic-potion-storybook.html", "market-storybook.html", "math-capacity.html", "math-concepts.html", "math-division.html", "math-foundations.html", "math-fractions.html", "math-geometry.html", "math-knowledge-grade1.html", "math-knowledge-grade2.html", "math-knowledge-grade3.html", "math-knowledge-grade4.html", "math-knowledge-grade5.html", "math-knowledge-grade6.html", "math-multiplication.html", "math-teaching.html", "mermaid-storybook.html", "mini4wd-lab.html", "mirror-storybook.html", "mixed-up-museum-storybook.html", "modules/english-original/index.html", "moonlight-garden-storybook.html", "music-storybook.html", "parrot-storybook.html", "picky-bear-storybook.html", "pirate-storybook.html", "princess-storybook.html", "princess-weekend-storybook.html", "rabbit-storybook.html", "red-hood-storybook.html", "science-earth-lab.html", "science-fire-weather.html", "science-homework-storybook.html", "science-optics.html", "snow-before-storybook.html", "star-library-storybook.html", "story-planet.html", "time-storybook.html", "underwater-world-storybook.html", "unicorn-storybook.html", "volcano-storybook.html", "witch-storybook.html", "wizard-storybook.html"]);
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
