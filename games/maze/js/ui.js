/* Maze screen, on the arcade kit (kit/kit.js): canvas drawing and finger
   tracing. The walls and floor are drawn once into an offscreen layer per
   size; every frame adds the trail, the glowing treat and the animal, which
   glides from cell to cell instead of jumping. */
(function () {
  var ANIMALS = [
    ['🐭', '🧀', 'mouse', 'cheese'], ['🐰', '🥕', 'bunny', 'carrot'], ['🐶', '🦴', 'puppy', 'bone'],
    ['🐱', '🐟', 'kitty', 'fish'], ['🐼', '🎋', 'panda', 'bamboo'], ['🐿️', '🌰', 'squirrel', 'acorn'],
    ['🐻', '🍯', 'bear', 'honey'], ['🐒', '🍌', 'monkey', 'banana']
  ];
  // wall colours, one per animal: [main, under-edge]
  var WALLS = [['#4cc2ff', '#1a7fc0'], ['#3ddc84', '#1f9a57'], ['#ff9f43', '#c86a12'], ['#a77bff', '#6c45c9'],
               ['#2ee6c9', '#129a86'], ['#ff7ac6', '#c4428c'], ['#ffd23f', '#d69a00'], ['#ff5d73', '#c12c47']];
  var NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];

  var boardEl = document.getElementById('board');
  var canvas = document.getElementById('maze'), ctx = canvas.getContext('2d');
  var layer = document.createElement('canvas'), lctx = layer.getContext('2d');
  var game, S = 0, SH = 0, M = 0, cell = 0, dpr = 1;
  var stageEl = document.querySelector('.k-stage');
  var tracing = false, lastPt = null, celebrating = false;
  var anim = { x: 0, y: 0, hop: 0 }, hint = null, lastStep = 0, lastBump = 0, winAt = 0;

  function pair() { return ANIMALS[(game.level - 1) % ANIMALS.length]; }
  function walls() { return WALLS[(game.level - 1) % WALLS.length]; }
  function center(i) { return [M + (i % game.n + 0.5) * cell, M + (Math.floor(i / game.n) + 0.5) * cell]; }

  /* ---------- drawing ---------- */
  function layout() {
    if (!game) return;
    boardEl.style.setProperty('--k-aspect', game.n / game.rows);
    var w = boardEl.clientWidth, hh = boardEl.clientHeight;
    if (!w || !hh) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    S = w; SH = hh;
    canvas.width = layer.width = Math.round(S * dpr);
    canvas.height = layer.height = Math.round(SH * dpr);
    M = Math.min(S, SH) * 0.04;
    cell = Math.min((S - 2 * M) / game.n, (SH - 2 * M) / game.rows);
    var h = center(game.head());
    anim.x = h[0]; anim.y = h[1];
    drawLayer();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawLayer() {
    var n = game.n, N = n * game.rows, c = lctx, i, col = walls();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, S, SH);
    // floor: a soft checkerboard so little eyes can count cells
    roundRect(c, M, M, cell * n, cell * game.rows, cell * 0.2);
    c.fillStyle = '#22265e'; c.fill();
    c.save(); c.clip();
    c.fillStyle = '#272c6b';
    for (i = 0; i < N; i++) if ((i % n + Math.floor(i / n)) % 2) c.fillRect(M + (i % n) * cell, M + Math.floor(i / n) * cell, cell, cell);
    c.restore();
    // start pad
    var s = center(game.start);
    c.fillStyle = 'rgba(255, 255, 255, 0.08)';
    c.beginPath(); c.arc(s[0], s[1], cell * 0.42, 0, Math.PI * 2); c.fill();
    // walls: an under-edge, then the candy top, then a little shine
    var lw = Math.max(4, cell * 0.17);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    for (i = 0; i < N; i++) {
      var x = M + (i % n) * cell, y = M + Math.floor(i / n) * cell, m = game.cells[i];
      if (!(m & 1)) { c.moveTo(x, y); c.lineTo(x + cell, y); }
      if (!(m & 8)) { c.moveTo(x, y); c.lineTo(x, y + cell); }
      if (i % n === n - 1 && !(m & 2)) { c.moveTo(x + cell, y); c.lineTo(x + cell, y + cell); }
      if (i >= N - n && !(m & 4)) { c.moveTo(x, y + cell); c.lineTo(x + cell, y + cell); }
    }
    c.save(); c.translate(0, lw * 0.4); c.strokeStyle = col[1]; c.lineWidth = lw; c.stroke(); c.restore();
    c.strokeStyle = col[0]; c.lineWidth = lw; c.stroke();
    c.save(); c.translate(0, -lw * 0.12); c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = lw * 0.22; c.stroke(); c.restore();
  }

  function emoji(ch, x, y, size, rot, sc) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (sc) ctx.scale(sc, sc);
    ctx.globalAlpha = 1; ctx.fillStyle = '#000';   // WebKit tints colour glyphs with the fill's alpha
    ctx.font = Math.floor(size) + 'px -apple-system, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(ch, 0, size * 0.06);
    ctx.restore();
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (!game || !S || document.hidden) return;
    var i, p;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // hint: glowing dots along the way ahead
    if (hint && t < hint.until) {
      var fade = Math.min(1, (hint.until - t) / 400);
      for (i = 1; i < hint.cells.length; i++) {
        p = center(hint.cells[i]);
        var a = Kit.reduced ? 0.8 : 0.45 + 0.4 * Math.sin(t / 160 - i * 0.7);
        ctx.fillStyle = 'rgba(255, 255, 255,' + (a * fade).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p[0], p[1], cell * 0.13, 0, Math.PI * 2); ctx.fill();
      }
    } else hint = null;

    // the trail: a candy ribbon with an under-edge, and footprints
    if (game.path.length > 1) {
      ctx.beginPath();
      for (i = 0; i < game.path.length; i++) {
        p = center(game.path[i]);
        if (i === game.path.length - 1) p = [anim.x, anim.y];
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.save(); ctx.translate(0, cell * 0.05); ctx.strokeStyle = '#d69a00'; ctx.lineWidth = cell * 0.34; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = cell * 0.34; ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (i = 0; i < game.path.length - 1; i++) {
        p = center(game.path[i]);
        ctx.beginPath(); ctx.arc(p[0], p[1], cell * 0.06, 0, Math.PI * 2); ctx.fill();
      }
    }

    // the treat, glowing
    var g = center(game.goal), pulse = Kit.reduced ? 1 : 1 + 0.08 * Math.sin(t / 260);
    if (!winAt) {
      var halo = ctx.createRadialGradient(g[0], g[1], 0, g[0], g[1], cell * 0.62 * pulse);
      halo.addColorStop(0, 'rgba(255, 210, 63, 0.55)'); halo.addColorStop(1, 'rgba(255, 210, 63, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(g[0], g[1], cell * 0.62 * pulse, 0, Math.PI * 2); ctx.fill();
      emoji(pair()[1], g[0], g[1], cell * 0.66, Kit.reduced ? 0 : 0.12 * Math.sin(t / 400), pulse);
    }

    // the animal glides toward the head of the trail
    var h = center(game.head());
    var k = Kit.reduced ? 1 : 0.32;
    anim.x += (h[0] - anim.x) * k; anim.y += (h[1] - anim.y) * k;
    var moving = Math.abs(h[0] - anim.x) + Math.abs(h[1] - anim.y) > 0.5;
    var hop = 0, rot = 0, sc = 1;
    if (!Kit.reduced) {
      if (moving) { hop = -Math.abs(Math.sin(t / 60)) * cell * 0.08; rot = 0.12 * Math.sin(t / 60); }
      if (winAt) { var w = (t - winAt) / 1000; hop = -Math.abs(Math.sin(w * 9)) * cell * 0.3; sc = 1.15; }
      else if (tracing) sc = 1.12;
    }
    emoji(pair()[0], anim.x, anim.y + hop, cell * 0.8, rot, sc);
  }

  /* ---------- input ---------- */
  function cellAt(clientX, clientY) {
    var r = canvas.getBoundingClientRect(), f = S / r.width;
    var x = (clientX - r.left) * f - M, y = (clientY - r.top) * f - M;
    var c = Math.floor(x / cell), rr = Math.floor(y / cell);
    if (c < 0 || rr < 0 || c >= game.n || rr >= game.rows) return -1;
    return rr * game.n + c;
  }

  function stepSound(back) {
    var now = performance.now();
    if (now - lastStep < 45) return;
    lastStep = now;
    var note = NOTES[(game.path.length - 1) % NOTES.length];
    Kit.sfx.tone(back ? note * 0.75 : note, 0.06, 'sine', { vol: 0.05 });
  }

  function bump() {
    var now = performance.now();
    if (now - lastBump < 450) return;
    lastBump = now;
    Kit.sfx.tone(150, 0.07, 'triangle', { vol: 0.07 });
    Kit.buzz(8);
  }

  // Walk from the last finger position to the new one in small steps so a
  // fast swipe cannot skip cells (or cut corners through walls).
  function track(x, y) {
    var changed = false, back = false, before = game.path.length;
    if (lastPt) {
      var dx = x - lastPt[0], dy = y - lastPt[1];
      var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * 0.25)));
      for (var s = 1; s <= steps; s++) {
        var c = cellAt(lastPt[0] + dx * s / steps, lastPt[1] + dy * s / steps);
        if (c < 0) continue;
        if (game.moveTo(c)) changed = true;
        else if (c !== game.head() && game.path.indexOf(c) < 0) {
          var d = Math.abs(c - game.head());
          if (d === 1 || d === game.n) bump();
        }
      }
    }
    lastPt = [x, y];
    if (changed) {
      back = game.path.length < before;
      stepSound(back);
      game.save();
      hint = null;
      if (game.won()) finish();
    }
  }

  function onDown(e) {
    if (celebrating || Kit.overlayOpen()) return;
    e.preventDefault();
    var c = cellAt(e.clientX, e.clientY);
    if (c < 0) return;
    // start tracing by touching the animal, or anywhere on the trail (to rewind)
    if (c !== game.head() && game.path.indexOf(c) < 0) {
      // forgiving: also accept a touch in a cell right next to the head
      var h = game.head(), d = Math.abs(c - h);
      if (!(d === 1 || d === game.n)) { nudgeToAnimal(); return; }
    }
    tracing = true; lastPt = null;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    track(e.clientX, e.clientY);
  }
  function onMove(e) { if (tracing) { e.preventDefault(); track(e.clientX, e.clientY); } }
  function onUp() { tracing = false; lastPt = null; }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);

  // a touch far from the animal: point at it
  function nudgeToAnimal() {
    var r = canvas.getBoundingClientRect(), f = r.width / S;
    Kit.floatText('Start here!', r.left + anim.x * f, r.top + (anim.y - cell * 0.5) * f, '#ffd23f');
    Kit.sfx.tap();
  }

  /* ---------- levels ---------- */
  /* The maze stretches to the stage's shape when a level starts (a tall
     phone gets a tall maze); a saved maze keeps the shape it was made with. */
  function stageAspect() {
    var cs = getComputedStyle(stageEl);
    var W = stageEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = stageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return W > 0 && H > 0 ? W / H : 1;
  }

  function startLevel(level, path, rows, cols) {
    celebrating = false; tracing = false; winAt = 0; hint = null;
    Kit.closeAll();
    game = new MazeGame(level, path, stageAspect(), rows, cols);
    MazeGame.saveLevel(level);
    MazeGame.saveMax(level);
    Kit.stat('maze', 'Level ' + MazeGame.loadMax());
    game.save();
    var p = pair();
    document.getElementById('level').textContent = level;
    document.getElementById('goal-who').textContent = p[0];
    document.getElementById('goal-what').textContent = p[1];
    document.getElementById('goal-text').textContent = 'Help the ' + p[2] + ' find the ' + p[3] + '!';
    Kit.anim(document.getElementById('level-chip'), 'k-bump');
    layout();
  }

  function finish() {
    celebrating = true; tracing = false;
    var level = game.level, next = level + 1, p = pair();
    MazeGame.saveLevel(next);
    MazeGame.saveMax(next);
    Kit.stat('maze', 'Level ' + MazeGame.loadMax());
    Kit.drop(MazeGame.SAVE_KEY);
    winAt = performance.now();
    Kit.buzz([30, 40, 60]);
    Kit.sfx.pop(660); setTimeout(function () { Kit.sfx.pop(880); }, 120);
    var r = canvas.getBoundingClientRect(), f = r.width / S, g = center(game.goal);
    Kit.confetti({ x: r.left + g[0] * f, y: r.top + g[1] * f, count: 40 });
    setTimeout(function () {
      Kit.result({
        emoji: p[0] + p[1], wiggle: true, confetti: true,
        title: 'Yum! You did it!',
        text: 'The ' + p[2] + ' found the <b>' + p[3] + '</b>.',
        stats: [{ label: 'Level', value: level, hi: true }, { label: 'Steps', value: game.path.length - 1 }],
        buttons: [{ label: 'Again', value: 'again', icon: 'restart' }, { label: 'Next maze', value: 'next', primary: true }]
      }).then(function (v) { startLevel(v === 'again' ? level : next); });
    }, 900);
  }

  function showHint() {
    if (celebrating || Kit.overlayOpen()) return;
    var route = game.route(game.head());
    hint = { cells: route.slice(0, 9), until: performance.now() + 2600 };
    Kit.sfx.tone(880, 0.12, 'sine', { vol: 0.07, to: 1320 });
  }

  function pickLevel() {
    if (Kit.overlayOpen()) return;
    var max = MazeGame.loadMax(), html = '<div class="levels">';
    for (var l = 1; l <= max; l++) {
      var n = MazeGame.sizeFor(l);
      html += '<button class="k-btn' + (l === game.level ? ' k-btn--primary' : '') + '" data-l="' + l + '">' + l + '<small>' + (n < 8 ? 'small' : n < 12 ? 'medium' : 'big') + '</small></button>';
    }
    html += '</div>';
    Kit.sfx.open();
    Kit.sheet({
      title: 'Pick a maze', html: html,
      onOpen: function (card, close) {
        card.querySelector('.levels').addEventListener('click', function (e) {
          var b = e.target.closest('[data-l]');
          if (!b) return;
          Kit.sfx.tap();
          close(null);
          startLevel(+b.dataset.l);
        });
        var cur = card.querySelector('.k-btn--primary');
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
      }
    });
  }

  document.getElementById('restart-btn').addEventListener('click', function () {
    if (celebrating || Kit.overlayOpen() || game.path.length < 2) return;
    game.path = [game.start]; game.save();
    Kit.sfx.tone(700, 0.14, 'sine', { vol: 0.07, to: 350 });
  });
  document.getElementById('hint-btn').addEventListener('click', showHint);
  document.getElementById('levels-btn').addEventListener('click', pickLevel);

  var HOW = [
    { emoji: '🐭', text: 'Put your finger on the <b>animal</b>.' },
    { emoji: '👉', text: 'Drag it along the paths to the yummy <b>treat</b>.' },
    { emoji: '↩️', text: 'Wrong way? Slide back along your trail.' },
    { icon: 'hint', text: 'Stuck? The <b>hint</b> button shows the way.' }
  ];
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindHelp(document.getElementById('help-btn'), 'maze', HOW);

  /* Turning the device before the child has moved: re-shape the maze to the
     new screen (same level, same seed). Once a trail exists the maze keeps
     its shape so no progress is lost. */
  function reshape() {
    if (!game || celebrating || tracing || game.path.length > 1) return;
    var fresh = new MazeGame(game.level, null, stageAspect());
    if (fresh.n === game.n && fresh.rows === game.rows) return;
    game = fresh; hint = null;
    game.save();
    layout();
  }
  var reshapeT = 0;
  function onStage() { clearTimeout(reshapeT); reshapeT = setTimeout(reshape, 150); }
  if (window.ResizeObserver) { new ResizeObserver(layout).observe(boardEl); new ResizeObserver(onStage).observe(stageEl); }
  else window.addEventListener('resize', function () { layout(); onStage(); });

  var saved = MazeGame.loadSaved();
  // ignore anything odd left in storage (old builds, hand edits)
  function dim(v) { return v === undefined || (v === (v | 0) && v >= 2 && v <= 40); }
  if (!saved || typeof saved !== 'object' || !(saved.level === (saved.level | 0) && saved.level >= 1 && saved.level < 10000) ||
      !dim(saved.rows) || !dim(saved.cols) || (saved.path !== undefined && !Array.isArray(saved.path))) saved = null;
  if (saved && saved.level) {
    // saves from before mazes could stretch were square
    var k = MazeGame.sizeFor(saved.level);
    startLevel(saved.level, saved.path, saved.rows || k, saved.cols || k);
  }
  else startLevel(MazeGame.loadLevel());
  Kit.howTo('maze', HOW);
  requestAnimationFrame(frame);

  window.__maze = { game: function () { return game; }, center: center, startLevel: startLevel, geom: function () { return { S: S, M: M, cell: cell }; } };
})();
