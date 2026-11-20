(async () => {
  'use strict';
  const current = new URL(location.href);
  const link = document.querySelector('a[data-preview-handoff]');
  const target = new URL(link.href);
  if (target.origin !== current.origin) return;
  target.search = current.search;
  target.hash = current.hash;
  link.href = target.href;
  try {
    if ('serviceWorker' in navigator) {
      // Root comes from the build-time static marker, not from query or fragment.
      const expectedWorker = new URL('entry-image-cache-sw.js', document.currentScript.src);
      const expectedScope = new URL('.', expectedWorker).href;
      const retire = navigator.serviceWorker.getRegistration(current.href).then(reg => {
        if (reg?.scope === expectedScope && reg.active?.scriptURL === expectedWorker.href) return reg.update();
      }).catch(async () => {});
    }
  } catch (_) {}
  location.replace(target.href);
})();
