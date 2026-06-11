// DayFlow Service Worker — Offline Support
const CACHE_NAME = 'dayflow-v1';

// Files to cache on install
const PRECACHE_URLS = [
  './daily-tracker-ios.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
];

// Google Fonts domains to cache at runtime
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── INSTALL: cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache the HTML immediately; fonts may fail offline — that's okay
      return cache.add('./daily-tracker-ios.html').then(() => {
        // Try to pre-cache fonts, but don't block install if they fail
        return Promise.allSettled(
          PRECACHE_URLS.slice(1).map(url => cache.add(url))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For font requests: cache-first with network fallback
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Fonts unavailable offline — app will fall back to system font, that's fine
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // For the HTML app itself: cache-first, update in background (stale-while-revalidate)
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => null);

        // Return cached version immediately; update cache in background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else: network-first, cache fallback
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
          
