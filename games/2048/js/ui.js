(function () {
  var boardEl = document.getElementById('board');
  var tilesEl = document.getElementById('tiles');
  var game, busy = false, queued = -1;

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
    document.getElementById('undo-btn').disabled = !game.prev;
  }

  function showGain(g) {
    if (!g) return;
    var el = document.getElementById('gain');
    el.textContent = '+' + g;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  function overlayOpen() {
    return !!document.querySelector('.over:not(.hidden)');
  }

  function move(dir) {
    if (overlayOpen()) return;
    if (busy) { queued = dir; return; }   // a quick second swipe waits its turn
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
      if (res.merges.length) buzz(10);
      if (game.won && !game.keepGoing) { queued = -1; won(); return; }
      if (!game.canMove()) { queued = -1; setTimeout(over, 500); return; }
      if (queued >= 0) { var q = queued; queued = -1; move(q); }
    }, 110);
  }

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  function confetti() {
    var box = document.getElementById('confetti');
    var colors = ['#ffc53d', '#e5484d', '#3fb950', '#4fa3f7', '#a06cf0', '#f06ca8'];
    box.innerHTML = '';
    for (var k = 0; k < 40; k++) {
      var p = document.createElement('i');
      var a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170;
      p.style.background = colors[k % colors.length];
      p.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(a) * d + 120) + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ''; }, 2200);
  }

  function nudge(dir) {
    var d = [[-1, 0], [0, -1], [1, 0], [0, 1]][dir];
    tilesEl.style.transition = 'transform 0.06s';
    tilesEl.style.transform = 'translate(' + d[0] * 4 + 'px,' + d[1] * 4 + 'px)';
    setTimeout(function () { tilesEl.style.transform = ''; }, 70);
  }

  function won() {
    document.getElementById('won').classList.remove('hidden');
    confetti();
    buzz([30, 40, 30]);
  }

  function over() {
    document.getElementById('over-score').textContent = game.score;
    document.getElementById('over-best').textContent = game.best;
    document.getElementById('over-tile').textContent = LABEL[game.maxTile()] || String(1 << game.maxTile());
    var line = document.getElementById('over-best-line');
    var isBest = game.score > 0 && game.score >= game.best;
    line.classList.toggle('new', isBest);
    line.textContent = isBest ? 'New best score!' : 'Best ' + game.best;
    document.getElementById('over-undo').classList.toggle('hidden', !game.prev);
    boardEl.classList.add('dim');
    document.getElementById('over').classList.remove('hidden');
  }

  function undo() {
    if (busy || !game.undo()) return;
    queued = -1;
    document.getElementById('over').classList.add('hidden');
    boardEl.classList.remove('dim');
    render(null);
  }

  function newGame() {
    try { localStorage.removeItem(G2048.SAVE_KEY); } catch (e) {}
    game = new G2048();
    game.save();
    document.getElementById('over').classList.add('hidden');
    document.getElementById('won').classList.add('hidden');
    document.getElementById('ask').classList.add('hidden');
    boardEl.classList.remove('dim');
    queued = -1;
    render(null);
  }

  /* A game in progress is worth a second thought before it's thrown away. */
  function askNew() {
    if (overlayOpen()) return;
    if (game.score === 0) { newGame(); return; }
    document.getElementById('ask').classList.remove('hidden');
  }

  function resumeOrNew() {
    var saved = G2048.loadSaved();
    if (!saved) { newGame(); return; }
    game = new G2048(saved);
    if (!game.canMove()) { newGame(); return; }
    render(null);
    if (game.won && !game.keepGoing) won();
  }

  /* ---- input: swipes anywhere on the page, plus arrow keys ---- */
  var start = null;
  document.addEventListener('pointerdown', function (e) {
    if (start || e.target.closest('button, a')) return;   // ignore a second finger
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  document.addEventListener('pointerup', function (e) {
    if (!start || e.pointerId !== start.id) return;
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

  document.getElementById('restart-btn').addEventListener('click', askNew);
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('over-undo').addEventListener('click', undo);
  document.getElementById('ask-no').addEventListener('click', function () { document.getElementById('ask').classList.add('hidden'); });
  document.getElementById('ask-yes').addEventListener('click', newGame);
  document.getElementById('over-again').addEventListener('click', newGame);
  document.getElementById('won-go').addEventListener('click', function () {
    game.keepGoing = true; game.save();
    document.getElementById('won').classList.add('hidden');
    if (!game.canMove()) over();
  });
  document.getElementById('won-new').addEventListener('click', newGame);

  build();
  resumeOrNew();

  window.__g2048 = { game: function () { return game; }, move: move, newGame: newGame, undo: undo };
})();
