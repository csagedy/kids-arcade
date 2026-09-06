/* Offline cache for the arcade. Bump CACHE whenever files change, otherwise
   phones keep serving the old copy. */
var CACHE = 'arcade-v1';

var FILES = [
  './', './index.html', './icon-arcade.png', './manifest.webmanifest',
  './games/color/index.html', './games/color/icon.png', './games/color/manifest.webmanifest',
  './games/color/css/style.css',
  './games/color/js/util.js', './games/color/js/quantize.js', './games/color/js/puzzles-data.js',
  './games/color/js/puzzle.js', './games/color/js/render.js', './games/color/js/input.js',
  './games/color/js/app.js',
  './games/watersort/index.html', './games/watersort/icon.png', './games/watersort/manifest.webmanifest',
  './games/watersort/style.css',
  './games/watersort/js/level.js', './games/watersort/js/game.js', './games/watersort/js/ui.js',
  './games/blockblast/index.html', './games/blockblast/icon.png', './games/blockblast/manifest.webmanifest',
  './games/blockblast/style.css',
  './games/blockblast/js/pieces.js', './games/blockblast/js/game.js', './games/blockblast/js/ui.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      // One missing file shouldn't fail the whole install.
      .then(function (c) { return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Serve from cache for speed and offline, refresh in the background so the
   next launch has the newest files. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var live = fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || live;
    })
  );
});
