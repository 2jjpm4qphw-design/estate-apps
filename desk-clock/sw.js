/* Desk Clock service worker.
 *
 * WHY THIS ONE HAS A SERVICE WORKER WHEN SIX OTHER ESTATE APPS DO NOT.
 * Those were branding passes on apps you open, use and close. This one is on permanently, in a
 * box frame, on charge, in a study. It has to come back up after a router reboot, a power cut,
 * or the phone restarting at 3am with the Wi-Fi still negotiating. An app that needs the network
 * to draw a clock is not a clock.
 *
 * THE FONT IS THE INTERESTING PART, and it is the reason this file is not a copy of Hub Pocket's.
 * Hub Pocket deliberately leaves cross-origin requests alone, because its cross-origin traffic is
 * the gist API and the weather, which must never be served stale. The clock's only cross-origin
 * traffic is Cormorant Garamond from Google, and that must never be served FRESH if the network
 * is down — the handover's words: "a clock that reloads after a Wi-Fi drop must not fall back to
 * Georgia".
 *
 * Self-hosting the woff2 in this folder would be better still, and the handover asks for it. It
 * is not done because the sandbox that built this cannot reach fonts.gstatic.com — blocked, 403,
 * verified rather than assumed. So the font is cached here on first load instead. The practical
 * difference is one online launch, which installing the app requires anyway. If Mark ever drops
 * the two woff2 files into this folder, swap the <link> for an @font-face, add them to SHELL, and
 * delete the FONT_HOSTS block below.
 *
 * Bump CACHE on every change to the shell or the page, or phones keep the old one.
 */
var CACHE = 'desk-clock-v5';        /* v5, 20 Sep 2026 — five pictures, four of them engravings. */
var FONT_CACHE = 'desk-clock-fonts-v1';

var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  /* The charging face's two crest silhouettes. They are files rather than base64 so the study
     clock does not carry 60KB it never draws — which means they must be in the shell, or the
     charging face arrives with no crest the first time it is opened without a network. */
  './crest-dim.png',
  './crest-gilt.png',
  /* The engraving and its interior mask. The line art is 175KB, which is worth it for the one
     picture that actually looks like an object rather than clipart — and it is cached once. */
  './decanter-line.png',
  './decanter-mask.png',
  './hourglass-line.png',
  './hourglass-mask-top.png',
  './hourglass-mask-bot.png',
  /* The keep has no mask: the sea rises in front of it rather than inside it. */
  './castle-line.png',
  './arms-line.png',
  './arms-mask-0.png'
];

var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        /* Keep the CURRENT shell and the CURRENT font cache; bin everything else.
           Listing both explicitly matters — an earlier draft deleted every cache whose name
           was not CACHE, which quietly threw the fonts away on every single update and put the
           clock back to Georgia until it next had a network. */
        return k !== CACHE && k !== FONT_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (_) { return; }

  /* ── The font: CACHE FIRST, always. ──────────────────────────────────────
     Stale is the correct answer here. The typeface is not going to change, and the failure this
     is guarding against is the network being absent, not the font being out of date. */
  if (FONT_HOSTS.indexOf(url.hostname) > -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          /* Cache opaque responses too. A no-cors font request comes back opaque, and an opaque
             response is still perfectly good for rendering — it just cannot be inspected. */
          if (res && (res.ok || res.type === 'opaque')) {
            var copy = res.clone();
            caches.open(FONT_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () {
          /* No network, nothing cached: let it fail quietly and fall back to Baskerville.
             The clock still tells the time, which is the job. */
          return new Response('', { status: 504, statusText: 'offline' });
        });
      })
    );
    return;
  }

  /* Any other cross-origin request is not ours — leave it alone. There should not be any. */
  if (url.origin !== self.location.origin) return;

  /* ── The page: network-first, so a deploy lands after one online load. ── */
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

  /* ── Icons and manifest: cache-first. ─────────────────────────────────── */
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
