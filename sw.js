const CACHE_NAME = 'kana-no-katas-v15';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/data.js',
  '/game.js',
  '/manifest.json',
  '/trace.html',
  '/strokes/A.svg',
  '/strokes/E.svg',
  '/strokes/HA.svg',
  '/strokes/HE.svg',
  '/strokes/HI.svg',
  '/strokes/HO.svg',
  '/strokes/HU.svg',
  '/strokes/I.svg',
  '/strokes/KA.svg',
  '/strokes/KE.svg',
  '/strokes/KI.svg',
  '/strokes/KO.svg',
  '/strokes/KU.svg',
  '/strokes/MA.svg',
  '/strokes/ME.svg',
  '/strokes/MI.svg',
  '/strokes/MO.svg',
  '/strokes/MU.svg',
  '/strokes/N.svg',
  '/strokes/NA.svg',
  '/strokes/NE.svg',
  '/strokes/NI.svg',
  '/strokes/NO.svg',
  '/strokes/NU.svg',
  '/strokes/O.svg',
  '/strokes/RA.svg',
  '/strokes/RE.svg',
  '/strokes/RI.svg',
  '/strokes/RO.svg',
  '/strokes/RU.svg',
  '/strokes/SA.svg',
  '/strokes/SE.svg',
  '/strokes/SI.svg',
  '/strokes/SO.svg',
  '/strokes/SU.svg',
  '/strokes/TA.svg',
  '/strokes/TE.svg',
  '/strokes/TI.svg',
  '/strokes/TO.svg',
  '/strokes/TU.svg',
  '/strokes/U.svg',
  '/strokes/WA.svg',
  '/strokes/WO.svg',
  '/strokes/YA.svg',
  '/strokes/YO.svg',
  '/strokes/YU.svg',
  '/strokes/a.svg',
  '/strokes/e.svg',
  '/strokes/ha.svg',
  '/strokes/he.svg',
  '/strokes/hi.svg',
  '/strokes/ho.svg',
  '/strokes/hu.svg',
  '/strokes/i.svg',
  '/strokes/ka.svg',
  '/strokes/ke.svg',
  '/strokes/ki.svg',
  '/strokes/ko.svg',
  '/strokes/ku.svg',
  '/strokes/ma.svg',
  '/strokes/me.svg',
  '/strokes/mi.svg',
  '/strokes/mo.svg',
  '/strokes/mu.svg',
  '/strokes/n.svg',
  '/strokes/na.svg',
  '/strokes/ne.svg',
  '/strokes/ni.svg',
  '/strokes/no.svg',
  '/strokes/nu.svg',
  '/strokes/o.svg',
  '/strokes/ra.svg',
  '/strokes/re.svg',
  '/strokes/ri.svg',
  '/strokes/ro.svg',
  '/strokes/ru.svg',
  '/strokes/sa.svg',
  '/strokes/se.svg',
  '/strokes/si.svg',
  '/strokes/so.svg',
  '/strokes/su.svg',
  '/strokes/ta.svg',
  '/strokes/te.svg',
  '/strokes/ti.svg',
  '/strokes/to.svg',
  '/strokes/tu.svg',
  '/strokes/u.svg',
  '/strokes/wa.svg',
  '/strokes/wo.svg',
  '/strokes/ya.svg',
  '/strokes/yo.svg',
  '/strokes/yu.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Installation : mise en cache de tous les assets
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
