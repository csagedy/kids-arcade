(function () {
  var boardEl = document.getElementById('board');
  var trayEl = document.getElementById('tray');
  var game, level, cells = [], ghost = null, drag = null;

  function loadLevel() {
    try { return Math.max(1, parseInt(localStorage.getItem('shapes.level'), 10) || 1); } catch (e) { return 1; }
  }
  function saveLevel(n) {
    try {
      localStorage.setItem('shapes.level', String(n));
      localStorage.setItem('arcade.stat.shapes', 'Level ' + n);
    } catch (e) {}
  }

  function start(n, saved) {
    level = makeShapesLevel(n);
    game = new ShapesGame(level, saved);
    document.getElementById('level-n').textContent = n;
    document.getElementById('win').classList.add('hidden');
    saveLevel(n);
    game.save();
    build();
    render();
  }

  function build() {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--n', game.grid);
    cells = [];
    for (var i = 0; i < game.grid * game.grid; i++) {
      var c = document.createElement('div');
      c.className = game.inside[i] ? 'cell in' : 'cell';
      boardEl.appendChild(c);
      cells.push(c);
    }
  }

  function render() {
    var occ = game.occupancy();
    for (var i = 0; i < cells.length; i++) {
      var el = cells[i];
      var p = occ[i];
      el.className = (game.inside[i] ? 'cell in' : 'cell') + (p >= 0 ? ' filled' : '');
      el.style.background = p >= 0 ? SHAPE_COLORS[game.pieces[p].color] : '';
      el.dataset.piece = p;
    }
    renderTray();
    var placed = game.pieces.filter(function (p) { return p.pos; }).length;
    document.getElementById('count').textContent = placed + ' / ' + game.pieces.length;
  }

  function renderTray() {
    trayEl.innerHTML = '';
    game.pieces.forEach(function (piece, idx) {
      if (piece.pos) return;
      var el = document.createElement('div');
      el.className = 'slot';
      var shape = game.shape(idx);
      var rows = Math.max.apply(null, shape.map(function (c) { return c[0]; })) + 1;
      var cols = Math.max.apply(null, shape.map(function (c) { return c[1]; })) + 1;
      var pip = 16;
      el.style.gridTemplateColumns = 'repeat(' + cols + ', ' + pip + 'px)';
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var d = document.createElement('div');
          d.style.width = d.style.height = pip + 'px';
          if (shape.some(function (s) { return s[0] === r && s[1] === c; })) {
            d.className = 'pip'; d.style.background = SHAPE_COLORS[piece.color];
          }
          el.appendChild(d);
        }
      }
      el.addEventListener('pointerdown', function (e) { startDrag(e, idx, el, null); });
      trayEl.appendChild(el);
    });
  }

  function metrics() {
    var a = cells[0].getBoundingClientRect(), b = cells[1].getBoundingClientRect();
    return { size: a.width, step: b.left - a.left, left: a.left, top: a.top };
  }

  /* Drag from the tray or from the board. A drag that hardly moves is a tap:
     tray tap rotates, board tap lifts the piece back to the tray. */
  function startDrag(e, idx, srcEl, fromBoard) {
    if (drag) return;
    e.preventDefault();
    var shape = game.shape(idx);
    var rows = Math.max.apply(null, shape.map(function (c) { return c[0]; })) + 1;
    var cols = Math.max.apply(null, shape.map(function (c) { return c[1]; })) + 1;
    var m = metrics();

    ghost = document.createElement('div');
    ghost.id = 'ghost';
    ghost.style.gridTemplateColumns = 'repeat(' + cols + ', ' + m.size + 'px)';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var d = document.createElement('div');
        d.style.width = d.style.height = m.size + 'px';
        if (shape.some(function (s) { return s[0] === r && s[1] === c; })) {
          d.style.background = SHAPE_COLORS[game.pieces[idx].color];
          d.style.borderRadius = '5px';
          d.style.boxShadow = 'inset 0 -3px 0 rgba(0,0,0,0.22)';
        }
        ghost.appendChild(d);
      }
    }
    document.body.appendChild(ghost);
    ghost.style.display = 'none';

    drag = {
      idx: idx, m: m, srcEl: srcEl, fromBoard: fromBoard,
      startX: e.clientX, startY: e.clientY, moved: false,
      w: cols * m.step - (m.step - m.size), h: rows * m.step - (m.step - m.size)
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function moveGhost(x, y) {
    var lift = drag.m.size * 1.3;
    drag.left = x - drag.w / 2;
    drag.top = y - drag.h / 2 - lift;
    ghost.style.left = drag.left + 'px';
    ghost.style.top = drag.top + 'px';
  }

  function target() {
    var m = drag.m;
    return { r: Math.round((drag.top - m.top) / m.step), c: Math.round((drag.left - m.left) / m.step) };
  }

  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 8) return;
      drag.moved = true;
      ghost.style.display = '';
      if (drag.fromBoard) { game.lift(drag.idx); render(); }
      else drag.srcEl.classList.add('dragging');
    }
    moveGhost(e.clientX, e.clientY);
    preview();
  }

  function clearPreview() {
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('preview', 'preview-bad');
  }

  function preview() {
    clearPreview();
    var t = target();
    var ok = game.canPlace(drag.idx, t.r, t.c);
    game.shape(drag.idx).forEach(function (p) {
      var r = t.r + p[0], c = t.c + p[1];
      if (r < 0 || c < 0 || r >= game.grid || c >= game.grid) return;
      cells[r * game.grid + c].classList.add(ok ? 'preview' : 'preview-bad');
    });
  }

  function onUp() {
    if (!drag) return;
    var d = drag;
    var t = d.moved ? target() : null;
    clearPreview();
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null; drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (!d.moved) {
      // A tap.
      if (d.fromBoard) game.lift(d.idx); else game.rotate(d.idx);
      render();
      return;
    }
    game.place(d.idx, t.r, t.c);   // falls back to the tray if it doesn't fit
    render();
    if (game.isSolved()) setTimeout(win, 350);
  }

  boardEl.addEventListener('pointerdown', function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('cell')) return;
    var p = +el.dataset.piece;
    if (isNaN(p) || p < 0) return;
    startDrag(e, p, el, true);
  });

  function win() {
    document.getElementById('win-n').textContent = game.level;
    document.getElementById('win').classList.remove('hidden');
    saveLevel(game.level + 1);
  }

  document.getElementById('restart-btn').addEventListener('click', function () { game.reset(); render(); });
  document.getElementById('win-next').addEventListener('click', function () { start(game.level + 1); });
  document.getElementById('win-replay').addEventListener('click', function () {
    document.getElementById('win').classList.add('hidden');
    game.reset(); render();
  });
  document.getElementById('prev-btn').addEventListener('click', function () { if (game.level > 1) start(game.level - 1); });
  document.getElementById('next-btn').addEventListener('click', function () { if (game.level < loadLevel()) start(game.level + 1); });
  window.addEventListener('resize', render);

  var saved = ShapesGame.loadSaved();
  var reached = loadLevel();
  if (saved && saved.level && saved.level <= reached) start(saved.level, saved); else start(reached);

  window.__shapes = { game: function () { return game; }, level: function () { return level; }, start: start, render: render };
})();
