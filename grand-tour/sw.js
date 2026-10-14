/* The Grand Tour service worker.
 * Caches the app shell and the map library so the app opens, and saved drives show, with no signal.
 * Map tiles are cached as you view them (capped, oldest out) — never pre-fetched in bulk, which
 * OpenStreetMap's tile policy forbids. Routing (brouter.de), place search and the gist always go
 * to the network. Bump CACHE on every shell change.
 */
var CACHE = 'grand-tour-v1';   // 4 Oct 2026 — first build
var TILES = 'grand-tour-tiles';
var TILE_CAP = 800;
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function trimTiles() {
  caches.open(TILES).then(function (c) { c.keys().then(function (ks) { if (ks.length > TILE_CAP) ks.slice(0, ks.length - TILE_CAP).forEach(function (k) { c.delete(k); }); }); });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url; try { url = new URL(req.url); } catch (_) { return; }
  var h = url.hostname;
  if (h === 'api.github.com' || h.indexOf('githubusercontent') >= 0 || h === 'brouter.de' || h === 'photon.komoot.io' || h === 'api.postcodes.io') return;
  if (h === 'tile.openstreetmap.org') {
    e.respondWith(caches.open(TILES).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res && res.ok) { c.put(req, res.clone()); trimTiles(); } return res; });
        return hit || net;
      });
    }));
    return;
  }
  if (h === 'cdnjs.cloudflare.com' || h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res; });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); return res;
    }).catch(function () { return caches.match('./index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return res; });
  }));
});
