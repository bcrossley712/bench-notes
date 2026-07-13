// service-worker.js
// Caches the app's own files so it opens and runs with zero connection,
// once it's been loaded at least once. Your data (entries/photos) lives
// in IndexedDB, not here - this only handles the app shell itself.
//
// CACHE_NAME's __VERSION__ token gets replaced with the deploy's commit
// hash automatically by the GitHub Actions workflow - never edit it by
// hand. This is what makes each real deploy count as a "new version" so
// phones actually pick up updates instead of reusing a stale cache.
const CACHE_NAME = 'bench-notes-__VERSION__';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Deliberately NOT calling self.skipWaiting() here. A newly installed
  // worker stays in the "waiting" state until the page tells it to take
  // over (see the SKIP_WAITING message below) - that's what lets the
  // update banner ask before switching versions out from under you.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
