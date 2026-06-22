// ═══════════════════════════════════════════════
// DAYFLOW — SERVICE WORKER
// Bump CACHE_NAME version to force refresh
// ═══════════════════════════════════════════════
const CACHE_NAME = 'dayflow-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// ── INSTALL: cache app shell ───────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return Promise.allSettled(
        ASSETS.map(url => {
          if (url.startsWith('http')) {
            return cache.add(new Request(url, { mode: 'no-cors' }));
          }
          return cache.add(url);
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old caches ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first, background-update HTML ─
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Background-update index.html so users always
        // get the latest version on next reload
        if (event.request.url.endsWith('.html') || event.request.url.endsWith('/')) {
          fetch(event.request).then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
          }).catch(() => {});
        }
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(response => {
        if (!response || (response.status !== 200 && response.type !== 'opaque')) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MESSAGE: force update from app ────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
