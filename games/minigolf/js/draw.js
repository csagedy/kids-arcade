/* Mini Golf drawing. One canvas fills the stage. The hole is fitted to the
   stage's shape: a tall hole stands upright on a tall screen and lies on
   its side on a wide one (whichever makes it bigger), so the course is
   always as big as it can be.

   Two layers: a static picture (background, decorations, base, grass,
   sand, water bed, rails, blocks, cup) rendered once per hole and size,
   and a cheap per-frame layer on top (water shimmer, belts, spinners,
   gates, portals, the flag, balls, the aim line, particles). */
(function (root) {
  'use strict';
  var S = root.GolfSim;

  /* ---------- themes ---------- */
  var THEMES = {
    candy: {
      bg: ['#4a2370', '#2c1a5c'], base: '#ffe3b0', baseEdge: '#d9a86a', grass: '#5fd47a', stripe: '#55c56f', blade: ['#7fe596', '#46b562'],
      rail: '#ff7ac6', railEdge: '#c94a92', railHi: '#ffd0ea', railDash: '#ffffff', block: '#9a5b3c', blockTop: '#b8754f', blockEdge: '#6b3b25',
      sand: '#ffe39a', sandDot: '#f2c763', flag: '#ff5d73', tee: '#47b863', post: '#ff9f43', postEdge: '#c96a12',
      bumper: '#a77bff', bumperEdge: '#6b45c9', bumperHi: '#e3d4ff', hub: '#ffd23f'
    },
    pirate: {
      bg: ['#1b78b8', '#0e4a80'], base: '#f3d59b', baseEdge: '#c9a25c', grass: '#4cc46a', stripe: '#44b660', blade: ['#6fdc88', '#3aa255'],
      rail: '#b97a42', railEdge: '#7a4a1f', railHi: '#e3ab72', railDash: '#8f5a2c', block: '#8a5a2e', blockTop: '#a8743f', blockEdge: '#5e3a17',
      sand: '#f7dc9c', sandDot: '#e0bc6a', flag: '#1b1d4a', tee: '#3cae5a', post: '#a8743f', postEdge: '#5e3a17',
      bumper: '#ff9f43', bumperEdge: '#c96a12', bumperHi: '#ffe0b8', hub: '#7a4a1f'
    },
    space: {
      bg: ['#1a1450', '#07071f'], base: '#3a3f80', baseEdge: '#222658', grass: '#33c4b0', stripe: '#2db5a2', blade: ['#55dcc8', '#21a08e'],
      rail: '#d4dbff', railEdge: '#7b84c9', railHi: '#ffffff', railDash: '#4cc2ff', block: '#5a61a8', blockTop: '#7880c8', blockEdge: '#353a78',
      sand: '#c9c3e8', sandDot: '#a59ed0', flag: '#ffd23f', tee: '#26a796', post: '#8b8fb8', postEdge: '#555a8a',
      bumper: '#ff7ac6', bumperEdge: '#c94a92', bumperHi: '#ffd6ee', hub: '#ffd23f'
    }
  };

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---------- view: logical <-> screen ---------- */
  function layout(W, H, w, dpr) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    w.floor.forEach(function (p) { x0 = Math.min(x0, p.x0); y0 = Math.min(y0, p.y0); x1 = Math.max(x1, p.x1); y1 = Math.max(y1, p.y1); });
    var M = 7;   // the base border round the green
    x0 -= M; y0 -= M; x1 += M; y1 += M;
    var bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var sA = Math.min(W / bw, H / bh), sB = Math.min(W / bh, H / bw);
    var rot = sB > sA * 1.06, s = rot ? sB : sA;
    var v = { W: W, H: H, dpr: dpr, s: s, rot: rot };
    if (rot) { v.m = [0, s, -s, 0, W / 2 + s * cy, H / 2 - s * cx]; }
    else { v.m = [s, 0, 0, s, W / 2 - s * cx, H / 2 - s * cy]; }
    return v;
  }
  function toScreen(v, x, y) { var m = v.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  function toLogical(v, X, Y) {
    var m = v.m;
    return v.rot ? [(Y - m[5]) / v.s, (m[4] - X) / v.s] : [(X - m[4]) / v.s, (Y - m[5]) / v.s];
  }
  function vecToLogical(v, dX, dY) { return v.rot ? [dY / v.s, -dX / v.s] : [dX / v.s, dY / v.s]; }
  function logical(ctx, v) { var m = v.m, d = v.dpr; ctx.setTransform(m[0] * d, m[1] * d, m[2] * d, m[3] * d, m[4] * d, m[5] * d); }
  function screen(ctx, v) { ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); }

  function polyPath(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function linePath(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  function circle(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }

  /* ---------- small textures ---------- */
  var grassCache = {};
  function grassPattern(ctx, th, key, px) {
    var k = key + px;
    if (grassCache[k]) return grassCache[k];
    var c = document.createElement('canvas'), n = Math.max(32, Math.round(px));
    c.width = c.height = n;
    var g = c.getContext('2d'), r = rng(7);
    for (var i = 0; i < n * n / 9; i++) {
      g.fillStyle = th.blade[i % 2];
      g.globalAlpha = 0.25 + r() * 0.35;
      var x = r() * n, y = r() * n;
      g.fillRect(x, y, Math.max(1, n / 64), Math.max(1.5, n / 30));
    }
    grassCache[k] = ctx.createPattern(c, 'repeat');
    return grassCache[k];
  }

  /* ---------- background decorations (screen space) ---------- */
  function decoCandy(g, x, y, r, rr, k) {
    var cols = ['#ff5d73', '#ffd23f', '#4cc2ff', '#3ddc84', '#ff9f43', '#a77bff'];
    var col = cols[Math.floor(rr() * cols.length)];
    if (k < 0.32) {          // lollipop
      g.strokeStyle = '#fff'; g.lineWidth = r * 0.22; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + r * 0.2, y + r * 1.9); g.stroke();
      g.fillStyle = col; g.beginPath(); circle(g, x, y, r); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = r * 0.16;
      g.beginPath();
      for (var t = 0; t < 14; t += 0.25) { var a = t * 0.9, d = r * t / 14; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
      g.stroke();
    } else if (k < 0.6) {    // gumdrop
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + r * 0.55, r * 1.05, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(x - r, y + r * 0.5);
      g.bezierCurveTo(x - r, y - r * 1.1, x + r, y - r * 1.1, x + r, y + r * 0.5); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (var i = 0; i < 6; i++) { g.beginPath(); circle(g, x + (rr() - 0.5) * r * 1.3, y - rr() * r * 0.5, r * 0.08); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.25, r * 0.22, r * 0.35, -0.5, 0, Math.PI * 2); g.fill();
    } else if (k < 0.78) {   // wrapped sweet
      g.save(); g.translate(x, y); g.rotate(rr() * 3);
      g.fillStyle = col;
      g.beginPath(); g.moveTo(-r * 0.6, 0); g.lineTo(-r * 1.3, -r * 0.55); g.lineTo(-r * 1.3, r * 0.55); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(r * 0.6, 0); g.lineTo(r * 1.3, -r * 0.55); g.lineTo(r * 1.3, r * 0.55); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(0, 0, r * 0.75, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-r * 0.2, -r * 0.18, r * 0.3, r * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    } else {                 // sprinkles
      g.lineCap = 'round'; g.lineWidth = r * 0.18;
      for (var j = 0; j < 5; j++) {
        g.strokeStyle = cols[Math.floor(rr() * cols.length)];
        var a2 = rr() * 3, sx = x + (rr() - 0.5) * r * 2.4, sy = y + (rr() - 0.5) * r * 2.4;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a2) * r * 0.5, sy + Math.sin(a2) * r * 0.5); g.stroke();
      }
    }
  }
  function decoPirate(g, x, y, r, rr, k) {
    if (k < 0.45) {          // waves
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = r * 0.14; g.lineCap = 'round';
      for (var i = 0; i < 2; i++) {
        var yy = y + i * r * 0.5, xx = x + i * r * 0.4;
        g.beginPath(); g.moveTo(xx - r, yy); g.quadraticCurveTo(xx - r * 0.5, yy - r * 0.4, xx, yy); g.quadraticCurveTo(xx + r * 0.5, yy - r * 0.4, xx + r, yy); g.stroke();
      }
    } else if (k < 0.62) {   // starfish
      g.fillStyle = rr() < 0.5 ? '#ff9f43' : '#ff7ac6';
      g.beginPath();
      for (var p = 0; p < 10; p++) { var a = -Math.PI / 2 + p * Math.PI / 5, d = p % 2 ? r * 0.38 : r * 0.9; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); circle(g, x, y, r * 0.12); g.fill();
    } else if (k < 0.78) {   // barrel floating
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); circle(g, x + r * 0.15, y + r * 0.2, r * 0.8); g.fill();
      g.fillStyle = '#a8743f'; g.beginPath(); circle(g, x, y, r * 0.8); g.fill();
      g.strokeStyle = '#5e3a17'; g.lineWidth = r * 0.12; g.beginPath(); circle(g, x, y, r * 0.8); g.stroke();
      g.beginPath(); circle(g, x, y, r * 0.5); g.stroke();
      g.fillStyle = '#c99358'; g.beginPath(); circle(g, x, y, r * 0.44); g.fill();
    } else if (k < 0.9) {    // little boat
      g.save(); g.translate(x, y); g.rotate((rr() - 0.5) * 0.6);
      g.fillStyle = '#7a4a1f'; g.beginPath(); g.moveTo(-r * 1.2, 0); g.lineTo(r * 1.2, 0); g.lineTo(r * 0.8, r * 0.5); g.lineTo(-r * 0.8, r * 0.5); g.closePath(); g.fill();
      g.strokeStyle = '#5e3a17'; g.lineWidth = r * 0.1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 1.4); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(r * 0.08, -r * 1.3); g.lineTo(r * 0.9, -r * 0.2); g.lineTo(r * 0.08, -r * 0.2); g.closePath(); g.fill();
      g.fillStyle = '#1b1d4a'; g.beginPath(); g.moveTo(0, -r * 1.4); g.lineTo(-r * 0.5, -r * 1.25); g.lineTo(0, -r * 1.1); g.fill();
      g.restore();
    } else {                 // shell / rock
      g.fillStyle = '#ffe0d0'; g.beginPath(); g.moveTo(x, y + r * 0.5); g.arc(x, y + r * 0.5, r * 0.7, Math.PI, 0); g.closePath(); g.fill();
      g.strokeStyle = '#e8a890'; g.lineWidth = r * 0.07;
      for (var s = -2; s <= 2; s++) { g.beginPath(); g.moveTo(x, y + r * 0.5); g.lineTo(x + s * r * 0.3, y - r * 0.1); g.stroke(); }
    }
  }
  function decoSpace(g, x, y, r, rr, k) {
    if (k < 0.5) {           // twinkly star
      g.fillStyle = 'rgba(255,255,255,' + (0.5 + rr() * 0.5) + ')';
      var q = r * (0.25 + rr() * 0.35);
      g.beginPath(); g.moveTo(x, y - q); g.quadraticCurveTo(x, y, x + q, y); g.quadraticCurveTo(x, y, x, y + q);
      g.quadraticCurveTo(x, y, x - q, y); g.quadraticCurveTo(x, y, x, y - q); g.fill();
    } else if (k < 0.72) {   // planet
      var cols = [['#ff9f43', '#c96a12'], ['#4cc2ff', '#1a7fc0'], ['#ff7ac6', '#c94a92'], ['#3ddc84', '#1f9a57']], c = cols[Math.floor(rr() * cols.length)];
      var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
      g.fillStyle = gr; g.beginPath(); circle(g, x, y, r * 0.75); g.fill();
      if (rr() < 0.6) {
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = r * 0.1;
        g.beginPath(); g.ellipse(x, y, r * 1.25, r * 0.35, -0.35, 0, Math.PI * 2); g.stroke();
      }
    } else if (k < 0.85) {   // asteroid
      g.fillStyle = '#6a6f9e'; g.beginPath();
      for (var i = 0; i < 9; i++) { var a = i * Math.PI * 2 / 9, d = r * (0.5 + rr() * 0.25); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
      g.closePath(); g.fill();
      g.fillStyle = '#4c5080'; g.beginPath(); circle(g, x - r * 0.15, y - r * 0.1, r * 0.14); circle(g, x + r * 0.2, y + r * 0.15, r * 0.1); g.fill();
    } else {                 // little rocket
      g.save(); g.translate(x, y); g.rotate(rr() * 6.28);
      g.fillStyle = '#ff5d73'; g.beginPath(); g.moveTo(-r * 0.35, r * 0.5); g.lineTo(-r * 0.6, r * 0.85); g.lineTo(r * 0.6, r * 0.85); g.lineTo(r * 0.35, r * 0.5); g.fill();
      g.fillStyle = '#eef0ff'; g.beginPath(); g.moveTo(0, -r * 0.95); g.quadraticCurveTo(r * 0.45, -r * 0.4, r * 0.35, r * 0.6); g.lineTo(-r * 0.35, r * 0.6); g.quadraticCurveTo(-r * 0.45, -r * 0.4, 0, -r * 0.95); g.fill();
      g.fillStyle = '#4cc2ff'; g.beginPath(); circle(g, 0, -r * 0.2, r * 0.17); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-r * 0.2, r * 0.62); g.lineTo(0, r * 1.15); g.lineTo(r * 0.2, r * 0.62); g.fill();
      g.restore();
    }
  }

  /* ---------- the static layer ---------- */
  function buildStatic(w, theme, v) {
    var th = THEMES[theme];
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(v.W * v.dpr)); c.height = Math.max(1, Math.round(v.H * v.dpr));
    var g = c.getContext('2d');
    var s = v.s, def = w.def;
    var sh = vecToLogical(v, s * 0.7, s * 1.2);   // shadow offset (down-right on screen), in course units

    // background
    screen(g, v);
    var bg = g.createLinearGradient(0, 0, v.W * 0.3, v.H);
    bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
    g.fillStyle = bg; g.fillRect(0, 0, v.W, v.H);
    if (theme === 'space') {
      var rs = rng(99);
      for (var i = 0; i < v.W * v.H / 2500; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.2 + rs() * 0.6) + ')';
        g.fillRect(rs() * v.W, rs() * v.H, rs() < 0.9 ? 1 : 2, rs() < 0.9 ? 1 : 2);
      }
    }
    if (theme === 'candy') {   // soft polka dots
      var rd = rng(5);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      var step = Math.max(26, s * 9);
      for (var yy = 0; yy < v.H + step; yy += step) for (var xx = (yy / step) % 2 ? step / 2 : 0; xx < v.W + step; xx += step) {
        g.beginPath(); circle(g, xx, yy, step * 0.18); g.fill();
      }
    }
    // scattered decorations, never on the course
    var r = rng(def.id.charCodeAt(0) * 977 + def.id.charCodeAt(1) * 13 + 3);
    var size = Math.max(9, s * 4.2), gap = size * 3.1;
    var deco = theme === 'candy' ? decoCandy : theme === 'pirate' ? decoPirate : decoSpace;
    for (var gy = gap * 0.5; gy < v.H + gap; gy += gap) {
      for (var gx = gap * 0.5; gx < v.W + gap; gx += gap) {
        var px = gx + (r() - 0.5) * gap * 0.8, py = gy + (r() - 0.5) * gap * 0.8, sz = size * (0.7 + r() * 0.6), kind = r();
        var L = toLogical(v, px, py), clear = sz * 1.6 / s + 8, near = false;
        for (var a = 0; a < 8 && !near; a++) {
          var ax = L[0] + Math.cos(a * 0.785) * clear, ay = L[1] + Math.sin(a * 0.785) * clear;
          if (S.inPoly(w.floor[0].pts, ax, ay) || w.floor.some(function (f) { return S.inPoly(f.pts, ax, ay); })) near = true;
        }
        if (near || S.inPoly(w.floor[0].pts, L[0], L[1])) continue;
        if (w.def.tunnels && w.floor.length > 1 && nearTube(w, L[0], L[1], clear)) continue;
        deco(g, px, py, sz, r, kind);
      }
    }

    logical(g, v);
    // tunnel tube between separate greens (behind the base)
    w.tunnels.forEach(function (t) {
      if (w.floor.length < 2) return;
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(t.x + sh[0], t.y + sh[1]); g.bezierCurveTo(t.x + 30, t.y - 30, t.ox - 30, t.oy + 40, t.ox + sh[0], t.oy + sh[1]); g.stroke();
      g.strokeStyle = '#5a61a8'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(t.x, t.y); g.bezierCurveTo(t.x + 30, t.y - 30, t.ox - 30, t.oy + 40, t.ox, t.oy); g.stroke();
      g.strokeStyle = 'rgba(167,123,255,0.9)'; g.lineWidth = 4.4;
      g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(t.x, t.y); g.bezierCurveTo(t.x + 30, t.y - 30, t.ox - 30, t.oy + 40, t.ox, t.oy); g.stroke();
      g.restore();
    });

    // base (biscuit / beach / platform) with a soft shadow
    g.save();
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = s * 4 * v.dpr; g.shadowOffsetX = 0; g.shadowOffsetY = s * 2 * v.dpr;
    g.fillStyle = th.baseEdge; g.strokeStyle = th.baseEdge; g.lineWidth = 13;
    g.beginPath(); w.floor.forEach(function (f) { polyPath(g, f.pts); }); g.fill(); g.stroke();
    g.restore();
    g.save();
    g.lineJoin = 'round';
    g.fillStyle = th.base; g.strokeStyle = th.base; g.lineWidth = 10.5;
    g.translate(-sh[0] * 0.4, -sh[1] * 0.4);
    g.beginPath(); w.floor.forEach(function (f) { polyPath(g, f.pts); }); g.fill(); g.stroke();
    g.restore();
    logical(g, v);
    if (theme === 'space') {   // rivets round the platform
      g.fillStyle = '#7880c8';
      w.floor.forEach(function (f) {
        for (var i = 0; i < f.pts.length; i++) {
          var p = f.pts[i], q = f.pts[(i + 1) % f.pts.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.floor(len / 9);
          var nx = (q[1] - p[1]) / (len || 1), ny = -(p[0] - q[0]) / (len || 1);
          for (var k = 0; k < n; k++) {
            var t = (k + 0.5) / n, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
            // outside side of this edge
            var ox = x - ny * 4.2, oy = y + nx * 4.2;
            if (S.inPoly(f.pts, ox, oy)) { ox = x + ny * 4.2; oy = y - nx * 4.2; }
            g.beginPath(); circle(g, ox, oy, 0.7); g.fill();
          }
        }
      });
    }
    if (theme === 'candy') {   // icing dots on the biscuit
      var cols = ['#ff5d73', '#4cc2ff', '#ffd23f', '#3ddc84', '#a77bff'], ci = 0;
      w.floor.forEach(function (f) {
        for (var i = 0; i < f.pts.length; i++) {
          var p = f.pts[i], q = f.pts[(i + 1) % f.pts.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.floor(len / 7);
          var nx = (q[1] - p[1]) / (len || 1), ny = -(p[0] - q[0]) / (len || 1);
          for (var k = 0; k < n; k++) {
            var t = (k + 0.5) / n, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
            var ox = x - ny * 4.4, oy = y + nx * 4.4;
            if (S.inPoly(f.pts, ox, oy)) { ox = x + ny * 4.4; oy = y - nx * 4.4; }
            g.fillStyle = cols[ci++ % cols.length];
            g.save(); g.translate(ox, oy); g.rotate(ci); g.fillRect(-0.9, -0.35, 1.8, 0.7); g.restore();
          }
        }
      });
    }

    // grass: clip to the green, then paint stripes and blades in screen pixels
    g.save();
    g.beginPath(); w.floor.forEach(function (f) { polyPath(g, f.pts); });
    g.clip();
    g.fillStyle = th.grass; g.fillRect(-20, -20, def.w + 40, def.h + 40);
    g.fillStyle = th.stripe;
    for (var by = -6; by < def.h + 20; by += 24) g.fillRect(-20, by, def.w + 40, 12);
    screen(g, v);
    g.fillStyle = grassPattern(g, th, theme, Math.min(96, s * 14 * v.dpr) / v.dpr);
    g.globalAlpha = 0.9; g.fillRect(0, 0, v.W, v.H); g.globalAlpha = 1;
    logical(g, v);
    // soft vignette inside the rails
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 8;
    w.floor.forEach(function (f) { g.beginPath(); polyPath(g, f.pts); g.stroke(); });

    // hills: shaded mounds and bowls with contour rings
    w.hills.forEach(function (h) {
      var up = h.a > 0, lx = h.x - sh[0] * h.r * 0.12, ly = h.y - sh[1] * h.r * 0.12;
      var gr = g.createRadialGradient(up ? lx : h.x + sh[0] * h.r * 0.1, up ? ly : h.y + sh[1] * h.r * 0.1, 0, h.x, h.y, h.r);
      if (up) { gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.0)'); }
      else { gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(0.65, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
      g.fillStyle = gr; g.beginPath(); circle(g, h.x, h.y, h.r); g.fill();
      if (up) {   // shade on the far side of the light
        var gs = g.createRadialGradient(h.x - sh[0] * 2, h.y - sh[1] * 2, h.r * 0.3, h.x, h.y, h.r);
        gs.addColorStop(0, 'rgba(0,0,0,0)'); gs.addColorStop(0.8, 'rgba(0,0,0,0.12)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gs; g.beginPath(); circle(g, h.x, h.y, h.r); g.fill();
      }
      g.strokeStyle = up ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)'; g.lineWidth = 0.5;
      for (var k = 1; k <= 3; k++) { g.beginPath(); circle(g, h.x, h.y, h.r * k / 4); g.stroke(); }
    });
    // slopes: darker downhill, chevrons drawn per frame
    w.slopes.forEach(function (sl) {
      var l = Math.hypot(sl.ax, sl.ay) || 1, cx = (sl.x0 + sl.x1) / 2, cy = (sl.y0 + sl.y1) / 2, half = Math.max(sl.x1 - sl.x0, sl.y1 - sl.y0) / 2;
      var gr = g.createLinearGradient(cx - sl.ax / l * half, cy - sl.ay / l * half, cx + sl.ax / l * half, cy + sl.ay / l * half);
      gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = gr; g.beginPath(); polyPath(g, sl.pts); g.fill();
    });
    // sand
    w.sand.forEach(function (sd, i) {
      g.save();
      g.beginPath(); polyPath(g, sd.pts);
      g.fillStyle = th.sand; g.fill();
      g.clip();
      g.strokeStyle = 'rgba(160,110,30,0.35)'; g.lineWidth = 2.4; g.beginPath(); polyPath(g, sd.pts); g.stroke();
      var rr = rng(31 + i);
      g.fillStyle = th.sandDot;
      for (var k = 0; k < (sd.x1 - sd.x0) * (sd.y1 - sd.y0) / 6; k++) { g.beginPath(); circle(g, sd.x0 + rr() * (sd.x1 - sd.x0), sd.y0 + rr() * (sd.y1 - sd.y0), 0.35); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.4;   // raked lines
      for (var ry = sd.y0; ry < sd.y1; ry += 2.6) { g.beginPath(); g.moveTo(sd.x0, ry); g.quadraticCurveTo((sd.x0 + sd.x1) / 2, ry + 1.5, sd.x1, ry); g.stroke(); }
      g.restore();
    });
    // water bed
    w.water.forEach(function (wt) {
      g.save();
      g.beginPath(); polyPath(g, wt.pts);
      var gr = g.createLinearGradient(wt.x0, wt.y0, wt.x1, wt.y1);
      gr.addColorStop(0, '#5cc8ff'); gr.addColorStop(1, '#2a8fe0');
      g.fillStyle = gr; g.fill();
      g.clip();
      g.strokeStyle = 'rgba(10,60,120,0.45)'; g.lineWidth = 3.4; g.beginPath(); polyPath(g, wt.pts); g.stroke();
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.9; g.beginPath(); polyPath(g, wt.pts); g.stroke();
    });
    // belts: dark rubber with roller ends
    w.belts.forEach(function (b) {
      g.fillStyle = '#2e3266'; g.beginPath(); polyPath(g, b.pts); g.fill();
      g.strokeStyle = '#1b1d4a'; g.lineWidth = 0.8; g.stroke();
    });
    // bridges: planks and posts
    w.bridges.forEach(function (b) {
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.rect(b.x0 + sh[0], b.y0 + sh[1], b.x1 - b.x0, b.y1 - b.y0); g.fill();
      g.fillStyle = '#c99358'; g.beginPath(); g.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.fill();
      g.strokeStyle = '#8f5a2c'; g.lineWidth = 0.5;
      var vert = (b.y1 - b.y0) > (b.x1 - b.x0);
      if (vert) for (var y = b.y0 + 3; y < b.y1; y += 3) { g.beginPath(); g.moveTo(b.x0, y); g.lineTo(b.x1, y); g.stroke(); }
      else for (var x = b.x0 + 3; x < b.x1; x += 3) { g.beginPath(); g.moveTo(x, b.y0); g.lineTo(x, b.y1); g.stroke(); }
      g.restore();
    });
    // tee mat
    g.save();
    g.translate(w.tee.x, w.tee.y);
    g.fillStyle = 'rgba(0,0,0,0.15)'; roundRect(g, -6, -4.2, 12, 9.4, 2); g.fill();
    g.fillStyle = th.tee; roundRect(g, -6, -4.6, 12, 9.2, 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.5; roundRect(g, -5.2, -3.8, 10.4, 7.6, 1.5); g.stroke();
    g.restore();
    // tunnel mouths (holes); the swirl is drawn per frame
    w.tunnels.forEach(function (t) {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); circle(g, t.x, t.y, t.r + 1.6); g.fill();
      var gr = g.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r + 1);
      gr.addColorStop(0, '#05051a'); gr.addColorStop(0.7, '#1b1450'); gr.addColorStop(1, '#a77bff');
      g.fillStyle = gr; g.beginPath(); circle(g, t.x, t.y, t.r + 1); g.fill();
      // exit pad
      g.fillStyle = 'rgba(167,123,255,0.35)'; g.beginPath(); circle(g, t.ox, t.oy, 5); g.fill();
      g.strokeStyle = '#d6c4ff'; g.lineWidth = 0.7; g.beginPath(); circle(g, t.ox, t.oy, 5); g.stroke();
    });
    // gate tracks
    w.gates.forEach(function (gt) {
      var x0 = Math.min(gt.ax, gt.bx) - Math.abs(gt.mx), x1 = Math.max(gt.ax, gt.bx) + Math.abs(gt.mx);
      var y0 = Math.min(gt.ay, gt.by) - Math.abs(gt.my), y1 = Math.max(gt.ay, gt.by) + Math.abs(gt.my);
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 0.6; g.setLineDash([1.5, 1.5]);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
    });
    // spinner sweep circle (a hint of where the arms reach)
    w.spinners.forEach(function (sp) {
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.6; g.setLineDash([1.6, 2]);
      g.beginPath(); circle(g, sp.x, sp.y, sp.len + S.ARM_R); g.stroke(); g.setLineDash([]);
    });

    // cup
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); circle(g, w.cup.x, w.cup.y, S.CUP_R + 0.8); g.fill();
    var cg = g.createRadialGradient(w.cup.x + sh[0] * 0.6, w.cup.y + sh[1] * 0.6, 0.5, w.cup.x, w.cup.y, S.CUP_R);
    cg.addColorStop(0, '#1d2a1f'); cg.addColorStop(0.75, '#0b120c'); cg.addColorStop(1, '#2f4532');
    g.fillStyle = cg; g.beginPath(); circle(g, w.cup.x, w.cup.y, S.CUP_R); g.fill();
    g.restore();

    // blocks: raised with a shadow, then rails round everything
    logical(g, v);
    g.lineJoin = 'round'; g.lineCap = 'round';
    function railStroke(path, closed) {
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = S.RAIL * 2 + 0.6;
      g.save(); g.translate(sh[0], sh[1]); g.beginPath(); path(); g.stroke(); g.restore();
      g.strokeStyle = th.railEdge; g.lineWidth = S.RAIL * 2 + 0.5; g.beginPath(); path(); g.stroke();
      g.strokeStyle = th.rail; g.lineWidth = S.RAIL * 2 - 0.5;
      g.save(); g.translate(-sh[0] * 0.15, -sh[1] * 0.15); g.beginPath(); path(); g.stroke();
      g.strokeStyle = th.railDash; g.lineWidth = theme === 'space' ? 0.9 : S.RAIL * 2 - 0.5;
      g.setLineDash(theme === 'candy' ? [2.2, 2.2] : theme === 'pirate' ? [0.35, 5] : [0.3, 4.5]);
      g.lineCap = theme === 'space' ? 'round' : 'butt';
      g.beginPath(); path(); g.stroke(); g.setLineDash([]); g.lineCap = 'round';
      g.strokeStyle = th.railHi; g.globalAlpha = 0.65; g.lineWidth = 0.55;
      g.translate(-sh[0] * 0.25, -sh[1] * 0.25); g.beginPath(); path(); g.stroke();
      g.globalAlpha = 1; g.restore();
    }
    w.blocks.forEach(function (b) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.save(); g.translate(sh[0] * 1.4, sh[1] * 1.4); g.beginPath(); polyPath(g, b.pts); g.fill(); g.restore();
      g.fillStyle = th.block; g.beginPath(); polyPath(g, b.pts); g.fill();
      g.save(); g.beginPath(); polyPath(g, b.pts); g.clip();
      g.fillStyle = th.blockTop;
      if (theme === 'candy') {   // chocolate squares
        for (var y = b.y0; y < b.y1; y += 5) for (var x = b.x0; x < b.x1; x += 5) { roundRect(g, x + 0.7, y + 0.7, 3.6, 3.6, 0.8); g.fill(); }
      } else if (theme === 'pirate') {
        g.strokeStyle = th.blockEdge; g.lineWidth = 0.4;
        for (var y2 = b.y0; y2 < b.y1; y2 += 3.2) { g.beginPath(); g.moveTo(b.x0, y2); g.lineTo(b.x1, y2); g.stroke(); }
      } else {
        g.globalAlpha = 0.6; for (var y3 = b.y0 + 2; y3 < b.y1; y3 += 8) { g.fillRect(b.x0, y3, b.x1 - b.x0, 3); } g.globalAlpha = 1;
      }
      g.restore();
      railStroke(function () { polyPath(g, b.pts); });
    });
    w.floor.forEach(function (f) { railStroke(function () { polyPath(g, f.pts); }); });
    (def.walls || []).forEach(function (line) { railStroke(function () { linePath(g, line); }); });

    // posts (static circles; bumpers are drawn per frame so they can flash)
    w.circles.forEach(function (c) {
      if (c.k !== 'post') return;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); circle(g, c.x + sh[0] * 1.3, c.y + sh[1] * 1.3, c.r); g.fill();
      g.fillStyle = th.postEdge; g.beginPath(); circle(g, c.x, c.y, c.r); g.fill();
      g.fillStyle = th.post; g.beginPath(); circle(g, c.x - sh[0] * 0.25, c.y - sh[1] * 0.25, c.r * 0.86); g.fill();
      if (theme === 'pirate') {   // barrel top
        g.strokeStyle = th.postEdge; g.lineWidth = 0.4; g.beginPath(); circle(g, c.x - sh[0] * 0.25, c.y - sh[1] * 0.25, c.r * 0.6); g.stroke();
      } else if (theme === 'space') {
        g.fillStyle = th.postEdge; g.beginPath(); circle(g, c.x - c.r * 0.3, c.y - c.r * 0.1, c.r * 0.2); circle(g, c.x + c.r * 0.25, c.y + c.r * 0.3, c.r * 0.14); g.fill();
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.6;
        g.beginPath(); g.arc(c.x - sh[0] * 0.25, c.y - sh[1] * 0.25, c.r * 0.55, 0, 4.2); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); circle(g, c.x - sh[0] * 0.6 - c.r * 0.2, c.y - sh[1] * 0.6 - c.r * 0.2, c.r * 0.22); g.fill();
    });
    return c;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function nearTube(w, x, y, clear) {
    for (var i = 0; i < w.tunnels.length; i++) {
      var t = w.tunnels[i];
      for (var k = 0; k <= 10; k++) {   // sample the bezier
        var u = k / 10, a = (1 - u) * (1 - u) * (1 - u), b = 3 * (1 - u) * (1 - u) * u, c = 3 * (1 - u) * u * u, d = u * u * u;
        var px = a * t.x + b * (t.x + 30) + c * (t.ox - 30) + d * t.ox, py = a * t.y + b * (t.y - 30) + c * (t.oy + 40) + d * t.oy;
        if (Math.hypot(px - x, py - y) < clear + 4) return true;
      }
    }
    return false;
  }

  /* ---------- per frame ---------- */
  function frame(ctx, st) {
    var v = st.view, w = st.world, th = THEMES[st.theme], time = st.time, tick = st.tick;
    var sh = vecToLogical(v, v.s * 0.7, v.s * 1.2);
    screen(ctx, v);
    ctx.drawImage(st.layer, 0, 0, v.W, v.H);
    logical(ctx, v);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var still = st.reduced;

    // zones live inside the rails: clip everything below to the green
    ctx.save();
    ctx.beginPath(); w.floor.forEach(function (f) { polyPath(ctx, f.pts); }); ctx.clip();
    // water shimmer
    w.water.forEach(function (wt, i) {
      ctx.save(); ctx.beginPath(); polyPath(ctx, wt.pts); ctx.clip();
      if (w.bridges.length) {   // not over the bridge planks
        ctx.beginPath(); ctx.rect(wt.x0 - 5, wt.y0 - 5, wt.x1 - wt.x0 + 10, wt.y1 - wt.y0 + 10);
        w.bridges.forEach(function (b) { ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); });
        ctx.clip('evenodd');
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.6;
      for (var y = wt.y0 + 3; y < wt.y1; y += 5) {
        var off = still ? 0 : ((time * 6 + y * 3 + i * 7) % 18);
        ctx.setLineDash([3, 6, 1.5, 7.5]); ctx.lineDashOffset = -off;
        ctx.beginPath();
        for (var x = wt.x0; x <= wt.x1; x += 3) ctx.lineTo(x, y + Math.sin(x * 0.25 + time * (still ? 0 : 1.6) + y) * 0.7);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    });
    // slopes: chevrons sliding downhill
    w.slopes.forEach(function (sl) {
      var l = Math.hypot(sl.ax, sl.ay) || 1, ux = sl.ax / l, uy = sl.ay / l, px = -uy, py = ux;
      ctx.save(); ctx.beginPath(); polyPath(ctx, sl.pts); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.3;
      var cx = (sl.x0 + sl.x1) / 2, cy = (sl.y0 + sl.y1) / 2, span = Math.max(sl.x1 - sl.x0, sl.y1 - sl.y0), off = still ? 0 : (time * 6) % 12;
      for (var d = -span; d < span; d += 12) for (var e = -span; e < span; e += 16) {
        var bx = cx + ux * (d + off) + px * e, by = cy + uy * (d + off) + py * e;
        ctx.beginPath(); ctx.moveTo(bx - ux * 2.5 + px * 3, by - uy * 2.5 + py * 3); ctx.lineTo(bx, by); ctx.lineTo(bx - ux * 2.5 - px * 3, by - uy * 2.5 - py * 3); ctx.stroke();
      }
      ctx.restore();
    });
    // belts: moving yellow chevrons
    w.belts.forEach(function (b) {
      var l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l, px = -uy, py = ux;
      ctx.save(); ctx.beginPath(); polyPath(ctx, b.pts); ctx.clip();
      var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, span = Math.max(b.x1 - b.x0, b.y1 - b.y0), off = still ? 0 : (time * l * 0.25) % 10;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5;
      for (var d0 = -span; d0 < span; d0 += 5) { var q = d0 + (off % 5); ctx.beginPath(); ctx.moveTo(cx + ux * q - px * span, cy + uy * q - py * span); ctx.lineTo(cx + ux * q + px * span, cy + uy * q + py * span); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,210,63,0.85)'; ctx.lineWidth = 1.4;
      var across = Math.min(b.x1 - b.x0, b.y1 - b.y0);
      if (Math.abs(ux) > 0.5) across = b.y1 - b.y0; else across = b.x1 - b.x0;
      for (var d = -span; d < span; d += 10) for (var e = -across / 2 + 5; e < across / 2; e += 10) {
        var bx = cx + ux * (d + off) + px * e, by = cy + uy * (d + off) + py * e;
        ctx.beginPath(); ctx.moveTo(bx - ux * 2.5 + px * 3, by - uy * 2.5 + py * 3); ctx.lineTo(bx, by); ctx.lineTo(bx - ux * 2.5 - px * 3, by - uy * 2.5 - py * 3); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#8b8fb8'; ctx.lineWidth = 1.2; ctx.beginPath(); polyPath(ctx, b.pts); ctx.stroke();
    });
    ctx.restore();
    // tunnels: swirling mouth and a glowing exit
    w.tunnels.forEach(function (t) {
      var a = still ? 0 : time * 3;
      ctx.lineWidth = 0.9;
      for (var k = 0; k < 3; k++) {
        ctx.strokeStyle = 'rgba(214,196,255,' + (0.8 - k * 0.2) + ')';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (0.9 - k * 0.25), a + k * 2, a + k * 2 + 2.6); ctx.stroke();
      }
      var pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * 4);
      ctx.strokeStyle = 'rgba(214,196,255,' + (0.3 + pulse * 0.5) + ')'; ctx.lineWidth = 0.8;
      ctx.beginPath(); circle(ctx, t.ox, t.oy, 5 + pulse * 1.5); ctx.stroke();
      // arrow showing which way it comes out
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
      var ax = t.ox + t.dx * 7.5, ay = t.oy + t.dy * 7.5;
      ctx.beginPath(); ctx.moveTo(ax - t.dx * 2 - t.dy * 2, ay - t.dy * 2 + t.dx * 2); ctx.lineTo(ax, ay); ctx.lineTo(ax - t.dx * 2 + t.dy * 2, ay - t.dy * 2 - t.dx * 2); ctx.stroke();
    });
    // bumpers (flash and swell when hit)
    w.circles.forEach(function (c) {
      if (c.k !== 'bumper') return;
      var since = (tick - c.hit) / 120, f = since < 0.25 ? 1 - since / 0.25 : 0;
      var r = c.r * (1 + (still ? 0 : 0.18 * f));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); circle(ctx, c.x + sh[0] * 1.3, c.y + sh[1] * 1.3, c.r); ctx.fill();
      ctx.fillStyle = th.bumperEdge; ctx.beginPath(); circle(ctx, c.x, c.y, r); ctx.fill();
      ctx.fillStyle = f > 0 ? '#fff' : th.bumper; ctx.beginPath(); circle(ctx, c.x - sh[0] * 0.2, c.y - sh[1] * 0.2, r * 0.84); ctx.fill();
      ctx.fillStyle = th.bumperHi; ctx.beginPath(); circle(ctx, c.x - sh[0] * 0.2, c.y - sh[1] * 0.2, r * 0.42); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); circle(ctx, c.x - sh[0] * 0.5 - r * 0.25, c.y - sh[1] * 0.5 - r * 0.25, r * 0.18); ctx.fill();
      if (f > 0) { ctx.strokeStyle = 'rgba(255,255,255,' + f + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); circle(ctx, c.x, c.y, r + 2 * (1 - f) + 1); ctx.stroke(); }
    });
    // moving things: gates and spinner arms
    var mv = w.moving;
    if (w.hasMovers && !mv.length) S.placeMovers(w, tick);
    w.gates.forEach(function (gt, i) {
      var m = mv[w.spinners.reduce(function (n, s) { return n + s.arms; }, 0) + i];
      if (!m) return;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = S.GATE_R * 2;
      ctx.beginPath(); ctx.moveTo(m.ax + sh[0] * 1.4, m.ay + sh[1] * 1.4); ctx.lineTo(m.bx + sh[0] * 1.4, m.by + sh[1] * 1.4); ctx.stroke();
      ctx.strokeStyle = st.theme === 'space' ? '#7880c8' : '#7a4a1f'; ctx.lineWidth = S.GATE_R * 2 + 0.4;
      ctx.beginPath(); ctx.moveTo(m.ax, m.ay); ctx.lineTo(m.bx, m.by); ctx.stroke();
      ctx.strokeStyle = st.theme === 'space' ? '#d4dbff' : '#c99358'; ctx.lineWidth = S.GATE_R * 2 - 1;
      ctx.beginPath(); ctx.moveTo(m.ax - sh[0] * 0.2, m.ay - sh[1] * 0.2); ctx.lineTo(m.bx - sh[0] * 0.2, m.by - sh[1] * 0.2); ctx.stroke();
      ctx.strokeStyle = st.theme === 'space' ? '#ffd23f' : '#8f5a2c'; ctx.lineWidth = S.GATE_R * 2 - 1;
      ctx.setLineDash(st.theme === 'space' ? [2, 2] : [0.3, 3.5]); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(m.ax - sh[0] * 0.2, m.ay - sh[1] * 0.2); ctx.lineTo(m.bx - sh[0] * 0.2, m.by - sh[1] * 0.2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'round';
    });
    var idx = 0;
    w.spinners.forEach(function (sp) {
      var arms = mv.slice(idx, idx + sp.arms); idx += sp.arms;
      arms.forEach(function (m) {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = S.ARM_R * 2;
        ctx.beginPath(); ctx.moveTo(m.ax + sh[0] * 1.6, m.ay + sh[1] * 1.6); ctx.lineTo(m.bx + sh[0] * 1.6, m.by + sh[1] * 1.6); ctx.stroke();
      });
      arms.forEach(function (m) {
        var pir = st.theme === 'pirate';
        ctx.strokeStyle = pir ? '#5e3a17' : '#353a78'; ctx.lineWidth = S.ARM_R * 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(m.ax, m.ay); ctx.lineTo(m.bx, m.by); ctx.stroke();
        ctx.strokeStyle = pir ? '#c99358' : '#d4dbff'; ctx.lineWidth = S.ARM_R * 2 - 0.9;
        ctx.beginPath(); ctx.moveTo(m.ax, m.ay); ctx.lineTo(m.bx, m.by); ctx.stroke();
        // handle knob / solar panel at the tip
        if (pir) {
          ctx.fillStyle = '#5e3a17'; ctx.beginPath(); circle(ctx, m.bx, m.by, S.ARM_R + 0.4); ctx.fill();
          ctx.fillStyle = '#a8743f'; ctx.beginPath(); circle(ctx, m.bx, m.by, S.ARM_R - 0.3); ctx.fill();
        } else {
          var dx = m.bx - m.ax, dy = m.by - m.ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
          ctx.fillStyle = '#4cc2ff'; ctx.strokeStyle = '#1a7fc0'; ctx.lineWidth = 0.4;
          ctx.beginPath();
          var tx = m.bx - ux * 5, ty = m.by - uy * 5;
          ctx.moveTo(tx - uy * 3.2, ty + ux * 3.2); ctx.lineTo(m.bx - uy * 3.2, m.by + ux * 3.2); ctx.lineTo(m.bx + uy * 3.2, m.by - ux * 3.2); ctx.lineTo(tx + uy * 3.2, ty - ux * 3.2); ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
      });
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); circle(ctx, sp.x + sh[0], sp.y + sh[1], 3.4); ctx.fill();
      ctx.fillStyle = th.hub; ctx.beginPath(); circle(ctx, sp.x, sp.y, 3.4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); circle(ctx, sp.x - 1, sp.y - 1, 1.1); ctx.fill();
    });

    // the aim line (under the balls)
    if (st.aim) drawAim(ctx, st, v);

    // other players' balls (dimmed) and the active ball
    st.balls.forEach(function (b) { if (b.show) drawBall(ctx, v, b, sh, time); });

    // flag: on screen it always stands up, whichever way the hole is turned
    screen(ctx, v);
    var cp = toScreen(v, w.cup.x, w.cup.y), fs = v.s;
    var lift = st.flagLift || 0;
    var poleH = fs * 15, wave = still ? 0 : Math.sin(time * 3.2);
    ctx.save();
    ctx.translate(cp[0], cp[1] - lift * fs * 6);
    ctx.globalAlpha = st.flagAlpha === undefined ? 1 : st.flagAlpha;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = fs * 0.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fs * 5, -fs * 2.4); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = fs * 0.7;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -poleH); ctx.stroke();
    ctx.fillStyle = th.flag;
    ctx.beginPath(); ctx.moveTo(0, -poleH);
    ctx.quadraticCurveTo(fs * 4, -poleH + fs * (0.6 + wave * 0.9), fs * 8.5, -poleH + fs * 2.6 + wave * fs * 0.5);
    ctx.quadraticCurveTo(fs * 4, -poleH + fs * (4.6 - wave * 0.6), 0, -poleH + fs * 5.4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(fs * 3.3) + 'px ' + 'ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(w.def.n), fs * 3.2, -poleH + fs * 2.75);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); circle(ctx, 0, -poleH, fs * 0.8); ctx.fill();
    ctx.restore();

    // particles (screen space)
    drawParticles(ctx, st);
    if (st.aim) drawPower(ctx, st, v);
  }

  function drawBall(ctx, v, b, sh, time) {
    var r = S.R * (b.scale === undefined ? 1 : b.scale);
    if (r <= 0.05) return;
    var x = b.x, y = b.y, hop = b.hop || 0;   // hop: height off the ground in course units
    ctx.globalAlpha = b.alpha === undefined ? 1 : b.alpha;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.32 - Math.min(0.2, hop * 0.02)) + ')';
    ctx.beginPath(); ctx.ellipse(x + sh[0] * (0.8 + hop * 0.15), y + sh[1] * (0.8 + hop * 0.15), r * 0.95, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
    var up = vecToLogical(v, 0, -v.s * hop);   // lift the ball up the screen
    x += up[0]; y += up[1];
    // trail
    if (b.trail && b.trail.length > 1) {
      for (var i = 0; i < b.trail.length; i++) {
        var t = b.trail[i], a = (i + 1) / b.trail.length;
        ctx.fillStyle = b.color; ctx.globalAlpha = a * 0.22 * (b.alpha === undefined ? 1 : b.alpha);
        ctx.beginPath(); circle(ctx, t[0], t[1], r * (0.4 + a * 0.5)); ctx.fill();
      }
      ctx.globalAlpha = b.alpha === undefined ? 1 : b.alpha;
    }
    if (b.glow) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + pulse * 0.4) + ')'; ctx.lineWidth = 0.6;
      ctx.beginPath(); circle(ctx, x, y, r + 1.4 + pulse * 0.8); ctx.stroke();
    }
    var lx = x - sh[0] * 0.35, ly = y - sh[1] * 0.35;
    var gr = ctx.createRadialGradient(lx - r * 0.2, ly - r * 0.2, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, b.color); gr.addColorStop(1, b.edge);
    ctx.fillStyle = gr; ctx.beginPath(); circle(ctx, x, y, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.45; ctx.beginPath(); circle(ctx, x, y, r - 0.2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function powerColor(p) {
    return p < 0.4 ? '#3ddc84' : p < 0.75 ? '#ffd23f' : '#ff5d73';
  }

  function drawAim(ctx, st, v) {
    var a = st.aim, b = a.ball, col = powerColor(a.power);
    var path = a.path;
    // dotted path, bending off walls
    var total = 0, seg, dotGap = 3.2, pos = dotGap * 0.8;
    ctx.fillStyle = '#fff';
    for (var i = 0; i + 1 < path.length; i++) {
      var p = path[i], q = path[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      while (pos <= total + L) {
        var t = (pos - total) / (L || 1), x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
        var fade = 1 - pos / (a.len + 1);
        ctx.globalAlpha = 0.25 + 0.75 * fade;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); circle(ctx, x + 0.25, y + 0.35, 0.95); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); circle(ctx, x, y, 0.9); ctx.fill();
        pos += dotGap;
      }
      total += L;
    }
    ctx.globalAlpha = 1;
    // pull-back band: from the ball toward the finger
    var bx = b.x, by = b.y, d = a.dir, back = 6 + a.power * 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - d[0] * back + 0.3, by - d[1] * back + 0.5); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - d[0] * back, by - d[1] * back); ctx.stroke();
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6;
    ctx.beginPath(); circle(ctx, bx - d[0] * back, by - d[1] * back, 2); ctx.fill(); ctx.stroke();
  }

  // power ring around the ball, in screen pixels so it reads the same on any hole
  function drawPower(ctx, st, v) {
    var a = st.aim, c = toScreen(v, a.ball.x, a.ball.y), p = a.power, col = powerColor(p);
    var R = Math.max(30, v.s * 8.5), lw = Math.max(7, v.s * 2);
    screen(ctx, v);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(10,12,40,0.55)'; ctx.lineWidth = lw + 4;
    ctx.beginPath(); ctx.arc(c[0], c[1], R, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(c[0], c[1], R, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    if (p > 0.01) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(c[0], c[1], R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    }
    // a little label with bars: easy to read without words
    var bars = Math.max(1, Math.ceil(p * 5));
    var bw = Math.max(5, v.s * 1.3), bh = Math.max(16, v.s * 4.5), gx = c[0] - (bw * 5 + 4 * 3) / 2, gy = c[1] - R - lw - bh - 6;
    if (gy < 4) gy = c[1] + R + lw + 6;
    for (var i = 0; i < 5; i++) {
      var h = bh * (0.4 + 0.15 * i);
      ctx.fillStyle = i < bars ? col : 'rgba(255,255,255,0.25)';
      ctx.strokeStyle = 'rgba(10,12,40,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(gx + i * (bw + 3), gy + bh - h, bw, h); ctx.stroke(); ctx.fill();
    }
  }

  function drawParticles(ctx, st) {
    var ps = st.particles, v = st.view;
    if (!ps.length) return;
    screen(ctx, v);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], a = 1 - p.age / p.life;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.ring) {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.w || 3;
        ctx.beginPath(); circle(ctx, p.x, p.y, p.r + (1 - a) * p.grow); ctx.stroke();
      } else {
        ctx.beginPath(); circle(ctx, p.x, p.y, p.r * (0.5 + a * 0.5)); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  root.GolfDraw = {
    THEMES: THEMES, layout: layout, toScreen: toScreen, toLogical: toLogical, vecToLogical: vecToLogical,
    buildStatic: buildStatic, frame: frame, powerColor: powerColor
  };
})(this);
