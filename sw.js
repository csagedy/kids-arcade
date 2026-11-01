/* Offline cache for the arcade. Bump CACHE whenever files change, otherwise
   phones keep serving the old copy. */
var CACHE = 'arcade-v27';

var FILES = [
  './',
  './icon-arcade.png',
  './index.html',
  './manifest.webmanifest',
  './menu-art.js',
  './cabinet/cabinet.css',
  './cabinet/cabinet.js',
  './cards/cards.css',
  './cards/cards.js',
  './games/2048/icon.png',
  './games/2048/index.html',
  './games/2048/manifest.webmanifest',
  './games/2048/style.css',
  './games/2048/js/game.js',
  './games/2048/js/ui.js',
  './games/asteroids/icon.png',
  './games/asteroids/index.html',
  './games/asteroids/manifest.webmanifest',
  './games/asteroids/js/game.js',
  './games/asteroids/js/ui.js',
  './games/blockblast/icon.png',
  './games/blockblast/index.html',
  './games/blockblast/manifest.webmanifest',
  './games/blockblast/style.css',
  './games/blockblast/js/game.js',
  './games/blockblast/js/pieces.js',
  './games/blockblast/js/ui.js',
  './games/breakout/icon.png',
  './games/breakout/index.html',
  './games/breakout/manifest.webmanifest',
  './games/breakout/js/game.js',
  './games/breakout/js/ui.js',
  './games/color/icon.png',
  './games/color/index.html',
  './games/color/manifest.webmanifest',
  './games/color/css/style.css',
  './games/color/js/app.js',
  './games/color/js/input.js',
  './games/color/js/pictures-expert.js',
  './games/color/js/pictures-hard.js',
  './games/color/js/pictures-medium.js',
  './games/color/js/puzzle.js',
  './games/color/js/puzzles-data.js',
  './games/color/js/quantize.js',
  './games/color/js/render.js',
  './games/color/js/util.js',
  './games/connect4/icon.png',
  './games/connect4/index.html',
  './games/connect4/manifest.webmanifest',
  './games/connect4/style.css',
  './games/connect4/js/game.js',
  './games/connect4/js/ui.js',
  './games/crazy8/icon.png',
  './games/crazy8/index.html',
  './games/crazy8/manifest.webmanifest',
  './games/crazy8/style.css',
  './games/crazy8/js/game.js',
  './games/crazy8/js/ui.js',
  './games/dots/icon.png',
  './games/dots/index.html',
  './games/dots/manifest.webmanifest',
  './games/dots/style.css',
  './games/dots/js/game.js',
  './games/dots/js/pictures-data.js',
  './games/dots/js/ui.js',
  './games/flow/icon.png',
  './games/flow/index.html',
  './games/flow/manifest.webmanifest',
  './games/flow/style.css',
  './games/flow/js/game.js',
  './games/flow/js/level.js',
  './games/flow/js/ui.js',
  './games/frogger/icon.png',
  './games/frogger/index.html',
  './games/frogger/manifest.webmanifest',
  './games/frogger/js/game.js',
  './games/frogger/js/ui.js',
  './games/gofish/icon.png',
  './games/gofish/index.html',
  './games/gofish/manifest.webmanifest',
  './games/gofish/style.css',
  './games/gofish/js/game.js',
  './games/gofish/js/ui.js',
  './games/hatch/icon.png',
  './games/hatch/index.html',
  './games/hatch/manifest.webmanifest',
  './games/hatch/style.css',
  './games/hatch/js/art.js',
  './games/hatch/js/game.js',
  './games/hatch/js/ui.js',
  './games/invaders/icon.png',
  './games/invaders/index.html',
  './games/invaders/manifest.webmanifest',
  './games/invaders/js/game.js',
  './games/invaders/js/ui.js',
  './games/klondike/icon.png',
  './games/klondike/index.html',
  './games/klondike/manifest.webmanifest',
  './games/klondike/style.css',
  './games/klondike/js/deals.js',
  './games/klondike/js/rules.js',
  './games/klondike/js/ui.js',
  './games/maze/icon.png',
  './games/maze/index.html',
  './games/maze/manifest.webmanifest',
  './games/maze/style.css',
  './games/maze/js/game.js',
  './games/maze/js/ui.js',
  './games/memory/icon.png',
  './games/memory/index.html',
  './games/memory/manifest.webmanifest',
  './games/memory/style.css',
  './games/memory/js/game.js',
  './games/memory/js/ui.js',
  './games/missile/icon.png',
  './games/missile/index.html',
  './games/missile/manifest.webmanifest',
  './games/missile/js/game.js',
  './games/missile/js/ui.js',
  './games/nonogram/icon.png',
  './games/nonogram/index.html',
  './games/nonogram/manifest.webmanifest',
  './games/nonogram/style.css',
  './games/nonogram/js/game.js',
  './games/nonogram/js/puzzles-data.js',
  './games/nonogram/js/ui.js',
  './games/pong/icon.png',
  './games/pong/index.html',
  './games/pong/manifest.webmanifest',
  './games/pong/js/game.js',
  './games/pong/js/ui.js',
  './games/shapes/icon.png',
  './games/shapes/index.html',
  './games/shapes/manifest.webmanifest',
  './games/shapes/style.css',
  './games/shapes/js/game.js',
  './games/shapes/js/level.js',
  './games/shapes/js/ui.js',
  './games/simon/icon.png',
  './games/simon/index.html',
  './games/simon/manifest.webmanifest',
  './games/simon/style.css',
  './games/simon/js/game.js',
  './games/simon/js/ui.js',
  './games/snake/icon.png',
  './games/snake/index.html',
  './games/snake/manifest.webmanifest',
  './games/snake/js/game.js',
  './games/snake/js/ui.js',
  './games/watersort/icon.png',
  './games/watersort/index.html',
  './games/watersort/manifest.webmanifest',
  './games/watersort/style.css',
  './games/watersort/js/game.js',
  './games/watersort/js/level.js',
  './games/watersort/js/ui.js',
  './kit/kit.css',
  './kit/kit.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // One missing file shouldn't fail the whole install, but the menu
      // should know: record "got/total" so it can show whether the phone
      // is really ready for a road trip.
      var got = 0;
      // cache: 'reload' skips the browser's HTTP cache, otherwise a phone
      // that fetched a file minutes ago can "install" the stale copy.
      return Promise.all(FILES.map(function (f) {
        return c.add(new Request(f, { cache: 'reload' })).then(function () { got++; }).catch(function () {});
      })).then(function () {
        return c.put('./__precache', new Response(got + '/' + FILES.length, { headers: { 'Content-Type': 'text/plain' } }));
      }).then(function () {
        return self.clients.matchAll({ includeUncontrolled: true });
      }).then(function (clients) {
        clients.forEach(function (cl) { cl.postMessage({ type: 'precached' }); });
      });
    }).then(function () { return self.skipWaiting(); })
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
  // On a dev server, always go to the network so edits show up on reload.
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var live = fetch(e.request, { cache: 'no-cache' }).then(function (res) {
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
