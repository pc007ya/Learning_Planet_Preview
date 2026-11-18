// Preview-only story access: no Firebase identity or parent-session bypass.
const root = new URL('../', import.meta.url);
const storyPaths = new Set(__STORY_PAGE_ALLOWLIST__);
const path = decodeURIComponent(location.pathname.slice(root.pathname.length));
const host = document.querySelector('#little-star, #story-app, #amusement-book');
const deny = () => {
  window.speechSynthesis?.cancel();
  if (host) host.replaceChildren(document.createTextNode('請先進入預覽 DEMO。'));
  location.replace(root.href);
};
let started;
async function update() {
  if (!window.LP_PREVIEW_READY || !location.pathname.startsWith(root.pathname) || !storyPaths.has(path) || localStorage.getItem('preview-demo-active') !== 'yes') { deny(); return; }
  try {
    const source = document.querySelector('script[data-story-reader]')?.dataset.storyReader;
    if (!source) throw new Error('Missing reader');
    const reader = new URL(source, document.baseURI);
    const allowed = ['modules/little-star/little-star.js', 'modules/story-planet/story-planet.js'];
    if (path === 'princess-weekend-storybook.html') allowed.push('modules/book-49/reader.js');
    if (path === 'amusement-park-storybook.html') allowed.push('modules/amusement-park/amusement-park.js');
    if (reader.origin !== root.origin || !allowed.some(p => new URL(p, root).pathname === reader.pathname)) throw new Error('Invalid reader');
    if (!started) started = import(reader.href);
    await started;
    if (localStorage.getItem('preview-demo-active') !== 'yes') deny();
  } catch (_) { deny(); }
}
window.addEventListener('pageshow', event => {if(event.persisted) update();});
window.addEventListener('storage', event => {if(event.key === 'learning-planet-preview.v1:preview-demo-active') update();});
await update();
