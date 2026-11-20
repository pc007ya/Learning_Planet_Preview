// Preview-only retirement worker at the legacy scope URL.
// Never intercept a request or open, rename, clear or delete any client storage.
'use strict';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
