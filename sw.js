/* ============================================================
   FROM THE LOVE BEGINS — Service Worker
   Caches static assets for offline/fast repeat visits.
   Security: only caches same-origin 'self' assets.
   ============================================================ */

const CACHE_NAME = 'ftlb-v4';

// Assets to pre-cache on install (all same-origin — safe for CSP worker-src 'self')
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/img/hero.jpg',
  '/img/support-qr1.jpeg'
];

// ── Install: pre-cache static shell ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static assets, network-first for YouTube ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // SECURITY: Only intercept same-origin GET requests.
  // Never cache cross-origin requests (YouTube API, fonts, etc.)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache valid same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
