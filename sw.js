// Service worker for Daily Macro Tracker PWA.
//
// Strategy:
//   - Navigations (HTML): network-first → cache fallback. Keeps users on the
//     latest shell as long as they're online; offline reload still works.
//   - Same-origin static assets (icons, manifest, fonts, json, css, js):
//     cache-first → network. Fast, offline-capable.
//   - Google Fonts (fonts.googleapis.com CSS + fonts.gstatic.com woff2):
//     stale-while-revalidate in a separate long-lived cache so offline open
//     still shows Fraunces / IBM Plex Sans Arabic instead of system fallback.
//   - Other cross-origin (Gemini, CDN libs, OpenFoodFacts): pass through.
//
// Bump CACHE_VERSION whenever shell files change to invalidate old caches.
const CACHE_VERSION = 'mt-v16';
const FONT_CACHE    = 'mt-fonts-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-152.png',
  './icons/icon-167.png',
  './icons/favicon-32.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './favicon.ico',
];

const ASSET_EXT = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|json|webmanifest|woff2?|ttf|otf)$/i;
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const CACHES_TO_KEEP = new Set([CACHE_VERSION, FONT_CACHE]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !CACHES_TO_KEEP.has(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow the page to trigger activation of a waiting SW after the user accepts
// the "new version" prompt. The page posts {type:'SKIP_WAITING'}.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Daily-reminder notifications are shown via registration.showNotification()
// from the page. When the user taps the notification, focus the existing tab
// if there is one, otherwise open a new one at the stored URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          if (w.url.indexOf(target) !== -1) return w.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate in a long-lived font cache.
  // Opaque responses are accepted (no-cors) so the woff2 fetch still works.
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const network = fetch(req).then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          }).catch(() => hit);
          return hit || network;
        })
      )
    );
    return;
  }

  // Any other cross-origin (Gemini API, CDN libs, OpenFoodFacts): pass through.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Static assets: cache-first.
  if (ASSET_EXT.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
      })
    );
    return;
  }

  // Anything else same-origin (rare): pass through to network.
});
