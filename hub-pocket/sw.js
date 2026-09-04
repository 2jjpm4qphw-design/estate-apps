/* Hub Pocket service worker.
 * Caches the app shell so the app LAUNCHES with no signal.
 * It never caches gist or weather data — those always go to the network,
 * so sync behaviour (read-modify-write + replay) is unchanged.
 *
 * Bump CACHE on every shell change so phones pick up the new version.
 * (Navigations are network-first, so a new deploy normally shows after one
 *  online load even without a bump — the bump just guarantees old caches are
 *  cleared.)
 */
var CACHE = 'hub-pocket-v14';   /* v14, 4 Sep 2026 — one list; to-dos moved to their diary day. */
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  // Leave cross-origin requests (GitHub gist API, open-meteo) untouched.
  if (url.origin !== self.location.origin) return;

  // App shell navigation: network-first (so deploys show after one online
  // load), fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // Same-origin static assets (icons, manifest): cache-first.
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
