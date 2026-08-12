/* Dressing Room service worker — caches the app shell + catalogue; thumbnails
 * cache opportunistically as you view them. Never caches the gist API.
 * Bump CACHE on shell or catalogue changes.
 */
var CACHE = 'wardrobe-v5';
var SHELL = ['./','./index.html','./manifest.webmanifest','./wardrobe.json','./thumbs.js','./outfits.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // leave the gist API alone
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); return res;
    }).catch(function () { return caches.match('./index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  // Same-origin assets incl. ./img/*.jpg: cache-first, populate on first view.
  e.respondWith(caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
