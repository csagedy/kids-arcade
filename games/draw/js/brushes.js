/* Doodle Pad brushes. A Painter draws strokes onto the ink canvas a
   segment at a time (never re-rendering the stroke), once per magic-mirror
   transform, and reports the area it touched so the screen can keep undo
   tiles. Every brush is opaque or uses a fixed grain, so overlapping
   segments never build up dark beads.

   Stroke state (one per finger): { tool, color, w (canvas px), scale
   (canvas px per CSS px), x, y (last raw point), mx, my (last midpoint),
   hue, rem (distance carried to the next dab), rnd }. Segments are
   quadratic curves from midpoint to midpoint through the raw points, which
   smooths a finger's 60Hz samples into round curves. */
var Brushes = (function () {
  'use strict';
  var D = Doodle;
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function Painter(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mats = [[1, 0, 0, 1, 0, 0]];
    this.onTouch = null;         // fn(x0, y0, x1, y1) in canvas px, already mirrored
    this.grain = {};             // crayon patterns by colour + scale
    this.stamps = {};            // emoji bitmaps by emoji + size
  }
  var P = Painter.prototype;

  P.setMirror = function (mode) { this.mats = D.mirrorMats(mode, this.canvas.width, this.canvas.height); };

  /* Run fn once per mirror transform. */
  P.each = function (fn) {
    var c = this.ctx, m = this.mats;
    for (var i = 0; i < m.length; i++) {
      c.setTransform(m[i][0], m[i][1], m[i][2], m[i][3], m[i][4], m[i][5]);
      fn(c, i);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  };

  /* Report a source-space box (plus padding), mirrored. */
  P.mark = function (x0, y0, x1, y1, pad) {
    if (!this.onTouch) return;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    for (var i = 0; i < this.mats.length; i++) {
      var m = this.mats[i], a = D.apply(m, x0, y0), b = D.apply(m, x1, y1);
      this.onTouch(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    }
  };

  /* ---------- crayon grain ----------
     A tile of the colour with little holes punched in it. The pattern sits
     in canvas space, so overlapping crayon strokes share the same "paper
     tooth" and the holes stay holes, like wax on real paper. */
  P.grainFor = function (color, scale) {
    var key = color + '@' + scale.toFixed(2);
    if (this.grain[key]) return this.grain[key];
    var n = Math.max(48, Math.round(64 * scale)), c = document.createElement('canvas');
    c.width = c.height = n;
    var g = c.getContext('2d'), r = D.rng(12345);
    g.fillStyle = color;
    g.globalAlpha = 0.94;
    g.fillRect(0, 0, n, n);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    var holes = Math.round(n * n / (14 * scale * scale));
    for (var i = 0; i < holes; i++) {
      var hx = r() * n, hy = r() * n, hr = (0.45 + r() * 0.9) * scale;
      g.globalAlpha = 0.55 + r() * 0.45;
      g.beginPath();
      // drawn at the wrapped positions too, so the tile repeats seamlessly
      for (var ox = -n; ox <= n; ox += n) {
        for (var oy = -n; oy <= n; oy += n) {
          g.moveTo(hx + ox + hr, hy + oy);
          g.arc(hx + ox, hy + oy, hr, 0, Math.PI * 2);
        }
      }
      g.fill();
    }
    var pat = this.ctx.createPattern(c, 'repeat');
    // keep the cache small: a dozen colours is plenty
    var keys = Object.keys(this.grain);
    if (keys.length > 24) delete this.grain[keys[0]];
    this.grain[key] = pat;
    return pat;
  };

  /* ---------- stamps ---------- */
  P.stampFor = function (emoji, px) {
    px = Math.max(8, Math.round(px));
    var key = emoji + '@' + px;
    if (this.stamps[key]) return this.stamps[key];
    var n = Math.ceil(px * 1.3), c = document.createElement('canvas');
    c.width = c.height = n;
    var g = c.getContext('2d');
    g.font = px + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, n / 2, n / 2 + px * 0.06);
    var keys = Object.keys(this.stamps);
    if (keys.length > 40) delete this.stamps[keys[0]];
    this.stamps[key] = c;
    return c;
  };

  /* ---------- line brushes ---------- */
  function quad(c, ax, ay, cx, cy, bx, by) {
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo(cx, cy, bx, by);
    c.stroke();
  }
  function dot(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  P.style = function (c, st, color) {
    c.globalCompositeOperation = st.tool === 'eraser' ? 'destination-out' : 'source-over';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (st.tool === 'crayon') {
      var pat = this.grainFor(st.color, st.scale);
      c.strokeStyle = pat; c.fillStyle = pat;
    } else {
      c.strokeStyle = color; c.fillStyle = color;
    }
  };

  /* One curve piece from (ax, ay) through (cx, cy) to (bx, by). */
  P.piece = function (st, ax, ay, cx, cy, bx, by) {
    var self = this, w = st.w, len = Math.hypot(bx - ax, by - ay) + 0.001;
    var color = st.color;
    if (st.tool === 'rainbow') { this.rainbowPiece(st, ax, ay, cx, cy, bx, by, len); return; }
    if (st.tool === 'glitter') { this.sprinkleAlong(st, ax, ay, cx, cy, bx, by); return; }
    if (st.tool === 'stamp') return;
    this.each(function (c) {
      self.style(c, st, color);
      if (st.tool === 'crayon') {
        // a waxy core and two rough edges, all in the same grain
        c.lineWidth = w * 0.78; quad(c, ax, ay, cx, cy, bx, by);
        var nx = -(by - ay) / len, ny = (bx - ax) / len, o = w * 0.3;
        c.lineWidth = w * 0.34;
        quad(c, ax + nx * o, ay + ny * o, cx + nx * o, cy + ny * o, bx + nx * o, by + ny * o);
        quad(c, ax - nx * o, ay - ny * o, cx - nx * o, cy - ny * o, bx - nx * o, by - ny * o);
      } else if (st.tool === 'paint') {
        c.lineWidth = w; quad(c, ax, ay, cx, cy, bx, by);
        // bristle streaks: slightly lighter and darker lines inside the stroke
        if (len > 0.5) {
          var px = -(by - ay) / len, py = (bx - ax) / len;
          c.lineWidth = Math.max(1, w * 0.09);
          for (var k = 0; k < st.bristles.length; k++) {
            var b = st.bristles[k], ox = px * b.o * w, oy = py * b.o * w;
            c.strokeStyle = b.c;
            quad(c, ax + ox, ay + oy, cx + ox, cy + oy, bx + ox, by + oy);
          }
        }
      } else {
        c.lineWidth = w; quad(c, ax, ay, cx, cy, bx, by);
      }
    });
    this.ctx.globalCompositeOperation = 'source-over';
    this.mark(Math.min(ax, bx, cx), Math.min(ay, by, cy), Math.max(ax, bx, cx), Math.max(ay, by, cy), w * 0.6 + 2);
  };

  /* Rainbow: the curve is cut into short straight bits, each a step further
     round the colour wheel, so the colours blend instead of showing beads
     when the finger moves fast. */
  P.rainbowPiece = function (st, ax, ay, cx, cy, bx, by, len) {
    var w = st.w, n = Math.max(1, Math.min(48, Math.ceil(len / Math.max(2, w * 0.18))));
    var pts = [], hues = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      pts.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
    }
    for (i = 0; i < n; i++) { st.hue += len / n / st.scale * 0.9; hues.push(D.hsl(st.hue)); }
    this.each(function (c) {
      c.globalCompositeOperation = 'source-over';
      c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = w;
      for (var k = 0; k < n; k++) {
        c.strokeStyle = hues[k];
        c.beginPath(); c.moveTo(pts[k][0], pts[k][1]); c.lineTo(pts[k + 1][0], pts[k + 1][1]); c.stroke();
      }
    });
    this.mark(Math.min(ax, bx, cx), Math.min(ay, by, cy), Math.max(ax, bx, cx), Math.max(ay, by, cy), w * 0.6 + 2);
  };

  /* ---------- glitter ---------- */
  function sparkle(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
  }
  P.sprinkleAt = function (st, x, y) {
    var w = st.w, rnd = st.rnd, n = 3, bits = [];
    for (var i = 0; i < n; i++) {
      var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * w * 0.75;
      var k = rnd(), col = k < 0.45 ? st.color : k < 0.7 ? st.light : k < 0.88 ? '#ffffff' : '#ffe27a';
      var star = rnd() < 0.55;
      bits.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: star ? w * (0.14 + rnd() * 0.26) : w * (0.05 + rnd() * 0.08), star: star, c: col });
    }
    this.each(function (c) {
      c.globalCompositeOperation = 'source-over';
      for (var j = 0; j < bits.length; j++) {
        var b = bits[j];
        c.fillStyle = b.c;
        if (b.star) sparkle(c, b.x, b.y, b.r);
        else dot(c, b.x, b.y, b.r);
      }
    });
    this.mark(x, y, x, y, w * 1.2 + 2);
  };
  P.sprinkleAlong = function (st, ax, ay, cx, cy, bx, by) {
    // walk the curve as two straight halves, dropping a sprinkle every `gap`
    var gap = Math.max(2, st.w * 0.32), pts = [[ax, ay], [(ax + 2 * cx + bx) / 4, (ay + 2 * cy + by) / 4], [bx, by]];
    for (var i = 1; i < pts.length; i++) {
      var x0 = pts[i - 1][0], y0 = pts[i - 1][1], dx = pts[i][0] - x0, dy = pts[i][1] - y0, L = Math.hypot(dx, dy);
      var t = gap - st.rem;
      while (t <= L) { this.sprinkleAt(st, x0 + dx * t / L, y0 + dy * t / L); t += gap; }
      st.rem = L - (t - gap);
    }
  };

  /* ---------- stamps ---------- */
  P.stampAt = function (st, x, y) {
    var px = st.w, img = this.stampFor(st.stamp, px), s = img.width;
    var rot = (st.rnd() - 0.5) * 0.5, sc = 0.88 + st.rnd() * 0.24;
    this.each(function (c) {
      c.globalCompositeOperation = 'source-over';
      c.translate(x, y);
      c.rotate(rot);
      c.scale(sc, sc);
      c.drawImage(img, -s / 2, -s / 2, s, s);
    });
    this.mark(x, y, x, y, s * 0.75 + 2);
    st.sx = x; st.sy = y;
    if (this.onStamp) this.onStamp(st);
  };

  /* ---------- a stroke ---------- */
  P.begin = function (st, x, y) {
    st.x = st.mx = x; st.y = st.my = y; st.rem = 0;
    st.rnd = D.rng((Math.random() * 4294967296) >>> 0);
    if (st.tool === 'glitter') { st.light = D.shade(st.color, 0.55); this.sprinkleAt(st, x, y); return; }
    if (st.tool === 'stamp') { st.gap = st.w * 0.95; this.stampAt(st, x, y); return; }
    if (st.tool === 'paint') {
      st.bristles = [
        { o: -0.34, c: D.shade(st.color, -0.16) }, { o: -0.12, c: D.shade(st.color, 0.2) },
        { o: 0.1, c: D.shade(st.color, -0.1) }, { o: 0.3, c: D.shade(st.color, 0.16) }
      ];
    }
    var self = this, color = st.tool === 'rainbow' ? D.hsl(st.hue) : st.color, r = st.w / 2;
    this.each(function (c) {
      self.style(c, st, color);
      dot(c, x, y, st.tool === 'crayon' ? r * 0.8 : r);
    });
    this.ctx.globalCompositeOperation = 'source-over';
    this.mark(x, y, x, y, r + 2);
  };

  P.move = function (st, x, y) {
    if (Math.abs(x - st.x) + Math.abs(y - st.y) < 0.5) return;
    if (st.tool === 'stamp') {
      // drop stamps every `gap` along the finger's path
      var dx = x - st.sx, dy = y - st.sy, L = Math.hypot(dx, dy);
      var n = 0;
      while (L >= st.gap && n < 12) {
        this.stampAt(st, st.sx + dx * st.gap / L, st.sy + dy * st.gap / L);
        dx = x - st.sx; dy = y - st.sy; L = Math.hypot(dx, dy); n++;
      }
      if (n >= 12) { st.sx = x; st.sy = y; }
      st.x = x; st.y = y;
      return;
    }
    var mx = (st.x + x) / 2, my = (st.y + y) / 2;
    this.piece(st, st.mx, st.my, st.x, st.y, mx, my);
    st.mx = mx; st.my = my; st.x = x; st.y = y;
  };

  P.end = function (st) {
    if (st.tool === 'stamp') return;
    if (st.mx !== st.x || st.my !== st.y) this.piece(st, st.mx, st.my, (st.mx + st.x) / 2, (st.my + st.y) / 2, st.x, st.y);
  };

  /* ---------- paint bucket ----------
     Floods from (x, y) and from each of its mirror images. A region of
     blank paper is painted *under* the ink (destination-over) after being
     grown a couple of pixels, so the fill tucks in beneath the soft edges
     of the lines with no white halo; a region of ink is recoloured on top.
     Returns true when something was filled. */
  P.fill = function (x, y, color, scale) {
    var W = this.canvas.width, H = this.canvas.height, c = this.ctx;
    var img = c.getImageData(0, 0, W, H), d = new Uint32Array(img.data.buffer);
    var rgb = D.rgb(color), want = (255 << 24 | rgb[2] << 16 | rgb[1] << 8 | rgb[0]) >>> 0;
    var groups = [
      { mask: null, box: { x0: W, y0: H, x1: -1, y1: -1 }, under: true },
      { mask: null, box: { x0: W, y0: H, x1: -1, y1: -1 }, under: false }
    ];
    var did = false;
    for (var i = 0; i < this.mats.length; i++) {
      var p = D.apply(this.mats[i], x, y), px = Math.round(p[0]), py = Math.round(p[1]);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      var t = d[py * W + px], blank = (t >>> 24) < D.ALPHA_EDGE;
      if (!blank && Math.abs((t & 255) - rgb[0]) + Math.abs(((t >>> 8) & 255) - rgb[1]) + Math.abs(((t >>> 16) & 255) - rgb[2]) < 12) continue;
      var g = groups[blank ? 0 : 1];
      if (!g.mask) g.mask = new Uint8Array(W * H);
      if (g.mask[py * W + px]) continue;
      if (D.flood(d, W, H, px, py, g.mask, g.box)) did = true;
    }
    if (!did) return false;
    var self = this;
    groups.forEach(function (g) {
      if (!g.mask || g.box.x1 < 0) return;
      var b = g.box, bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      var out = c.createImageData(bw, bh), o = new Uint32Array(out.data.buffer), m = g.mask;
      for (var y = 0; y < bh; y++) {
        var src = (y + b.y0) * W + b.x0, dst = y * bw;
        for (var x = 0; x < bw; x++) if (m[src + x]) o[dst + x] = want;
      }
      var tmp = document.createElement('canvas');
      tmp.width = bw; tmp.height = bh;
      tmp.getContext('2d').putImageData(out, 0, 0);
      // Grow the fill a little by drawing it at small offsets (the GPU
      // does the work): under the ink this tucks it beneath the soft edges
      // of the lines; on top it closes the 1px seam with the old colour.
      var r = g.under ? Math.max(2, Math.round(scale * 1.5)) : 1, offs = [[0, 0]];
      for (var k = 0; k < 8; k++) offs.push([Math.round(Math.cos(k * Math.PI / 4) * r), Math.round(Math.sin(k * Math.PI / 4) * r)]);
      c.globalCompositeOperation = g.under ? 'destination-over' : 'source-over';
      offs.forEach(function (d) { c.drawImage(tmp, b.x0 + d[0], b.y0 + d[1]); });
      c.globalCompositeOperation = 'source-over';
      if (self.onTouch) self.onTouch(b.x0 - r, b.y0 - r, b.x1 + r + 1, b.y1 + r + 1);
      tmp.width = tmp.height = 0;
    });
    return true;
  };

  return { Painter: Painter, EMOJI_FONT: EMOJI_FONT };
})();
