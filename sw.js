const CACHE_NAME = 'kana-no-katas-v38';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/data.js',
  '/game.js',
  '/manifest.json',
  '/trace.html',
  '/strokes/reference_strokes.json',
  '/strokes/h/a.svg',
  '/strokes/h/e.svg',
  '/strokes/h/ha.svg',
  '/strokes/h/he.svg',
  '/strokes/h/hi.svg',
  '/strokes/h/ho.svg',
  '/strokes/h/hu.svg',
  '/strokes/h/i.svg',
  '/strokes/h/ka.svg',
  '/strokes/h/ke.svg',
  '/strokes/h/ki.svg',
  '/strokes/h/ko.svg',
  '/strokes/h/ku.svg',
  '/strokes/h/ma.svg',
  '/strokes/h/me.svg',
  '/strokes/h/mi.svg',
  '/strokes/h/mo.svg',
  '/strokes/h/mu.svg',
  '/strokes/h/n.svg',
  '/strokes/h/na.svg',
  '/strokes/h/ne.svg',
  '/strokes/h/ni.svg',
  '/strokes/h/no.svg',
  '/strokes/h/nu.svg',
  '/strokes/h/o.svg',
  '/strokes/h/ra.svg',
  '/strokes/h/re.svg',
  '/strokes/h/ri.svg',
  '/strokes/h/ro.svg',
  '/strokes/h/ru.svg',
  '/strokes/h/sa.svg',
  '/strokes/h/se.svg',
  '/strokes/h/si.svg',
  '/strokes/h/so.svg',
  '/strokes/h/su.svg',
  '/strokes/h/ta.svg',
  '/strokes/h/te.svg',
  '/strokes/h/ti.svg',
  '/strokes/h/to.svg',
  '/strokes/h/tu.svg',
  '/strokes/h/u.svg',
  '/strokes/h/wa.svg',
  '/strokes/h/we.svg',
  '/strokes/h/wi.svg',
  '/strokes/h/wo.svg',
  '/strokes/h/ya.svg',
  '/strokes/h/yo.svg',
  '/strokes/h/yu.svg',
  '/strokes/k/a.svg',
  '/strokes/k/e.svg',
  '/strokes/k/ha.svg',
  '/strokes/k/he.svg',
  '/strokes/k/hi.svg',
  '/strokes/k/ho.svg',
  '/strokes/k/hu.svg',
  '/strokes/k/i.svg',
  '/strokes/k/ka.svg',
  '/strokes/k/ke.svg',
  '/strokes/k/ki.svg',
  '/strokes/k/ko.svg',
  '/strokes/k/ku.svg',
  '/strokes/k/ma.svg',
  '/strokes/k/me.svg',
  '/strokes/k/mi.svg',
  '/strokes/k/mo.svg',
  '/strokes/k/mu.svg',
  '/strokes/k/n.svg',
  '/strokes/k/na.svg',
  '/strokes/k/ne.svg',
  '/strokes/k/ni.svg',
  '/strokes/k/no.svg',
  '/strokes/k/nu.svg',
  '/strokes/k/o.svg',
  '/strokes/k/ra.svg',
  '/strokes/k/re.svg',
  '/strokes/k/ri.svg',
  '/strokes/k/ro.svg',
  '/strokes/k/ru.svg',
  '/strokes/k/sa.svg',
  '/strokes/k/se.svg',
  '/strokes/k/si.svg',
  '/strokes/k/so.svg',
  '/strokes/k/su.svg',
  '/strokes/k/ta.svg',
  '/strokes/k/te.svg',
  '/strokes/k/ti.svg',
  '/strokes/k/to.svg',
  '/strokes/k/tu.svg',
  '/strokes/k/u.svg',
  '/strokes/k/wa.svg',
  '/strokes/k/we.svg',
  '/strokes/k/wi.svg',
  '/strokes/k/wo.svg',
  '/strokes/k/ya.svg',
  '/strokes/k/yo.svg',
  '/strokes/k/yu.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch : cache-first, fallback réseau
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
