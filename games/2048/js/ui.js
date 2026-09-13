(function () {
  var boardEl = document.getElementById('board');
  var tilesEl = document.getElementById('tiles');
  var game, busy = false;

  var LABEL = ['', '2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096', '8192'];

  function build() {
    boardEl.querySelectorAll('.bg').forEach(function (b) { b.remove(); });
    for (var i = 0; i < N * N; i++) {
      var b = document.createElement('div');
      b.className = 'bg';
      boardEl.insertBefore(b, tilesEl);
    }
  }

  function pos(el, i) {
    el.style.setProperty('--r', Math.floor(i / N));
    el.style.setProperty('--c', i % N);
  }

  /* Draw the grid from scratch. `pop` lists indices that should bounce in. */
  function render(pop, merges) {
    tilesEl.innerHTML = '';
    for (var i = 0; i < N * N; i++) {
      var v = game.grid[i];
      if (!v) continue;
      var t = document.createElement('div');
      t.className = 'tile v' + Math.min(v, 13);
      if (pop && pop.indexOf(i) >= 0) t.className += ' new';
      if (merges && merges.indexOf(i) >= 0) t.className += ' merged';
      t.textContent = LABEL[v] || String(1 << v);
      t.dataset.i = i;
      pos(t, i);
      tilesEl.appendChild(t);
    }
    document.getElementById('score').textContent = game.score;
    document.getElementById('best').textContent = game.best;
  }

  function showGain(g) {
    if (!g) return;
    var el = document.getElementById('gain');
    el.textContent = '+' + g;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  function move(dir) {
    if (busy) return;
    var res = game.move(dir);
    if (!res) { nudge(dir); return; }
    busy = true;

    // Slide the existing tile elements to where they ended up, then redraw.
    var els = tilesEl.querySelectorAll('.tile');
    for (var k = 0; k < els.length; k++) {
      var i = +els[k].dataset.i;
      if (res.from[i] !== undefined) pos(els[k], res.from[i]);
    }
    setTimeout(function () {
      render([res.spawned], res.merges);
      showGain(res.gained);
      busy = false;
      if (game.won && !game.keepGoing) { won(); return; }
      if (!game.canMove()) setTimeout(over, 400);
    }, 110);
  }

  function nudge(dir) {
    var d = [[-1, 0], [0, -1], [1, 0], [0, 1]][dir];
    tilesEl.style.transition = 'transform 0.06s';
    tilesEl.style.transform = 'translate(' + d[0] * 4 + 'px,' + d[1] * 4 + 'px)';
    setTimeout(function () { tilesEl.style.transform = ''; }, 70);
  }

  function won() {
    document.getElementById('won').classList.remove('hidden');
  }

  function over() {
    document.getElementById('over-score').textContent = game.score;
    document.getElementById('over-best').textContent = game.best;
    document.getElementById('over').classList.remove('hidden');
  }

  function newGame() {
    try { localStorage.removeItem(G2048.SAVE_KEY); } catch (e) {}
    game = new G2048();
    game.save();
    document.getElementById('over').classList.add('hidden');
    document.getElementById('won').classList.add('hidden');
    render(null);
  }

  function resumeOrNew() {
    var saved = G2048.loadSaved();
    if (!saved) { newGame(); return; }
    game = new G2048(saved);
    if (!game.canMove()) { newGame(); return; }
    render(null);
  }

  /* ---- input: swipes anywhere on the page, plus arrow keys ---- */
  var start = null;
  document.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button, a')) return;
    start = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('pointerup', function (e) {
    if (!start) return;
    var dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 2 : 0);
    else move(dy > 0 ? 3 : 1);
  });
  document.addEventListener('pointercancel', function () { start = null; });
  document.addEventListener('keydown', function (e) {
    var map = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3 };
    if (map[e.key] !== undefined) { e.preventDefault(); move(map[e.key]); }
  });

  document.getElementById('restart-btn').addEventListener('click', newGame);
  document.getElementById('over-again').addEventListener('click', newGame);
  document.getElementById('won-go').addEventListener('click', function () {
    game.keepGoing = true; game.save();
    document.getElementById('won').classList.add('hidden');
  });
  document.getElementById('won-new').addEventListener('click', newGame);

  build();
  resumeOrNew();

  window.__g2048 = { game: function () { return game; }, move: move, newGame: newGame };
})();
