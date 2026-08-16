// Roadcraft — shell cache only. Network-first for the page so a new build is picked up
// on the next online load; bump CACHE on every shell change. Never caches map or weather
// calls: a stale road-speed limit is worse than none.
var CACHE = 'roadcraft-v5';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL).catch(function(){}); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;          // never touch GitHub, weather or map APIs
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(function(){ return caches.match('./index.html'); }));
    return;
  }
  e.respondWith(caches.match(r).then(function(hit){ return hit || fetch(r); }));
});
