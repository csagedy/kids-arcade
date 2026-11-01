/* Flow screen, on the arcade kit. The board is a canvas filling a .k-fit
   square; pipes are drawn as candy tubes (dark under-edge, bright body,
   highlight). While a finger draws, a soft bubble of the pipe's colour
   shows under it so kids can see past their own finger. Each step makes a
   little rising note; joining a pair pops and makes the pipe shimmer. */
(function () {
  var boardEl = document.getElementById('board');
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var game = null, level = null;
  var drawing = -1, activePointer = -1, finger = null;
  var W = 0, cellPx = 0, pad = 0, dpr = 1;
  var hinted = false;
  var flashes = [];          // { c, t0 } shimmering pipes
  var raf = 0;
  var STARS_KEY = 'flow.stars';
  var stars = Kit.load(STARS_KEY, {});
  if (!stars || typeof stars !== 'object' || Array.isArray(stars)) stars = {};

  // Clamped so a damaged value can't ask the level picker for a million buttons.
  function loadLevel() { return Math.min(5000, Math.max(1, parseInt(Kit.raw('flow.level'), 10) || 1)); }
  /* Only ever moves the "reached" level forward, so revisiting an older
     level never loses progress. */
  function saveLevel(n) {
    n = Math.max(n, loadLevel());
    Kit.setRaw('flow.level', String(n));
    Kit.stat('flow', 'Level ' + n);
  }

  function start(n, saved) {
    Kit.closeAll();
    level = makeFlowLevel(n);
    game = new FlowGame(level, saved);
    drawing = -1; activePointer = -1; finger = null; flashes = [];
    hinted = !!(saved && saved.hinted);
    document.getElementById('level-n').textContent = n;
    boardEl.classList.remove('won');
    saveLevel(n);
    persist();
    layout();
    render();
    updateNav();
  }
  function persist() {
    game.save();
    if (hinted) { var s = Kit.load(FlowGame.SAVE_KEY, null); if (s) { s.hinted = true; Kit.save(FlowGame.SAVE_KEY, s); } }
  }
  function updateNav() {
    document.getElementById('prev-btn').disabled = game.level <= 1;
    document.getElementById('next-btn').disabled = game.level >= loadLevel();
  }

  /* ---------- drawing ---------- */
  function layout() {
    var r = boardEl.getBoundingClientRect();
    W = Math.max(50, r.width);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(W * dpr);
    pad = Math.max(6, W * 0.022);
    cellPx = (W - pad * 2) / game.size;
  }
  function center(cell) {
    var r = Math.floor(cell / game.size), c = cell % game.size;
    return { x: pad + (c + 0.5) * cellPx, y: pad + (r + 0.5) * cellPx };
  }
  function rgb(hex) { var c = hex.replace('#', ''); return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function shade(hex, k) {   // k < 0 darker, > 0 lighter
    var c = rgb(hex).map(function (v) { return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); });
    return 'rgb(' + c.join(',') + ')';
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function stroke(p, color, width, dy) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    p.forEach(function (cell, k) {
      var pt = center(cell);
      if (k === 0) ctx.moveTo(pt.x, pt.y + dy); else ctx.lineTo(pt.x, pt.y + dy);
    });
    ctx.stroke();
  }

  function render(now) {
    now = now || performance.now();
    var s = game.size, cp = cellPx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);

    // board and empty cells
    ctx.fillStyle = '#12143a'; rr(0, W * 0.012, W, W, W * 0.04); ctx.fill();
    ctx.fillStyle = '#22265e'; rr(0, 0, W, W - W * 0.006, W * 0.04); ctx.fill();
    var g = cp * 0.06, cr = cp * 0.16;
    var owner = new Int8Array(game.N).fill(-1);
    game.paths.forEach(function (p, c) { p.forEach(function (cell) { owner[cell] = c; }); });
    for (var i = 0; i < game.N; i++) {
      var x = pad + (i % s) * cp, y = pad + Math.floor(i / s) * cp;
      ctx.fillStyle = owner[i] >= 0 ? rgba(FLOW_COLORS[owner[i]], game.isComplete(owner[i]) ? 0.3 : 0.18) : '#2b3074';
      rr(x + g, y + g, cp - 2 * g, cp - 2 * g, cr); ctx.fill();
    }

    // pipes: under-edge, body, highlight
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    game.paths.forEach(function (p, c) {
      if (p.length < 2) return;
      var col = FLOW_COLORS[c];
      stroke(p, shade(col, -0.35), cp * 0.38, cp * 0.05);
      stroke(p, col, cp * 0.36, 0);
      stroke(p, 'rgba(255,255,255,0.28)', cp * 0.09, -cp * 0.07);
    });

    // shimmer along freshly joined pipes
    var anim = false;
    flashes = flashes.filter(function (f) {
      var t = (now - f.t0) / 600;
      if (t >= 1) return false;
      anim = true;
      var p = game.paths[f.c];
      if (p.length < 2) return true;
      var head = t * (p.length + 2);
      ctx.save();
      for (var k = 0; k < p.length; k++) {
        var d = Math.abs(k - head + 1);
        if (d > 2) continue;
        var pt = center(p[k]);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * (1 - d / 2)) + ')';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, cp * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return true;
    });

    // dots
    game.pairs.forEach(function (pr, c) {
      var col = FLOW_COLORS[c], done = game.isComplete(c);
      [pr.a, pr.b].forEach(function (cell) {
        var pt = center(cell), r = cp * 0.33;
        ctx.fillStyle = shade(col, -0.35);
        ctx.beginPath(); ctx.arc(pt.x, pt.y + cp * 0.05, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(pt.x - r * 0.3, pt.y - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
        if (done) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, cp * 0.05);
          ctx.beginPath(); ctx.arc(pt.x, pt.y, r + cp * 0.06, 0, Math.PI * 2); ctx.stroke();
        }
      });
    });

    // the bubble under the finger
    if (drawing >= 0 && finger) {
      var col2 = FLOW_COLORS[drawing];
      ctx.fillStyle = rgba(col2, 0.28);
      ctx.beginPath(); ctx.arc(finger.x, finger.y, cp * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(col2, 0.6); ctx.lineWidth = 2;
      ctx.stroke();
    }

    renderStats();
    if (anim && !raf) raf = requestAnimationFrame(function (t) { raf = 0; render(t); });
  }

  function renderStats() {
    var done = 0;
    for (var c = 0; c < game.pairs.length; c++) if (game.isComplete(c)) done++;
    document.getElementById('flows').textContent = done + '/' + game.pairs.length;
    var pct = Math.round(game.filledCount() / game.N * 100);
    document.getElementById('fill').textContent = pct + '%';
    document.getElementById('fill-bar').style.width = pct + '%';
    document.querySelector('.fill-card').classList.toggle('full', pct === 100);
  }

  /* ---------- pointer ---------- */
  function local(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * W / rect.width, y: (e.clientY - rect.top) * W / rect.width };
  }
  function cellAt(pt) {
    var c = Math.floor((pt.x - pad) / cellPx), r = Math.floor((pt.y - pad) / cellPx);
    if (c < 0 || r < 0 || c >= game.size || r >= game.size) return -1;
    return r * game.size + c;
  }

  function note(len) { Kit.sfx.tone(392 * Math.pow(1.06, Math.min(len, 24)), 0.05, 'sine', { vol: 0.05 }); }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (drawing >= 0 || Kit.overlayOpen()) return;   // ignore a second finger
    var pt = local(e), cell = cellAt(pt);
    if (cell < 0) return;
    drawing = game.begin(cell);
    if (drawing >= 0) {
      activePointer = e.pointerId;
      finger = pt;
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      Kit.sfx.click();
      note(game.paths[drawing].length);
      render();
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (drawing < 0 || e.pointerId !== activePointer) return;
    e.preventDefault();
    var pt = local(e);
    finger = pt;
    var cell = cellAt(pt);
    if (cell >= 0) {
      var before = game.paths.map(function (p) { return p.length; });
      var wasDone = game.isComplete(drawing);
      // The finger may jump a cell on a fast stroke: walk toward it one step at a time.
      var guard = 0;
      while (guard++ < 6) {
        var p = game.paths[drawing];
        var head = p[p.length - 1];
        if (head === cell) break;
        var step = stepToward(head, cell);
        if (step < 0 || !game.extend(drawing, step)) break;
        note(game.paths[drawing].length);
      }
      // a cut through another pipe
      for (var o = 0; o < before.length; o++) {
        if (o !== drawing && game.paths[o].length < before[o]) { Kit.sfx.tone(180, 0.08, 'triangle', { vol: 0.07 }); break; }
      }
      if (!wasDone && game.isComplete(drawing)) joined(drawing);
    }
    render();
  });

  function joined(c) {
    flashes.push({ c: c, t0: performance.now() });
    Kit.sfx.pop(520 + c * 40);
    Kit.buzz(12);
    if (!game.allConnected()) Kit.anim(document.getElementById('flows-chip'), 'k-bump');
  }

  function stepToward(from, to) {
    var s = game.size;
    var fr = Math.floor(from / s), fc = from % s, tr = Math.floor(to / s), tc = to % s;
    if (fr === tr && fc === tc) return -1;
    // Move along the longer axis first, then the other, so diagonals resolve.
    if (Math.abs(tc - fc) >= Math.abs(tr - fr)) return from + (tc > fc ? 1 : -1);
    return from + (tr > fr ? s : -s);
  }

  function endStroke(e) {
    if (drawing < 0 || (e && e.pointerId !== activePointer)) return;
    drawing = -1; activePointer = -1; finger = null;
    game.moves++;
    persist();
    render();
    if (game.allConnected()) setTimeout(win, 350);
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  /* ---------- winning ---------- */
  function win() {
    if (!game.allConnected() || Kit.overlayOpen()) return;
    var perfect = game.filledCount() === game.N;
    var n = perfect && !hinted ? 3 : perfect ? 2 : 1;
    var had = stars[game.level] || 0;
    if (n > had) { stars[game.level] = n; Kit.save(STARS_KEY, stars); }
    var t0 = performance.now();
    game.paths.forEach(function (_, c) { flashes.push({ c: c, t0: t0 + c * 60 }); });
    render();
    boardEl.classList.remove('won'); void boardEl.offsetWidth; boardEl.classList.add('won');
    Kit.buzz([30, 40, 30]);
    saveLevel(game.level + 1);
    updateNav();
    var text = n === 3 ? 'Every square filled. Perfect!' :
      perfect ? 'Every square filled! Try it with no hints for 3 stars.' :
      'All joined! Fill <b>every</b> square for more stars.';
    setTimeout(function () {
      Kit.result({
        emoji: n === 3 ? '🌈' : '🎉', title: 'Level ' + game.level + ' done!', text: text,
        stars: n, confetti: true, wiggle: true,
        buttons: [{ label: 'Again', value: 'again' }, { label: 'Next level', value: 'next', primary: true }]
      }).then(function (v) {
        if (v === 'next') start(game.level + 1);
        else if (v === 'again') { hinted = false; game.reset(); persist(); render(); boardEl.classList.remove('won'); }
      });
    }, 450);
  }

  /* ---------- buttons ---------- */
  document.getElementById('restart-btn').addEventListener('click', function () {
    if (Kit.overlayOpen()) return;
    if (game.filledCount() === 0) return;
    function clear() {
      Kit.sfx.slide();
      hinted = false;
      game.reset(); persist(); render();
    }
    // A pipe or two is quick to redo; a mostly drawn board deserves a second thought.
    var joinedAny = game.pairs.some(function (_, c) { return game.isComplete(c); });
    if (!joinedAny) { clear(); return; }
    Kit.confirm({ title: 'Clear the board?', text: 'All the pipes will be wiped off.', yes: 'Clear it', no: 'Keep them', icon: 'restart' })
      .then(function (yes) { if (yes) clear(); });
  });
  document.getElementById('hint-btn').addEventListener('click', function () {
    if (!level || Kit.overlayOpen() || game.allConnected()) return;
    var c = game.hint(level.solution);
    if (c < 0) return;
    hinted = true;
    persist();
    flashes.push({ c: c, t0: performance.now() });
    Kit.sfx.open();
    render();
    if (game.allConnected()) setTimeout(win, 500);
  });
  document.getElementById('prev-btn').addEventListener('click', function () { if (game.level > 1) { Kit.sfx.tap(); start(game.level - 1); } });
  document.getElementById('next-btn').addEventListener('click', function () {
    // Only levels already reached can be skipped to.
    if (game.level < loadLevel()) { Kit.sfx.tap(); start(game.level + 1); }
  });
  document.getElementById('levels-btn').addEventListener('click', function () {
    if (Kit.overlayOpen()) return;
    var reached = loadLevel(), html = '<div class="lv-grid">';
    for (var i = 1; i <= reached; i++) {
      var st = stars[i] || 0, s = '';
      for (var k = 0; k < st; k++) s += '★';
      html += '<button class="k-btn' + (i === game.level ? ' cur k-btn--primary' : i === reached ? ' k-btn--blue' : '') + '" data-lv="' + i + '">' + i + (s ? '<small>' + s + '</small>' : '') + '</button>';
    }
    html += '</div>';
    Kit.sfx.open();
    Kit.sheet({
      title: 'Pick a level', html: html, buttons: [{ label: 'Close', value: null }],
      onOpen: function (card, close) {
        var gr = card.querySelector('.lv-grid'), cur = gr.querySelector('.cur');
        if (cur) gr.scrollTop = cur.offsetTop - gr.clientHeight / 2;
        gr.addEventListener('click', function (e) {
          var b = e.target.closest('[data-lv]');
          if (b) { Kit.sfx.tap(); close(+b.getAttribute('data-lv')); }
        });
      }
    }).then(function (n) { if (n) start(n); });
  });

  var HOWTO = [
    { emoji: '👆', text: 'Drag from a dot to the dot of the <b>same colour</b>.' },
    { emoji: '🚫', text: 'Pipes can’t cross. Drawing over a pipe cuts it.' },
    { emoji: '🟩', text: 'Join every colour and fill <b>every square</b> for 3 stars.' },
    { icon: 'hint', text: 'Stuck? The light bulb draws one pipe for you.' }
  ];
  Kit.bindHelp(document.getElementById('help-btn'), 'flow', HOWTO);
  Kit.bindMute(document.getElementById('mute-btn'));

  function relayout() { if (game) { layout(); render(); } }
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(boardEl);
  window.addEventListener('resize', relayout);

  var saved = FlowGame.loadSaved();
  var reached = loadLevel();
  // Resume the board in play if it belongs to a level already reached.
  // A board that was finished (the app closed before the result card was
  // tapped) moves on to the next level instead of showing a done puzzle.
  var savedLv = saved && typeof saved.level === 'number' && saved.level % 1 === 0 ? saved.level : 0;
  if (savedLv >= 1 && savedLv <= reached) {
    start(savedLv, saved);
    if (game.allConnected() && savedLv < reached) start(savedLv + 1);
  } else start(reached);
  Kit.howTo('flow', HOWTO);

  window.__flow = { game: function () { return game; }, level: function () { return level; }, start: start, render: render };
})();
