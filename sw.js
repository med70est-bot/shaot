/* Service worker: guarda la app para que funcione sin senal. */
const CACHE = 'shaot-v2';
const ARCHIVOS = [
  './', './index.html', './css/app.css',
  './js/app.js', './js/calc.js', './js/store.js', './js/i18n.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Hebcal: primero la red, y si no hay, lo que este cacheado.
  if (url.hostname.includes('hebcal.com')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // El resto: primero el cache, y en paralelo actualizamos.
  e.respondWith(
    caches.match(e.request).then(hit => {
      const red = fetch(e.request).then(r => {
        if (r && r.status === 200 && url.origin === location.origin) {
          const c = r.clone();
          caches.open(CACHE).then(x => x.put(e.request, c));
        }
        return r;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
