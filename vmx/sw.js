// Offline cache for the VMX (only active on https or localhost).
// Other apps live on the same site, so this only ever touches caches named vmx-*.
const CACHE = 'vmx-v4';
const CORES = ['blox_core.js', 'blobs_core.js', 'intercept_core.js', 'invasion_core.js', 'blackjack_core.js',
  'checkers_core.js', 'reversi_core.js', 'junction_core.js', 'pool_core.js', 'tricky_core.js', 'tricky_rules.js', 'zork_core.js', 'zmachine.js', 'zork1.z3',
  'starraiders_core.js', 'starraiders_machine.js', 'cpu6502.js'].map((f) => 'cores/' + f);
const SHELL = ['./', 'index.html', 'vmx.js', 'games.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'apple-touch-icon.png', 'favicon.png', ...CORES];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('vmx-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  // network first (so updates show up), fall back to the cache when offline
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
