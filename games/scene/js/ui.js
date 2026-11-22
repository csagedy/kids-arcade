/* Scene Maker screen, on the arcade kit. An open-ended felt board: pick a
   backdrop, drag (or tap) stickers out of the tray, move them about, pinch
   or use the big buttons to size / turn / flip them, tap them to make them
   do their thing. No score, no end. Everything saves as it changes.

   Input is pointer events, one record per finger in `gestures`:
     item   a finger on a placed sticker (two fingers on one = pinch)
     new    a sticker pulled out of the tray
     turn   the yellow handle: one-finger turn and grow
   A sticker being dragged lives in the fixed #float layer (so it can go
   over the tray to the bin) and moves by transform only; its size in px is
   committed when the finger lifts. */
(function () {
  'use strict';
  var M = SceneModel, A = SceneArt;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------- icons this game needs on top of Kit.ICONS ---------- */
  var ICO = {
    picture: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 16.5l5-5 4 4 2.5-2.5 5.5 5"/><circle cx="16" cy="9.5" r="1.6" fill="currentColor"/>',
    gift: '<rect x="4" y="11" width="16" height="9" rx="1.5"/><rect x="3" y="7.5" width="18" height="3.5" rx="1"/><path d="M12 7.5V20M12 7.5C10 3 6.5 4 7.5 6.2 8.2 7.5 12 7.5 12 7.5zM12 7.5c2-4.5 5.5-3.5 4.5-1.3-.7 1.3-4.5 1.3-4.5 1.3z"/>',
    broom: '<path d="M15.5 3 11.5 11"/><path d="M7 12h9l1.5 8.5h-12z"/><path d="M9.5 16v4.5M13 16v4.5"/>',
    bigger: '<path d="M12 5v14M5 12h14" stroke-width="3.2"/>',
    smaller: '<path d="M5 12h14" stroke-width="3.2"/>',
    flip: '<path d="M12 3.5v17" stroke-dasharray="2 3"/><path d="M9 7 3.5 17H9z" fill="currentColor"/><path d="M15 7l5.5 10H15z"/>',
    front: '<rect x="3.5" y="9.5" width="11" height="11" rx="2.5"/><rect x="9.5" y="3.5" width="11" height="11" rx="2.5" fill="currentColor"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 4.5H6a2 2 0 0 0-2 2V16"/>',
    bin: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5.5M13.5 11v5.5"/>'
  };
  function ico(name) {
    return '<svg class="k-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICO[name] + '</svg>';
  }
  $$('[data-ico]').forEach(function (s) { s.innerHTML = ico(s.getAttribute('data-ico')); });

  A.install();
  var sceneEl = $('#scene'), bgEl = $('#bg'), layerEl = $('#stickers'), selEl = $('#sel'), toolsEl = $('#tools'),
      floatEl = $('#float'), trayEl = $('#tray'), tabsEl = $('#tabs'), wrapEl = $('#grid-wrap'), gridEl = $('#grid'),
      undoBtn = $('#undo-btn'), playBtn = $('#play-btn');
  var landMQ = window.matchMedia('(orientation: landscape) and (min-width: 640px)');
  function valid(id) { return !!A.meta(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var scene, W = 1, H = 1;
  var els = {};            // item uid -> .st element
  var sel = null;          // selected item uid
  var cat = Kit.load('scene.tab', 'farm');
  if (!A.CATS.some(function (c) { return c.id === cat; })) cat = A.CATS[0].id;
  var alive = false, aliveTimer = 0;
  var gestures = {};       // pointerId -> gesture
  var pend = {};           // pointerId -> a press on a tray sticker that may become a drag

  /* ---------- sounds: tiny synthesised animal noises through Kit.sfx ---------- */
  var T = Kit.sfx.tone;
  function seq(list) { list.forEach(function (n) { T(n[0], n[1], n[2] || 'sine', n[3] || {}); }); }
  var SND = {
    moo: function () { T(176, 0.75, 'sawtooth', { vol: 0.035, to: 120, attack: 0.15 }); T(178, 0.75, 'triangle', { vol: 0.09, to: 118, attack: 0.15 }); },
    oink: function () { T(330, 0.09, 'square', { vol: 0.035, to: 210 }); T(310, 0.1, 'square', { vol: 0.035, to: 190, when: 0.14 }); },
    baa: function () { for (var i = 0; i < 6; i++) T(i % 2 ? 430 : 395, 0.07, 'sawtooth', { vol: 0.03, when: i * 0.065 }); },
    cluck: function () { [0, 0.12, 0.22].forEach(function (w, i) { T(720 + i * 90, 0.06, 'square', { vol: 0.025, to: 520, when: w }); }); },
    cheep: function () { T(2300, 0.07, 'sine', { vol: 0.06, to: 3000 }); T(2400, 0.07, 'sine', { vol: 0.06, to: 3100, when: 0.12 }); },
    quack: function () { T(560, 0.13, 'sawtooth', { vol: 0.04, to: 380 }); T(540, 0.13, 'sawtooth', { vol: 0.04, to: 360, when: 0.18 }); },
    neigh: function () { for (var i = 0; i < 7; i++) T(900 - i * 50 + (i % 2) * 60, 0.06, 'triangle', { vol: 0.07, when: i * 0.055 }); },
    woof: function () { T(290, 0.1, 'triangle', { vol: 0.12, to: 160 }); T(280, 0.12, 'triangle', { vol: 0.12, to: 150, when: 0.18 }); },
    meow: function () { T(520, 0.18, 'sine', { vol: 0.08, to: 820 }); T(820, 0.26, 'sine', { vol: 0.08, to: 430, when: 0.17 }); },
    squeak: function () { T(1500, 0.06, 'sine', { vol: 0.07, to: 1950 }); T(1600, 0.06, 'sine', { vol: 0.06, to: 2100, when: 0.09 }); },
    roar: function () { T(170, 0.5, 'sawtooth', { vol: 0.05, to: 95, attack: 0.05 }); T(120, 0.5, 'triangle', { vol: 0.08, to: 80 }); },
    trumpet: function () { T(440, 0.32, 'sawtooth', { vol: 0.04, to: 660, attack: 0.05 }); T(660, 0.28, 'sawtooth', { vol: 0.04, to: 520, when: 0.3 }); },
    hoot: function () { T(420, 0.18, 'sine', { vol: 0.1, to: 390 }); T(400, 0.32, 'sine', { vol: 0.1, to: 360, when: 0.26 }); },
    ribbit: function () { T(230, 0.06, 'square', { vol: 0.035, to: 180 }); T(270, 0.08, 'square', { vol: 0.035, to: 200, when: 0.09 }); },
    tweet: function () { for (var i = 0; i < 3; i++) T(2400 + i * 200, 0.06, 'sine', { vol: 0.06, to: 3200, when: i * 0.09 }); },
    buzz: function () { T(190, 0.45, 'sawtooth', { vol: 0.025, to: 220 }); },
    hello: function () { seq([[523, 0.12, 'triangle', { vol: 0.08 }], [659, 0.12, 'triangle', { vol: 0.08, when: 0.13 }], [784, 0.16, 'triangle', { vol: 0.08, when: 0.26 }]]); },
    baby: function () { T(700, 0.22, 'sine', { vol: 0.08, to: 950 }); T(900, 0.2, 'sine', { vol: 0.07, to: 650, when: 0.22 }); },
    putt: function () { for (var i = 0; i < 6; i++) T(85, 0.05, 'square', { vol: 0.045, when: i * 0.08 }); },
    honk: function () { T(392, 0.12, 'square', { vol: 0.035 }); T(392, 0.18, 'square', { vol: 0.035, when: 0.16 }); },
    toot: function () { T(587, 0.38, 'triangle', { vol: 0.08 }); T(740, 0.38, 'triangle', { vol: 0.06 }); },
    whoosh: function () { T(200, 0.5, 'sine', { vol: 0.07, to: 900 }); },
    ufo: function () { T(600, 0.5, 'sine', { vol: 0.06, to: 1200 }); T(900, 0.4, 'sine', { vol: 0.04, to: 500, when: 0.25 }); },
    chime: function () { seq([[1046, 0.3, 'sine', { vol: 0.07 }], [1318, 0.3, 'sine', { vol: 0.06, when: 0.08 }], [1568, 0.35, 'sine', { vol: 0.05, when: 0.16 }]]); },
    twinkle: function () { seq([[1568, 0.15, 'sine', { vol: 0.06 }], [2093, 0.2, 'sine', { vol: 0.05, when: 0.1 }]]); },
    boing: function () { T(260, 0.3, 'sine', { vol: 0.1, to: 640 }); },
    crunch: function () { for (var i = 0; i < 4; i++) T(300 + Math.random() * 400, 0.03, 'square', { vol: 0.03, when: i * 0.05 }); },
    leaves: function () { T(1200, 0.2, 'sine', { vol: 0.03, to: 800 }); T(900, 0.2, 'sine', { vol: 0.03, to: 1300, when: 0.12 }); },
    rain: function () { for (var i = 0; i < 5; i++) T(1400 + Math.random() * 900, 0.05, 'sine', { vol: 0.05, when: i * 0.07 }); },
    thunder: function () { T(80, 0.7, 'sawtooth', { vol: 0.05, to: 40 }); T(60, 0.8, 'triangle', { vol: 0.1, to: 35, when: 0.05 }); },
    night: function () { seq([[784, 0.25, 'sine', { vol: 0.06 }], [659, 0.25, 'sine', { vol: 0.06, when: 0.22 }], [523, 0.4, 'sine', { vol: 0.06, when: 0.44 }]]); },
    knock: function () { T(220, 0.05, 'triangle', { vol: 0.12 }); T(220, 0.05, 'triangle', { vol: 0.12, when: 0.14 }); },
    tada: function () { seq([[523, 0.12, 'triangle', { vol: 0.08 }], [784, 0.3, 'triangle', { vol: 0.08, when: 0.12 }]]); },
    song: function () { seq([[659, 0.14, 'triangle', { vol: 0.08 }], [784, 0.14, 'triangle', { vol: 0.08, when: 0.15 }], [880, 0.14, 'triangle', { vol: 0.08, when: 0.3 }], [784, 0.25, 'triangle', { vol: 0.08, when: 0.45 }]]); },
    what: function () { T(400, 0.3, 'sine', { vol: 0.08, to: 700 }); },
    rumble: function () { T(55, 0.6, 'sawtooth', { vol: 0.05, to: 70 }); T(82, 0.6, 'square', { vol: 0.02, to: 64 }); T(110, 0.5, 'triangle', { vol: 0.06, to: 90, when: 0.1 }); },
    beep: function () { T(1050, 0.13, 'square', { vol: 0.03 }); T(1050, 0.13, 'square', { vol: 0.03, when: 0.26 }); T(1050, 0.13, 'square', { vol: 0.03, when: 0.52 }); },
    churn: function () { for (var i = 0; i < 4; i++) T(70 + (i % 2) * 20, 0.16, 'sawtooth', { vol: 0.04, when: i * 0.16 }); },
    clang: function () { T(1300, 0.25, 'triangle', { vol: 0.06, to: 1250 }); T(1950, 0.15, 'sine', { vol: 0.03 }); },
    whale: function () { T(260, 0.9, 'sine', { vol: 0.1, to: 420, attack: 0.25 }); T(420, 0.8, 'sine', { vol: 0.07, to: 220, when: 0.8, attack: 0.2 }); },
    orca: function () { T(1200, 0.25, 'sine', { vol: 0.06, to: 1900 }); T(1900, 0.3, 'sine', { vol: 0.05, to: 1100, when: 0.24 }); },
    dolphin: function () { for (var i = 0; i < 5; i++) T(2600, 0.02, 'square', { vol: 0.02, when: i * 0.05 }); T(1800, 0.3, 'sine', { vol: 0.06, to: 2900, when: 0.28 }); },
    shark: function () { T(82, 0.32, 'triangle', { vol: 0.14 }); T(87, 0.32, 'triangle', { vol: 0.14, when: 0.42 }); },
    seal: function () { T(520, 0.12, 'sawtooth', { vol: 0.04, to: 320 }); T(500, 0.12, 'sawtooth', { vol: 0.04, to: 300, when: 0.2 }); },
    squawk: function () { T(700, 0.16, 'sawtooth', { vol: 0.035, to: 480 }); T(760, 0.2, 'sawtooth', { vol: 0.035, to: 500, when: 0.2 }); },
    snip: function () { T(1800, 0.03, 'square', { vol: 0.03 }); T(1600, 0.03, 'square', { vol: 0.03, when: 0.12 }); },
    sonar: function () { T(1320, 0.5, 'sine', { vol: 0.07, to: 1300 }); },
    blub: function () { for (var i = 0; i < 3; i++) T(380 + i * 120, 0.07, 'sine', { vol: 0.08, to: 900 + i * 150, when: i * 0.09 }); }
  };
  function sound(name) { (SND[name] || function () { Kit.sfx.pop(); })(); }

  /* ---------- sizes ---------- */
  function measure() { W = sceneEl.clientWidth || 1; H = sceneEl.clientHeight || 1; }

  /* ---------- drawing stickers ---------- */
  function makeEl(it) {
    var m = A.meta(it.s), el = document.createElement('div');
    el.className = 'st';
    el.setAttribute('data-u', it.u);
    el.innerHTML = '<div class="st-in"' + (m.alive ? ' data-alive="' + m.alive + '"' : '') + ' style="--d:' + (-Math.random() * 3).toFixed(2) + 's">' + A.svg(it.s) + '</div>';
    return el;
  }
  function place(el, it) {
    var s = it.k * W;
    el.style.width = el.style.height = s.toFixed(1) + 'px';
    el.style.transform = 'translate3d(' + (it.x * W - s / 2).toFixed(1) + 'px,' + (it.y * H - s / 2).toFixed(1) + 'px,0) rotate(' + it.r.toFixed(1) + 'deg)';
    el.style.zIndex = it.z;
    el.classList.toggle('flip', !!it.f);
  }
  function renderBg() { bgEl.innerHTML = A.backdropSVG(scene.bg); }
  function renderStickers() {
    layerEl.innerHTML = '';
    els = {};
    scene.items.forEach(function (it) { var el = makeEl(it); place(el, it); layerEl.appendChild(el); els[it.u] = el; });
    if (sel && !scene.byU(sel)) sel = null;
    showSel();
  }
  function renderAll() { renderBg(); renderStickers(); updateButtons(); }
  function layoutAll() { scene.items.forEach(function (it) { if (els[it.u] && els[it.u].parentNode === layerEl) place(els[it.u], it); }); showSel(); }
  function updateButtons() { undoBtn.disabled = !scene.canUndo(); }

  /* ---------- selection frame and tools ---------- */
  function selBox(x, y, k, r) {
    var s = Math.max(k * W + 10, 46);
    selEl.style.width = selEl.style.height = s.toFixed(1) + 'px';
    selEl.style.transform = 'translate3d(' + (x * W - s / 2).toFixed(1) + 'px,' + (y * H - s / 2).toFixed(1) + 'px,0) rotate(' + r.toFixed(1) + 'deg)';
  }
  function hideSel() { selEl.classList.add('k-hidden'); toolsEl.classList.add('k-hidden'); }
  function showSel() {
    var it = sel && scene.byU(sel);
    if (!it || busy(it)) { hideSel(); return; }
    selEl.classList.remove('k-hidden');
    selBox(it.x, it.y, it.k, it.r);
    toolsEl.classList.remove('k-hidden');
    var tw = toolsEl.offsetWidth, th = toolsEl.offsetHeight;
    var a = it.r * Math.PI / 180, half = it.k * W / 2 * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
    var tap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k-tap')) || 48;
    var gap = tap * 0.6 + 6, cy = it.y * H;
    var ty = cy - half - gap - th;
    if (ty < 4) ty = cy + half + gap;
    if (ty + th > H - 4) ty = cy - half - gap - th >= -th * 0.4 ? Math.max(4, cy - half - gap - th) : Math.min(H - th - 4, Math.max(4, cy - th / 2));
    var tx = tw >= W - 8 ? (W - tw) / 2 : clamp(it.x * W - tw / 2, 4, W - tw - 4);
    toolsEl.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
  }
  function select(u) { sel = u; showSel(); }

  function busy(it) {
    for (var id in gestures) if (gestures[id].it === it) return true;
    return false;
  }

  /* ---------- changes: every one is undoable and saved ---------- */
  var statN = -1;
  function save() {
    M.saveCurrent(scene);
    updateButtons();
    var n = M.count(scene);
    if (n !== statN) { statN = n; if (n > 0) Kit.stat('scene', n === 1 ? '1 scene' : n + ' scenes'); }
  }
  function act(it, quiet) {
    var m = A.meta(it.s), el = els[it.u];
    if (!m || !el) return;
    if (!Kit.reduced) Kit.anim(el.firstChild, 'act-' + (m.act || 'hop'));
    if (!quiet) sound(m.snd);
  }
  function popEl(el) {
    el.classList.add('gone');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, Kit.reduced ? 0 : 300);
  }
  function removeItem(it, el, noCheckpoint) {
    if (!noCheckpoint) scene.checkpoint();
    scene.remove(it.u);
    delete els[it.u];
    if (sel === it.u) sel = null;
    popEl(el);
    Kit.sfx.pop(360);
    hideSel();
    save();
  }
  /* a random free-ish spot for a sticker on this backdrop */
  function spot(m) {
    var b = A.backdrop(scene.bg), z = b[m.place] || b.ground || [0.6, 0.9], best = null, bestD = -1;
    if (m.place === 'any') z = [0.2, 0.8];
    var x0 = z.length > 2 ? z[2] : 0.12, x1 = z.length > 3 ? z[3] : 0.88;
    for (var t = 0; t < 10; t++) {
      var x = x0 + Math.random() * (x1 - x0), y = z[0] + Math.random() * (z[1] - z[0]), d = 9;
      scene.items.forEach(function (it) { var dx = it.x - x, dy = (it.y - y) * 0.75; d = Math.min(d, dx * dx + dy * dy); });
      if (d > bestD) { bestD = d; best = { x: x, y: y }; }
    }
    return best;
  }
  function full() {
    Kit.toast('The picture is full!', { icon: 'star', top: true });
    Kit.anim(sceneEl, 'k-shake');
    Kit.sfx.bad();
  }
  function addAt(sid, x, y, k, delay) {
    var it = scene.add(sid, x, y, k);
    if (!it) return null;
    var el = makeEl(it);
    place(el, it);
    layerEl.appendChild(el);
    els[it.u] = el;
    if (!Kit.reduced) { if (delay) el.firstChild.style.animationDelay = delay + 's'; Kit.anim(el.firstChild, 's-in'); }
    return it;
  }
  function tapAdd(sid) {
    if (scene.full()) { full(); return; }
    var m = A.meta(sid), p = spot(m);
    scene.checkpoint();
    var it = addAt(sid, p.x, p.y, m.k);
    select(it.u);
    Kit.sfx.place();
    save();
  }
  function surprise() {
    if (Kit.overlayOpen()) return;
    if (scene.full()) { full(); return; }
    var b = A.backdrop(scene.bg);
    var pool = (b.pool || A.all().map(function (m) { return m.id; })).filter(valid);
    var n = Math.min(3 + (Math.random() < 0.4 ? 1 : 0), M.MAX_ITEMS - scene.items.length), picks = [];
    while (picks.length < n && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    scene.checkpoint();
    var last = null;
    picks.forEach(function (sid, i) {
      var m = A.meta(sid), p = spot(m);
      var it = addAt(sid, p.x, p.y, m.k * (0.85 + Math.random() * 0.3), i * 0.15);
      if (it && Math.random() < 0.4) { it.f = 1; place(els[it.u], it); }
      last = it || last;
      setTimeout(function () { Kit.sfx.pop(500 + i * 120); }, i * 150);
    });
    select(null);
    save();
  }

  /* ---------- the tray ---------- */
  function buildTabs() {
    tabsEl.innerHTML = A.CATS.map(function (c) {
      return '<button class="tab' + (c.id === cat ? ' on' : '') + '" data-cat="' + c.id + '" aria-label="' + Kit.esc(c.name) + '" aria-pressed="' + (c.id === cat) + '">' + A.use(c.icon) + '</button>';
    }).join('');
  }
  function buildGrid() {
    gridEl.innerHTML = A.inCat(cat).map(function (m) {
      return '<button class="ti" data-s="' + m.id + '" aria-label="' + Kit.esc(m.name) + '">' + A.use(m.id) + '</button>';
    }).join('');
    wrapEl.scrollLeft = 0; wrapEl.scrollTop = 0;
  }
  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b || b.getAttribute('data-cat') === cat) return;
    cat = b.getAttribute('data-cat');
    Kit.save('scene.tab', cat);
    Kit.sfx.tap();
    buildTabs(); buildGrid(); layoutTray();
  });
  function layoutTray() {
    var big = Math.min(window.innerWidth, window.innerHeight) >= 600, target = big ? 100 : 74, gap = 8, pad = 16;
    if (landMQ.matches) {
      var w = wrapEl.clientWidth - pad, cols = Math.max(2, Math.round((w + gap) / (target + gap)));
      while (cols > 2 && (w - (cols - 1) * gap) / cols < 56) cols--;
      gridEl.style.setProperty('--cols', cols);
      gridEl.style.setProperty('--cell', Math.floor((w - (cols - 1) * gap) / cols) + 'px');
    } else {
      var hh = wrapEl.clientHeight - pad, rows = Math.max(1, Math.round((hh + gap) / (target + gap)));
      while (rows > 1 && (hh - (rows - 1) * gap) / rows < 56) rows--;
      var cell = Math.min(Math.floor((hh - (rows - 1) * gap) / rows), big ? 132 : 104);
      gridEl.style.setProperty('--rows', rows);
      gridEl.style.setProperty('--cell', Math.max(48, cell) + 'px');
    }
  }

  /* A press on a tray sticker: a tap adds it; pulling it across the way the
     tray does not scroll (or holding it a moment) picks it up. */
  gridEl.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.ti');
    if (!b || Kit.overlayOpen() || e.button > 0) return;
    var p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, sid: b.getAttribute('data-s'), btn: b, t0: Date.now() };
    p.timer = setTimeout(function () { if (pend[p.id] === p) pickUp(p); }, 330);
    pend[e.pointerId] = p;
    b.classList.add('press');
    if (e.pointerType === 'mouse') e.preventDefault();
  });
  function endPend(p) { clearTimeout(p.timer); p.btn.classList.remove('press'); delete pend[p.id]; }
  function pickUp(p) {
    endPend(p);
    if (scene.full()) { full(); return; }
    var m = A.meta(p.sid);
    var rect = sceneEl.getBoundingClientRect();
    var it = { s: p.sid, k: m.k, r: 0, f: 0, u: 0 };
    var el = makeEl(it);
    var size = m.k * W;
    el.style.width = el.style.height = size + 'px';
    el.classList.add('lift');
    floatEl.appendChild(el);
    var g = { kind: 'new', sid: p.sid, el: el, size0: size, k: m.k, r: 0, cx: p.x, cy: p.y - size * 0.2, pts: {}, rect: rect, tray: trayEl.getBoundingClientRect(), lastX: p.x, lastY: p.y };
    g.pts[p.id] = { x: p.x, y: p.y };
    rebase(g);
    gestures[p.id] = g;
    p.btn.classList.add('out');
    g.btn = p.btn;
    if (!Kit.reduced) Kit.anim(el.firstChild, 's-in');
    Kit.sfx.tone(520, 0.06, 'sine', { vol: 0.07, to: 760 });
    draw(g);
  }
  // keep iOS from scrolling the tray once a sticker is in the hand
  wrapEl.addEventListener('touchmove', function (e) {
    for (var id in gestures) if (gestures[id].kind === 'new') { e.preventDefault(); return; }
  }, { passive: false });

  /* ---------- gestures on the scene ---------- */
  function rebase(g) {
    g.b = { cx: g.cx, cy: g.cy, k: g.k, r: g.r, p: {} };
    for (var id in g.pts) g.b.p[id] = { x: g.pts[id].x, y: g.pts[id].y };
  }
  function ids(g) { return Object.keys(g.pts); }
  function reach(g) { return Math.max(g.k * W * 0.8, 70); }

  sceneEl.addEventListener('pointerdown', function (e) {
    if (Kit.overlayOpen() || e.button > 0) return;
    if (e.target.closest('.tools')) return;
    var rect = sceneEl.getBoundingClientRect();
    if (e.target.closest('.turn')) { startTurn(e, rect); return; }
    var stEl = e.target.closest('.st'), it = stEl ? scene.byU(+stEl.getAttribute('data-u')) : null;
    if (!it) {
      // a second finger near a sticker that is already held makes a pinch
      for (var id in gestures) {
        var g = gestures[id];
        if (g.kind !== 'item' || ids(g).length !== 1) continue;
        var c = centre(g, rect), dx = e.clientX - c.x, dy = e.clientY - c.y;
        if (dx * dx + dy * dy < reach(g) * reach(g)) { e.preventDefault(); join(g, e); return; }
      }
      it = nearest(e.clientX - rect.left, e.clientY - rect.top);
    }
    if (!it) { if (sel) { select(null); Kit.sfx.tone(500, 0.05, 'sine', { vol: 0.04, to: 380 }); } return; }
    e.preventDefault();
    for (var id2 in gestures) if (gestures[id2].it === it) { if (ids(gestures[id2]).length < 2) join(gestures[id2], e); return; }
    var g2 = { kind: 'item', it: it, el: els[it.u], cx: rect.left + it.x * W, cy: rect.top + it.y * H, k: it.k, r: it.r,
      size0: it.k * W, pts: {}, rect: rect, t0: Date.now(), moved: false, lifted: false, lastX: e.clientX, lastY: e.clientY, wasSel: sel === it.u };
    g2.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    rebase(g2);
    gestures[e.pointerId] = g2;
    if (sel !== it.u) { sel = it.u; }
    hideSel();
  });
  function centre(g, rect) { return g.lifted ? { x: g.cx, y: g.cy } : { x: rect.left + g.it.x * W, y: rect.top + g.it.y * H }; }
  /* a finger just off a small sticker still picks it up */
  function nearest(x, y) {
    var best = null, bz = -1;
    scene.items.forEach(function (it) {
      var dx = x - it.x * W, dy = y - it.y * H, r = Math.max(it.k * W * 0.32, 22);
      if (dx * dx + dy * dy < r * r && it.z > bz && !busy(it)) { best = it; bz = it.z; }
    });
    return best;
  }
  function join(g, e) {
    g.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    gestures[e.pointerId] = g;
    g.moved = true;
    if (!g.lifted) lift(g);
    rebase(g);
  }
  function lift(g) {
    g.lifted = true;
    g.rect = sceneEl.getBoundingClientRect();
    g.tray = trayEl.getBoundingClientRect();
    scene.checkpoint();
    g.size0 = g.it.k * W;
    g.cx = g.rect.left + g.it.x * W; g.cy = g.rect.top + g.it.y * H;
    rebase(g);
    g.el.classList.add('lift');
    g.el.style.zIndex = '';
    floatEl.appendChild(g.el);
    trayEl.classList.add('binning');
    hideSel();
    draw(g);
  }
  function startTurn(e, rect) {
    var it = sel && scene.byU(sel);
    if (!it || busy(it)) return;
    e.preventDefault();
    var cx = rect.left + it.x * W, cy = rect.top + it.y * H;
    var g = { kind: 'turn', it: it, el: els[it.u], cx: cx, cy: cy, k: it.k, r: it.r, size0: it.k * W, rect: rect, pts: {}, moved: false,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx), d0: Math.max(20, Math.hypot(e.clientX - cx, e.clientY - cy)), k0: it.k, r0: it.r };
    g.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    gestures[e.pointerId] = g;
    toolsEl.classList.add('k-hidden');
  }

  function update(g) {
    if (g.kind === 'turn') {
      var p = g.pts[ids(g)[0]];
      var a = Math.atan2(p.y - g.cy, p.x - g.cx), d = Math.hypot(p.x - g.cx, p.y - g.cy);
      g.k = M.clampK(g.k0 * d / g.d0);
      var r = g.r0 + (a - g.a0) * 180 / Math.PI;
      var near = Math.round(r / 90) * 90;
      g.r = Math.abs(r - near) < 5 ? near : r;
      return;
    }
    var list = ids(g);
    if (list.length === 1) {
      var q = g.pts[list[0]], b = g.b.p[list[0]];
      g.cx = g.b.cx + q.x - b.x; g.cy = g.b.cy + q.y - b.y;
    } else if (list.length >= 2) {
      var p1 = g.pts[list[0]], p2 = g.pts[list[1]], b1 = g.b.p[list[0]], b2 = g.b.p[list[1]];
      var d0 = Math.max(10, Math.hypot(b2.x - b1.x, b2.y - b1.y)), d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      var a0 = Math.atan2(b2.y - b1.y, b2.x - b1.x), a1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      g.k = M.clampK(g.b.k * d1 / d0);
      g.r = g.b.r + (a1 - a0) * 180 / Math.PI;
      g.cx = g.b.cx + (p1.x + p2.x - b1.x - b2.x) / 2;
      g.cy = g.b.cy + (p1.y + p2.y - b1.y - b2.y) / 2;
    }
  }
  function draw(g) {
    var sc = g.k * W / g.size0;
    if (g.kind === 'turn') {
      var x = g.it.x * W, y = g.it.y * H;
      g.el.style.transform = 'translate3d(' + (x - g.size0 / 2).toFixed(1) + 'px,' + (y - g.size0 / 2).toFixed(1) + 'px,0) rotate(' + g.r.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      selBox(g.it.x, g.it.y, g.k, g.r);
      return;
    }
    g.el.style.transform = 'translate3d(' + (g.cx - g.size0 / 2).toFixed(1) + 'px,' + (g.cy - g.size0 / 2).toFixed(1) + 'px,0) rotate(' + g.r.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
  }
  function overTray(g, x, y) { var t = g.tray; return t && x >= t.left && x <= t.right && y >= t.top && y <= t.bottom; }

  var raf = 0, dirty = [];
  function frame() {
    raf = 0;
    dirty.forEach(draw);
    dirty = [];
  }
  window.addEventListener('pointermove', function (e) {
    var p = pend[e.pointerId];
    if (p) {
      p.x = e.clientX; p.y = e.clientY;
      var dx = p.x - p.x0, dy = p.y - p.y0, land = landMQ.matches;
      var along = Math.abs(land ? dy : dx), across = Math.abs(land ? dx : dy);
      if (across > 10 && across > along) pickUp(p);
      else if (along > 12) endPend(p);        // the tray is scrolling
      return;
    }
    var g = gestures[e.pointerId];
    if (!g) return;
    e.preventDefault();
    g.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    g.lastX = e.clientX; g.lastY = e.clientY;
    if (g.kind === 'item' && !g.lifted) {
      var b = g.b.p[e.pointerId];
      if (Math.abs(e.clientX - b.x) + Math.abs(e.clientY - b.y) < 8) return;
      g.moved = true;
      lift(g);
    }
    g.moved = true;
    update(g);
    if (g.kind === 'item') trayEl.classList.toggle('bin-hot', overTray(g, e.clientX, e.clientY));
    if (dirty.indexOf(g) < 0) dirty.push(g);
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: false });

  function up(e) {
    var p = pend[e.pointerId];
    if (p) {
      endPend(p);
      if (e.type === 'pointerup' && Math.abs(e.clientX - p.x0) + Math.abs(e.clientY - p.y0) < 12) tapAdd(p.sid);
      return;
    }
    var g = gestures[e.pointerId];
    if (!g) return;
    delete gestures[e.pointerId];
    delete g.pts[e.pointerId];
    if (ids(g).length) { rebase(g); return; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; dirty.forEach(draw); dirty = []; }
    finish(g, e.type === 'pointercancel');
  }
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  function finish(g, cancelled) {
    var rect = g.rect, x = (g.cx - rect.left) / W, y = (g.cy - rect.top) / H;
    if (g.kind === 'new') {
      if (g.btn) g.btn.classList.remove('out');
      var inScene = g.lastX >= rect.left && g.lastX <= rect.right && g.lastY >= rect.top && g.lastY <= rect.bottom;
      if (cancelled || !inScene || overTray(g, g.lastX, g.lastY) || scene.full()) {
        popEl(g.el);
        if (scene.full() && inScene) full();
        return;
      }
      scene.checkpoint();
      var it = scene.add(g.sid, clamp(x, 0.02, 0.98), clamp(y, 0.02, 0.98), g.k, g.r);
      g.el.setAttribute('data-u', it.u);
      g.el.classList.remove('lift');
      layerEl.appendChild(g.el);
      els[it.u] = g.el;
      place(g.el, it);
      select(it.u);
      Kit.sfx.place();
      save();
      return;
    }
    if (g.kind === 'turn') {
      if (g.moved) { scene.checkpoint(); scene.update(g.it.u, { k: g.k, r: g.r }); place(g.el, g.it); save(); }
      else place(g.el, g.it);
      showSel();
      return;
    }
    // a placed sticker
    trayEl.classList.remove('binning', 'bin-hot');
    if (!g.lifted) {
      // a tap: select it and let it do its thing
      if (Date.now() - g.t0 < 600) act(g.it);
      select(g.it.u);
      return;
    }
    g.el.classList.remove('lift');
    var off = 0.1;
    if (overTray(g, g.lastX, g.lastY) || x < -off || x > 1 + off || y < -off || y > 1 + off) {
      removeItem(g.it, g.el, true);
      return;
    }
    scene.update(g.it.u, { x: x, y: y, k: g.k, r: g.r });
    layerEl.appendChild(g.el);
    place(g.el, g.it);
    select(g.it.u);
    Kit.sfx.place();
    save();
  }
  /* the scene went away under a drag (overlay, page hidden): put things back */
  function endAll() {
    Object.keys(pend).forEach(function (id) { endPend(pend[id]); });
    var seen = [];
    Object.keys(gestures).forEach(function (id) {
      var g = gestures[id];
      delete gestures[id];
      if (seen.indexOf(g) >= 0) return;
      seen.push(g);
      g.pts = {};
      finish(g, true);
    });
  }

  /* ---------- the tool bar on a selected sticker ---------- */
  toolsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'), it = sel && scene.byU(sel);
    if (!b || !it || Kit.overlayOpen()) return;
    var t = b.getAttribute('data-t'), el = els[it.u];
    function eased() {
      el.classList.add('ease'); selEl.classList.add('ease');
      setTimeout(function () { el.classList.remove('ease'); selEl.classList.remove('ease'); }, 240);
    }
    if (t === 'bin') { removeItem(it, el); return; }
    if (t === 'copy') {
      if (scene.full()) { full(); return; }
      scene.checkpoint();
      var c = scene.copy(it.u), ce = makeEl(c);
      place(ce, c); layerEl.appendChild(ce); els[c.u] = ce;
      if (!Kit.reduced) Kit.anim(ce.firstChild, 's-in');
      Kit.sfx.pop(640);
      select(c.u); save();
      return;
    }
    scene.checkpoint();
    if (t === 'big' || t === 'small') {
      var k0 = it.k;
      scene.update(it.u, { k: it.k * (t === 'big' ? 1.25 : 0.8) });
      if (it.k === k0) { scene.undo(); Kit.anim(el.firstChild, 'act-pulse'); Kit.sfx.bad(); return; }
      eased();
      Kit.sfx.tone(t === 'big' ? 440 : 660, 0.12, 'sine', { vol: 0.08, to: t === 'big' ? 700 : 400 });
    } else if (t === 'flip') {
      scene.update(it.u, { f: !it.f });
      Kit.sfx.slide();
    } else if (t === 'front') {
      scene.front(it.u);
      scene.items.forEach(function (x) { if (els[x.u]) els[x.u].style.zIndex = x.z; });
      if (!Kit.reduced) Kit.anim(el.firstChild, 'act-pulse');
      Kit.sfx.pop(700);
    }
    place(el, it);
    showSel();
    save();
  });

  /* ---------- bar buttons ---------- */
  undoBtn.addEventListener('click', function () {
    if (Kit.overlayOpen() || !scene.undo()) return;
    endAll();
    var bg = bgEl.getAttribute('data-bg');
    if (bg !== scene.bg) renderBg();
    bgEl.setAttribute('data-bg', scene.bg);
    renderStickers();
    Kit.sfx.tone(520, 0.1, 'sine', { vol: 0.08, to: 340 });
    save();
  });

  function clearScene() {
    if (Kit.overlayOpen() || scene.isEmpty()) return;
    Kit.confirm({ emoji: '🧹', title: 'Clear the picture?', text: 'Every sticker comes off. Undo brings them back.', yes: 'Clear', no: 'Keep', danger: true })
      .then(function (yes) {
        if (!yes) return;
        scene.checkpoint();
        Object.keys(els).forEach(function (u) { popEl(els[u]); });
        els = {}; sel = null;
        scene.clear();
        hideSel();
        Kit.sfx.slide();
        save();
      });
  }
  $$('.clear-btn').forEach(function (b) { b.addEventListener('click', clearScene); });
  $('#surprise-btn').addEventListener('click', surprise);

  function setAlive(on) {
    alive = !!on && !Kit.reduced;
    sceneEl.classList.toggle('alive', alive);
    Kit.setIcon(playBtn, alive ? 'pause' : 'play');
    playBtn.setAttribute('aria-pressed', alive ? 'true' : 'false');
    clearInterval(aliveTimer);
    if (alive) aliveTimer = setInterval(function () {
      if (document.hidden || Kit.overlayOpen() || !scene.items.length) return;
      var it = scene.items[Math.floor(Math.random() * scene.items.length)];
      if (!busy(it)) act(it, Math.random() < 0.5);
    }, 2600);
  }
  if (Kit.reduced) playBtn.classList.add('k-hidden');
  playBtn.addEventListener('click', function () {
    if (Kit.overlayOpen()) return;
    setAlive(!alive);
    if (alive) Kit.sfx.open(); else Kit.sfx.close();
  });

  /* ---------- sheets: backdrops and the gallery ---------- */
  var BG_ORDER = ['farm', 'build', 'sea', 'ocean', 'barn', 'pond', 'road', 'space', 'blank'];
  function bgList() {
    var all = A.backdrops().slice();
    all.sort(function (a, b) { var i = BG_ORDER.indexOf(a.id), j = BG_ORDER.indexOf(b.id); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    return all;
  }
  function useBg(id) { return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><use href="#sm-bg-' + id + '"/></svg>'; }
  /* a little picture of a saved scene: the backdrop plus every sticker */
  function thumb(d) {
    var s = '<svg viewBox="0 0 400 300" aria-hidden="true"><use href="#sm-bg-' + Kit.esc(A.backdrop(d.bg).id) + '"/>';
    (d.items || []).slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }).forEach(function (it) {
      if (!valid(it.s)) return;
      var size = (+it.k || 0.18) * 400;
      s += '<g transform="translate(' + ((+it.x || 0) * 400).toFixed(1) + ' ' + ((+it.y || 0) * 300).toFixed(1) + ') rotate(' + (+it.r || 0) + ')' + (it.f ? ' scale(-1 1)' : '') + '">' +
        '<use href="#sm-st-' + it.s + '" x="' + (-size / 2).toFixed(1) + '" y="' + (-size / 2).toFixed(1) + '" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) + '"/></g>';
    });
    return s + '</svg>';
  }
  function openBackdrops() {
    if (Kit.overlayOpen()) return Promise.resolve();
    endAll();
    var html = '<div class="pick-grid">' + bgList().map(function (b) {
      return '<button class="pick' + (b.id === scene.bg ? ' on' : '') + '" data-bg="' + b.id + '" aria-label="' + Kit.esc(b.name) + '">' + useBg(b.id) + '</button>';
    }).join('') + '</div>';
    Kit.sfx.open();
    return Kit.sheet({
      title: 'Pick a place', html: html, buttons: [],
      onOpen: function (card, close) {
        card.addEventListener('click', function (e) {
          var b = e.target.closest('.pick');
          if (!b) return;
          var id = b.getAttribute('data-bg');
          Kit.sfx.tap();
          if (id !== scene.bg) {
            scene.checkpoint(); scene.setBg(id); renderBg(); bgEl.setAttribute('data-bg', id); save();
            Kit.sfx.good();
          }
          close(id);
        });
      }
    });
  }
  $('#bg-btn').addEventListener('click', openBackdrops);

  function openGallery() {
    if (Kit.overlayOpen()) return;
    endAll();
    var list = M.gallery();
    var html = '<div class="pick-grid">' +
      '<button class="pick pick-new" data-act="new" aria-label="New scene"><span class="plus">' + Kit.icon('new') + '</span></button>' +
      '<div class="gal-item"><button class="pick on" data-act="now" aria-label="This scene">' + thumb(scene.toJSON()) + '</button><span class="gal-now">' + Kit.icon('star') + '</span></div>' +
      list.map(function (d) {
        return '<div class="gal-item" data-id="' + Kit.esc(d.id) + '"><button class="pick" data-act="open" aria-label="Open this scene">' + thumb(d) + '</button>' +
          '<button class="k-btn k-btn--icon k-btn--bad gal-del" data-act="del" aria-label="Throw this scene away">' + ico('bin') + '</button></div>';
      }).join('') + '</div>';
    Kit.sfx.open();
    Kit.sheet({
      title: 'My scenes', html: html, buttons: [],
      onOpen: function (card, close) {
        card.addEventListener('click', function (e) {
          var b = e.target.closest('[data-act]');
          if (!b) return;
          var a = b.getAttribute('data-act'), item = b.closest('.gal-item'), id = item && item.getAttribute('data-id');
          Kit.sfx.tap();
          if (a === 'now') { close('now'); return; }
          if (a === 'new') { close('new'); return; }
          if (a === 'open') { close({ open: id }); return; }
          if (a === 'del') {
            Kit.confirm({ emoji: '🗑️', title: 'Throw it away?', text: 'This picture will be gone for good.', yes: 'Throw away', no: 'Keep it', danger: true })
              .then(function (yes) {
                if (!yes) return;
                M.removeSaved(id);
                if (item.parentNode) item.parentNode.removeChild(item);
                Kit.sfx.pop(300);
                statN = -1; save();
              });
          }
        });
      }
    }).then(function (v) {
      if (v === 'new') newScene();
      else if (v && v.open) openSaved(v.open);
    });
  }
  $('#gallery-btn').addEventListener('click', openGallery);

  function swapTo(next) {
    setAlive(false);
    scene = next;
    sel = null;
    renderAll();
    bgEl.setAttribute('data-bg', scene.bg);
    statN = -1;
    save();
  }
  function newScene() {
    M.archive(scene);
    swapTo(new M.Scene({ bg: scene.bg }, valid));
    Kit.sfx.open();
    setTimeout(openBackdrops, 250);
  }
  function openSaved(id) {
    var d = M.take(id);
    if (!d) return;
    M.archive(scene);
    swapTo(new M.Scene(d, valid));
    Kit.sfx.good();
  }

  /* ---------- help, sound ---------- */
  var HOW = [
    { emoji: '🏞️', text: 'Tap the <b>picture</b> button to pick a place.' },
    { emoji: '👆', text: '<b>Tap</b> a sticker in the tray, or <b>pull it</b> onto the picture.' },
    { emoji: '🐮', text: 'Tap it to make it move. Big buttons or two fingers: bigger, flip, turn.' },
    { emoji: '🗑️', text: 'Drag it back to the tray to take it away. 🎁 adds a surprise!' }
  ];
  $$('.help-btn').forEach(function (b) { Kit.bindHelp(b, 'scene', HOW, { title: 'Make a picture', button: "Let's make one!" }); });
  $$('.mute-btn').forEach(function (b) { Kit.bindMute(b); });

  /* ---------- resizing, saving on the way out ---------- */
  function relayout() { measure(); layoutAll(); layoutTray(); }
  if (window.ResizeObserver) { var ro = new ResizeObserver(relayout); ro.observe(sceneEl); ro.observe(wrapEl); }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', function () { setTimeout(relayout, 250); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { endAll(); M.saveCurrent(scene); } });
  window.addEventListener('pagehide', function () { M.saveCurrent(scene); });

  /* ---------- start ---------- */
  var saved = M.loadCurrent(valid);
  var firstTime = !saved && !Kit.raw('arcade.howto.scene') && !M.gallery().length;
  scene = saved || new M.Scene({ bg: 'farm', items: firstTime ? [
    { s: 'sun', x: 0.86, y: 0.15, k: 0.15 }, { s: 'cloud', x: 0.6, y: 0.14, k: 0.19 },
    { s: 'cow', x: 0.42, y: 0.76, k: 0.2 }, { s: 'tractor', x: 0.74, y: 0.8, k: 0.22 }, { s: 'chick', x: 0.2, y: 0.84, k: 0.09 }
  ] : [] }, valid);
  measure();
  buildTabs(); buildGrid();
  renderAll();
  bgEl.setAttribute('data-bg', scene.bg);
  layoutTray();
  save();
  if (!Kit.overlayOpen()) Kit.howTo('scene', HOW, { title: 'Make a picture', button: "Let's make one!" });

  /* for tests and screenshots (tools/shot.mjs --js="...") */
  window.__scene = {
    scene: function () { return scene; },
    add: function (sid, x, y, k, r, f) {
      var m = A.meta(sid);
      if (!m) return null;
      var it = scene.add(sid, x, y, k || m.k, r || 0, f);
      if (!it) return null;
      var el = makeEl(it); place(el, it); layerEl.appendChild(el); els[it.u] = el; save();
      return it.u;
    },
    select: select, setBg: function (id) { scene.setBg(id); renderBg(); save(); },
    backdrops: openBackdrops, gallery: openGallery, surprise: surprise, alive: setAlive, newScene: newScene,
    clear: function () { scene.clear(); renderStickers(); save(); },
    tab: function (c) { cat = c; buildTabs(); buildGrid(); layoutTray(); },
    /* every sticker of one group (or all) on a plain page, for checking the art */
    sheet: function (c, size) {
      size = size || 150;
      var list = c ? A.inCat(c) : A.all();
      document.body.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#9fd8a0;min-height:100%;overflow:auto;height:100%">' +
        list.map(function (m) {
          return '<div style="width:' + size + 'px;text-align:center;font:600 11px sans-serif;color:#123"><div style="width:' + size + 'px;height:' + size + 'px;background:#cfeeff;border-radius:10px">' + A.svg(m.id) + '</div>' + m.id + '</div>';
        }).join('') + '</div>';
      document.documentElement.style.overflow = 'auto';
    },
    bgSheet: function () {
      document.body.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">' + bgList().map(function (b) {
        return '<div style="width:380px;font:600 12px sans-serif;color:#fff"><div style="width:380px;height:285px">' + A.backdropSVG(b.id) + '</div>' + b.id + '</div>';
      }).join('') + '</div>';
      A.install();
      document.documentElement.style.overflow = 'auto';
    }
  };
})();
