const VERSION = 'v7';
const CACHE = 'explorer-' + VERSION;
const APP = ['./', 'index.html', 'assets/app.css', 'assets/app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
// Beim Installieren immer frisch vom Netz holen (GitHub Pages cached 10 Min. per HTTP)
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(APP.map(u => fetch(u, { cache: 'reload' }).then(r => { if (r.ok) return c.put(u, r); })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(() => self.clients.matchAll({ type: 'window' })).then(cs => cs.forEach(c => c.postMessage({ type: 'updated', version: VERSION })))); });
self.addEventListener('message', e => { if (e.data === 'version') e.source.postMessage({ type: 'version', version: VERSION }); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.endsWith('index.enc.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
