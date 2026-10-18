(function () {
  var boardEl = document.getElementById('board');
  var trayEl = document.getElementById('tray');
  var game, cells = [], ghost = null, drag = null;
  var muted = false;
  try { muted = localStorage.getItem('bb.mute') === '1'; } catch (e) {}

  /* ---- sound: tiny synthesised blips, no files. iOS only starts audio from a
     touch, so the context is created and resumed on the first pointerdown. ---- */
  var actx = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended' && actx.resume) actx.resume();
    return actx;
  }
  function tone(freq, when, dur, type, vol) {
    if (muted || !actx) return;
    try {
      var t = actx.currentTime + when;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];   // C major pentatonic-ish
  var sfx = {
    pick: function () { tone(660, 0, 0.06, 'triangle', 0.08); },
    drop: function () { tone(180, 0, 0.12, 'sine', 0.22); tone(120, 0.02, 0.14, 'sine', 0.18); },
    bad: function () { tone(160, 0, 0.12, 'sawtooth', 0.06); },
    clear: function (lines, streak) {
      var n = Math.min(3 + lines * 2, SCALE.length), base = Math.min(streak - 1, 3);
      for (var i = 0; i < n; i++) tone(SCALE[i] * (1 + base * 0.06), i * 0.06, 0.22, 'triangle', 0.14);
    },
    over: function () { [523, 440, 349, 262].forEach(function (f, i) { tone(f, i * 0.16, 0.3, 'sine', 0.14); }); }
  };
  // iOS counts touchend/click (not always pointerdown) as the unlocking gesture.
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(function (n) {
    document.addEventListener(n, audio, { passive: true });
  });

  function setMuteButton() {
    var b = document.getElementById('mute-btn');
    b.textContent = muted ? '🔇' : '🔊';
    b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  }

  function build() {
    boardEl.innerHTML = '';
    cells = [];
    for (var i = 0; i < SIZE * SIZE; i++) {
      var c = document.createElement('div');
      c.className = 'cell';
      boardEl.appendChild(c);
      cells.push(c);
    }
  }

  function render() {
    for (var i = 0; i < cells.length; i++) {
      var v = game.board[i];
      var el = cells[i];
      el.className = v ? 'cell filled' : 'cell';
      el.style.background = v ? BB_COLORS[v - 1] : '';
    }
    document.getElementById('score').textContent = game.score;
    document.getElementById('best').textContent = game.best;
    renderTray();
  }

  /* Tray pieces are drawn small; they scale up to board size when picked up. */
  function renderTray() {
    trayEl.innerHTML = '';
    game.tray.forEach(function (piece, slot) {
      var el = document.createElement('div');
      el.className = 'slot';
      if (!piece) {
        el.className += ' empty';
      } else {
        var pip = 19;
        el.style.gridTemplateColumns = 'repeat(' + piece.cols + ', ' + pip + 'px)';
        for (var r = 0; r < piece.rows; r++) {
          for (var c = 0; c < piece.cols; c++) {
            var d = document.createElement('div');
            var on = piece.cells.some(function (p) { return p[0] === r && p[1] === c; });
            d.style.width = d.style.height = pip + 'px';
            if (on) { d.className = 'pip'; d.style.background = BB_COLORS[piece.color]; }
            el.appendChild(d);
          }
        }
        // Grey out a piece that has nowhere left to go.
        if (!game.fitsAnywhere(piece)) el.className += ' dead';
        el.addEventListener('pointerdown', function (e) { startDrag(e, slot, el); });
      }
      trayEl.appendChild(el);
    });
  }

  function metrics() {
    var a = cells[0].getBoundingClientRect();
    var b = cells[1].getBoundingClientRect();
    return { size: a.width, step: b.left - a.left, left: a.left, top: a.top };
  }

  function startDrag(e, slot, slotEl) {
    var piece = game.tray[slot];
    if (!piece || drag) return;
    e.preventDefault();

    var m = metrics();
    ghost = document.createElement('div');
    ghost.id = 'ghost';
    ghost.style.gridTemplateColumns = 'repeat(' + piece.cols + ', ' + m.size + 'px)';
    for (var r = 0; r < piece.rows; r++) {
      for (var c = 0; c < piece.cols; c++) {
        var d = document.createElement('div');
        d.style.width = d.style.height = m.size + 'px';
        var on = piece.cells.some(function (p) { return p[0] === r && p[1] === c; });
        if (on) {
          d.style.background = BB_COLORS[piece.color];
          d.style.borderRadius = '5px';
          d.style.boxShadow = 'inset 0 -3px 0 rgba(0,0,0,0.22)';
        }
        ghost.appendChild(d);
      }
    }
    document.body.appendChild(ghost);
    slotEl.classList.add('dragging');

    sfx.pick();
    drag = {
      id: e.pointerId, slot: slot, piece: piece, slotEl: slotEl, m: m,
      w: piece.cols * m.step - (m.step - m.size),
      h: piece.rows * m.step - (m.step - m.size)
    };
    moveGhost(e.clientX, e.clientY);

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  /* Lift the piece above the finger so a small hand doesn't cover the board. */
  function moveGhost(x, y) {
    var lift = drag.m.size * 1.35;
    drag.left = x - drag.w / 2;
    drag.top = y - drag.h / 2 - lift;
    ghost.style.left = drag.left + 'px';
    ghost.style.top = drag.top + 'px';
  }

  function target() {
    var m = drag.m;
    return {
      r: Math.round((drag.top - m.top) / m.step),
      c: Math.round((drag.left - m.left) / m.step)
    };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
    preview();
  }

  function clearPreview() {
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('preview', 'preview-bad');
  }

  function preview() {
    clearPreview();
    var t = target();
    var ok = game.canPlace(drag.piece, t.r, t.c);
    drag.piece.cells.forEach(function (p) {
      var r = t.r + p[0], c = t.c + p[1];
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
      var el = cells[r * SIZE + c];
      if (ok) el.classList.add('preview');
      else if (!game.board[r * SIZE + c]) el.classList.add('preview-bad');
    });
    // Show which lines this drop would complete.
    if (ok) game.wouldClear(drag.piece, t.r, t.c).forEach(function (i) { cells[i].classList.add('preview-clear'); });
  }

  function onUp(e) {
    // A second finger must not drop (or cancel) the piece the first one holds.
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var t = target();
    var before = Array.prototype.slice.call(game.board);
    var piece = drag.piece;
    var wasCancel = e && e.type === 'pointercancel';
    var placed = wasCancel ? null : game.place(drag.slot, t.r, t.c);

    clearPreview();
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    drag.slotEl.classList.remove('dragging');
    ghost = null;
    drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (!placed) {
      // Dropped somewhere it doesn't fit: the piece springs back to the tray.
      if (!wasCancel) sfx.bad();
      render();
      return;
    }

    render();
    if (placed.lines > 0) {
      var cr = t.r + piece.rows / 2, cc = t.c + piece.cols / 2;
      placed.cells.forEach(function (i) {
        var el = cells[i];
        // Ripple outwards from where the piece landed.
        var dist = Math.abs(Math.floor(i / SIZE) + 0.5 - cr) + Math.abs((i % SIZE) + 0.5 - cc);
        el.style.animationDelay = Math.round(dist * 18) + 'ms';
        el.classList.add('flash');
        setTimeout(function () { el.classList.remove('flash'); el.style.animationDelay = ''; }, 340 + dist * 18);
      });
      burst(placed, before, piece, t);
      showCombo(placed);
      sfx.clear(placed.lines, placed.streak);
      if (navigator.vibrate) { try { navigator.vibrate(placed.lines > 1 ? [20, 30, 20] : 15); } catch (e2) {} }
    } else {
      sfx.drop();
    }
    if (game.isOver()) setTimeout(gameOver, 700);
  }

  /* Little squares of the cleared colours fly off the board. Capped so a big
     combo doesn't cost an old phone any frames. */
  function burst(placed, before, piece, t) {
    if (!Element.prototype.animate) return;
    var wrap = document.querySelector('.board-wrap');
    var wr = wrap.getBoundingClientRect();
    var m = metrics();
    var step = Math.max(1, Math.ceil(placed.cells.length / 24));
    for (var k = 0; k < placed.cells.length; k += step) {
      var i = placed.cells[k];
      var colorIdx = placed.colors[k] || (piece.color + 1);
      var d = document.createElement('div');
      var r = Math.floor(i / SIZE), c = i % SIZE;
      d.className = 'spark';
      d.style.width = d.style.height = (m.size * 0.5) + 'px';
      d.style.left = (m.left + c * m.step + m.size * 0.25 - wr.left) + 'px';
      d.style.top = (m.top + r * m.step + m.size * 0.25 - wr.top) + 'px';
      d.style.background = BB_COLORS[colorIdx - 1];
      wrap.appendChild(d);
      var dx = (Math.random() - 0.5) * 130, dy = -30 - Math.random() * 90;
      var anim = d.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 3) + 'deg) scale(0.2)', opacity: 0 }
      ], { duration: 520 + Math.random() * 200, easing: 'ease-out', delay: 40 });
      anim.onfinish = (function (n) { return function () { if (n.parentNode) n.parentNode.removeChild(n); }; })(d);
    }
  }

  function showCombo(placed) {
    var el = document.getElementById('combo');
    var text = placed.lines > 1 ? placed.lines + ' lines!' : '+' + placed.gained;
    if (placed.streak > 1) text = 'Combo x' + Math.min(placed.streak, 5) + '  +' + placed.gained;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;   // restart the animation
    el.classList.add('show');
  }

  function gameOver() {
    if (!game.isOver()) return;
    document.getElementById('over-score').textContent = game.score;
    document.getElementById('over-best').textContent = game.best;
    document.getElementById('over-new').classList.toggle('hidden', !(game.score > 0 && game.score >= game.best));
    document.getElementById('over').classList.remove('hidden');
    sfx.over();
  }

  function newGame() {
    BBGame.clearSaved();
    game = new BBGame();
    game.save();
    document.getElementById('over').classList.add('hidden');
    render();
  }

  /* Pick up a saved board if there is one; a finished board starts fresh. */
  function resumeOrNew() {
    var saved = BBGame.loadSaved();
    if (!saved) { newGame(); return; }
    game = new BBGame(saved);
    if (game.isOver()) { newGame(); return; }
    document.getElementById('over').classList.add('hidden');
    render();
  }

  document.getElementById('restart-btn').addEventListener('click', newGame);
  document.getElementById('mute-btn').addEventListener('click', function () {
    muted = !muted;
    try { localStorage.setItem('bb.mute', muted ? '1' : '0'); } catch (e) {}
    setMuteButton();
    if (!muted) { audio(); sfx.pick(); }
  });
  setMuteButton();
  document.getElementById('over-again').addEventListener('click', newGame);
  window.addEventListener('resize', render);

  build();
  resumeOrNew();

  window.__bb = {
    game: function () { return game; },
    newGame: newGame,
    render: render,
    placeAt: function (slot, r, c) {
      var res = game.place(slot, r, c);
      render();
      return res;
    }
  };
})();
