/* Block Blast screen, on the arcade kit (kit/kit.js). Rules live in
   game.js / pieces.js; this file draws the board and tray, runs drag and
   drop, and makes line clears feel big. */
(function () {
  var boardEl = document.getElementById('board');
  var cellsEl = document.getElementById('cells');
  var trayEl = document.getElementById('tray');
  var game, cells = [], slots = [], ghost = null, drag = null;
  var bestAtStart = 0, dealt = false;

  var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  var sfx = {
    pick: function () { Kit.sfx.tone(660, 0.06, 'triangle', { vol: 0.08, to: 880 }); },
    drop: function () { Kit.sfx.place(); },
    bad: function () { Kit.sfx.tone(170, 0.12, 'triangle', { vol: 0.09, to: 120 }); },
    clear: function (lines, streak) {
      var n = Math.min(3 + lines * 2, SCALE.length), lift = 1 + Math.min(streak - 1, 3) * 0.06;
      for (var i = 0; i < n; i++) Kit.sfx.tone(SCALE[i] * lift, 0.22, 'triangle', { vol: 0.12, when: i * 0.055 });
    }
  };
  var WORDS = ['', 'Nice!', 'Great!', 'Amazing!', 'WOW!'];

  /* ---------- drawing ---------- */
  function build() {
    cellsEl.innerHTML = '';
    cells = [];
    for (var i = 0; i < SIZE * SIZE; i++) {
      var c = document.createElement('div');
      c.className = 'cell';
      cellsEl.appendChild(c);
      cells.push(c);
    }
  }

  function paint(el, color) {
    el.style.setProperty('--c', BB_COLORS[color]);
    el.style.setProperty('--e', BB_EDGES[color]);
  }

  function render() {
    for (var i = 0; i < cells.length; i++) {
      var v = game.board[i], el = cells[i];
      el.className = v ? 'cell blk' : 'cell';
      if (v) paint(el, v - 1); else { el.style.removeProperty('--c'); el.style.removeProperty('--e'); }
    }
    document.getElementById('score').textContent = game.score;
    document.getElementById('best').textContent = game.best;
    renderTray();
  }

  function pieceGrid(piece, holder) {
    holder.style.gridTemplateColumns = 'repeat(' + piece.cols + ', auto)';
    for (var r = 0; r < piece.rows; r++) {
      for (var c = 0; c < piece.cols; c++) {
        var d = document.createElement('i');
        var on = piece.cells.some(function (p) { return p[0] === r && p[1] === c; });
        if (on) { d.className = 'blk'; paint(d, piece.color); }
        holder.appendChild(d);
      }
    }
  }

  /* Tray blocks are as big as the slot allows (up to 2/3 of a board cell);
     small pieces get bigger blocks so they're easy to grab. */
  function sizeTray() {
    var cell = cells[0].getBoundingClientRect().width;
    slots.forEach(function (s, i) {
      var piece = game.tray[i];
      if (!piece) return;
      var w = s.clientWidth, h = s.clientHeight;
      var u = Math.min(cell * 0.66, w / (Math.max(piece.cols, 3) + 0.9), h / (Math.max(piece.rows, 3) + 0.9));
      s.style.setProperty('--u', Math.max(10, Math.floor(u)) + 'px');
    });
  }

  function renderTray() {
    trayEl.innerHTML = '';
    slots = [];
    var animate = dealt; dealt = false;
    game.tray.forEach(function (piece, slot) {
      var el = document.createElement('div');
      el.className = 'slot';
      el.style.setProperty('--i', slot);
      var p = document.createElement('div');
      p.className = 'piece';
      el.appendChild(p);
      if (!piece) el.className += ' empty';
      else {
        pieceGrid(piece, p);
        // Grey out a piece that has nowhere left to go.
        if (!game.fitsAnywhere(piece)) el.className += ' dead';
        if (animate && !Kit.reduced) el.className += ' deal';
        el.setAttribute('aria-label', 'Piece ' + (slot + 1));
      }
      el.addEventListener('pointerdown', function (e) { startDrag(e, slot, el); });
      trayEl.appendChild(el);
      slots.push(el);
    });
    sizeTray();
  }

  function metrics() {
    var a = cells[0].getBoundingClientRect(), b = cells[1].getBoundingClientRect();
    return { size: a.width, step: b.left - a.left, left: a.left, top: a.top };
  }

  /* ---------- drag and drop ---------- */
  function startDrag(e, slot, slotEl) {
    var piece = game.tray[slot];
    if (!piece || drag || Kit.overlayOpen()) return;
    e.preventDefault();
    var m = metrics();
    ghost = document.createElement('div');
    ghost.id = 'ghost';
    ghost.style.setProperty('--u', m.size + 'px');
    ghost.style.setProperty('--gap', (m.step - m.size) + 'px');
    var gp = document.createElement('div');
    gp.className = 'piece';
    pieceGrid(piece, gp);
    ghost.appendChild(gp);
    document.body.appendChild(ghost);
    slotEl.classList.add('dragging');
    sfx.pick();
    Kit.buzz(5);
    drag = {
      id: e.pointerId, slot: slot, piece: piece, slotEl: slotEl, m: m,
      w: piece.cols * m.step - (m.step - m.size),
      h: piece.rows * m.step - (m.step - m.size),
      last: '', lift: liftFor(m), x0: e.clientX, y0: e.clientY, moved: false
    };
    moveGhost(e.clientX, e.clientY);
    preview();
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  /* Lift the piece above the finger so a small hand doesn't cover the board.
     In landscape the board reaches almost to the bottom of the screen, so a
     full lift would put the finger below the screen for the bottom row; lift
     only as far as leaves that row reachable (never less than half a block). */
  function liftFor(m) {
    var lastRowBottom = m.top + (SIZE - 1) * m.step + m.size;
    var room = window.innerHeight - 12 - lastRowBottom + m.size * 0.5;
    return Math.max(m.size * 0.5, Math.min(m.size * 1.3 + 24, room));
  }
  function moveGhost(x, y) {
    var lift = drag.lift;
    drag.left = x - drag.w / 2;
    drag.top = y - drag.h - lift + drag.m.size * 0.5;
    ghost.style.transform = 'translate(' + drag.left + 'px,' + drag.top + 'px)';
  }

  function target() {
    var m = drag.m;
    return { r: Math.round((drag.top - m.top) / m.step), c: Math.round((drag.left - m.left) / m.step) };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 12) drag.moved = true;
    moveGhost(e.clientX, e.clientY);
    preview();
  }

  function clearPreview() {
    for (var i = 0; i < cells.length; i++) {
      var el = cells[i];
      if (el.classList.contains('preview')) { el.style.removeProperty('--c'); el.style.removeProperty('--e'); }
      el.classList.remove('preview', 'preview-bad', 'preview-clear');
    }
  }

  function preview() {
    var t = target(), key = t.r + ',' + t.c;
    if (key === drag.last) return;
    drag.last = key;
    clearPreview();
    var ok = game.canPlace(drag.piece, t.r, t.c);
    var onBoard = false;
    drag.piece.cells.forEach(function (p) {
      var r = t.r + p[0], c = t.c + p[1];
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
      onBoard = true;
      var el = cells[r * SIZE + c];
      if (ok) { el.classList.add('preview'); paint(el, drag.piece.color); }
      else if (!game.board[r * SIZE + c]) el.classList.add('preview-bad');
    });
    // Show which lines this drop would complete.
    if (ok) {
      var clear = game.wouldClear(drag.piece, t.r, t.c);
      clear.forEach(function (i) { cells[i].classList.add('preview-clear'); });
      if (clear.length) Kit.sfx.tone(990, 0.05, 'sine', { vol: 0.04 });
      else Kit.sfx.click();
    }
  }

  function onUp(e) {
    // A second finger must not drop (or cancel) the piece the first one holds.
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var t = target();
    var piece = drag.piece, slotEl = drag.slotEl, slot = drag.slot;
    // A plain tap on a piece just puts it back: no "wrong" buzz for that.
    var wasCancel = (e && e.type === 'pointercancel') || !drag.moved;
    var placed = wasCancel ? null : game.place(drag.slot, t.r, t.c);

    clearPreview();
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    slotEl.classList.remove('dragging');
    ghost = null; drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (!placed) {
      // Dropped somewhere it doesn't fit: the piece springs back to the tray.
      if (!wasCancel) sfx.bad();
      Kit.anim(slotEl, 'back');
      return;
    }
    afterPlace(placed, piece, t);
  }

  function afterPlace(placed, piece, t) {
    var trayWasFull = game.tray.filter(Boolean).length === 3 && placed;
    dealt = trayWasFull;   // all three gone: a new set was dealt
    render();
    // the blocks just put down bounce in
    piece.cells.forEach(function (p) {
      var i = (t.r + p[0]) * SIZE + t.c + p[1];
      if (game.board[i]) Kit.anim(cells[i], 'land');
    });
    if (placed.lines > 0) {
      var cr = t.r + piece.rows / 2, cc = t.c + piece.cols / 2;
      placed.cells.forEach(function (i) {
        var el = cells[i];
        // Ripple outwards from where the piece landed.
        var dist = Math.abs(Math.floor(i / SIZE) + 0.5 - cr) + Math.abs((i % SIZE) + 0.5 - cc);
        el.style.animationDelay = Math.round(dist * 22) + 'ms';
        el.classList.remove('land');
        el.classList.add('flash');
        setTimeout(function () { el.classList.remove('flash'); el.style.animationDelay = ''; }, 460 + dist * 22);
      });
      burst(placed, piece);
      showCombo(placed);
      sfx.clear(placed.lines, placed.streak);
      Kit.buzz(placed.lines > 1 ? [20, 30, 20] : 15);
    } else {
      sfx.drop();
    }
    var gained = placed.gained + piece.cells.length;
    Kit.anim(document.getElementById('score-chip'), 'k-bump');
    if (placed.lines) Kit.floatText('+' + gained, document.getElementById('score-chip'));
    if (bestAtStart > 0 && game.score > bestAtStart) {
      bestAtStart = 0;
      Kit.toast('New best score!', { icon: 'star', top: true });
      Kit.anim(document.getElementById('best-chip'), 'k-bump');
      Kit.sfx.good();
    }
    if (game.isOver()) setTimeout(gameOver, 900);
  }

  /* Little squares of the cleared colours fly off the board. Capped so a big
     combo doesn't cost an old phone any frames. */
  function burst(placed, piece) {
    if (!Element.prototype.animate || Kit.reduced) return;
    var m = metrics();
    var step = Math.max(1, Math.ceil(placed.cells.length / 28));
    for (var k = 0; k < placed.cells.length; k += step) {
      var i = placed.cells[k];
      var colorIdx = (placed.colors[k] || (piece.color + 1)) - 1;
      var d = document.createElement('div');
      var r = Math.floor(i / SIZE), c = i % SIZE;
      d.className = 'spark';
      d.style.width = d.style.height = (m.size * 0.45) + 'px';
      d.style.left = (m.left + c * m.step + m.size * 0.27) + 'px';
      d.style.top = (m.top + r * m.step + m.size * 0.27) + 'px';
      d.style.background = BB_COLORS[colorIdx];
      document.body.appendChild(d);
      var dx = (Math.random() - 0.5) * m.size * 4, dy = -m.size * (0.6 + Math.random() * 2);
      var anim = d.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 3) + 'deg) scale(0.2)', opacity: 0 }
      ], { duration: 560 + Math.random() * 240, easing: 'cubic-bezier(.2,.7,.4,1)', delay: 60 });
      anim.onfinish = (function (n) { return function () { if (n.parentNode) n.parentNode.removeChild(n); }; })(d);
    }
  }

  function showCombo(placed) {
    var el = document.getElementById('combo');
    var word = WORDS[Math.min(placed.lines, 4)];
    var sub = '+' + placed.gained;
    if (placed.streak > 1) sub = 'Combo x' + Math.min(placed.streak, 5) + '  ' + sub;
    el.innerHTML = Kit.esc(word) + '<small>' + Kit.esc(sub) + '</small>';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 1150);
  }

  /* ---------- game over / new game ---------- */
  function gameOver() {
    if (!game.isOver()) return;
    slots.forEach(function (s) { if (!s.classList.contains('empty')) Kit.anim(s, 'nope'); });
    Kit.sfx.bad();
    setTimeout(function () {
      var isBest = game.score > 0 && game.score >= game.best;
      boardEl.classList.add('dim');
      Kit.result({
        emoji: isBest ? '🌟' : '🧱',
        title: 'No room left!',
        text: 'None of your pieces fit anywhere now.',
        badge: isBest ? 'New best score!' : '',
        stats: [{ label: 'Score', value: game.score, hi: true }, { label: 'Best', value: game.best }],
        buttons: [{ label: 'Play again', value: 'again', primary: true }],
        sound: isBest ? 'win' : 'lose',
        confetti: isBest
      }).then(newGame);
    }, 600);
  }

  function newGame() {
    BBGame.clearSaved();
    game = new BBGame();
    game.save();
    bestAtStart = game.best;
    if (game.best) Kit.stat('blockblast', 'Best ' + game.best);
    Kit.closeAll();
    boardEl.classList.remove('dim');
    dealt = true;
    render();
    Kit.sfx.open();
  }

  function askNew() {
    if (Kit.overlayOpen() || drag) return;
    if (game.score === 0) { newGame(); return; }
    Kit.confirm({ title: 'Start a new game?', text: 'This board will be cleared.', yes: 'New game', no: 'Keep playing', emoji: '🤔' })
      .then(function (yes) { if (yes) newGame(); });
  }

  /* Pick up a saved board if there is one; a finished board starts fresh. */
  function resumeOrNew() {
    var saved = BBGame.loadSaved();
    if (!saved) { newGame(); return; }
    game = new BBGame(saved);
    if (game.isOver()) { newGame(); return; }
    bestAtStart = game.score < game.best ? game.best : 0;
    dealt = true;
    render();
  }

  var HOW = [
    { emoji: '👆', text: 'Drag a piece from the tray onto the board.' },
    { emoji: '🧱', text: 'Fill a whole <b>row</b> or <b>column</b> and it blasts away!' },
    { emoji: '✨', text: 'Clear lots of lines at once, or in a row, for big points.' },
    { emoji: '🙈', text: 'The game ends when no piece fits.' }
  ];
  document.getElementById('restart-btn').addEventListener('click', askNew);
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindHelp(document.getElementById('help-btn'), 'blockblast', HOW);
  if (window.ResizeObserver) new ResizeObserver(function () { if (game) sizeTray(); }).observe(trayEl);
  window.addEventListener('resize', function () { if (game) sizeTray(); });

  build();
  resumeOrNew();
  Kit.howTo('blockblast', HOW);

  window.__bb = {
    game: function () { return game; },
    newGame: newGame,
    render: render,
    placeAt: function (slot, r, c) {
      var piece = game.tray[slot];
      var res = game.place(slot, r, c);
      if (res) afterPlace(res, piece, { r: r, c: c }); else render();
      return res;
    }
  };
})();
