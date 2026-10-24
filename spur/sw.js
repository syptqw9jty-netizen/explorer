// Spur — Service Worker. Speichert nur die App selbst, niemals Inhalte. Funktioniert offline.
const VERSION = 'spur-v3';
const APP = ['./', 'index.html', 'manifest.webmanifest', 'assets/app.css', 'assets/js/app.js', 'assets/js/store.js', 'assets/js/crypto.js', 'assets/js/audio.js', 'assets/js/ai.js', 'assets/js/orb.js', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(APP.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok && c.put(u, r))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('spur-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window' })).then(cs => cs.forEach(c => c.postMessage({ type: 'updated', version: VERSION }))));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // KI-Anfragen nie anfassen
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
