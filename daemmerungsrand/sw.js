const C='daemmerungsrand-v12-12';
const FILES=['./','index.html','klassik.html','westerntor.html','three.min.js','GLTFLoader.js','SkeletonUtils.js','figuren.js','w/leben.json','w/zeit.json','w/karte.jpg','s/logo_hell.png','w/stadt_nav.json','w/t/index.json','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==C).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;if(/\.(glb|hdr|mp4|mov)(\?|$)/.test(e.request.url))return;/* große Modelldateien nicht über den Zwischenspeicher leiten */
  e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
