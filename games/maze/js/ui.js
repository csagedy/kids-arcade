/* Maze UI: canvas drawing and finger tracing. */
(function () {
  var ANIMALS = [['🐭', '🧀'], ['🐰', '🥕'], ['🐶', '🦴'], ['🐱', '🐟'], ['🐼', '🎋'], ['🐿️', '🌰'], ['🐻', '🍯'], ['🐒', '🍌']];
  var canvas = document.getElementById('maze'), ctx = canvas.getContext('2d');
  var game, size = 0, cell = 0, dpr = 1, tracing = false, lastPt = null, celebrating = false;
  var levelEl = document.getElementById('level'), hintEl = document.getElementById('hint');

  function pair() { return ANIMALS[(game.level - 1) % ANIMALS.length]; }

  function layout() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = rect.width;
    canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
    cell = size / game.n;
    draw();
  }

  function center(i) { return [(i % game.n + 0.5) * cell, (Math.floor(i / game.n) + 0.5) * cell]; }

  function draw() {
    var n = game.n, i;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // trail
    if (game.path.length > 1) {
      ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = cell * 0.42; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (i = 0; i < game.path.length; i++) {
        var p = center(game.path[i]);
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // walls
    ctx.strokeStyle = '#7fb4ff'; ctx.lineWidth = Math.max(3, cell * 0.12);
    ctx.beginPath();
    for (i = 0; i < n * n; i++) {
      var x = (i % n) * cell, y = Math.floor(i / n) * cell, m = game.cells[i];
      if (!(m & 1)) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (!(m & 8)) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      if (i % n === n - 1 && !(m & 2)) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      if (i >= n * (n - 1) && !(m & 4)) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
    }
    ctx.stroke();
    // goal and animal
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = Math.floor(cell * 0.7) + 'px -apple-system, "Apple Color Emoji", sans-serif';
    var g = center(game.goal), h = center(game.head());
    ctx.fillText(pair()[1], g[0], g[1] + cell * 0.04);
    ctx.fillText(pair()[0], h[0], h[1] + cell * 0.04);
  }

  function cellAt(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var c = Math.floor((clientX - r.left) / r.width * game.n), rr = Math.floor((clientY - r.top) / r.height * game.n);
    if (c < 0 || rr < 0 || c >= game.n || rr >= game.n) return -1;
    return rr * game.n + c;
  }

  // Walk from the last finger position to the new one in small steps so a fast
  // swipe cannot skip cells (or cut corners through walls).
  function track(x, y) {
    var changed = false;
    if (lastPt) {
      var dx = x - lastPt[0], dy = y - lastPt[1];
      var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * 0.25)));
      for (var s = 1; s <= steps; s++) {
        var c = cellAt(lastPt[0] + dx * s / steps, lastPt[1] + dy * s / steps);
        if (c >= 0 && game.moveTo(c)) changed = true;
      }
    }
    lastPt = [x, y];
    if (changed) {
      game.save();
      draw();
      if (game.won()) finish();
    }
  }

  function onDown(e) {
    if (celebrating) return;
    e.preventDefault();
    var c = cellAt(e.clientX, e.clientY);
    if (c < 0) return;
    // start tracing by touching the animal, or anywhere on the trail (to rewind)
    if (c !== game.head() && game.path.indexOf(c) < 0) {
      // forgiving: also accept a touch in a cell right next to the head
      var h = game.head(), d = Math.abs(c - h);
      if (!(d === 1 || d === game.n)) return;
    }
    tracing = true; lastPt = null;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    hintEl.classList.add('hidden');
    track(e.clientX, e.clientY);
  }
  function onMove(e) { if (tracing) { e.preventDefault(); track(e.clientX, e.clientY); } }
  function onUp() { tracing = false; lastPt = null; }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);

  function updateLevel() { levelEl.textContent = 'Level ' + game.level; }

  function startLevel(level, path) {
    celebrating = false; tracing = false;
    document.getElementById('win').classList.add('hidden');
    game = new MazeGame(level, path);
    MazeGame.saveLevel(level);
    game.save();
    updateLevel();
    layout();
    if (level === 1 && game.path.length === 1) hintEl.classList.remove('hidden');
  }

  function finish() {
    celebrating = true; tracing = false;
    var next = game.level + 1;
    MazeGame.saveLevel(next);
    try { localStorage.removeItem(MazeGame.SAVE_KEY); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(60);
    document.getElementById('win-emoji').textContent = pair()[0] + pair()[1];
    confetti();
    setTimeout(function () { document.getElementById('win').classList.remove('hidden'); }, 450);
    document.getElementById('win-next').onclick = function () { startLevel(next); };
  }

  function confetti() {
    var wrap = document.getElementById('confetti'), bits = ['🎉', '⭐', '✨', '🎈', '🌟'];
    wrap.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var s = document.createElement('span');
      s.textContent = bits[i % bits.length];
      s.style.left = (Math.random() * 94) + '%';
      s.style.animationDelay = (Math.random() * 0.5) + 's';
      s.style.fontSize = (18 + Math.random() * 16) + 'px';
      wrap.appendChild(s);
    }
  }

  document.getElementById('restart-btn').addEventListener('click', function () {
    game.path = [game.start]; game.save(); draw(); hintEl.classList.add('hidden');
  });
  window.addEventListener('resize', function () { if (game) layout(); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { if (game) layout(); }, 200); });

  var saved = MazeGame.loadSaved();
  if (saved && saved.level) startLevel(saved.level, saved.path);
  else startLevel(MazeGame.loadLevel());
})();
