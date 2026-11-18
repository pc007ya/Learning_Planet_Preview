// Insert synchronously before every other script in EVERY preview HTML entry.
(() => {
  'use strict';
  const prefix = 'learning-planet-preview.v1:';

  function isolate(raw) {
    const keys = () => Array.from({length: raw.length}, (_, i) => raw.key(i)).filter(k => k && k.startsWith(prefix));
    const api = {
      getItem: key => raw.getItem(prefix + String(key)),
      setItem: (key, value) => raw.setItem(prefix + String(key), String(value)),
      removeItem: key => raw.removeItem(prefix + String(key)),
      clear: () => keys().forEach(key => raw.removeItem(key)),
      key: i => keys()[Number(i)]?.slice(prefix.length) ?? null,
      get length() { return keys().length; }
    };
    return new Proxy(api, {
      get: (target, key) => key in target ? target[key] : typeof key === 'string' ? api.getItem(key) ?? undefined : undefined,
      set: (_target, key, value) => { api.setItem(key, value); return true; },
      deleteProperty: (_target, key) => { api.removeItem(key); return true; },
      ownKeys: () => keys().map(key => key.slice(prefix.length)),
      getOwnPropertyDescriptor: (_target, key) => api.getItem(key) === null ? undefined : ({configurable: true, enumerable: true, writable: true, value: api.getItem(key)})
    });
  }
  const stateKey = '__LP_PREVIEW_ISOLATION_V1__';
  function locked(name, value) {
    const d = Object.getOwnPropertyDescriptor(window, name);
    return !!d && d.configurable === false && d.writable === false && d.value === value;
  }
  function probe(facade) {
    const key = '__isolation_probe__' + Math.random().toString(36).slice(2);
    facade.setItem(key, 'ok');
    if (facade.getItem(key) !== 'ok') throw new Error('Storage unavailable');
    facade.removeItem(key);
  }
  try {
    const previous = Object.getOwnPropertyDescriptor(window, stateKey);
    if (previous) {
      const state = previous.value;
      if (!locked(stateKey, state) || !Object.isFrozen(state) ||
          state.version !== prefix || typeof state.verify !== 'function' ||
          state.verify() !== true) throw new Error('Invalid existing isolation');
      return; // document.open/write preserves this realm: never wrap twice.
    }
    const stores = ['localStorage', 'sessionStorage'].map(name => {
      const descriptor = Object.getOwnPropertyDescriptor(window, name);
      if (descriptor && !descriptor.configurable) throw new Error('Storage cannot be isolated');
      const raw = window[name];
      const facade = isolate(raw);
      // Check actual browser storage availability before exposing the app.
      probe(facade);
      return {name, facade};
    });
    for (const {name, facade} of stores) {
      Object.defineProperty(window, name, { value: facade, configurable: false, writable: false });
      if (window[name] !== facade) throw new Error('Storage replacement failed');
    }
    Object.defineProperty(window, 'LP_PREVIEW_ONLY', { value: true, writable: false, configurable: false });
    Object.defineProperty(window, 'LP_PREVIEW_READY', { value: true, writable: false, configurable: false });
    const state = Object.freeze({
      version: prefix,
      verify() {
        if (!locked('LP_PREVIEW_ONLY', true) || !locked('LP_PREVIEW_READY', true)) return false;
        for (const {name, facade} of stores) {
          if (!locked(name, facade)) return false;
          probe(facade);
        }
        return true;
      }
    });
    Object.defineProperty(window, stateKey, {value: state, configurable: false, writable: false});
  } catch (_) {
    // This bootstrap is the FIRST parser-executed script. A throw alone would
    // let later scripts run with raw storage. Tighten CSP before any can run,
    // then consume the remaining source as hidden plaintext, never markup.
    document.write('<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; worker-src \'none\'; frame-src \'none\'; connect-src \'none\'; object-src \'none\'"><style>body{font:18px system-ui;padding:24px;background:#08152b;color:white}</style></head><body><h1>預覽隔離未能啟動</h1><p>為保護原有學習資料，已停止載入。請關閉此頁，使用獨立瀏覽器設定檔再試。</p><plaintext hidden>');
  }
})();
