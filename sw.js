/* =============================================================
   Service worker: hace que la app funcione sin señal.
   -------------------------------------------------------------
   Cuidado con las redirecciones: iOS rechaza cualquier respuesta
   redirigida que venga de un service worker, con el error
   "Response served by service worker has redirections".
   Cloudflare responde /index.html con un 307 hacia /, así que
   nunca se guarda ni se sirve esa URL, y toda respuesta que
   llegue redirigida se reconstruye limpia antes de usarla.
   ============================================================= */

const CACHE = 'shaot-v7';

/* Ojo: va './' y NO './index.html', que es la que redirige. */
const ARCHIVOS = [
  './',
  './css/app.css',
  './js/app.js',
  './js/calc.js',
  './js/store.js',
  './js/i18n.js',
  './js/impuestos.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/** Reconstruye una respuesta redirigida como una respuesta normal. */
async function sinRedireccion(res) {
  if (!res || !res.redirected) return res;
  const cuerpo = await res.blob();
  return new Response(cuerpo, {
    status: 200,
    statusText: 'OK',
    headers: res.headers
  });
}

/** ¿Se puede guardar esta respuesta en el cache? */
function guardable(res) {
  return res && res.status === 200 && res.type !== 'opaqueredirect' && !res.redirected;
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ARCHIVOS.map(url =>
        fetch(url, { redirect: 'follow', cache: 'reload' })
          .then(sinRedireccion)
          .then(r => guardable(r) ? c.put(url, r) : null)
          .catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Navegación (abrir la app): siempre se responde con la raíz ya
     cacheada, nunca con una redirección. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await sinRedireccion(await fetch(req, { redirect: 'follow' }));
        if (guardable(res)) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put('./', copia));
        }
        return res;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('./'))
            || (await cache.match('./index.html'))
            || Response.error();
      }
    })());
    return;
  }

  /* Festivos de Hebcal: primero la red, y si no hay, lo cacheado. */
  if (url.hostname.includes('hebcal.com')) {
    e.respondWith(
      fetch(req)
        .then(r => {
          if (guardable(r)) {
            const copia = r.clone();
            caches.open(CACHE).then(c => c.put(req, copia));
          }
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* El resto: primero el cache, y en paralelo se actualiza. */
  e.respondWith((async () => {
    const enCache = await caches.match(req);
    const red = fetch(req, { redirect: 'follow' })
      .then(sinRedireccion)
      .then(r => {
        if (guardable(r) && url.origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return r;
      })
      .catch(() => enCache);
    return enCache || red;
  })());
});
