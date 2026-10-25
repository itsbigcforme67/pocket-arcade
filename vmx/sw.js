// Offline cache for the VMX (only active on https or localhost).
// Other apps live on the same site, so this only ever touches caches named vmx-*.
const CACHE = 'vmx-v21';
const CORES = ['starraiders_core.js', 'starraiders_machine.js', 'cpu6502.js', 'vxrt.js', 'vxrt.wasm', 'zork1.LICENSE',
  '3CARDPOK.VXP', '9BALL.VXP', 'BACCARAT.VXP', 'BIGSIX.VXP', 'BLACKJAC.VXP', 'BLOBS.VXP', 'BLOX.VXP', 'CASINOWA.VXP', 'CHECKERS.VXP',
  'CHUCKALU.VXP', 'CRAPS.VXP', 'FOLDROOM.VXP', 'FROGRACE.VXP', 'HILO.VXP', 'INTERCEP.VXP', 'INVASION.VXP', 'JUNCTION.VXP', 'KENO.VXP', 'LETITRID.VXP',
  'REDDOG.VXP', 'REVERSI.VXP', 'ROULETTE.VXP', 'SCRATCH.VXP', 'SICBO.VXP', 'SLOTS.VXP', 'TRICKYWI.VXP', 'VIDEOPOK.VXP', 'ZORKI.VXP'].map((f) => 'cores/' + f);
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
