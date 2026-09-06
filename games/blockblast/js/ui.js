(function () {
  var boardEl = document.getElementById('board');
  var trayEl = document.getElementById('tray');
  var game, cells = [], ghost = null, drag = null;

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

    drag = {
      slot: slot, piece: piece, slotEl: slotEl, m: m,
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
    if (!drag) return;
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
  }

  function onUp() {
    if (!drag) return;
    var t = target();
    var placed = game.place(drag.slot, t.r, t.c);

    clearPreview();
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    drag.slotEl.classList.remove('dragging');
    ghost = null;
    drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (!placed) { render(); return; }

    render();
    if (placed.lines > 0) {
      placed.cells.forEach(function (i) {
        cells[i].classList.add('flash');
        setTimeout(function () { cells[i].classList.remove('flash'); }, 340);
      });
      showCombo(placed);
    }
    if (game.isOver()) setTimeout(gameOver, 500);
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
    document.getElementById('over-score').textContent = game.score;
    document.getElementById('over-best').textContent = game.best;
    document.getElementById('over').classList.remove('hidden');
  }

  function newGame() {
    game = new BBGame();
    document.getElementById('over').classList.add('hidden');
    render();
  }

  document.getElementById('restart-btn').addEventListener('click', newGame);
  document.getElementById('over-again').addEventListener('click', newGame);
  window.addEventListener('resize', render);

  build();
  newGame();

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
