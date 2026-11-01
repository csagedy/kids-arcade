/* Dot to Dot screens, on the arcade kit.

   Library: pictures in three sections by size, each card a thumbnail that
   shows the finished picture, the part joined so far, or just the dots.
   Play: a .k-fit square canvas. Tap the next dot or slide a finger through
   the dots; each join draws its line out from the last dot with a rising
   note, and the last one floods the shape with colour. The next dot is
   forgiving to hit (small fingers, crowded pictures). */
(function () {
  var libEl = document.getElementById('lib');
  var playEl = document.getElementById('play');
  var boardEl = document.getElementById('board');
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var game = null, dpr = 1, W = 0, M = 0, S = 1;
  var hintUntil = 0, idleTimer = 0, doneAt = 0, blinkAt = 0, blinkTimer = 0, wrongAt = -1, wrongUntil = 0, raf = 0;
  var seg = null;           // { i, t0 } the line growing into dot i
  var bursts = [];          // { x, y, t0, c } rings where a dot was joined
  var down = false;
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  var SECTIONS = [
    { name: 'Little', sub: 'up to 8 dots', max: 8 },
    { name: 'Middle', sub: '9 to 14 dots', max: 14 },
    { name: 'Big', sub: '15 dots or more', max: 1e9 }
  ];

  /* ---------- picture details ----------
     The optional `details` of a picture (see pictures-data.js), drawn into
     any 2D context through X(x, y) -> [px, py] with s px per unit. Fills
     flood in with the main colour; the rest are "marks" that, once the
     picture is done, draw on / pop in one after another, then the eyes
     blink. t is ms since the picture was finished (Infinity = all shown). */
  var D_START = 750, D_DUR = 320;
  function marksOf(def) {   // eyes last: the picture "wakes up" at the end
    var m = (def.details || []).filter(function (d) { return d && d[0] !== 'fill' && d[0] !== 'disc'; });
    return m.filter(function (d) { return d[0] !== 'eye'; }).concat(m.filter(function (d) { return d[0] === 'eye'; }));
  }
  function markStep(def) { return Math.min(90, 1300 / Math.max(1, marksOf(def).length)); }
  /* When the last mark has finished arriving. */
  function detailsEnd(def) {
    var n = marksOf(def).length;
    return n ? D_START + (n - 1) * markStep(def) + D_DUR : 0;
  }
  function hasEyes(def) { return (def.details || []).some(function (d) { return d && d[0] === 'eye'; }); }

  function polyPath(g, X, pts) {
    g.beginPath();
    for (var i = 0; i < pts.length; i++) { var p = X(pts[i][0], pts[i][1]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  }
  function paintFills(g, def, X, s) {
    (def.details || []).forEach(function (d) {
      if (!d) return;
      if (d[0] === 'fill' && d[2] && d[2].length > 2) { g.fillStyle = d[1]; polyPath(g, X, d[2]); g.closePath(); g.fill(); }
      else if (d[0] === 'disc') { var c = X(d[2], d[3]); g.fillStyle = d[1]; g.beginPath(); g.arc(c[0], c[1], d[4] * s, 0, Math.PI * 2); g.fill(); }
    });
  }
  function backOut(p) { var q = p - 1; return 1 + 2.7 * q * q * q + 1.7 * q * q; }
  /* blink: 1 = eyes open, 0 = shut. Returns true while still animating. */
  function paintMarks(g, def, X, s, t, blink) {
    var marks = marksOf(def), step = markStep(def), busy = false;
    g.lineCap = 'round'; g.lineJoin = 'round';
    marks.forEach(function (d, i) {
      var p = (t - D_START - i * step) / D_DUR;
      if (p <= 0) { busy = true; return; }
      if (p < 1) busy = true; else p = 1;
      var k = d[0], c, r;
      if (k === 'line' && d[3] && d[3].length > 1) {
        var pts = d[3].map(function (q) { return X(q[0], q[1]); }), len = 0, segs = [];
        for (var a = 1; a < pts.length; a++) { var l = Math.hypot(pts[a][0] - pts[a - 1][0], pts[a][1] - pts[a - 1][1]); segs.push(l); len += l; }
        var want = len * p;
        g.strokeStyle = d[1]; g.lineWidth = Math.max(1, d[2] * s);
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (var b = 1; b < pts.length && want > 0; b++) {
          var f = Math.min(1, want / (segs[b - 1] || 1));
          g.lineTo(pts[b - 1][0] + (pts[b][0] - pts[b - 1][0]) * f, pts[b - 1][1] + (pts[b][1] - pts[b - 1][1]) * f);
          want -= segs[b - 1];
        }
        g.stroke();
      } else if (k === 'arc') {
        c = X(d[3], d[4]);
        var a0 = d[6] * Math.PI / 180, a1 = d[7] * Math.PI / 180;
        g.strokeStyle = d[1]; g.lineWidth = Math.max(1, d[2] * s);
        g.beginPath(); g.arc(c[0], c[1], d[5] * s, a0, a0 + (a1 - a0) * p); g.stroke();
      } else if (k === 'dot') {
        c = X(d[2], d[3]); r = d[4] * s * backOut(p);
        g.fillStyle = d[1];
        g.beginPath(); g.ellipse(c[0], c[1], Math.max(0.1, r), Math.max(0.1, (d[5] || d[4]) * s * backOut(p)), 0, 0, Math.PI * 2); g.fill();
      } else if (k === 'star') {
        c = X(d[2], d[3]); r = d[4] * s * backOut(p);
        var n = d[5] || 5, inner = n === 4 ? 0.32 : 0.45, rot = (1 - p) * 1.6;
        g.fillStyle = d[1];
        g.beginPath();
        for (var j = 0; j < n * 2; j++) {
          var ang = rot - Math.PI / 2 + j * Math.PI / n, rr2 = j % 2 ? r * inner : r;
          g.lineTo(c[0] + Math.cos(ang) * rr2, c[1] + Math.sin(ang) * rr2);
        }
        g.closePath(); g.fill();
      } else if (k === 'eye') {
        c = X(d[1], d[2]); r = d[3] * s * backOut(p);
        var open = Math.max(0.08, blink == null ? 1 : blink);
        if (r <= 0) return;
        if (d[4] === 'big') {   // white eye, dark pupil looking a touch inward-up
          g.fillStyle = '#fff';
          g.beginPath(); g.ellipse(c[0], c[1], r, r * 1.1 * open, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = DOT_INK;
          g.beginPath(); g.ellipse(c[0], c[1] + r * 0.12 * open, r * 0.58, r * 0.66 * open, 0, 0, Math.PI * 2); g.fill();
          if (open > 0.5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(c[0] - r * 0.2, c[1] - r * 0.15, r * 0.22, 0, Math.PI * 2); g.fill(); }
        } else {                 // a shiny dark bead
          g.fillStyle = DOT_INK;
          g.beginPath(); g.ellipse(c[0], c[1], r * 0.85, r * 1.15 * open, 0, 0, Math.PI * 2); g.fill();
          if (open > 0.5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(c[0] - r * 0.28, c[1] - r * 0.4, r * 0.3, 0, Math.PI * 2); g.fill(); }
        }
      }
    });
    return busy;
  }

  /* ---------- library ---------- */
  function showLibrary() {
    game = null;
    clearTimeout(idleTimer); clearTimeout(blinkTimer);
    Kit.closeAll();
    playEl.hidden = true;
    libEl.hidden = false;
    var done = DotsGame.doneSet();
    var grid = document.getElementById('lib-grid');
    grid.innerHTML = '';
    var list = DOT_PICTURES.slice().sort(function (a, b) { return a.points.length - b.points.length; });
    var k = 0, nDone = 0;
    SECTIONS.forEach(function (sec, si) {
      var lo = si ? SECTIONS[si - 1].max : 0;
      var items = list.filter(function (d) { return d.points.length > lo && d.points.length <= sec.max; });
      if (!items.length) return;
      var h = document.createElement('div');
      h.className = 'sec';
      h.innerHTML = '<h2>' + sec.name + '</h2><span>' + sec.sub + '</span>';
      grid.appendChild(h);
      var g = document.createElement('div');
      g.className = 'grid';
      grid.appendChild(g);
      items.forEach(function (def) {
        var isDone = !!done[def.id];
        if (isDone) nDone++;
        var part = isDone ? 0 : partial(def);
        var b = document.createElement('button');
        b.className = 'pic' + (isDone ? ' done' : '');
        b.style.setProperty('--i', k++);
        b.innerHTML = '<canvas></canvas><div class="pic-label"></div>' +
          (isDone ? '<span class="tick">' + Kit.icon('check') + '</span>' : part ? '<span class="part">' + part + '/' + def.points.length + '</span>' : '');
        b.querySelector('.pic-label').textContent = isDone ? def.name : def.points.length + ' dots';
        b.addEventListener('click', function () { Kit.sfx.tap(); open(def); });
        g.appendChild(b);
        b._def = def; b._done = isDone; b._part = part;
      });
    });
    document.getElementById('lib-done').textContent = nDone + '/' + DOT_PICTURES.length;
    requestAnimationFrame(drawThumbs);
  }
  function partial(def) { var n = parseInt(Kit.raw('dots.p.' + def.id), 10); return n > 0 && n < def.points.length ? n : 0; }

  function drawThumbs() {
    var tdpr = Math.min(2, window.devicePixelRatio || 1);
    Array.prototype.forEach.call(document.querySelectorAll('.pic'), function (b) {
      var c = b.querySelector('canvas'), w = c.clientWidth || 100;
      c.width = c.height = Math.round(w * tdpr);
      var g = c.getContext('2d'), def = b._def;
      g.setTransform(tdpr, 0, 0, tdpr, 0, 0);
      var m = w * 0.1, s = (w - 2 * m) / 100;
      function P(i) { return [m + def.points[i][0] * s, m + def.points[i][1] * s]; }
      var n = def.points.length;
      if (b._done) {
        g.fillStyle = def.color; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1.5, w * 0.018); g.lineJoin = 'round';
        g.beginPath();
        for (var i = 0; i < n; i++) { var p = P(i); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
        g.closePath(); g.fill();
        var TX = function (x, y) { return [m + x * s, m + y * s]; };
        paintFills(g, def, TX, s);
        g.beginPath();
        for (var i2 = 0; i2 < n; i2++) { var p2 = P(i2); if (i2) g.lineTo(p2[0], p2[1]); else g.moveTo(p2[0], p2[1]); }
        g.closePath(); g.stroke();
        paintMarks(g, def, TX, s, Infinity, 1);
        return;
      }
      if (b._part > 1) {
        g.strokeStyle = def.color; g.lineWidth = Math.max(2, w * 0.025); g.lineCap = g.lineJoin = 'round';
        g.beginPath();
        for (var j = 0; j < b._part; j++) { var q = P(j); if (j) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
        g.stroke();
      }
      for (var k = 0; k < n; k++) {
        var d = P(k);
        g.fillStyle = k < b._part ? def.color : '#aeb2e0';
        g.beginPath(); g.arc(d[0], d[1], Math.max(2, w * 0.022), 0, Math.PI * 2); g.fill();
      }
    });
  }

  /* ---------- play ---------- */
  function open(def) {
    Kit.closeAll();
    Kit.setRaw('dots.last', def.id);
    game = new DotsGame(def);
    libEl.hidden = true;
    playEl.hidden = false;
    document.getElementById('title').textContent = def.name;
    boardEl.style.setProperty('--pc', def.color);
    document.querySelector('.pic-card').style.setProperty('--pc', def.color);
    boardEl.classList.remove('cheer');
    seg = null; bursts = []; hintUntil = 0; wrongUntil = 0;
    doneAt = game.isDone() ? performance.now() - 60000 : 0;   // already finished: show it all
    blinkAt = 0;
    layout();
    render();
    armIdle();
    if (game.isDone()) armBlink(1500);
  }

  function layout() {
    if (!game) return;
    var r = boardEl.getBoundingClientRect();
    W = Math.max(50, r.width);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(W * dpr);
    M = W * 0.07;
    S = (W - 2 * M) / 100;
  }
  function PX(x, y) { return [M + x * S, M + y * S]; }
  function pt(i) { var p = game.points[i]; return { x: M + p[0] * S, y: M + p[1] * S }; }

  /* Dot radius: as big as reads well, but never so big that neighbours in a
     crowded picture overlap. */
  var minGap = {};
  function dotRadius() {
    var g = minGap[game.id];
    if (g === undefined) {
      g = 1e9;
      var P = game.points;
      for (var a = 0; a < P.length; a++) for (var b = a + 1; b < P.length; b++) {
        g = Math.min(g, Math.sqrt(Math.pow(P[a][0] - P[b][0], 2) + Math.pow(P[a][1] - P[b][1], 2)));
      }
      minGap[game.id] = g;
    }
    return Math.max(11, Math.min(W / 17, g * S * 0.47));
  }

  /* A finished picture with eyes blinks now and then (not with reduced
     motion). Each blink only redraws for its quarter second. */
  function armBlink(delay) {
    clearTimeout(blinkTimer);
    if (!game || !game.isDone() || !hasEyes(game.def) || Kit.reduced) return;
    var id = game.id;
    blinkTimer = setTimeout(function () {
      if (!game || game.id !== id || !game.isDone()) return;
      blinkAt = performance.now(); render();
      armBlink(2500 + Math.random() * 3500);
    }, delay);
  }
  /* Tapping a finished picture: it blinks and does a little happy wiggle. */
  function poke() {
    Kit.sfx.pop(620 + Math.random() * 200);
    Kit.buzz(8);
    if (Kit.reduced) return;
    if (hasEyes(game.def)) { blinkAt = performance.now(); render(); armBlink(3000 + Math.random() * 3000); }
    boardEl.classList.remove('cheer'); void boardEl.offsetWidth; boardEl.classList.add('cheer');
  }

  /* A reminder pulse if the kid pauses for a few seconds. */
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (game && !game.isDone()) { hintUntil = performance.now() + 2600; render(); }
    }, 5000);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shapePath(upto, close) {
    ctx.beginPath();
    for (var k = 0; k < upto; k++) { var q = pt(k); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    if (close) ctx.closePath();
  }

  function render(now) {
    if (!game) return;
    now = now || performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    var n = game.points.length, done = game.isDone(), anim = false;
    var col = game.color, r = dotRadius();

    // the paper: a deep night card with a soft glow
    ctx.fillStyle = '#12143a'; rr(0, W * 0.014, W, W - W * 0.014, W * 0.05); ctx.fill();
    var bg = ctx.createRadialGradient(W / 2, W * 0.3, W * 0.05, W / 2, W / 2, W * 0.75);
    bg.addColorStop(0, '#2b3075'); bg.addColorStop(1, '#1b1e52');
    ctx.fillStyle = bg; rr(0, 0, W, W - W * 0.01, W * 0.05); ctx.fill();

    // colour creeps in as the shape is joined, then floods in once complete
    var joinedTo = done ? n : game.next;
    if (joinedTo > 2) {
      var a = done ? Math.min(1, 0.25 + (now - doneAt) / 700 * 0.75) : 0.18;
      if (done && a < 1) anim = true;
      ctx.globalAlpha = a; ctx.fillStyle = col; shapePath(joinedTo, true); ctx.fill();
      if (done) {   // second colours, then a candy sheen from the top
        paintFills(ctx, game.def, PX, S);
        shapePath(n, true);
        var sh = ctx.createLinearGradient(0, M, 0, W - M);
        sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = sh; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // joined lines, the newest one growing out of its dot
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (joinedTo > 1) {
      var growing = seg && !done ? Math.min(1, (now - seg.t0) / 160) : 1;
      if (growing < 1) anim = true;
      var drawLine = function (w, color, dy) {
        ctx.strokeStyle = color; ctx.lineWidth = w;
        ctx.save(); ctx.translate(0, dy);
        ctx.beginPath();
        var last = done ? n : joinedTo;
        for (var k = 0; k < last; k++) {
          var q = pt(k);
          if (k === last - 1 && growing < 1 && !done) {
            var pq = pt(k - 1); q = { x: pq.x + (q.x - pq.x) * growing, y: pq.y + (q.y - pq.y) * growing };
          }
          if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
        }
        if (done) ctx.closePath();
        ctx.stroke(); ctx.restore();
      };
      var lw = Math.max(5, W * 0.016);
      drawLine(lw + 2, 'rgba(0,0,0,0.35)', lw * 0.4);
      drawLine(lw, done ? '#fff' : col, 0);
    }

    // the finished picture's eyes, smiles and windows arrive, then a blink
    if (done && game.def.details) {
      var since = Kit.reduced ? Infinity : now - doneAt;
      var bl = 1;
      if (!Kit.reduced && blinkAt && now >= blinkAt && now < blinkAt + 240) {
        bl = 1 - Math.sin(Math.PI * (now - blinkAt) / 240); anim = true;
      }
      if (paintMarks(ctx, game.def, PX, S, since, bl)) anim = true;
    }

    // rings where dots were joined
    bursts = bursts.filter(function (b) {
      var t = (now - b.t0) / 450;
      if (t >= 1) return false;
      anim = true;
      ctx.strokeStyle = b.c; ctx.globalAlpha = 1 - t; ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, r * (1 + t * 1.4), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      return true;
    });

    // dots and numbers
    if (!done) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var fs = Math.round(r * (n > 9 ? 1.05 : 1.2));
      ctx.font = '900 ' + fs + 'px ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif';
      for (var j = n - 1; j >= 0; j--) {
        var d = pt(j);
        var isNext = j === game.next, joined = j < game.next;
        var wrong = j === wrongAt && now < wrongUntil;
        var rad = r;
        if (isNext) {
          var hint = now < hintUntil;
          var beat = (Math.sin(now / (hint ? 110 : 320)) + 1) / 2;
          rad = r * (1.08 + (hint ? 0.22 : 0.06) * beat);
          anim = true;
          ctx.fillStyle = 'rgba(255,210,63,' + (0.18 + 0.2 * beat) + ')';
          ctx.beginPath(); ctx.arc(d.x, d.y, rad * 1.55, 0, Math.PI * 2); ctx.fill();
        }
        if (wrong) anim = true;
        var face = wrong ? '#ff5d73' : joined ? col : isNext ? '#ffd23f' : '#eef0ff';
        var edge = wrong ? '#c12c47' : joined ? 'rgba(0,0,0,0.35)' : isNext ? '#d69a00' : '#9da2d6';
        ctx.fillStyle = edge;
        ctx.beginPath(); ctx.arc(d.x, d.y + rad * 0.14, rad, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = face;
        ctx.beginPath(); ctx.arc(d.x, d.y, rad, 0, Math.PI * 2); ctx.fill();
        if (joined) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(d.x, d.y, rad, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = isNext ? '#3b2a00' : joined ? 'rgba(10,10,40,0.6)' : '#2a2f7a';
        ctx.fillText(String(j + 1), d.x, d.y + fs * 0.06);
      }
    }

    var shown = Math.min(game.next, n);
    document.getElementById('progress').textContent = shown + '/' + n;
    document.getElementById('next-n').textContent = done ? '★' : game.next + 1;
    document.getElementById('pic-bar').style.width = (shown / n * 100) + '%';
    if (anim && !raf) raf = requestAnimationFrame(function (t) { raf = 0; render(t); });
  }

  /* ---------- input ---------- */
  function local(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * W / rect.width, y: (e.clientY - rect.top) * W / rect.width };
  }
  function dist(p, i) { var q = pt(i); return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)); }

  function hit() {
    var i = game.next;
    var res = game.tap(i);
    var q = pt(i);
    seg = { i: i, t0: performance.now() };
    bursts.push({ x: q.x, y: q.y, t0: performance.now(), c: game.color });
    var step = PENTA[i % PENTA.length];
    Kit.sfx.tone(392 * Math.pow(2, step / 12), 0.16, 'sine', { vol: 0.12 });
    Kit.sfx.tone(784 * Math.pow(2, step / 12), 0.06, 'triangle', { vol: 0.03 });
    hintUntil = 0;
    game.misses = 0;
    Kit.buzz(8);
    Kit.anim(document.getElementById('next-chip'), 'k-bump');
    if (res === 'done') finish();
    else armIdle();
    render();
  }

  function finish() {
    game.markDone();
    doneAt = performance.now();
    down = false;
    clearTimeout(idleTimer);
    Kit.sfx.good();
    setTimeout(function () {
      boardEl.classList.remove('cheer'); void boardEl.offsetWidth; boardEl.classList.add('cheer');
      Kit.sfx.pop(660);
    }, 450);
    Kit.buzz([30, 40, 30]);
    var name = game.name, id = game.id, def = game.def;
    // the details pop in one by one, a soft tick for each face feature
    if (!Kit.reduced) {
      marksOf(def).forEach(function (d, i) {
        if (d[0] !== 'eye') return;
        setTimeout(function () { if (game && game.id === id) Kit.sfx.pop(760 + i * 12); }, D_START + i * markStep(def));
      });
      armBlink(detailsEnd(def) + 350);
    }
    setTimeout(function () {
      if (!game || game.id !== id) return;
      var nDone = Object.keys(DotsGame.doneSet()).length;
      Kit.result({
        emoji: '✨', title: name + '!', wiggle: true, confetti: true,
        text: 'You joined all <b>' + game.points.length + '</b> dots. ' + (nDone >= DOT_PICTURES.length ? 'Every picture done. Wow!' : nDone + ' of ' + DOT_PICTURES.length + ' pictures done.'),
        buttons: [{ label: 'All pictures', value: 'lib' }, { label: 'Next', value: 'next', primary: true, icon: 'next' }]
      }).then(function (v) {
        if (v === 'lib') showLibrary();
        else if (v === 'next') open(nextPicture());
      });
    }, Kit.reduced ? 1300 : Math.max(1300, detailsEnd(def) + 900));
  }
  /* The next picture by size that isn't finished yet (wrapping round). */
  function nextPicture() {
    var list = DOT_PICTURES.slice().sort(function (a, b) { return a.points.length - b.points.length; });
    var done = DotsGame.doneSet(), at = list.map(function (d) { return d.id; }).indexOf(game.id);
    for (var k = 1; k <= list.length; k++) {
      var d = list[(at + k) % list.length];
      if (!done[d.id]) return d;
    }
    return list[(at + 1) % list.length];
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!game || Kit.overlayOpen()) return;
    e.preventDefault();
    if (game.isDone()) { if (performance.now() - doneAt > detailsEnd(game.def) + 400) poke(); return; }
    down = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    var p = local(e), r = dotRadius();
    // the next dot wins anything near it
    if (dist(p, game.next) < Math.max(r * 2.1, W * 0.06)) { hit(); return; }
    var best = -1, bestD = Infinity;
    for (var i = game.next + 1; i < game.points.length; i++) {
      var dd = dist(p, i);
      if (dd < r * 1.4 && dd < bestD) { best = i; bestD = dd; }
    }
    if (best < 0) return;
    game.tap(best);   // counts the miss
    wrongAt = best; wrongUntil = performance.now() + 380;
    Kit.sfx.tone(240, 0.12, 'triangle', { vol: 0.08, to: 180 });
    // Two misses: pulse the right dot so nobody gets stuck.
    if (game.misses >= 2) hintUntil = performance.now() + 2000;
    armIdle();
    render();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || !game || game.isDone()) return;
    if (dist(local(e), game.next) < dotRadius() * 1.3) hit();
  });
  function up() { down = false; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* ---------- buttons ---------- */
  var HOWTO = [
    { emoji: '1️⃣', text: 'Find dot number <b>1</b>, then 2, then 3…' },
    { emoji: '👆', text: 'Tap each dot, or slide your finger from dot to dot.' },
    { emoji: '🟡', text: 'The <b>yellow</b> dot is always the next one.' },
    { emoji: '🎨', text: 'Join them all to colour in the picture!' }
  ];
  document.getElementById('back-btn').addEventListener('click', function () { Kit.sfx.tap(); showLibrary(); });
  document.getElementById('clear-btn').addEventListener('click', function () {
    if (!game || Kit.overlayOpen() || (game.next === 0)) return;
    Kit.confirm({ title: 'Start this picture again?', yes: 'Start over', emoji: '🔄' }).then(function (ok) {
      if (!ok || !game) return;
      game.reset(); hintUntil = 0; doneAt = 0; blinkAt = 0; seg = null; bursts = [];
      clearTimeout(blinkTimer);
      boardEl.classList.remove('cheer');
      Kit.sfx.slide();
      render(); armIdle();
    });
  });
  Kit.bindHelp(document.getElementById('help-btn'), 'dots', HOWTO);
  Kit.bindHelp(document.getElementById('lib-help'), 'dots', HOWTO);
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindMute(document.getElementById('lib-mute'));

  function relayout() { if (game) { layout(); render(); } else if (!libEl.hidden) drawThumbs(); }
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(boardEl);
  window.addEventListener('resize', relayout);

  var last = Kit.raw('dots.last');
  var def = DOT_PICTURES.filter(function (p) { return p.id === last; })[0];
  if (def && !DotsGame.doneSet()[def.id]) open(def); else showLibrary();
  Kit.howTo('dots', HOWTO);

  window.__dots = { game: function () { return game; }, open: open, render: render, pt: function (i) { return pt(i); }, W: function () { return W; } };
})();
