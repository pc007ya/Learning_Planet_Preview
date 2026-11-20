import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { test } from 'node:test';
const forwarding = await readFile(new URL('./forward.js', import.meta.url), 'utf8');
const retiring = await readFile(new URL('./retire-worker.js', import.meta.url), 'utf8');
const prefix = 'https://pc007ya.github.io/Learning_Planet_Preview/';
const oldWorker = prefix + 'entry-image-cache-sw.js';
const from = prefix + 'chinese/?language=zh%2BTW#unit-2';
const dest = prefix + 'v2/chinese/';
async function exercise({serviceWorker, target = dest}) {
  const moves = [];
  const link = {href: target};
  await runInContext(forwarding, createContext({
    URL, location: { href: from, replace: next => moves.push(next) },
    document: { querySelector: () => link, currentScript: { src: prefix + 'preview-forward.js' } },
    navigator: serviceWorker ? {serviceWorker} : {},
    setTimeout: (run, delay) => { assert.equal(delay, 450); const timer = setTimeout(run, 0); return timer; }
  }));
  return {moves, link};
}
test('forwards query and hash for direct legacy links without a registered worker', async () => {
  const {moves, link} = await exercise({});
  assert.deepEqual(moves, [dest+'?language=zh%2BTW#unit-2']);
  assert.equal(link.href, moves[0]);
});
test('updates only the old matching worker before safely forwarding', async () => {
  let updates = 0;
  const {moves} = await exercise({serviceWorker: { getRegistration(url) {
    assert.equal(url, from);
    return Promise.resolve({ scope: prefix, active: { scriptURL: oldWorker }, update: () => { updates++; } });
  } }});
  assert.equal(updates, 1);
  assert.equal(moves.length, 1);
});
test('ignores unrelated same-origin registrations and redirects', async () => {
  let updates = 0;
  let result = await exercise({serviceWorker: { getRegistration() {
    return Promise.resolve({ scope: 'https://pc007ya.github.io/Learning_Planet_Assets/', active: { scriptURL:oldWorker }, update: () => { updates++; } });
  } }});
  assert.equal(updates, 0);
  assert.equal(result.moves.length, 1);
  result = await exercise({target: 'https://example.invalid/ignored'});
  assert.deepEqual(result.moves, []);
});
test('continues when an existing registration never resolves or fails', async () => {
  for (const getRegistration of [() => new Promise(() => {}), () => Promise.reject(new Error('storage inaccessible'))]) {
    const {moves} = await exercise({serviceWorker:{getRegistration}});
    assert.equal(moves.length, 1);
  }
});
test('retirement worker claims clients without intercepting or modifying storage', async () => {
  const listeners = new Map();
  const order = [];
  const context = createContext({
    self: {
      addEventListener: (type, fn) => listeners.set(type, fn),
      skipWaiting: async () => {order.push('skip');},
      clients: {claim: async () => {order.push('claim');}},
      get indexedDB() {throw new Error('unexpected storage access');}
    },
    get indexedDB() {throw new Error('unexpected storage access');},
    get caches() {throw new Error('unexpected cache access');}
  });
  runInContext(retiring, context);
  assert.deepEqual([...listeners.keys()], ['install','activate']);
  for (const f of listeners.values()) {
    let lifetime; f({waitUntil: p => {lifetime = p;}}); assert(lifetime); await lifetime;
  }
  assert.deepEqual(order, ['skip','claim']);
});
