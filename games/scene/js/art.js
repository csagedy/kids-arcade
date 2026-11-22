/* Scene Maker art: backdrops (viewBox 400 x 300, the scene's 4:3) and
   stickers (viewBox 100 x 100), all hand-written inline SVG in one chunky
   style: a dark ink outline, flat candy fills, a white shine, dot eyes that
   blink (class "eye"). Stickers sit inside one <g> that carries the outline,
   so every shape is outlined unless wrapped in N() (no stroke).

   More stickers are added by art-build.js (construction) and art-sea.js
   (marine life) through SceneArt.def, using the helpers in SceneArt.h.

   SceneArt.install() adds one hidden <svg> with the shared gradients plus a
   <symbol> per sticker and backdrop, so the tray, the backdrop picker and
   the gallery thumbnails are cheap <use> references. Stickers placed on
   the scene are inlined (SceneArt.svg) so their eyes can blink. */
var SceneArt = (function () {
  'use strict';
  var A = {};
  var INK = '#2b2347';

  /* ---------- drawing helpers ---------- */
  function f(v) { return Math.round(v * 100) / 100; }
  function P(d, fill, x) { return '<path d="' + d + '" fill="' + (fill || 'none') + '"' + (x || '') + '/>'; }
  function C(cx, cy, r, fill, x) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + (fill || 'none') + '"' + (x || '') + '/>'; }
  function E(cx, cy, rx, ry, fill, x) { return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + (fill || 'none') + '"' + (x || '') + '/>'; }
  function R(x, y, w, h, r, fill, xx) { return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(r || 0) + '" fill="' + (fill || 'none') + '"' + (xx || '') + '/>'; }
  function N(s) { return '<g stroke="none">' + s + '</g>'; }
  function G(s, tr, cls) { return '<g' + (tr ? ' transform="' + tr + '"' : '') + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</g>'; }
  function rot(a, x, y) { return ' transform="rotate(' + a + ' ' + x + ' ' + y + ')"'; }
  function sw(w) { return ' stroke-width="' + w + '"'; }
  function st(c, w) { return ' stroke="' + c + '"' + (w ? sw(w) : ''); }
  function op(o) { return ' opacity="' + o + '"'; }
  /* overlapping circles with one clean outline (clouds, wool, leaves) */
  function puff(list, fill) {
    var c = list.map(function (a) { return C(a[0], a[1], a[2], fill); }).join('');
    return '<g stroke-width="6">' + c + '</g>' + N(c);
  }
  /* a thick outlined line (tails, trunks, arms, booms) */
  function tube(d, col, w) { return P(d, 'none', sw(w + 6)) + P(d, 'none', st(col, w)); }
  function eye(x, y, r) {
    return '<g class="eye">' + C(x, y, r, INK, ' stroke="none"') + C(x + r * 0.36, y - r * 0.38, r * 0.4, '#fff', ' stroke="none"') + '</g>';
  }
  function eyes(x1, x2, y, r) { return eye(x1, y, r) + eye(x2, y, r); }
  /* an eye on a white disc (for dark faces) */
  function eyeW(x, y, r) { return C(x, y, r * 1.55, '#fff', sw(2)) + eye(x + r * 0.15, y + r * 0.1, r); }
  function smile(x, y, w) { return P('M' + f(x - w) + ' ' + f(y) + 'q' + f(w) + ' ' + f(w * 0.85) + ' ' + f(2 * w) + ' 0', 'none', sw(2.6)); }
  function cheek(x, y, r) { return N(E(x, y, r, r * 0.7, '#ff8fb1', op(0.75))); }
  function cheeks(x1, x2, y, r) { return cheek(x1, y, r) + cheek(x2, y, r); }
  function shine(x, y, rx, ry, a) { return N(E(x, y, rx, ry, '#fff', op(0.55) + (a ? rot(a, x, y) : ''))); }
  function wheel(x, y, r, hub) { return C(x, y, r, '#3b3350') + C(x, y, r * 0.52, hub || '#e6e3f2') + N(C(x, y, r * 0.17, '#3b3350')); }
  function ring(cx, cy, rr, r, n, a0) {
    var out = [];
    for (var i = 0; i < n; i++) { var a = (a0 || 0) + i * Math.PI * 2 / n; out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a), r]); }
    return out;
  }
  /* star outline: n points, outer R, inner r */
  function starD(cx, cy, Ro, ri, n, a0) {
    var d = '';
    for (var i = 0; i < n * 2; i++) {
      var a = (a0 === undefined ? -Math.PI / 2 : a0) + i * Math.PI / n, rr = i % 2 ? ri : Ro;
      d += (i ? 'L' : 'M') + f(cx + rr * Math.cos(a)) + ' ' + f(cy + rr * Math.sin(a));
    }
    return d + 'Z';
  }
  /* a cubic centre line p0..p3 turned into a filled shape that narrows from
     w0 to w1 with a round tip: arms, tentacles, tails, kelp. Returns
     { d, at(t, side) } so callers can dot things (suckers) along it. */
  function bez(p, t) {
    var u = 1 - t;
    return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
            u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]];
  }
  function bezN(p, t) {
    var a = bez(p, Math.max(0, t - 0.01)), b = bez(p, Math.min(1, t + 0.01));
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    return [-dy / l, dx / l];
  }
  function taper(p, w0, w1, n) {
    n = n || 14;
    var L = [], Rr = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, q = bez(p, t), nn = bezN(p, t), w = (w0 + (w1 - w0) * t) / 2;
      L.push(f(q[0] + nn[0] * w) + ' ' + f(q[1] + nn[1] * w));
      Rr.push(f(q[0] - nn[0] * w) + ' ' + f(q[1] - nn[1] * w));
    }
    var wt = Math.max(0.5, w1 / 2);
    var d = 'M' + L.join('L') + 'A' + f(wt) + ' ' + f(wt) + ' 0 0 1 ' + Rr[n] + 'L' + Rr.reverse().join('L') + 'Z';
    return {
      d: d,
      at: function (t, side) {
        var q = bez(p, t), nn = bezN(p, t), w = (w0 + (w1 - w0) * t) / 2 * (side || 0);
        return [q[0] + nn[0] * w, q[1] + nn[1] * w];
      }
    };
  }
  function limb(p, w0, w1, fill) { return P(taper(p, w0, w1).d, fill); }
  /* track with rollers (diggers, bulldozers) */
  function track(x, y, w, h, n) {
    var s = R(x, y, w, h, h / 2, '#3b3350'), r = h * 0.3;
    n = n || 4;
    for (var i = 0; i < n; i++) s += C(x + h / 2 + i * (w - h) / (n - 1), y + h / 2, r, '#9aa0bd', sw(2));
    return s + N(R(x + h / 2, y + 1.6, w - h, 2, 1, '#6b6788'));
  }
  A.h = { INK: INK, f: f, P: P, C: C, E: E, R: R, N: N, G: G, rot: rot, sw: sw, st: st, op: op, puff: puff, tube: tube,
    eye: eye, eyes: eyes, eyeW: eyeW, smile: smile, cheek: cheek, cheeks: cheeks, shine: shine, wheel: wheel, ring: ring,
    starD: starD, taper: taper, limb: limb, track: track };

  /* ---------- the sticker registry ---------- */
  /* Tabs: each shows one of its own stickers as the picture. */
  A.CATS = [
    { id: 'farm', icon: 'cow', name: 'Farm animals' },
    { id: 'build', icon: 'excavator', name: 'Building site' },
    { id: 'sea', icon: 'clownfish', name: 'Sea life' },
    { id: 'wild', icon: 'lion', name: 'Wild animals' },
    { id: 'people', icon: 'girl', name: 'People' },
    { id: 'go', icon: 'tractor', name: 'Things that go' },
    { id: 'food', icon: 'apple', name: 'Plants and food' },
    { id: 'sky', icon: 'sun', name: 'Sky and weather' },
    { id: 'places', icon: 'house', name: 'Buildings and things' },
    { id: 'silly', icon: 'partyhat', name: 'Silly' }
  ];
  var LIST = [], BY = {};
  /* def(id, name, cat, k, place, act, snd, alive, draw)
       k      default size (fraction of the scene's width)
       place  where Surprise and tap-to-add put it: sky | ground | water | any
       act    what a tap does: hop wiggle spin pulse sway dig tip lift rock swim flap
       snd    sound name (ui.js), alive = idle motion while playing:
              bob drift sway twinkle float rock swim */
  A.def = function (id, name, cat, k, place, act, snd, alive, draw) {
    var m = { id: id, name: name, cat: cat, k: k, place: place, act: act, snd: snd, alive: alive, draw: draw, body: null };
    LIST.push(m); BY[id] = m;
    return m;
  };
  A.meta = function (id) { return BY[id] || null; };
  A.all = function () { return LIST; };
  A.inCat = function (c) { return LIST.filter(function (m) { return m.cat === c; }); };
  A.body = function (id) {
    var m = BY[id];
    if (!m) return '';
    if (m.body === null) {
      try { m.body = '<g stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' + m.draw() + '</g>'; }
      catch (e) { m.body = ''; }
    }
    return m.body;
  };
  A.svg = function (id) { return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + A.body(id) + '</svg>'; };
  A.use = function (id) { return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#sm-st-' + id + '"/></svg>'; };
  var def = A.def;

  /* ======================= farm animals ======================= */
  def('cow', 'Cow', 'farm', 0.2, 'ground', 'hop', 'moo', 'bob', function () {
    var W = '#fff', H = '#8a7a9a';
    return P('M20 44q-11 3-9 18') + E(11.5, 63, 3.5, 5, INK) +
      E(47, 68, 8, 5, '#ffb3c1') +
      R(22, 56, 9, 26, 4, W) + R(34, 58, 9, 24, 4, W) + R(52, 58, 9, 24, 4, W) + R(64, 56, 9, 26, 4, W) +
      R(22, 78, 9, 6, 3, H) + R(34, 78, 9, 6, 3, H) + R(52, 78, 9, 6, 3, H) + R(64, 78, 9, 6, 3, H) +
      R(14, 34, 64, 32, 16, W) +
      N(P('M27 37q12-2 13 7q1 9-9 9q-9 0-8-9z', INK) + P('M48 50q9-4 12 3q2 8-6 10q-9 1-9-6z', INK) + C(22, 56, 3, INK)) +
      P('M68 30q-7-9-1-15q1 7 6 10z', '#ffe7a0') + P('M84 30q7-9 1-15q-1 7-6 10z', '#ffe7a0') +
      E(60, 35, 7, 3.6, W, rot(-25, 60, 35)) + E(92, 35, 7, 3.6, W, rot(25, 92, 35)) +
      E(76, 41, 14, 13, W) + N(P('M80 29q8 1 9 9q-6 1-9-9z', INK)) +
      E(76, 52, 12, 8, '#ffb3c1') + N(E(72, 52, 1.7, 2.3, INK) + E(80, 52, 1.7, 2.3, INK)) +
      eyes(70, 82, 39, 2.8) + shine(30, 58, 6, 2.5, -10);
  });
  def('pig', 'Pig', 'farm', 0.18, 'ground', 'hop', 'oink', 'bob', function () {
    var K = '#ffb0c8', D = '#ff86aa';
    return P('M17 52q-8-1-7-7q1-5 6-3q4 3-1 7q-4 2-7 0') +
      R(24, 62, 9, 20, 4, K) + R(36, 64, 9, 18, 4, K) + R(52, 64, 9, 18, 4, K) + R(64, 62, 9, 20, 4, K) +
      E(46, 55, 32, 21, K) + shine(32, 44, 9, 3.5, -20) +
      P('M63 34L60 19L73 28z', D) + P('M89 34L92 19L79 28z', D) +
      C(76, 44, 15, K) +
      E(76, 50, 8, 6, D) + N(E(73, 50, 1.6, 2.4, INK) + E(79, 50, 1.6, 2.4, INK)) +
      eyes(70, 82, 40, 2.6) + cheeks(65, 87, 47, 2.8);
  });
  def('sheep', 'Sheep', 'farm', 0.18, 'ground', 'hop', 'baa', 'bob', function () {
    var O = '#fffaf0', F = '#5d4f72';
    return R(30, 62, 7, 22, 3, F) + R(40, 64, 7, 20, 3, F) + R(52, 64, 7, 20, 3, F) + R(62, 62, 7, 22, 3, F) +
      puff([[28, 52, 12], [38, 42, 13], [52, 40, 13], [64, 46, 12], [64, 60, 12], [50, 64, 13], [36, 63, 12], [24, 60, 9]], O) +
      E(64, 42, 7, 3.6, F, rot(-25, 64, 42)) + E(90, 42, 7, 3.6, F, rot(25, 90, 42)) +
      E(77, 47, 11, 13, F) +
      puff([[71, 35, 5], [77, 32, 6], [83, 35, 5]], O) +
      eyeW(72.5, 46, 2.2) + eyeW(82, 46, 2.2) +
      P('M74 54q3 3 6 0', 'none', st('#fff', 2)) + shine(36, 40, 6, 3, -20);
  });
  def('hen', 'Hen', 'farm', 0.15, 'ground', 'hop', 'cluck', 'bob', function () {
    return P('M44 76v12l-5 4M44 88l5 4M56 76v12l-5 4M56 88l5 4', 'none', st('#f39c12', 3.5)) +
      P('M26 54q-14-10-8-26q6 8 10 10q-2-11 7-17q4 10 6 20z', '#fff') +
      E(50, 60, 26, 20, '#fff') +
      P('M34 58q13-9 27 0q-7 13-27 0z', '#ecebff') +
      puff([[66, 21, 4], [71, 18, 4.6], [76, 21, 4]], '#ff5d73') +
      C(71, 33, 12, '#fff') +
      P('M82 30l11 4l-11 4z', '#ffb52e') +
      E(80, 43, 3, 5, '#ff5d73') +
      eye(74, 30, 2.6) + cheek(70, 37, 2.4);
  });
  def('chick', 'Chick', 'farm', 0.1, 'ground', 'hop', 'cheep', 'bob', function () {
    var O = '#ff9f43';
    return P('M40 82l-5 7M40 82v8M40 82l5 7M60 82l-5 7M60 82v8M60 82l5 7', 'none', st(O, 3)) +
      E(22, 58, 7, 11, '#f5c400', rot(-20, 22, 58)) + E(78, 58, 7, 11, '#f5c400', rot(20, 78, 58)) +
      C(50, 55, 28, '#ffdd4d') +
      P('M47 28q-4-10 3-12M51 28q4-10 11-6') +
      shine(38, 40, 7, 4, -30) +
      eyes(40, 60, 50, 3.4) + P('M44 57l6-5l6 5l-6 5z', O) + cheeks(33, 67, 60, 3.2);
  });
  def('duck', 'Duck', 'farm', 0.16, 'water', 'hop', 'quack', 'swim', function () {
    var W = '#fff';
    return E(40, 83, 6, 2.5, '#ff9f43') + E(56, 83, 6, 2.5, '#ff9f43') +
      P('M18 60l-9-13l17 6z', W) +
      R(62, 38, 14, 24, 7, W) +
      E(46, 66, 32, 17, W) +
      N(R(63.5, 40, 11, 20, 5, W)) +
      P('M30 62q16-10 30 2q-14 12-30-2z', '#e9ebff') +
      C(70, 36, 13, W) +
      P('M80 33q14-2 14 4q0 6-14 5z', '#ff9f43') + P('M83 37.5h10', 'none', sw(2)) +
      eye(73, 32, 2.6) + cheek(69, 40, 2.6);
  });
  def('horse', 'Horse', 'farm', 0.22, 'ground', 'hop', 'neigh', 'bob', function () {
    var B = '#c98048', M = '#5b3a22', H = '#4a3f63';
    return P('M17 44q-12 6-8 28q6-4 10-16z', M) +
      R(20, 56, 8, 30, 3, B) + R(31, 58, 8, 28, 3, B) + R(55, 58, 8, 28, 3, B) + R(66, 56, 8, 30, 3, B) +
      R(20, 82, 8, 6, 2, H) + R(31, 82, 8, 6, 2, H) + R(55, 82, 8, 6, 2, H) + R(66, 82, 8, 6, 2, H) +
      R(14, 36, 62, 28, 14, B) +
      N(P('M58 46L64 18L79 16L75 50z', B)) + P('M60 37L64 18M79 16L75 47') +
      P('M66 9q-9 6-6 14q-6 5-3 12q-5 5 0 12l5-2L66 18z', M) +
      E(80, 22, 16, 10, B, rot(32, 80, 22)) +
      E(88, 28, 7.5, 6, '#e8a878', rot(32, 88, 28)) + N(E(91, 28, 1.5, 2, INK)) +
      P('M69 12l1-10l8 7z', B) +
      eye(77, 17, 2.6) + shine(28, 42, 7, 2.6, -8);
  });
  def('dog', 'Dog', 'farm', 0.15, 'ground', 'hop', 'woof', 'bob', function () {
    var T = '#e3a868', B = '#8a5a35', L = '#fff4e2';
    return tube('M66 82q16-4 14-20', T, 5) +
      E(50, 72, 19, 18, T) + E(50, 70, 9, 11, L) +
      E(41, 88, 7, 4.5, L) + E(59, 88, 7, 4.5, L) +
      C(50, 40, 19, T) + N(E(59, 35, 7, 6, B)) +
      E(32, 42, 7, 14, B, rot(18, 32, 42)) + E(68, 42, 7, 14, B, rot(-18, 68, 42)) +
      E(50, 48, 10, 7, L) + E(50, 45, 4, 3, INK) +
      P('M46 50q2 3 4 0q2 3 4 0', 'none', sw(2)) + E(52, 54, 2.6, 3.2, '#ff7a9a', sw(2)) +
      eyes(42, 58, 36, 3);
  });
  def('cat', 'Cat', 'farm', 0.14, 'ground', 'wiggle', 'meow', 'bob', function () {
    var O = '#ffa64d', S = '#e07a1f', L = '#fff1de';
    return tube('M66 84q20 0 18-18q-1-8-7-8', O, 5) +
      E(50, 72, 18, 18, O) + E(50, 72, 9, 12, L) +
      E(43, 88, 6.5, 4, L) + E(57, 88, 6.5, 4, L) +
      P('M33 34L34 14L48 27z', O) + P('M67 34L66 14L52 27z', O) +
      N(P('M36.5 29L37 19.5L43.5 26z', '#ffb3c1') + P('M63.5 29L63 19.5L56.5 26z', '#ffb3c1')) +
      E(50, 40, 19, 16, O) +
      N(P('M44 25l2 6l2-6zM49 24l1 7l1-7zM54 25l2 6l2-6z', S)) +
      eyes(42, 58, 39, 3) +
      P('M48 45l2 2.2l2-2.2z', '#ff7a9a', sw(1.5)) + P('M46 48q2 2 4 0q2 2 4 0', 'none', sw(2)) +
      P('M37 45l-12-2M37 48l-12 2M63 45l12-2M63 48l12 2', 'none', sw(1.8));
  });
  def('bunny', 'Bunny', 'farm', 0.12, 'ground', 'hop', 'squeak', 'bob', function () {
    var G = '#ece7f7', K = '#ffb3c8';
    return E(41, 24, 7, 17, G, rot(-8, 41, 24)) + E(59, 24, 7, 17, G, rot(8, 59, 24)) +
      N(E(41, 25, 3, 11, K, rot(-8, 41, 25)) + E(59, 25, 3, 11, K, rot(8, 59, 25))) +
      E(50, 74, 18, 17, G) +
      E(41, 89, 8, 4.5, G) + E(59, 89, 8, 4.5, G) +
      C(50, 49, 16, G) +
      eyes(44, 56, 46, 2.8) + E(50, 52, 2.6, 2, K, sw(1.5)) +
      P('M50 54v2.5M47 57q3 2 3-1q0 3 3 1', 'none', sw(1.8)) + cheeks(40, 60, 54, 2.8);
  });

  /* ======================= wild animals ======================= */
  def('lion', 'Lion', 'wild', 0.2, 'ground', 'hop', 'roar', 'bob', function () {
    var M = '#e08a2c', F = '#ffc65a';
    return tube('M64 84q20 0 22-16', F, 5) + C(86, 66, 5, M) +
      E(50, 79, 19, 13, F) + E(41, 90, 6, 3.5, F) + E(59, 90, 6, 3.5, F) +
      puff(ring(50, 43, 20, 9.5, 12), M) +
      C(35, 29, 6, F) + C(65, 29, 6, F) +
      C(50, 45, 17, F) +
      N(E(45, 52, 6, 4.5, '#fff1d6') + E(55, 52, 6, 4.5, '#fff1d6')) +
      P('M46 47h8l-4 4.5z', '#7a3f2a', sw(2)) +
      eyes(43, 57, 41, 2.8) + cheeks(37, 63, 50, 2.6);
  });
  def('elephant', 'Elephant', 'wild', 0.24, 'ground', 'hop', 'trumpet', 'bob', function () {
    var L = '#9fb0dc', I = '#c9d3f2';
    return P('M17 50q-8 6-6 14') +
      R(22, 60, 12, 26, 5, L) + R(36, 62, 12, 24, 5, L) + R(52, 62, 12, 24, 5, L) + R(64, 60, 12, 26, 5, L) +
      N(P('M24 83h3M38 83h3M54 83h3M66 83h3', 'none', st('#fff', 2.4))) +
      E(44, 54, 30, 22, L) +
      tube('M82 50q8 8 6 20q-1 6 5 7', L, 7) +
      C(72, 42, 17, L) +
      P('M60 30q-16 4-14 22q2 12 16 9q6-14-2-31z', I) +
      P('M78 54q2 6 9 6q-5-6-4-9z', '#fff') +
      eye(77, 38, 2.6) + cheek(81, 46, 2.6) + shine(32, 42, 8, 3, -15);
  });
  def('giraffe', 'Giraffe', 'wild', 0.26, 'ground', 'hop', 'squeak', 'sway', function () {
    var Y = '#ffcf5a', S = '#d9822f', H = '#6b4a2a';
    return R(30, 64, 7, 30, 3, Y) + R(40, 66, 7, 28, 3, Y) + R(56, 66, 7, 28, 3, Y) + R(66, 64, 7, 30, 3, Y) +
      N(R(30, 90, 7, 4, 1, H) + R(40, 90, 7, 4, 1, H) + R(56, 90, 7, 4, 1, H) + R(66, 90, 7, 4, 1, H)) +
      P('M24 56q-6 8-4 16') + E(20, 73, 2.5, 3.5, H) +
      E(48, 60, 24, 13, Y) +
      N(P('M60 56L66 22L80 22L72 58z', Y)) + P('M61 50L66 22M80 22L72 58') +
      N(C(38, 58, 4, S) + C(50, 64, 3.6, S) + C(57, 55, 3.2, S) + C(30, 62, 2.8, S) + C(43, 52, 2.6, S) +
        C(69, 38, 3, S) + C(68, 50, 3, S) + C(73, 29, 2.4, S)) +
      P('M71 12v-6M79 12v-6') + C(71, 5, 2.6, S) + C(79, 5, 2.6, S) +
      E(67, 15, 5, 2.6, Y, rot(-30, 67, 15)) +
      E(80, 20, 11, 8, Y, rot(20, 80, 20)) +
      E(87, 24, 5.5, 4.5, '#ffe2a6', rot(20, 87, 24)) + N(E(89, 23, 1.3, 1.6, INK)) +
      eye(78, 17, 2.4);
  });
  def('bear', 'Bear', 'wild', 0.18, 'ground', 'hop', 'roar', 'bob', function () {
    var B = '#a86b3c', L = '#e8c28f';
    return C(32, 24, 8, B) + C(68, 24, 8, B) + N(C(32, 24, 4, L) + C(68, 24, 4, L)) +
      E(50, 72, 22, 20, B) + E(50, 74, 12, 13, L) +
      E(30, 68, 7, 11, B, rot(20, 30, 68)) + E(70, 68, 7, 11, B, rot(-20, 70, 68)) +
      E(38, 90, 9, 6, B) + E(62, 90, 9, 6, B) + N(E(38, 90, 5, 3, L) + E(62, 90, 5, 3, L)) +
      C(50, 40, 20, B) +
      E(50, 48, 10, 8, L) + E(50, 44, 4.5, 3.2, INK) +
      P('M50 47v4M46 52q4 3 8 0', 'none', sw(2)) +
      eyes(42, 58, 36, 3) + cheeks(36, 64, 46, 2.6);
  });
  def('fox', 'Fox', 'wild', 0.16, 'ground', 'hop', 'squeak', 'bob', function () {
    var O = '#ff8a3d', W = '#fff';
    return P('M60 84q32 4 28-24q-2-10-10-8q4 18-18 24z', O) + N(P('M82 54q8 2 6 10q-4-4-10-4z', W)) +
      E(50, 76, 16, 16, O) + E(50, 76, 8, 11, W) +
      E(43, 91, 6, 3.5, '#3b3350') + E(57, 91, 6, 3.5, '#3b3350') +
      P('M30 36L32 13L46 30z', O) + P('M70 36L68 13L54 30z', O) +
      N(P('M33 31L34 19L41 28z', '#3b3350') + P('M67 31L66 19L59 28z', '#3b3350')) +
      P('M27 34Q30 52 50 61Q70 52 73 34Q50 25 27 34z', O) +
      N(P('M30 40Q40 54 50 61Q44 48 30 40zM70 40Q60 54 50 61Q56 48 70 40z', W)) +
      C(50, 58, 3.2, INK) +
      eyes(41, 59, 41, 2.8);
  });
  def('owl', 'Owl', 'wild', 0.13, 'sky', 'flap', 'hoot', 'bob', function () {
    var O = '#a3714b', L = '#f3dcb5', D = '#8a5c3a';
    return P('M42 86l-3 5M42 86v6M42 86l3 5M58 86l-3 5M58 86v6M58 86l3 5', 'none', st('#ff9f43', 3)) +
      E(25, 58, 8, 16, D, rot(10, 25, 58)) + E(75, 58, 8, 16, D, rot(-10, 75, 58)) +
      P('M28 34L25 14L42 27z', O) + P('M72 34L75 14L58 27z', O) +
      E(50, 56, 26, 31, O) +
      E(50, 68, 15, 17, L) +
      P('M44 63l2 2l2-2M52 63l2 2l2-2M48 71l2 2l2-2M44 77l2 2l2-2M52 77l2 2l2-2', 'none', st('#c99a6a', 2)) +
      C(39, 41, 10.5, '#fff') + C(61, 41, 10.5, '#fff') +
      eye(40, 42, 5.4) + eye(60, 42, 5.4) +
      P('M46 49l4 7l4-7z', '#ffb52e');
  });
  def('frog', 'Frog', 'wild', 0.14, 'water', 'hop', 'ribbit', 'bob', function () {
    var G = '#5fd068', D = '#3aa84d';
    return E(24, 76, 12, 8, G) + E(76, 76, 12, 8, G) +
      E(50, 66, 26, 20, G) + E(50, 72, 14, 11, '#c9f3a8') +
      E(40, 86, 7, 4, G) + E(60, 86, 7, 4, G) +
      C(36, 42, 11, G) + C(64, 42, 11, G) +
      N(E(50, 54, 25, 15, G)) + P('M26 56q0-14 14-16M74 56q0-14-14-16') +
      C(36, 41, 7, '#fff') + C(64, 41, 7, '#fff') +
      eye(36, 42, 3.6) + eye(64, 42, 3.6) +
      P('M34 58q16 10 32 0', 'none', sw(2.6)) + cheeks(29, 71, 58, 3.4) +
      N(C(28, 70, 2.4, D) + C(72, 70, 2.4, D) + C(66, 76, 1.8, D));
  });
  def('bird', 'Bluebird', 'wild', 0.1, 'sky', 'flap', 'tweet', 'float', function () {
    var B = '#4cb8ff';
    return P('M44 74v7M54 74v7', 'none', st('#ff9f43', 3)) +
      P('M26 52L8 42L12 62z', B) +
      E(46, 56, 24, 19, B) + N(E(52, 63, 14, 10, '#d8f1ff')) +
      P('M28 50q15-8 26 6q-13 11-26-6z', '#2f8fe0') +
      C(66, 40, 14, B) +
      P('M78 37l11 4l-11 4z', '#ffb52e') +
      eye(69, 36, 2.6) + cheek(66, 45, 2.6);
  });
  def('butterfly', 'Butterfly', 'wild', 0.12, 'sky', 'flap', 'chime', 'float', function () {
    return E(30, 36, 20, 16, '#ff7ac6', rot(-25, 30, 36)) + E(70, 36, 20, 16, '#ff7ac6', rot(25, 70, 36)) +
      E(35, 64, 14, 12, '#a77bff', rot(20, 35, 64)) + E(65, 64, 14, 12, '#a77bff', rot(-20, 65, 64)) +
      N(C(27, 33, 6, '#ffd23f') + C(73, 33, 6, '#ffd23f') + C(34, 66, 4.5, '#fff') + C(66, 66, 4.5, '#fff') +
        C(18, 42, 3, '#fff') + C(82, 42, 3, '#fff')) +
      P('M47 21q-6-10-12-12M53 21q6-10 12-12') + C(35, 9, 2.8, INK) + C(65, 9, 2.8, INK) +
      E(50, 52, 6, 24, '#5b4d7a') +
      C(50, 26, 7.5, '#5b4d7a') + N(C(47, 25, 1.9, '#fff') + C(53, 25, 1.9, '#fff')) +
      P('M47 29q3 2 6 0', 'none', st('#fff', 1.6));
  });
  def('bee', 'Bee', 'wild', 0.09, 'sky', 'flap', 'buzz', 'float', function () {
    var Y = '#ffd23f';
    return P('M23 56l-9 2l9 3z', INK) +
      E(50, 56, 28, 20, Y) +
      N(P('M38 38Q34 56 38 74L46 75.5Q42 56 46 36.5zM54 36.5Q50 56 54 75.5L62 74Q58 56 62 38z', INK)) +
      E(50, 56, 28, 20) +
      P('M80 42q2-10 8-12M74 42q-2-10 2-14') + C(88, 30, 2.4, INK) + C(76, 28, 2.4, INK) +
      C(78, 54, 13, Y) +
      eyes(74, 84, 52, 2.4) + smile(79, 58, 3) +
      E(40, 30, 11, 15, '#e6f6ff', op(0.92) + rot(-25, 40, 30)) + E(58, 28, 11, 15, '#e6f6ff', op(0.92) + rot(20, 58, 28));
  });

  /* ======================= people ======================= */
  /* A chibi person, front on. o: skin, hair, style (short | pigtails | bun |
     long | bald), top, legs, shoes, dress, hat (cap | straw | hard), hatc,
     overalls, vest, glasses, beard, hold (shovel | flag | hammer). */
  function person(o) {
    var s = '', k = o.skin, h = o.hair;
    if (o.hold === 'shovel') s += P('M76 26V70', 'none', st('#a0714f', 4)) + P('M70 70h12l-2 14q-4 4-8 0z', '#9aa0bd') + P('M72 24h8', 'none', st('#a0714f', 4));
    if (o.hold === 'flag') s += P('M76 30V72', 'none', st('#6b6788', 3)) + P('M76 30l16 6l-16 6z', '#ff5d4d');
    if (o.hold === 'hammer') s += P('M76 46V72', 'none', st('#a0714f', 4)) + R(68, 40, 16, 8, 2, '#9aa0bd');
    if (o.tank) s += R(30, 42, 40, 30, 8, o.tank);
    if (!o.dress) s += R(40, 68, 8, 20, 3, o.legs) + R(52, 68, 8, 20, 3, o.legs);
    else s += R(41, 72, 6, 16, 3, k) + R(53, 72, 6, 16, 3, k);
    s += o.fins ? P('M36 86h12l2 10h-16zM52 86h12l2 10h-16z', o.fins) : E(43, 89, 7, 4, o.shoes) + E(57, 89, 7, 4, o.shoes);
    s += tube('M39 52L29 64', o.top, 7) + tube('M61 52L71 64', o.top, 7) + C(28, 66, 4.5, k) + C(72, 66, 4.5, k);
    s += o.dress ? P('M39 46H61L70 76Q50 80 30 76z', o.top) : R(36, 46, 28, 26, 9, o.top);
    if (o.overalls) s += R(42, 52, 16, 16, 3, o.overalls) + P('M42 54L39 47M58 54L61 47', 'none', st(o.overalls, 3.5)) + N(C(44.5, 56, 1.6, '#ffd23f') + C(55.5, 56, 1.6, '#ffd23f'));
    if (o.vest) s += P('M38 48H45V72H38zM55 48H62V72H55z', o.vest) + N(R(38, 60, 7, 3, 0, '#e8f0ff') + R(55, 60, 7, 3, 0, '#e8f0ff'));
    if (o.style === 'pigtails') s += C(31, 31, 7, h) + C(69, 31, 7, h) + N(P('M25 23l5 3l-5 3zM75 23l-5 3l5 3z', '#ff7ac6'));
    if (o.style === 'bun') s += C(50, 13, 8, h);
    if (o.style === 'long') s += R(32, 22, 36, 30, 12, h);
    s += C(50, 30, 16, k);
    if (o.style !== 'bald') s += P('M34 29Q34 13 50 13Q66 13 66 29Q60 21 50 22Q40 21 34 29z', h);
    if (o.beard) s += P('M38 34q12 18 24 0q-4 8-12 8q-8 0-12-8z', o.beard);
    if (o.hat === 'cap') s += P('M34 27Q34 11 50 11Q66 11 66 27z', o.hatc) + P('M58 25Q74 22 80 28Q70 31 58 28z', o.hatc);
    if (o.hat === 'straw') s += E(50, 19, 25, 5.5, '#ffd27a') + P('M38 19Q38 5 50 5Q62 5 62 19z', '#ffd27a') + N(R(38.5, 14, 23, 4, 0, '#ff5d73'));
    if (o.hat === 'hard') s += P('M33 26Q33 9 50 9Q67 9 67 26z', o.hatc) + R(30, 24, 40, 5, 2.5, o.hatc) + N(R(47, 10, 6, 14, 2, '#fff', op(0.35)));
    if (o.mask) s += R(37, 24, 26, 13, 6, '#bfe9ff') + P('M37 30H33M63 30h4', 'none', st('#3b3350', 3));
    s += o.mask ? eyes(44, 56, 30.5, 2.4) : eyes(44, 56, 31, 2.6);
    s += o.mask ? C(50, 41, 3, '#ffd23f') : smile(50, 36.5, 4) + cheeks(39, 61, 36, 2.6);
    if (o.glasses) s += C(44, 31, 5) + C(56, 31, 5) + P('M49 31h2', 'none', sw(2));
    return s;
  }
  A.h.person = person;
  def('boy', 'Boy', 'people', 0.15, 'ground', 'hop', 'hello', 'bob', function () {
    return person({ skin: '#f6c7a0', hair: '#7a4a2a', style: 'short', top: '#4cc2ff', legs: '#3b4a9a', shoes: '#ff5d73', hat: 'cap', hatc: '#ff5d73' });
  });
  def('girl', 'Girl', 'people', 0.15, 'ground', 'hop', 'hello', 'bob', function () {
    return person({ skin: '#c98a5e', hair: '#3b2a20', style: 'pigtails', top: '#ff7ac6', dress: true, shoes: '#a77bff' });
  });
  def('farmer', 'Farmer', 'people', 0.16, 'ground', 'hop', 'hello', 'bob', function () {
    return person({ skin: '#e9b48a', hair: '#8a5a35', style: 'short', top: '#ff5d73', legs: '#4c7dff', overalls: '#4c7dff', shoes: '#6b4a2a', hat: 'straw', beard: '#8a5a35' });
  });
  def('grandma', 'Grandma', 'people', 0.15, 'ground', 'hop', 'hello', 'bob', function () {
    return person({ skin: '#f6d0b0', hair: '#d6d9ec', style: 'bun', top: '#a77bff', dress: true, shoes: '#6b4a2a', glasses: true });
  });
  def('baby', 'Baby', 'people', 0.1, 'ground', 'wiggle', 'baby', 'bob', function () {
    var K = '#f6c7a0', Y = '#ffe066';
    return E(34, 86, 10, 7, Y) + E(66, 86, 10, 7, Y) + C(26, 88, 5, K) + C(74, 88, 5, K) +
      E(50, 74, 20, 16, Y) + N(R(46, 64, 8, 4, 2, '#ffb52e')) +
      tube('M34 68L26 78', Y, 7) + tube('M66 68L74 78', Y, 7) + C(25, 80, 4.5, K) + C(75, 80, 4.5, K) +
      C(50, 42, 21, K) +
      P('M50 21q-3-8 3-10q6 0 3 6', 'none', st('#c98a5e', 3)) +
      eyes(42, 58, 42, 3) + cheeks(36, 64, 49, 3.2) +
      E(50, 52, 5, 3.4, '#ff7ac6') + C(50, 52, 1.6, '#fff', ' stroke="none"');
  });
  def('astronaut', 'Astronaut', 'people', 0.16, 'sky', 'float', 'whoosh', 'float', function () {
    var W = '#f4f2ff', G = '#c9cde3';
    return R(30, 40, 40, 30, 6, G) +
      R(38, 66, 10, 20, 4, W) + R(52, 66, 10, 20, 4, W) + R(36, 82, 13, 8, 3, '#6b6788') + R(51, 82, 13, 8, 3, '#6b6788') +
      tube('M38 50L26 62', W, 9) + tube('M62 50L74 62', W, 9) + C(25, 64, 5.5, G) + C(75, 64, 5.5, G) +
      R(34, 42, 32, 30, 10, W) + R(42, 50, 16, 10, 2, '#4cc2ff') + N(C(45, 66, 2, '#ff5d73') + C(51, 66, 2, '#ffd23f') + C(57, 66, 2, '#3ddc84')) +
      C(50, 28, 18, W) + E(50, 29, 12, 10.5, '#bfe6ff') +
      eyes(45, 55, 28, 2.4) + smile(50, 32, 3.4) + cheeks(41, 59, 32, 2.2) +
      shine(43, 23, 4, 2, -30) + R(47, 7, 6, 4, 1, G);
  });

  /* ======================= things that go ======================= */
  def('tractor', 'Tractor', 'go', 0.24, 'ground', 'rock', 'putt', 'rock', function () {
    var D = '#ff5d4d', G = '#bfe9ff';
    return R(64, 22, 6, 22, 2, '#6b6880') + N(C(67, 16, 4, '#e6e3f2', op(0.8)) + C(73, 10, 3, '#e6e3f2', op(0.6))) +
      R(48, 42, 44, 22, 6, D) + P('M84 46v14M88 46v14', 'none', st('#c9363a', 2)) +
      R(20, 18, 34, 6, 3, D) + R(22, 22, 30, 44, 5, D) + R(27, 27, 20, 18, 3, G) + shine(31, 31, 3, 6, 20) +
      tube('M10 66Q12 44 34 44Q56 44 58 66', D, 5) +
      wheel(34, 68, 20, '#ffd23f') + wheel(80, 76, 12, '#ffd23f') +
      C(90, 50, 3, '#ffd23f');
  });
  def('car', 'Car', 'go', 0.2, 'ground', 'rock', 'honk', 'rock', function () {
    var B = '#4cc2ff', G = '#d8f3ff';
    return P('M8 64Q8 50 22 48L30 32Q34 26 44 26H62Q70 26 74 34L80 48Q92 50 92 62V68H8z', B) +
      P('M34 46L39 33Q41 31 45 31H52V46z', G) + P('M56 31H61Q66 31 68 35L72 46H56z', G) +
      P('M54 48h6', 'none', sw(2.6)) + shine(26, 54, 8, 2.5) +
      wheel(27, 68, 11) + wheel(73, 68, 11) +
      E(89, 56, 2.6, 4, '#ffd23f') + E(10, 58, 2, 3, '#ff5d73');
  });
  def('truck', 'Farm truck', 'go', 0.24, 'ground', 'rock', 'honk', 'rock', function () {
    var T = '#2ec4a8', G = '#d8f3ff';
    return R(10, 34, 30, 20, 3, '#ffd27a') + P('M18 36v16M32 36v16', 'none', st('#c98a4a', 2.4)) +
      R(8, 52, 48, 16, 3, T) +
      P('M54 68V34Q54 28 60 28H74Q80 28 84 36L90 50Q94 52 94 58V68z', T) +
      P('M60 34H72Q76 34 78 38L83 50H60z', G) + shine(30, 57, 10, 2) +
      wheel(26, 70, 11) + wheel(76, 70, 11) + E(92, 58, 2, 3.5, '#ffd23f');
  });
  def('bus', 'Bus', 'go', 0.26, 'ground', 'rock', 'honk', 'rock', function () {
    var Y = '#ffd23f', G = '#d8f3ff';
    return R(6, 28, 88, 42, 10, Y) +
      R(13, 36, 14, 14, 3, G) + R(31, 36, 14, 14, 3, G) + R(49, 36, 14, 14, 3, G) + R(68, 36, 20, 16, 3, G) +
      N(R(6, 56, 88, 4, 0, '#2b2347')) + R(68, 54, 12, 14, 2, '#ffe680') +
      wheel(24, 72, 10) + wheel(74, 72, 10) +
      E(91, 62, 2.4, 3.4, '#fff7c2') + shine(30, 32, 16, 1.6);
  });
  def('train', 'Train', 'go', 0.24, 'ground', 'rock', 'toot', 'rock', function () {
    return puff([[62, 12, 5], [70, 8, 6], [80, 9, 4.5]], '#eef0ff') +
      R(12, 24, 30, 44, 4, '#4c7dff') + R(8, 19, 38, 8, 3, '#ff5d73') + R(18, 30, 18, 14, 3, '#ffe9a6') +
      R(40, 40, 46, 26, 10, '#ff5d73') + N(R(44, 44, 38, 3, 1.5, '#fff', op(0.5))) +
      P('M60 40V25H55L53 17H72L70 25H66V40z', '#4a3f63') +
      E(78, 40, 5, 4, '#ffd23f') +
      P('M84 64L95 77H80z', '#ffd23f') +
      R(10, 62, 78, 8, 3, '#4a3f63') +
      wheel(25, 74, 11) + wheel(52, 76, 8.5) + wheel(72, 76, 8.5) + P('M25 74H72', 'none', st('#c9cde3', 3));
  });
  def('boat', 'Sailboat', 'go', 0.22, 'water', 'rock', 'toot', 'rock', function () {
    return P('M49 14V62H18z', '#fff') + P('M55 22V62H82z', '#ffd23f') +
      R(49, 10, 5, 56, 2, '#a0714f') + P('M54 10l11 4l-11 4z', '#ff5d73') +
      P('M10 62H90L80 80Q50 86 20 80z', '#ff5d4d') + N(R(16, 68, 70, 3, 1.5, '#fff', op(0.8))) +
      P('M4 88q8-6 16 0t16 0t16 0t16 0t16 0t16 0', 'none', st('#4cc2ff', 4));
  });
  def('plane', 'Plane', 'go', 0.22, 'sky', 'rock', 'whoosh', 'float', function () {
    var Y = '#ffd23f';
    return P('M10 32H22L32 50H14z', Y) +
      P('M12 52Q14 44 30 44H72Q88 44 90 54Q88 62 72 62H22Q12 60 12 52z', Y) +
      N(R(16, 52, 70, 3, 1.5, '#ff5d73')) +
      P('M38 54H58L52 78H40z', '#ff9f43') +
      C(58, 50, 3.6, '#bfe9ff') + C(68, 50, 3.6, '#bfe9ff') + P('M76 44Q82 44 85 50H76z', '#bfe9ff') +
      E(94, 54, 3, 13, '#d9dbe8') + C(91, 54, 3, '#ff5d73');
  });
  def('rocket', 'Rocket', 'go', 0.18, 'sky', 'lift', 'whoosh', 'float', function () {
    return P('M42 76Q50 99 58 76z', '#ff9f43') + N(P('M46 76Q50 91 54 76z', '#ffd23f')) +
      P('M35 56L22 76L37 73z', '#ff5d73') + P('M65 56L78 76L63 73z', '#ff5d73') +
      P('M50 5Q71 22 66 56L64 77H36L34 56Q29 22 50 5z', '#f4f2ff') +
      P('M50 5Q61 13 64 24H36Q39 13 50 5z', '#ff5d73') +
      C(50, 42, 8, '#4cc2ff') + shine(47, 39, 2.5, 3.5, 30) + R(47.5, 60, 5, 18, 2.5, '#ff5d73');
  });
  def('balloon', 'Hot-air balloon', 'go', 0.2, 'sky', 'float', 'whoosh', 'float', function () {
    return P('M38 62L42 78M62 62L58 78M50 66V78', 'none', sw(2)) + R(40, 77, 20, 15, 3, '#c98a4a') + P('M40 82h20', 'none', st('#a0714f', 2)) +
      P('M50 5Q81 5 81 35Q81 55 61 66H39Q19 55 19 35Q19 5 50 5z', '#ff5d73') +
      P('M50 5Q34 30 41 66H59Q66 30 50 5z', '#ffd23f') +
      P('M50 5Q45 30 47 66H53Q55 30 50 5z', '#4cc2ff') + shine(30, 24, 4, 9, 20);
  });
  def('ufo', 'Flying saucer', 'go', 0.2, 'sky', 'float', 'ufo', 'float', function () {
    return N(P('M36 62L22 96H78L64 62z', '#c9ff9a', op(0.4))) +
      P('M33 47Q33 22 50 22Q67 22 67 47z', '#bfe9ff') +
      C(50, 38, 8, '#7be08a') + P('M50 30v-5', 'none', sw(2)) + C(50, 24, 2, '#ff5d73') + eyes(47, 53, 38, 1.8) +
      shine(40, 30, 3, 6, 25) +
      E(50, 52, 39, 12, '#a7a9c9') + N(E(50, 49, 30, 4, '#fff', op(0.35))) +
      N(C(24, 54, 3, '#ffd23f') + C(37, 58, 3, '#ff5d73') + C(50, 59, 3, '#3ddc84') + C(63, 58, 3, '#4cc2ff') + C(76, 54, 3, '#ffd23f'));
  });

  /* ======================= plants and food ======================= */
  def('tree', 'Tree', 'food', 0.26, 'ground', 'sway', 'leaves', 'sway', function () {
    return P('M43 93L46 58H54L57 93z', '#a0714f') +
      puff([[50, 28, 18], [32, 40, 15], [68, 40, 15], [36, 58, 14], [64, 58, 14], [50, 50, 17]], '#3ddc84') +
      N(C(40, 36, 3.4, '#ff5d73') + C(63, 46, 3.4, '#ff5d73') + C(46, 59, 3.4, '#ff5d73') + C(56, 25, 3, '#ff5d73')) +
      shine(40, 22, 7, 3.5, -30);
  });
  def('pine', 'Pine tree', 'food', 0.22, 'ground', 'sway', 'leaves', 'sway', function () {
    var G = '#26b36b';
    return R(45, 78, 10, 15, 2, '#a0714f') +
      P('M50 40L85 80H15z', G) + P('M50 22L78 58H22z', G) + P('M50 6L72 36H28z', G) +
      N(P('M50 10L40 26M50 28L34 50M50 46L28 72', 'none', st('#6fe0a0', 3)));
  });
  def('bush', 'Bush', 'food', 0.2, 'ground', 'sway', 'leaves', 'sway', function () {
    return puff([[28, 66, 14], [50, 56, 19], [72, 66, 14], [38, 76, 12], [62, 76, 12], [50, 74, 12]], '#4fc46a') +
      N(C(40, 60, 3, '#ff7ac6') + C(60, 54, 3, '#ffd23f') + C(70, 70, 3, '#ff7ac6') + C(30, 72, 3, '#fff') + C(52, 72, 3, '#fff')) +
      shine(44, 46, 7, 3, -20);
  });
  def('flower', 'Flower', 'food', 0.11, 'ground', 'sway', 'chime', 'sway', function () {
    return tube('M50 93Q48 70 50 45', '#3ddc84', 5) +
      P('M50 78Q34 66 27 72Q36 83 50 78z', '#3ddc84') + P('M50 70Q66 58 73 64Q64 75 50 70z', '#3ddc84') +
      puff(ring(50, 33, 12, 10, 6, -Math.PI / 2), '#ff7ac6') +
      C(50, 33, 9, '#ffd23f') + eyes(46.5, 53.5, 32, 1.8) + smile(50, 35.5, 2.4);
  });
  def('sunflower', 'Sunflower', 'food', 0.16, 'ground', 'sway', 'chime', 'sway', function () {
    var s = tube('M50 95Q46 70 50 45', '#3ddc84', 5) + P('M49 72Q30 60 24 68Q34 80 49 72z', '#3ddc84');
    for (var i = 0; i < 12; i++) { var a = i * 30; s += E(50, 15, 5.5, 11, '#ffd23f', rot(a, 50, 33)); }
    return s + C(50, 33, 12, '#8a5a35') + N(C(46, 30, 1.4, '#c98a4a') + C(54, 30, 1.4, '#c98a4a') + C(50, 37, 1.4, '#c98a4a') + C(44, 37, 1.4, '#c98a4a') + C(56, 37, 1.4, '#c98a4a')) + smile(50, 34, 4);
  });
  def('mushroom', 'Mushroom', 'food', 0.12, 'ground', 'hop', 'boing', 'bob', function () {
    return P('M36 52Q33 82 40 87H60Q67 82 64 52z', '#fff4e2') +
      P('M12 54Q12 16 50 16Q88 16 88 54Q50 62 12 54z', '#ff5d4d') +
      N(C(30, 34, 5, '#fff') + C(50, 25, 5.5, '#fff') + C(70, 34, 5, '#fff') + C(24, 48, 3, '#fff') + C(76, 48, 3, '#fff') + C(48, 44, 4, '#fff')) +
      eyes(44, 56, 68, 2.4) + smile(50, 73, 3) + cheeks(40, 60, 74, 2.2);
  });
  def('carrot', 'Carrot', 'food', 0.11, 'ground', 'wiggle', 'crunch', 'sway', function () {
    return tube('M50 34Q40 18 33 15', '#3ddc84', 6) + tube('M50 34Q50 16 52 7', '#3ddc84', 6) + tube('M50 34Q60 19 69 16', '#3ddc84', 6) +
      P('M38 33L62 33Q68 50 53 91Q48 94 46 89Q32 52 38 33z', '#ff8a3d') +
      P('M42 46h7M52 58h7M44 68h6M50 78h5', 'none', st('#d9661c', 2.4));
  });
  def('apple', 'Apple', 'food', 0.11, 'ground', 'hop', 'crunch', 'bob', function () {
    return tube('M50 30Q50 18 56 12', '#8a5a35', 3) + P('M54 22Q66 10 78 16Q70 28 54 22z', '#3ddc84') +
      P('M50 30Q70 18 82 36Q90 60 72 82Q62 90 50 84Q38 90 28 82Q10 60 18 36Q30 18 50 30z', '#ff5d4d') +
      shine(30, 42, 5, 9, 20);
  });
  def('pumpkin', 'Pumpkin', 'food', 0.15, 'ground', 'hop', 'boing', 'bob', function () {
    var O = '#ff9f43';
    return tube('M50 34Q48 24 54 18', '#3ddc84', 6) + P('M54 26q14-8 18 2', 'none', st('#3ddc84', 3)) +
      E(32, 60, 18, 25, O) + E(68, 60, 18, 25, O) + E(50, 60, 16, 27, O) +
      shine(28, 52, 4, 8, 15);
  });
  def('strawberry', 'Strawberry', 'food', 0.1, 'ground', 'hop', 'crunch', 'bob', function () {
    var s = P('M50 88Q19 68 22 44Q26 30 50 32Q74 30 78 44Q81 68 50 88z', '#ff4d6d');
    var seeds = [[36, 46], [50, 44], [64, 46], [30, 58], [44, 56], [58, 56], [70, 58], [38, 68], [52, 68], [64, 68], [46, 78], [56, 78]];
    s += N(seeds.map(function (p) { return E(p[0], p[1], 1.4, 2.2, '#ffe680'); }).join(''));
    return s + P('M50 36L36 26L46 30L50 18L54 30L64 26z', '#3ddc84') + tube('M50 22V12', '#3ddc84', 3);
  });
  def('icecream', 'Ice cream', 'food', 0.11, 'ground', 'wiggle', 'chime', 'sway', function () {
    return P('M33 50L50 94L67 50z', '#f0b46a') + N(P('M38 58l20 22M46 52l16 18M62 58l-20 22M54 52l-16 18', 'none', st('#c98a4a', 2))) +
      C(50, 46, 17, '#ff9ec7') + P('M36 52q2 8 6 2q4 8 8 0', '#ff9ec7') +
      C(50, 27, 13, '#9ef0c9') + C(50, 12, 4.5, '#ff3b5c') + shine(43, 22, 3, 5, 30);
  });
  def('cupcake', 'Cupcake', 'food', 0.12, 'ground', 'hop', 'chime', 'bob', function () {
    return P('M26 56H74L67 90H33z', '#4cc2ff') + P('M38 58l2 30M50 58v30M62 58l-2 30', 'none', st('#1a7fc0', 2)) +
      puff([[32, 54, 10], [50, 50, 13], [68, 54, 10], [41, 41, 10], [59, 41, 10], [50, 32, 9]], '#fff0f6') +
      N(R(36, 46, 5, 2, 1, '#ff5d73', rot(30, 38, 47)) + R(56, 40, 5, 2, 1, '#3ddc84', rot(-20, 58, 41)) + R(46, 54, 5, 2, 1, '#a77bff', rot(60, 48, 55)) + R(62, 52, 5, 2, 1, '#ffd23f') + R(44, 36, 5, 2, 1, '#4cc2ff', rot(-40, 46, 37))) +
      C(50, 20, 5, '#ff3b5c') + tube('M50 15Q52 9 57 8', '#3ddc84', 1.5);
  });

  /* ======================= sky and weather ======================= */
  function cloudPuff(c) { return puff([[28, 60, 14], [44, 47, 18], [62, 48, 16], [76, 60, 12], [52, 63, 14], [36, 66, 10], [66, 65, 10]], c); }
  def('sun', 'Sun', 'sky', 0.18, 'sky', 'spin', 'chime', 'twinkle', function () {
    var d = '';
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6, b = a + 0.16, c = a - 0.16;
      d += 'M' + f(50 + 30 * Math.cos(c)) + ' ' + f(50 + 30 * Math.sin(c)) + 'L' + f(50 + 45 * Math.cos(a)) + ' ' + f(50 + 45 * Math.sin(a)) + 'L' + f(50 + 30 * Math.cos(b)) + ' ' + f(50 + 30 * Math.sin(b)) + 'Z';
    }
    return P(d, '#ffb92e') + C(50, 50, 28, '#ffd23f') + shine(39, 38, 7, 4, -35) +
      eyes(41, 59, 47, 3.2) + smile(50, 55, 7) + cheeks(34, 66, 56, 3.6);
  });
  def('cloud', 'Cloud', 'sky', 0.22, 'sky', 'wiggle', 'whoosh', 'drift', function () {
    return cloudPuff('#fff') + eyes(43, 57, 56, 2.4) + smile(50, 60, 3) + cheeks(37, 63, 62, 2.4);
  });
  def('raincloud', 'Rain cloud', 'sky', 0.22, 'sky', 'wiggle', 'rain', 'drift', function () {
    var drop = function (x, y) { return P('M' + x + ' ' + y + 'q5 8 0 11q-5-3 0-11z', '#4cc2ff', sw(2.2)); };
    return drop(32, 78) + drop(48, 84) + drop(64, 78) + drop(78, 86) +
      G(cloudPuff('#d7dcf5'), 'translate(0 -10)') + eyes(43, 57, 47, 2.4) + P('M47 53q3-2 6 0', 'none', sw(2.4));
  });
  def('storm', 'Thunder cloud', 'sky', 0.22, 'sky', 'wiggle', 'thunder', 'drift', function () {
    return P('M54 56L40 78H50L42 98L68 68H56L64 56z', '#ffd23f') +
      G(cloudPuff('#a9b0d6'), 'translate(0 -12)') + eyes(43, 57, 45, 2.4) + P('M46 52q4-3 8 0', 'none', sw(2.4)) + N(P('M38 38l8 3M62 38l-8 3', 'none', st(INK, 2.4)));
  });
  def('rainbow', 'Rainbow', 'sky', 0.32, 'sky', 'pulse', 'chime', 'twinkle', function () {
    var cols = ['#ff5d73', '#ff9f43', '#ffd23f', '#3ddc84', '#4cc2ff', '#a77bff'], s = '';
    s = P('M23.75 74A26.25 26.25 0 0 1 76.25 74', 'none', sw(36.5) + ' stroke-linecap="butt"');
    cols.forEach(function (c, i) { var r = 40 - i * 5.5; s += P('M' + f(50 - r) + ' 74A' + r + ' ' + r + ' 0 0 1 ' + f(50 + r) + ' 74', 'none', st(c, 5.9) + ' stroke-linecap="butt"'); });
    return s + puff([[12, 74, 9], [22, 76, 8], [6, 80, 6], [16, 82, 7]], '#fff') + puff([[88, 74, 9], [78, 76, 8], [94, 80, 6], [84, 82, 7]], '#fff');
  });
  def('moon', 'Moon', 'sky', 0.16, 'sky', 'wiggle', 'night', 'twinkle', function () {
    return P('M60 12A38 38 0 1 0 88 66A30 30 0 1 1 60 12z', '#fff2a8') +
      P('M30 50q4 4 8 0', 'none', sw(2.6)) + smile(38, 64, 5) + cheek(28, 58, 3) +
      N(C(36, 32, 3, '#f0de7a') + C(48, 80, 4, '#f0de7a')) +
      P(starD(80, 22, 7, 3, 5), '#ffd23f', sw(2));
  });
  def('star', 'Star', 'sky', 0.12, 'sky', 'spin', 'twinkle', 'twinkle', function () {
    return P(starD(50, 54, 44, 21, 5), '#ffd23f') + shine(40, 36, 5, 2.5, -35) +
      eyes(43, 57, 52, 2.8) + smile(50, 58, 4) + cheeks(37, 63, 60, 2.6);
  });
  def('snowflake', 'Snowflake', 'sky', 0.12, 'sky', 'spin', 'twinkle', 'twinkle', function () {
    var d = '';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      var px = function (r, o) { return f(50 + r * c - o * s) + ' ' + f(50 + r * s + o * c); };
      d += 'M50 50L' + px(40, 0) + 'M' + px(22, 0) + 'L' + px(32, 9) + 'M' + px(22, 0) + 'L' + px(32, -9) + 'M' + px(32, 0) + 'L' + px(38, 6) + 'M' + px(32, 0) + 'L' + px(38, -6);
    }
    return P(d, 'none', sw(10)) + P(d, 'none', st('#bfe9ff', 4.5)) + C(50, 50, 7, '#fff');
  });
  def('planet', 'Planet', 'sky', 0.2, 'sky', 'spin', 'ufo', 'twinkle', function () {
    return G(tube('M10 52A40 11 0 0 1 90 52', '#ffd23f', 5) +
      C(50, 50, 24, '#a77bff') + N(P('M30 40Q50 34 70 40M27 54Q50 48 73 54', 'none', st('#c9a8ff', 4)) + C(60, 60, 3, '#8a5ee0') + C(40, 38, 2, '#8a5ee0')) +
      tube('M10 52A40 11 0 0 0 90 52', '#ffd23f', 5) + shine(40, 38, 6, 3, -30), 'rotate(-18 50 50)');
  });

  /* ======================= buildings and things ======================= */
  def('house', 'House', 'places', 0.26, 'ground', 'pulse', 'knock', 'bob', function () {
    return R(64, 18, 9, 18, 1, '#c9363a') +
      R(20, 44, 60, 46, 3, '#ffe2a6') +
      P('M12 48L50 14L88 48z', '#ff5d4d') +
      R(43, 64, 14, 26, 3, '#4c7dff') + N(C(54, 78, 1.6, '#ffd23f')) +
      R(26, 54, 12, 12, 2, '#bfe9ff') + R(62, 54, 12, 12, 2, '#bfe9ff') + P('M32 54v12M26 60h12M68 54v12M62 60h12', 'none', sw(2)) +
      P('M8 90H92', 'none', sw(3));
  });
  def('barn', 'Barn', 'places', 0.3, 'ground', 'pulse', 'moo', 'bob', function () {
    var W = '#fff';
    return R(14, 44, 72, 46, 2, '#e8453c') +
      P('M8 48L20 26L50 12L80 26L92 48z', '#9b2f2f') + P('M8 48L20 26L50 12L80 26L92 48', 'none', st(W, 2.6)) +
      R(43, 28, 14, 11, 2, '#fff3c4') +
      R(34, 58, 32, 32, 1, '#c9363a') + P('M34 58L66 90M66 58L34 90', 'none', st(W, 3)) + R(34, 58, 32, 32, 1, 'none', st(W, 3)) +
      P('M14 90H86', 'none', sw(3));
  });
  def('windmill', 'Windmill', 'places', 0.24, 'ground', 'spin', 'whoosh', 'bob', function () {
    var blade = R(46, 4, 8, 32, 2, '#fff') + N(P('M47 12h6M47 20h6M47 28h6', 'none', st('#c9cde3', 2)));
    return P('M37 93L43 42H57L63 93z', '#f4f2ff') + R(46, 74, 8, 19, 4, '#8a5a35') + R(46, 52, 8, 8, 2, '#bfe9ff') +
      P('M41 44Q50 28 59 44z', '#ff5d73') +
      G(G(blade, 'rotate(20 50 38)') + G(blade, 'rotate(110 50 38)') + G(blade, 'rotate(200 50 38)') + G(blade, 'rotate(290 50 38)') + C(50, 38, 4, '#ffd23f'), '', 's-spin');
  });
  def('fence', 'Fence', 'places', 0.24, 'ground', 'wiggle', 'knock', 'bob', function () {
    var W = '#f0c389', s = R(4, 46, 92, 8, 2, W) + R(4, 66, 92, 8, 2, W);
    [8, 31, 54, 77].forEach(function (x) { s += P('M' + x + ' 42L' + (x + 7.5) + ' 32L' + (x + 15) + ' 42V88H' + x + 'z', W); });
    return s + N(P('M10 80h80', 'none', st('#c98a4a', 2)));
  });
  def('haybale', 'Hay bale', 'places', 0.2, 'ground', 'hop', 'leaves', 'bob', function () {
    return P('M12 46L26 32H90L76 46z', '#ffe7a6') + P('M76 46L90 32V68L76 82z', '#e8b85a') + R(12, 46, 64, 36, 4, '#ffd27a') +
      P('M32 46V82M56 46V82M34 46L48 32M58 46L72 32', 'none', st('#c98a4a', 2.6)) +
      N(P('M18 58h8M40 66h8M62 56h8M20 72h6M64 72h6M40 54h6', 'none', st('#e8b85a', 2)));
  });
  def('tent', 'Tent', 'places', 0.24, 'ground', 'pulse', 'knock', 'bob', function () {
    return P('M50 18L90 86H10z', '#ff9f43') + P('M50 18L62 86H38z', '#7a3f2a') + N(P('M50 18L30 86', 'none', st('#ffb96b', 3))) +
      P('M50 18V6', 'none', sw(2.4)) + P('M50 6l12 4l-12 4z', '#3ddc84') + P('M6 86H94', 'none', sw(3));
  });
  def('castle', 'Castle', 'places', 0.28, 'ground', 'pulse', 'tada', 'bob', function () {
    var G1 = '#d9dcef', G2 = '#c4c8e3';
    var top = function (x, y, w) { var s = ''; for (var i = 0; i < 3; i++) s += R(x + i * w / 2.5, y - 6, w / 5, 7, 1, G2); return s; };
    return P('M24 28V14M76 28V14', 'none', sw(2.4)) + P('M24 14l12 4l-12 4z', '#ff5d73') + P('M76 14l12 4l-12 4z', '#4cc2ff') +
      top(14, 34, 20) + top(66, 34, 20) + top(32, 50, 36) +
      R(30, 50, 40, 42, 1, G1) + R(14, 34, 20, 58, 1, G2) + R(66, 34, 20, 58, 1, G2) +
      P('M41 92V74Q50 62 59 74V92z', '#8a5a35') + R(20, 46, 8, 11, 4, '#4a3f63') + R(72, 46, 8, 11, 4, '#4a3f63') + P('M6 92H94', 'none', sw(3));
  });
  def('ball', 'Beach ball', 'places', 0.1, 'ground', 'hop', 'boing', 'bob', function () {
    return C(50, 50, 32, '#fff') +
      P('M50 18A32 32 0 0 0 50 82C30 70 30 30 50 18z', '#ffd23f', ' stroke="none"') +
      P('M50 18A32 32 0 0 1 50 82C70 70 70 30 50 18z', '#3ddc84', ' stroke="none"') +
      P('M50 18C30 30 30 70 50 82C44 64 44 36 50 18z', '#ff5d73', ' stroke="none"') +
      P('M50 18C70 30 70 70 50 82C56 64 56 36 50 18z', '#4cc2ff', ' stroke="none"') +
      P('M50 18C30 30 30 70 50 82M50 18C70 30 70 70 50 82', 'none', sw(2)) +
      C(50, 50, 32) + C(50, 18, 4, '#fff', sw(2)) + shine(36, 32, 6, 3.5, -40);
  });
  def('kite', 'Kite', 'places', 0.14, 'sky', 'sway', 'whoosh', 'float', function () {
    return P('M50 74q-12 8 0 14q12 6 0 10', 'none', sw(2)) + N(P('M44 82l-5-3v6zM56 88l5-3v6z', '#ffd23f')) +
      P('M50 6L76 38L50 74L24 38z', '#ff5d73') + P('M50 6L76 38H50zM50 74L24 38H50z', '#ffd23f', sw(0)) +
      P('M50 6L76 38L50 74L24 38zM50 6V74M24 38H76', 'none');
  });

  /* ======================= silly ======================= */
  function bubble(inner) {
    return P('M14 16H86Q94 16 94 24V62Q94 70 86 70H42L24 88L28 70H14Q6 70 6 62V24Q6 16 14 16z', '#fff') + inner;
  }
  def('partyhat', 'Party hat', 'silly', 0.1, 'any', 'wiggle', 'tada', 'rock', function () {
    return P('M50 10L77 84Q50 94 23 84z', '#a77bff') +
      N(C(46, 40, 3.4, '#ffd23f') + C(56, 56, 3.4, '#ff7ac6') + C(40, 66, 3.4, '#3ddc84') + C(62, 76, 3.4, '#4cc2ff') + C(54, 30, 2.6, '#ff7ac6') + C(34, 80, 2.6, '#ffd23f')) +
      puff([[50, 9, 5], [44, 6, 4], [56, 6, 4], [50, 3, 4]], '#ffd23f');
  });
  def('crown', 'Crown', 'silly', 0.12, 'any', 'pulse', 'tada', 'twinkle', function () {
    return P('M14 76L18 30L34 52L50 22L66 52L82 30L86 76z', '#ffd23f') + C(18, 28, 4, '#ffd23f') + C(50, 20, 4, '#ffd23f') + C(82, 28, 4, '#ffd23f') +
      R(14, 70, 72, 14, 3, '#ffc928') + C(32, 77, 3.6, '#ff5d73') + C(50, 77, 3.6, '#4cc2ff') + C(68, 77, 3.6, '#3ddc84') + shine(40, 50, 3, 9, 20);
  });
  def('sunglasses', 'Sunglasses', 'silly', 0.14, 'any', 'wiggle', 'boing', '', function () {
    return P('M8 44L2 38M92 44l6-6', 'none', sw(4)) +
      R(8, 36, 36, 26, 11, '#2b3a7a', st('#ff5d73', 5)) + R(56, 36, 36, 26, 11, '#2b3a7a', st('#ff5d73', 5)) +
      P('M44 44Q50 38 56 44', 'none', st('#ff5d73', 5)) +
      N(P('M16 44l8-6M20 54l14-12M64 44l8-6M68 54l14-12', 'none', st('#fff', 3.2)));
  });
  def('tophat', 'Top hat', 'silly', 0.12, 'any', 'hop', 'boing', '', function () {
    return E(50, 80, 36, 8, '#4a3f63') + R(28, 18, 44, 62, 5, '#4a3f63') + R(28, 62, 44, 9, 0, '#ff5d73') + shine(36, 36, 3, 12, 0);
  });
  def('moustache', 'Moustache', 'silly', 0.12, 'any', 'wiggle', 'boing', '', function () {
    return P('M50 46Q60 34 73 44Q84 52 95 40Q94 61 75 61Q60 61 50 52Q40 61 25 61Q6 61 5 40Q16 52 27 44Q40 34 50 46z', '#6b3f1f') +
      N(P('M58 46q8-4 14 2M42 46q-8-4-14 2', 'none', st('#9a6a45', 2.4)));
  });
  def('bow', 'Bow', 'silly', 0.1, 'any', 'wiggle', 'boing', '', function () {
    return P('M50 50L18 30Q8 50 18 70z', '#ff5d9e') + P('M50 50L82 30Q92 50 82 70z', '#ff5d9e') +
      N(C(22, 44, 3, '#fff') + C(24, 58, 3, '#fff') + C(78, 44, 3, '#fff') + C(76, 58, 3, '#fff') + C(32, 50, 2.6, '#fff') + C(68, 50, 2.6, '#fff')) +
      R(42, 41, 16, 18, 6, '#ff3b84');
  });
  def('googly', 'Googly eyes', 'silly', 0.1, 'any', 'wiggle', 'boing', '', function () {
    return C(30, 50, 22, '#fff') + C(70, 50, 22, '#fff') + G(C(36, 58, 10, INK) + C(64, 56, 10, INK) + N(C(39, 54, 3.4, '#fff') + C(67, 52, 3.4, '#fff')), '', 'eye');
  });
  def('say-heart', 'Love bubble', 'silly', 0.14, 'sky', 'pulse', 'chime', 'float', function () {
    return bubble(P('M50 60C30 48 30 28 40 26C46 25 50 30 50 34C50 30 54 25 60 26C70 28 70 48 50 60z', '#ff5d73') + shine(42, 32, 2.5, 4, 30));
  });
  def('say-song', 'Song bubble', 'silly', 0.14, 'sky', 'pulse', 'song', 'float', function () {
    return bubble(P('M42 52V28L64 23V46', 'none', sw(4)) + E(37, 53, 7, 5.5, '#a77bff', rot(-20, 37, 53)) + E(59, 47, 7, 5.5, '#a77bff', rot(-20, 59, 47)) + P('M42 33L64 28', 'none', sw(4)));
  });
  def('say-star', 'Wow bubble', 'silly', 0.14, 'sky', 'pulse', 'twinkle', 'float', function () {
    return bubble(P(starD(50, 44, 19, 8.5, 5), '#ffd23f') + shine(45, 36, 2.4, 1.4, -35));
  });
  def('say-sleep', 'Sleepy bubble', 'silly', 0.14, 'sky', 'pulse', 'night', 'float', function () {
    return bubble(P('M54 24A18 18 0 1 0 68 52A14 14 0 1 1 54 24z', '#fff2a8') + P(starD(30, 30, 6, 2.6, 5), '#ffd23f', sw(2)) + P(starD(72, 26, 4.5, 2, 5), '#ffd23f', sw(2)));
  });
  def('say-what', 'What bubble', 'silly', 0.14, 'sky', 'pulse', 'what', 'float', function () {
    return bubble(P('M40 34Q40 24 50 24Q60 24 60 33Q60 40 50 44V48', 'none', sw(13)) + P('M40 34Q40 24 50 24Q60 24 60 33Q60 40 50 44V48', 'none', st('#4cc2ff', 7)) + C(50, 58, 5, '#4cc2ff'));
  });

  /* ======================= backdrops (400 x 300) ======================= */
  /* Soft and outline-free so the stickers stand out. Classes animate while
     the scene is playing: b-drift (clouds), b-sway (weeds), b-twinkle,
     b-ripple, b-rise (bubbles), b-glow, b-ray. Zones are scene fractions
     [y0, y1] for Surprise and tap-to-add; water also has [x0, x1]. */
  var BACKS = [], BBY = {};
  function back(id, name, o, draw) { o.id = id; o.name = name; o.draw = draw; BACKS.push(o); BBY[id] = o; }
  function cloud(x, y, s) {
    s = s || 1;
    return G(C(x, y, 16 * s, '#fff') + C(x + 18 * s, y - 8 * s, 20 * s, '#fff') + C(x + 38 * s, y, 15 * s, '#fff') + R(x - 2 * s, y - 2 * s, 42 * s, 16 * s, 8 * s, '#fff'), '', 'b-drift');
  }
  function sky(g) { return R(0, 0, 400, 300, 0, 'url(#' + (g || 'sm-sky') + ')'); }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function tufts(list, c) { return P(list.map(function (p) { return 'M' + p[0] + ' ' + p[1] + 'l3-9l3 9l3-7l2 7'; }).join(''), 'none', st(c, 2.4) + ' stroke-linecap="round" stroke-linejoin="round"'); }
  function lolly(x, y, s, c) { return R(x - 2 * s, y, 4 * s, 14 * s, 1, '#8a5a35') + C(x, y - 2 * s, 11 * s, c || '#4fbf5c') + C(x - 3 * s, y - 5 * s, 4 * s, '#fff', op(0.18)); }
  A.h.cloud = cloud; A.h.sky = sky; A.h.rng = rng; A.h.tufts = tufts; A.h.lolly = lolly;
  A.back = back;

  back('farm', 'Farm', { sky: [0.07, 0.3], ground: [0.66, 0.9], pool: ['cow', 'pig', 'sheep', 'hen', 'chick', 'horse', 'dog', 'cat', 'tractor', 'farmer', 'sun', 'cloud', 'tree', 'haybale', 'sunflower', 'fence', 'pumpkin'] }, function () {
    return sky() + cloud(54, 52) + cloud(288, 36, 0.8) +
      P('M0 150Q70 110 150 140Q230 100 310 132Q360 115 400 128V300H0z', '#a6e08a') +
      P('M232 132Q280 112 340 122Q372 118 400 124V162Q330 150 250 166z', '#ffd86b') +
      P('M240 141Q300 125 400 133M246 152Q310 138 400 146', 'none', st('#f2c14e', 3)) +
      P('M164 128Q190 118 222 126L226 150Q194 146 168 154z', '#c98f5a') + P('M168 136Q196 128 223 134M170 145Q198 138 225 143', 'none', st('#b07a48', 2.5)) +
      lolly(210, 110, 0.8, '#5cc46a') + lolly(226, 114, 0.6, '#4fb35e') + lolly(360, 104, 0.7, '#4fb35e') +
      P('M0 180Q110 158 210 172Q310 188 400 166V300H0z', '#74cf5f') +
      P('M84 186Q98 222 160 240Q226 260 218 300H262Q270 252 190 228Q132 210 110 186z', '#e9c88f') +
      R(136, 92, 24, 94, 4, '#d8dcef') + E(148, 92, 12, 8, '#b9bfdc') + P('M136 120h24M136 150h24', 'none', st('#b9bfdc', 2)) +
      R(46, 120, 86, 66, 2, '#d8453b') +
      P('M38 124L56 96L89 82L122 96L140 124z', '#9e2f2f') + P('M38 124L56 96L89 82L122 96L140 124', 'none', st('#fff', 4) + ' stroke-linejoin="round"') +
      R(80, 101, 18, 14, 2, '#fff4c4', st('#fff', 3)) +
      R(70, 146, 38, 40, 1, '#c23b33') + P('M70 146L108 186M108 146L70 186', 'none', st('#fff', 4)) + R(70, 146, 38, 40, 1, 'none', st('#fff', 4)) +
      P('M244 203H400M244 214H400', 'none', st('#fff', 4)) +
      [252, 276, 300, 324, 348, 372, 396].map(function (x) { return R(x - 3, 194, 6, 26, 2, '#fff'); }).join('') +
      C(20, 186, 15, '#4fbf5c') + C(38, 190, 12, '#58c766') +
      tufts([[30, 272], [120, 286], [300, 262], [360, 290], [190, 270]], '#5fbf4e') +
      N(C(60, 250, 3, '#fff') + C(70, 262, 3, '#ffd23f') + C(330, 240, 3, '#ff7ac6') + C(150, 274, 3, '#fff') + C(380, 250, 3, '#ffd23f'));
  });

  back('barn', 'Inside the barn', { sky: [0.12, 0.3], ground: [0.72, 0.9], pool: ['cow', 'pig', 'sheep', 'hen', 'chick', 'horse', 'dog', 'cat', 'bunny', 'haybale', 'farmer', 'duck'] }, function () {
    var s = R(0, 0, 400, 300, 0, '#b9573f'), i;
    for (i = 25; i < 400; i += 25) s += P('M' + i + ' 0V205', 'none', st('#a14a35', 2.5));
    s += R(250, 56, 84, 64, 4, '#9fdcff') + P('M250 104Q290 90 334 102V120H250z', '#7fd36a') + C(312, 76, 9, '#ffe27a') +
      R(250, 56, 84, 64, 4, 'none', st('#7a3a2a', 7)) + P('M292 56V120M250 88H334', 'none', st('#7a3a2a', 5));
    s += R(0, 24, 400, 14, 0, '#7a3a2a') + P('M0 130L70 38M400 130L330 38', 'none', st('#7a3a2a', 11));
    s += P('M0 108Q20 76 50 90Q80 72 110 94Q124 98 132 108z', '#ffd27a') + R(0, 108, 136, 11, 0, '#7a3a2a') +
      P('M14 96l6-8M40 92l4-10M70 88l2-10M96 92l6-8', 'none', st('#e8b85a', 2.4));
    s += P('M200 38V60', 'none', st('#4a2a20', 2.5)) + G(C(200, 72, 28, '#ffe9a0', op(0.22)), '', 'b-glow') + R(191, 60, 18, 22, 5, '#ffd23f') + R(194, 64, 12, 13, 3, '#fff6c8');
    s += R(320, 140, 80, 66, 0, '#8a4430') + P('M320 140L400 206M400 140L320 206M320 140H400V206H320z', 'none', st('#e9c88f', 4));
    s += P('M0 200H400V300H0z', '#e8c26e');
    var r = rng(7);
    for (i = 0; i < 46; i++) { var x = r() * 400, y = 208 + r() * 90; s += P('M' + f(x) + ' ' + f(y) + 'l' + f(6 + r() * 6) + ' ' + f(-2 + r() * 4), 'none', st('#d4a94f', 2.2)); }
    s += C(30, 214, 32, '#f5cf6a') + C(76, 222, 22, '#f5cf6a') + P('M10 200l8-10M34 196l4-12M58 206l8-10', 'none', st('#e8b85a', 2.4));
    return s;
  });

  back('pond', 'Pond', { sky: [0.07, 0.28], ground: [0.5, 0.58], water: [0.58, 0.84, 0.28, 0.72], pool: ['duck', 'frog', 'chick', 'butterfly', 'bee', 'flower', 'bird', 'boat', 'cloud', 'sun', 'turtle', 'clownfish'] }, function () {
    var s = sky() + cloud(250, 46, 0.8), x;
    var d = 'M0 140';
    for (x = 0; x <= 400; x += 25) d += 'Q' + (x + 12) + ' ' + (104 + (x * 7) % 18) + ' ' + (x + 25) + ' 128';
    s += P(d + 'V150H0z', '#4fb35e');
    s += R(0, 132, 400, 168, 0, '#7fd36a');
    s += E(200, 216, 168, 60, '#2f9ee8') + E(200, 212, 158, 52, '#5ec0ff') +
      G(E(150, 206, 30, 6, 'none', st('#bfe9ff', 2.5)) + E(262, 228, 22, 5, 'none', st('#bfe9ff', 2.5)) + E(210, 190, 16, 4, 'none', st('#bfe9ff', 2.5)), '', 'b-ripple');
    var pad = function (px, py, r) { return E(px, py, r, r * 0.55, '#3ddc84') + P('M' + px + ' ' + py + 'L' + (px + r) + ' ' + (py - 3) + 'L' + (px + r) + ' ' + (py + 3) + 'z', '#5ec0ff'); };
    s += pad(110, 230, 16) + pad(300, 200, 13) + pad(240, 250, 11) + C(110, 226, 5, '#ff9ec7') + C(110, 226, 2, '#ffd23f');
    s += G(P('M28 210V150M40 216V140M52 212V158M18 214V164', 'none', st('#3aa84d', 3.5)) +
      R(25, 148, 6, 18, 3, '#8a5a35') + R(37, 138, 6, 18, 3, '#8a5a35') + R(49, 156, 6, 16, 3, '#8a5a35'), '', 'b-sway');
    s += E(356, 252, 16, 10, '#a9adc9') + E(374, 260, 11, 7, '#bfc3dc') + E(60, 262, 12, 7, '#a9adc9');
    s += tufts([[330, 160], [80, 150], [380, 286], [20, 290], [200, 290]], '#5fbf4e');
    return s + N(C(300, 160, 3, '#ff7ac6') + C(140, 150, 3, '#fff') + C(370, 180, 3, '#ffd23f'));
  });

  back('road', 'Road trip', { sky: [0.07, 0.3], ground: [0.68, 0.9], pool: ['car', 'bus', 'truck', 'tractor', 'tree', 'pine', 'house', 'cow', 'sheep', 'cloud', 'sun', 'balloon', 'bird'] }, function () {
    return sky() + cloud(40, 50, 0.9) + cloud(300, 70, 0.7) +
      P('M0 150Q80 108 170 138Q260 104 400 132V300H0z', '#a9dcc0') +
      R(318, 122, 22, 16, 1, '#d8453b') + P('M314 124L329 112L344 124z', '#9e2f2f') +
      P('M0 176Q120 140 230 166Q320 190 400 160V300H0z', '#86d36e') +
      P('M50 300C120 236 250 210 290 158L306 158C292 214 210 250 230 300z', '#7c7a94') +
      P('M50 300C120 236 250 210 290 158M306 158C292 214 210 250 230 300', 'none', st('#fff', 3)) +
      P('M140 300C176 248 268 212 298 158', 'none', st('#ffd23f', 4) + ' stroke-dasharray="14 12"') +
      lolly(80, 190, 1.2) + lolly(40, 210, 1.5, '#3fbf62') + lolly(340, 178, 1.1) + lolly(372, 200, 1.5, '#3fbf62') + lolly(250, 150, 0.6) +
      P('M320 230H400M320 244H400', 'none', st('#fff', 3.5)) + [326, 350, 374, 398].map(function (x) { return R(x - 2.5, 222, 5, 30, 2, '#fff'); }).join('') +
      tufts([[20, 270], [110, 292], [330, 280], [380, 296]], '#5fbf4e');
  });

  back('space', 'Space', { sky: [0.08, 0.6], ground: [0.84, 0.92], pool: ['rocket', 'astronaut', 'ufo', 'planet', 'star', 'moon', 'say-star', 'snowflake'] }, function () {
    var s = R(0, 0, 400, 300, 0, 'url(#sm-night)') + E(120, 130, 150, 60, '#a77bff', op(0.13)) + E(300, 90, 110, 40, '#4cc2ff', op(0.08));
    var r = rng(3), tw = '', i;
    for (i = 0; i < 80; i++) s += C(f(r() * 400), f(r() * 230), f(0.6 + r() * 1.4), '#fff', op(f(0.4 + r() * 0.6)));
    for (i = 0; i < 12; i++) tw += P(starD(f(r() * 400), f(r() * 210), 5, 1.6, 4, 0), '#fff6c8');
    s += G(tw, '', 'b-twinkle');
    s += C(338, 62, 26, '#4cc2ff') + N(P('M322 50Q330 40 340 46Q346 56 336 60Q326 62 322 50zM344 70Q354 64 360 72Q356 82 346 80z', '#3ddc84')) + C(330, 52, 22, '#fff', op(0.12));
    s += C(70, 70, 12, '#ff9f43') + E(70, 72, 23, 5, 'none', st('#ffd23f', 3));
    s += P('M0 238Q90 220 190 234Q300 250 400 228V300H0z', '#c9cde3') +
      E(70, 262, 22, 7, '#aeb3d1') + E(220, 278, 30, 8, '#aeb3d1') + E(330, 256, 16, 5, '#aeb3d1') + E(150, 250, 10, 3, '#aeb3d1');
    return s;
  });

  back('blank', 'Sky and grass', { sky: [0.08, 0.4], ground: [0.74, 0.9], pool: null }, function () {
    return sky() + P('M0 214Q200 192 400 214V300H0z', '#7fd36a') + P('M0 236Q200 220 400 238V300H0z', '#74c95f');
  });

  A.backdrops = function () { return BACKS; };
  A.backdrop = function (id) { return BBY[id] || BBY.farm; };
  A.backdropSVG = function (id) {
    var b = A.backdrop(id);
    if (!b.svg) b.svg = b.draw();
    return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + b.svg + '</svg>';
  };

  /* ---------- the hidden defs: gradients and <symbol>s ---------- */
  A.install = function () {
    if (document.getElementById('sm-defs')) return;
    var g = '<linearGradient id="sm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fc8ff"/><stop offset="1" stop-color="#dff6ff"/></linearGradient>' +
      '<linearGradient id="sm-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1038"/><stop offset="1" stop-color="#2e2a78"/></linearGradient>' +
      '<linearGradient id="sm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fe0ff"/><stop offset="0.45" stop-color="#1f9fe0"/><stop offset="1" stop-color="#123a8f"/></linearGradient>' +
      '<linearGradient id="sm-ocean" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fb5f0"/><stop offset="1" stop-color="#1560c0"/></linearGradient>' +
      '<linearGradient id="sm-warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#ffe9c4"/></linearGradient>' +
      '<linearGradient id="sm-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>';
    LIST.forEach(function (m) { g += '<symbol id="sm-st-' + m.id + '" viewBox="0 0 100 100">' + A.body(m.id) + '</symbol>'; });
    BACKS.forEach(function (b) { if (!b.svg) b.svg = b.draw(); g += '<symbol id="sm-bg-' + b.id + '" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">' + b.svg + '</symbol>'; });
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('id', 'sm-defs');
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    s.innerHTML = '<defs>' + g + '</defs>';
    document.body.insertBefore(s, document.body.firstChild);
  };

  return A;
})();
