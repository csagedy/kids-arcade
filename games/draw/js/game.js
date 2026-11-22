/* Doodle Pad: the model. No DOM in here: the tool / colour / paper / stamp
   tables, the magic-mirror transforms, the paint-bucket flood fill (on raw
   pixel arrays), the undo stack with its memory budget, and the small
   preferences that live in localStorage under draw.*.

   Pictures themselves are never in localStorage (it is a ~5MB quota shared
   by every game): they live in IndexedDB, see js/store.js.

   Units: brush sizes are in CSS pixels (so a finger-sized line is
   finger-sized on a phone and on an iPad); the screen code multiplies them
   by the canvas's pixels-per-CSS-pixel when a stroke starts. */
var Doodle = (function () {
  'use strict';
  var D = {};

  /* sizes: small / medium / big, in CSS px (stroke width, glitter spray
     width or stamp height). */
  D.TOOLS = [
    { id: 'marker',  label: 'Marker',       sizes: [6, 14, 28] },
    { id: 'crayon',  label: 'Crayon',       sizes: [9, 18, 32] },
    { id: 'paint',   label: 'Paint brush',  sizes: [16, 30, 56] },
    { id: 'rainbow', label: 'Rainbow',      sizes: [9, 18, 34] },
    { id: 'glitter', label: 'Glitter',      sizes: [14, 26, 46] },
    { id: 'stamp',   label: 'Stamps',       sizes: [44, 72, 118] },
    { id: 'fill',    label: 'Paint bucket', sizes: [0, 0, 0] },
    { id: 'eraser',  label: 'Eraser',       sizes: [16, 32, 64] }
  ];
  D.TOOL = {};
  D.TOOLS.forEach(function (t) { D.TOOL[t.id] = t; });
  /* Tools that use the chosen colour (picking a colour while on another
     tool switches back to the last of these). */
  D.COLOUR_TOOLS = { marker: 1, crayon: 1, paint: 1, glitter: 1, fill: 1 };

  /* The kit's eight candy colours, then the ones kids ask for. */
  D.COLORS = [
    { hex: '#ff5d73', name: 'Red' },
    { hex: '#ff9f43', name: 'Orange' },
    { hex: '#ffd23f', name: 'Yellow' },
    { hex: '#3ddc84', name: 'Green' },
    { hex: '#2ee6c9', name: 'Teal' },
    { hex: '#4cc2ff', name: 'Blue' },
    { hex: '#a77bff', name: 'Purple' },
    { hex: '#ff7ac6', name: 'Pink' },
    { hex: '#1f8f4e', name: 'Dark green' },
    { hex: '#2f4fc8', name: 'Dark blue' },
    { hex: '#8b5a2b', name: 'Brown' },
    { hex: '#22232e', name: 'Black' },
    { hex: '#a3a8b8', name: 'Grey' },
    { hex: '#ffffff', name: 'White' },
    { hex: '#fde0c5', name: 'Light skin' },
    { hex: '#f0bd8c', name: 'Skin' },
    { hex: '#c68a5a', name: 'Tan skin' },
    { hex: '#8a5634', name: 'Dark skin' }
  ];

  /* Paper is a layer under the ink, so changing it never touches the
     drawing and the eraser always shows the paper again. top/bottom make a
     soft vertical gradient; stars sprinkles a fixed star field (the same on
     screen and in thumbnails). */
  D.PAPERS = [
    { id: 'white', name: 'White',     top: '#ffffff', bottom: '#ffffff' },
    { id: 'night', name: 'Night sky', top: '#262b78', bottom: '#0b0c2a', stars: true, dark: true },
    { id: 'cream', name: 'Sunshine',  top: '#fff8dc', bottom: '#ffeeb8' },
    { id: 'sky',   name: 'Sky',       top: '#e6f6ff', bottom: '#bfe6ff' },
    { id: 'mint',  name: 'Grass',     top: '#ebfbf0', bottom: '#c6f0d4' },
    { id: 'pink',  name: 'Bubblegum', top: '#fff0f7', bottom: '#ffd3e8' },
    { id: 'kraft', name: 'Cardboard', top: '#e8cba5', bottom: '#d3a978' }
  ];
  D.PAPER = {};
  D.PAPERS.forEach(function (p) { D.PAPER[p.id] = p; });

  D.STAMPS = ['🐄', '🐖', '🐑', '🐓', '🐎', '🦆', '🐕', '🐈', '🐇', '🐥', '🐝', '🦋',
              '🚜', '🏡', '🌳', '🌻', '🌷', '🍎', '🥕', '⭐', '❤️', '🌈', '☀️', '☁️'];

  /* ---------- magic mirror ----------
     0 off, 1 left/right mirror, 2 kaleidoscope (4 turns x 2 mirrors).
     Each entry is a canvas transform [a, b, c, d, e, f]; a stroke is drawn
     once per entry. */
  D.MIRROR_NAMES = ['Mirror off', 'Magic mirror', 'Kaleidoscope'];
  D.mirrorMats = function (mode, w, h) {
    var cx = w / 2, cy = h / 2, out = [[1, 0, 0, 1, 0, 0]];
    if (mode === 1) out.push([-1, 0, 0, 1, 2 * cx, 0]);
    if (mode === 2) {
      out = [];
      // rotate by k * 90deg about the centre, with and without a flip
      var rots = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]];
      rots.forEach(function (r) {
        [1, -1].forEach(function (f) {
          // M = R * F, F = flip x when f = -1; then translate so the centre stays put
          var a = r[0] * f, b = r[1] * f, c = r[2], d = r[3];
          out.push([a, b, c, d, cx - (a * cx + c * cy), cy - (b * cx + d * cy)]);
        });
      });
    }
    return out;
  };
  D.apply = function (m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };

  /* ---------- colour helpers ---------- */
  D.rgb = function (hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  D.hex = function (r, g, b) {
    function c(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + c(r) + c(g) + c(b);
  };
  /* amt > 0 mixes toward white, < 0 toward black */
  D.shade = function (hex, amt) {
    var c = D.rgb(hex), t = amt > 0 ? 255 : 0, k = Math.abs(amt);
    return D.hex(c[0] + (t - c[0]) * k, c[1] + (t - c[1]) * k, c[2] + (t - c[2]) * k);
  };
  D.hsl = function (h) { return 'hsl(' + (((h % 360) + 360) % 360).toFixed(1) + ',95%,58%)'; };

  /* A tiny seeded random (mulberry32) for star fields and glitter. */
  D.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Notes for sounds: a C major pentatonic, so anything played together is nice. */
  D.PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

  /* ---------- paint bucket ----------
     Scanline flood fill over a Uint32Array of RGBA pixels (little-endian:
     alpha is the top byte). Marks the region in `mask` (Uint8Array, 1 = in)
     and grows `box` {x0, y0, x1, y1} (inclusive). Two kinds of region:
       - starting on blank paper (alpha < 160): every not-very-inked pixel,
         so the fill runs right up to the soft edges of lines;
       - starting on ink: pixels of about the same colour.
     Returns the number of pixels marked. */
  D.ALPHA_EDGE = 160;
  D.flood = function (d, w, h, sx, sy, mask, box) {
    var n = w * h, t = d[sy * w + sx], EDGE = D.ALPHA_EDGE;
    var blank = (t >>> 24) < EDGE, i, p;
    // One tight pass marks which pixels belong to this kind of region
    // (and aren't filled yet), so the flood itself only checks bytes.
    var ok = new Uint8Array(n);
    if (blank) {
      for (i = 0; i < n; i++) if ((d[i] >>> 24) < EDGE && !mask[i]) ok[i] = 1;
    } else {
      var tr = t & 255, tg = (t >>> 8) & 255, tb = (t >>> 16) & 255, TOL = 90;
      for (i = 0; i < n; i++) {
        p = d[i];
        if ((p >>> 24) < EDGE || mask[i]) continue;
        var dr = (p & 255) - tr, dg = ((p >>> 8) & 255) - tg, db = ((p >>> 16) & 255) - tb;
        if ((dr < 0 ? -dr : dr) + (dg < 0 ? -dg : dg) + (db < 0 ? -db : db) <= TOL) ok[i] = 1;
      }
    }
    var stack = [sx, sy], count = 0;
    while (stack.length) {
      var y = stack.pop(), x = stack.pop(), row = y * w;
      if (!ok[row + x]) continue;
      var l = x, r = x;
      while (l > 0 && ok[row + l - 1]) l--;
      while (r < w - 1 && ok[row + r + 1]) r++;
      for (var k = row + l, e = row + r; k <= e; k++) { ok[k] = 0; mask[k] = 1; }
      count += r - l + 1;
      if (l < box.x0) box.x0 = l;
      if (r > box.x1) box.x1 = r;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      if (y > 0) seeds(row - w, y - 1);
      if (y < h - 1) seeds(row + w, y + 1);
    }
    function seeds(rr, yy) {
      var inSpan = false;
      for (var k = l; k <= r; k++) {
        if (ok[rr + k]) { if (!inSpan) { stack.push(k, yy); inSpan = true; } }
        else inSpan = false;
      }
    }
    return blank ? count : -count;   // sign says which kind of region it was
  };

  D.isBlank = function (u32) {
    for (var i = 0, n = u32.length; i < n; i++) if (u32[i] >>> 24) return false;
    return true;
  };

  /* ---------- undo ----------
     Each entry holds the "before" pixels of the 128px tiles a gesture
     touched (blank tiles cost nothing: data null). Oldest steps drop off
     once the stack passes its memory budget or step count. */
  D.TILE = 128;
  D.Undo = function (budget, max) {
    this.list = []; this.bytes = 0; this.budget = budget; this.max = max;
  };
  D.Undo.prototype.push = function (entry) {
    this.list.push(entry);
    this.bytes += entry.bytes;
    while (this.list.length > 1 && (this.bytes > this.budget || this.list.length > this.max)) {
      this.bytes -= this.list.shift().bytes;
    }
  };
  D.Undo.prototype.pop = function () {
    var e = this.list.pop();
    if (e) this.bytes -= e.bytes;
    return e || null;
  };
  D.Undo.prototype.clear = function () { this.list = []; this.bytes = 0; };
  D.Undo.prototype.size = function () { return this.list.length; };

  /* ---------- small saved things (localStorage, draw.*) ---------- */
  D.PREFS_KEY = 'draw.prefs';
  D.CURRENT_KEY = 'draw.current';
  D.loadPrefs = function () {
    var p = Kit.load(D.PREFS_KEY, {}) || {};
    var out = {
      tool: D.TOOL[p.tool] ? p.tool : 'marker',
      brush: D.COLOUR_TOOLS[p.brush] && p.brush !== 'fill' ? p.brush : 'marker',
      color: typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#4cc2ff',
      size: p.size === 0 || p.size === 2 ? p.size : 1,
      stamp: p.stamp >= 0 && p.stamp < D.STAMPS.length ? p.stamp | 0 : 0,
      mirror: p.mirror === 1 || p.mirror === 2 ? p.mirror : 0,
      paper: D.PAPER[p.paper] ? p.paper : 'white'
    };
    return out;
  };
  D.savePrefs = function (p) { Kit.save(D.PREFS_KEY, p); };

  D.statText = function (n) { return n === 1 ? '1 picture' : n + ' pictures'; };
  D.newId = function () { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); };

  return D;
})();
