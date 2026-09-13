(function () {
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var game = null, level = null;
  var drawing = -1;           // colour being drawn, or -1
  var cellPx = 0, pad = 0, dpr = 1;

  function loadLevel() {
    try { return Math.max(1, parseInt(localStorage.getItem('flow.level'), 10) || 1); } catch (e) { return 1; }
  }
  function saveLevel(n) {
    try {
      localStorage.setItem('flow.level', String(n));
      localStorage.setItem('arcade.stat.flow', 'Level ' + n);
    } catch (e) {}
  }

  function start(n, saved) {
    level = makeFlowLevel(n);
    game = new FlowGame(level, saved);
    drawing = -1;
    document.getElementById('level-n').textContent = n;
    document.getElementById('win').classList.add('hidden');
    saveLevel(n);
    game.save();
    layout();
    render();
  }

  /* Size the canvas to the space it has, square, crisp on retina. */
  function layout() {
    var wrap = canvas.parentNode;
    var side = Math.min(wrap.clientWidth, wrap.clientHeight) - 8;
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = side + 'px';
    canvas.width = canvas.height = Math.round(side * dpr);
    pad = 4;
    cellPx = (side - pad * 2) / game.size;
  }

  function center(cell) {
    var r = Math.floor(cell / game.size), c = cell % game.size;
    return { x: pad + (c + 0.5) * cellPx, y: pad + (r + 0.5) * cellPx };
  }

  function render() {
    var s = game.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.fillStyle = '#1e222b';
    roundRect(0, 0, pad * 2 + cellPx * s, pad * 2 + cellPx * s, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (var i = 1; i < s; i++) {
      ctx.beginPath(); ctx.moveTo(pad + i * cellPx, pad); ctx.lineTo(pad + i * cellPx, pad + s * cellPx); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, pad + i * cellPx); ctx.lineTo(pad + s * cellPx, pad + i * cellPx); ctx.stroke();
    }

    // filled cell tint + pipes
    game.paths.forEach(function (p, c) {
      if (!p.length) return;
      var col = FLOW_COLORS[c];
      ctx.fillStyle = hexA(col, 0.18);
      p.forEach(function (cell) {
        var r = Math.floor(cell / s), cc = cell % s;
        ctx.fillRect(pad + cc * cellPx + 1, pad + r * cellPx + 1, cellPx - 2, cellPx - 2);
      });
      if (p.length > 1) {
        ctx.strokeStyle = col;
        ctx.lineWidth = cellPx * 0.36;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        p.forEach(function (cell, k) {
          var pt = center(cell);
          if (k === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }
    });

    // dots
    game.pairs.forEach(function (pr, c) {
      [pr.a, pr.b].forEach(function (cell) {
        var pt = center(cell);
        ctx.fillStyle = FLOW_COLORS[c];
        ctx.beginPath(); ctx.arc(pt.x, pt.y, cellPx * 0.33, 0, Math.PI * 2); ctx.fill();
        if (game.isComplete(c)) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath(); ctx.arc(pt.x, pt.y, cellPx * 0.14, 0, Math.PI * 2); ctx.fill();
        }
      });
    });

    var done = game.paths.filter(function (_, c) { return game.isComplete(c); }).length;
    document.getElementById('flows').textContent = done + ' / ' + game.pairs.length;
    var pct = Math.round(game.filledCount() / game.N * 100);
    document.getElementById('fill').textContent = pct + '% full';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function hexA(hex, a) {
    var c = hex.replace('#', '');
    return 'rgba(' + parseInt(c.substr(0, 2), 16) + ',' + parseInt(c.substr(2, 2), 16) + ',' + parseInt(c.substr(4, 2), 16) + ',' + a + ')';
  }

  /* ---- pointer ---- */
  function cellFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left - pad, y = e.clientY - rect.top - pad;
    var c = Math.floor(x / cellPx), r = Math.floor(y / cellPx);
    if (c < 0 || r < 0 || c >= game.size || r >= game.size) return -1;
    return r * game.size + c;
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var cell = cellFromEvent(e);
    if (cell < 0) return;
    drawing = game.begin(cell);
    if (drawing >= 0) { canvas.setPointerCapture(e.pointerId); render(); }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (drawing < 0) return;
    e.preventDefault();
    var cell = cellFromEvent(e);
    if (cell < 0) return;
    // The finger may jump a cell on a fast stroke: walk toward it one step at a time.
    var guard = 0;
    while (guard++ < 4) {
      var p = game.paths[drawing];
      var head = p[p.length - 1];
      if (head === cell) break;
      var step = stepToward(head, cell);
      if (step < 0 || !game.extend(drawing, step)) break;
    }
    render();
  });

  function stepToward(from, to) {
    var s = game.size;
    var fr = Math.floor(from / s), fc = from % s, tr = Math.floor(to / s), tc = to % s;
    if (fr === tr && fc === tc) return -1;
    // Move along the longer axis first, then the other, so diagonals resolve.
    if (Math.abs(tc - fc) >= Math.abs(tr - fr)) return from + (tc > fc ? 1 : -1);
    return from + (tr > fr ? s : -s);
  }

  function endStroke() {
    if (drawing < 0) return;
    drawing = -1;
    game.moves++;
    game.save();
    render();
    if (game.allConnected()) setTimeout(win, 300);
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  function win() {
    var perfect = game.filledCount() === game.N;
    document.getElementById('win-n').textContent = game.level;
    document.getElementById('win-perfect').classList.toggle('hidden', !perfect);
    document.getElementById('win').classList.remove('hidden');
    saveLevel(game.level + 1);
  }

  document.getElementById('restart-btn').addEventListener('click', function () {
    game.reset(); game.save(); render();
  });
  document.getElementById('win-next').addEventListener('click', function () { start(game.level + 1); });
  document.getElementById('win-replay').addEventListener('click', function () {
    document.getElementById('win').classList.add('hidden');
    game.reset(); game.save(); render();
  });
  document.getElementById('prev-btn').addEventListener('click', function () { if (game.level > 1) start(game.level - 1); });
  document.getElementById('next-btn').addEventListener('click', function () {
    // Only levels already reached can be skipped to.
    if (game.level < loadLevel()) start(game.level + 1);
  });

  window.addEventListener('resize', function () { if (game) { layout(); render(); } });

  var saved = FlowGame.loadSaved();
  var reached = loadLevel();
  // Resume the board in play if it belongs to the current level.
  if (saved && saved.level && saved.level <= reached) start(saved.level, saved); else start(reached);

  window.__flow = { game: function () { return game; }, level: function () { return level; }, start: start, render: render };
})();
