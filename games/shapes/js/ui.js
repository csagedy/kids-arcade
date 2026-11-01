/* Shape Fit screen, on the arcade kit.

   The board is cropped to the outline so it can be as big as the screen
   allows. Pieces wait in the tray (beside the board in landscape, under it
   in portrait), sized to fit. Drag a piece onto the outline: it floats
   above your finger, the slots it would fill light up, and a near miss
   snaps to the closest spot that fits. Tap a tray piece to turn it; tap a
   placed piece to turn it where it sits (or it hops back to the tray when
   there's no room). */
(function () {
  var boardEl = document.getElementById('board');
  var trayEl = document.getElementById('tray');
  var game, level, cells = [], win0 = null, ghost = null, drag = null, spun = -1, busy = false;
  var HINTS_KEY = 'shapes.hints', STARS_KEY = 'shapes.stars';
  var stars = Kit.load(STARS_KEY, {});
  if (!stars || typeof stars !== 'object' || Array.isArray(stars)) stars = {};
  var hints = 0;

  function loadLevel() { return Math.min(999, Math.max(1, parseInt(Kit.raw('shapes.level'), 10) || 1)); }
  /* Only ever moves the "reached" level forward. */
  function saveLevel(n) {
    n = Math.max(n, loadLevel());
    Kit.setRaw('shapes.level', String(n));
    Kit.stat('shapes', 'Level ' + n);
  }

  function shade(hex, k) {
    var c = hex.replace('#', '');
    var v = [0, 2, 4].map(function (i) { return Math.round(parseInt(c.substr(i, 2), 16) * (1 + k)); });
    return 'rgb(' + v.join(',') + ')';
  }
  function colorOf(idx) { return SHAPE_COLORS[game.pieces[idx].color]; }

  function start(n, saved) {
    Kit.closeAll();
    level = makeShapesLevel(n);
    game = new ShapesGame(level, saved);
    var h = Kit.load(HINTS_KEY, null);
    hints = h && h.level === n && saved ? h.n | 0 : 0;
    document.getElementById('level-n').textContent = n;
    boardEl.classList.remove('won');
    saveLevel(n);
    game.save();
    build();
    render();
    updateNav();
  }
  function updateNav() {
    document.getElementById('prev-btn').disabled = game.level <= 1;
    document.getElementById('next-btn').disabled = game.level >= loadLevel();
  }

  /* ---------- board ---------- */
  function build() {
    var g = game.grid, r0 = g, r1 = -1, c0 = g, c1 = -1;
    for (var i = 0; i < g * g; i++) if (game.inside[i]) {
      var r = Math.floor(i / g), c = i % g;
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
    win0 = { r0: r0, c0: c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1 };
    boardEl.style.setProperty('--cols', win0.cols);
    boardEl.style.setProperty('--rows', win0.rows);
    boardEl.style.setProperty('--k-aspect', win0.cols / win0.rows);
    boardEl.innerHTML = '';
    cells = [];
    for (var rr = r0; rr <= r1; rr++) for (var cc = c0; cc <= c1; cc++) {
      var idx = rr * g + cc, el = document.createElement('div');
      el.className = game.inside[idx] ? 'sq in' : 'sq';
      el.style.setProperty('--d', (rr - r0) + (cc - c0));
      el._idx = idx;
      boardEl.appendChild(el);
      cells[idx] = el;
    }
  }

  function joins(has, r, c) {
    return (has(r, c + 1) ? ' jr' : '') + (has(r, c - 1) ? ' jl' : '') + (has(r + 1, c) ? ' jb' : '') + (has(r - 1, c) ? ' jt' : '');
  }

  /* One cell of a piece: the block, plus bridges over the gap to its
     right / lower neighbours (and the corner, inside a 2x2). */
  function fillCell(el, col, same, r, c) {
    el.className += joins(same, r, c);
    el.style.setProperty('--c', col);
    el.style.setProperty('--e', shade(col, -0.3));
    var h = '<i class="blk"></i>';
    if (same(r, c + 1)) h += '<i class="br r"></i>';
    if (same(r + 1, c)) h += '<i class="br b"></i>';
    if (same(r, c + 1) && same(r + 1, c) && same(r + 1, c + 1)) h += '<i class="br d"></i>';
    el.innerHTML = h;
  }

  function render() {
    var occ = game.occupancy(), g = game.grid;
    cells.forEach(function (el, i) {
      if (!el) return;
      var p = occ[i];
      el.className = game.inside[i] ? 'sq in' : 'sq';
      el.innerHTML = '';
      el._piece = p;
      if (p < 0) return;
      var r = Math.floor(i / g), c = i % g;
      el.className += joins(function (rr, cc) {
        return rr >= 0 && cc >= 0 && rr < g && cc < g && occ[rr * g + cc] === p;
      }, r, c);
      var same = function (rr, cc) { return rr >= 0 && cc >= 0 && rr < g && cc < g && occ[rr * g + cc] === p; };
      fillCell(el, colorOf(p), same, r, c);
    });
    renderTray();
    var placed = game.pieces.filter(function (p) { return p.pos; }).length;
    document.getElementById('count').textContent = placed + '/' + game.pieces.length;
  }

  /* a piece as a little grid of .sq cells */
  function pieceGrid(el, idx) {
    var shape = game.shape(idx), rows = 0, cols = 0, has = {};
    shape.forEach(function (s) { rows = Math.max(rows, s[0] + 1); cols = Math.max(cols, s[1] + 1); has[s[0] + ',' + s[1]] = 1; });
    el.style.gridTemplateColumns = 'repeat(' + cols + ', var(--cell))';
    el.innerHTML = '';
    var c1 = colorOf(idx);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var sq = document.createElement('div');
      sq.className = 'sq';
      if (has[r + ',' + c]) fillCell(sq, c1, function (rr, cc) { return has[rr + ',' + cc]; }, r, c);
      el.appendChild(sq);
    }
    return { rows: rows, cols: cols };
  }

  function renderTray() {
    trayEl.innerHTML = '';
    game.pieces.forEach(function (piece, idx) {
      if (piece.pos) return;
      var el = document.createElement('div');
      el.className = 'piece' + (idx === spun ? ' spin' : '') + (drag && drag.idx === idx ? ' lifted' : '');
      pieceGrid(el, idx);
      el._idx = idx;
      el.addEventListener('pointerdown', function (e) { startDrag(e, idx, el, false); });
      trayEl.appendChild(el);
    });
    fitTray();
  }

  /* Biggest pip size (up to about a board cell) at which every piece fits. */
  function fitTray() {
    var m = metrics();
    var pip = Math.min(m.size * 0.8, 64);
    for (var k = 0; k < 14; k++) {
      trayEl.style.setProperty('--pip', pip + 'px');
      if (trayEl.scrollHeight <= trayEl.clientHeight + 1 && trayEl.scrollWidth <= trayEl.clientWidth + 1) break;
      pip *= 0.9;
      if (pip < 9) break;
    }
  }

  function metrics() {
    var rc = boardEl.getBoundingClientRect();
    var size = rc.width / (win0.cols + (win0.cols - 1) * 0.07);
    return { size: size, step: size * 1.07, left: rc.left, top: rc.top };
  }

  /* ---------- dragging ---------- */
  function startDrag(e, idx, srcEl, fromBoard) {
    if (drag || busy || Kit.overlayOpen()) return;
    e.preventDefault();
    var m = metrics();
    ghost = document.createElement('div');
    ghost.id = 'ghost';
    ghost.style.setProperty('--cell', m.size + 'px');
    var dims = pieceGrid(ghost, idx);
    ghost.style.display = 'none';
    document.body.appendChild(ghost);
    var w = dims.cols * m.step - (m.step - m.size), h = dims.rows * m.step - (m.step - m.size);
    // where on the piece the finger holds it: the grabbed cell for a board
    // piece, the middle for a tray piece
    var gx = w / 2, gy = h / 2, lift = e.pointerType === 'mouse' ? 0 : m.size * 0.9;
    if (fromBoard) {
      var p = game.pieces[idx], g = game.grid;
      var rr = Math.floor(srcEl._idx / g) - p.pos[0], cc = srcEl._idx % g - p.pos[1];
      gx = (cc + 0.5) * m.step; gy = (rr + 0.5) * m.step;
      lift = e.pointerType === 'mouse' ? 0 : m.size * 0.5;
    }
    drag = {
      idx: idx, m: m, srcEl: srcEl, fromBoard: fromBoard, w: w, h: h, gx: gx, gy: gy, lift: lift,
      pid: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function moveGhost(x, y) {
    drag.left = x - drag.gx;
    drag.top = y - drag.gy - drag.lift;
    ghost.style.transform = 'translate(' + drag.left + 'px,' + drag.top + 'px)';
  }

  /* Where the piece would land: the exact spot under it if it fits, else
     the closest neighbouring spot that does (within about half a cell). */
  function target() {
    var m = drag.m;
    var fr = (drag.top - m.top) / m.step + win0.r0, fc = (drag.left - m.left) / m.step + win0.c0;
    var r = Math.round(fr), c = Math.round(fc);
    if (game.canPlace(drag.idx, r, c)) return { r: r, c: c, ok: true };
    var best = null, bd = 0.75;
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      var tr = r + dr, tc = c + dc, d = Math.abs(tr - fr) + Math.abs(tc - fc);
      if (d < bd && game.canPlace(drag.idx, tr, tc)) { bd = d; best = { r: tr, c: tc, ok: true }; }
    }
    return best || { r: r, c: c, ok: false };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    e.preventDefault();
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 8) return;
      drag.moved = true;
      ghost.style.display = '';
      Kit.sfx.tone(520, 0.06, 'sine', { vol: 0.06, to: 700 });
      if (drag.fromBoard) { game.lift(drag.idx); render(); }
      else drag.srcEl.classList.add('lifted');
    }
    moveGhost(e.clientX, e.clientY);
    preview();
  }

  function clearPreview() { cells.forEach(function (c) { if (c) c.classList.remove('prev', 'prev-bad'); }); }
  var lastPrev = '';
  function preview() {
    clearPreview();
    var t = target();
    var near = false;
    game.shape(drag.idx).forEach(function (p) {
      var el = cells[(t.r + p[0]) * game.grid + t.c + p[1]];
      var r = t.r + p[0], c = t.c + p[1];
      if (r < 0 || c < 0 || r >= game.grid || c >= game.grid || !el) return;
      near = true;
      el.classList.add(t.ok ? 'prev' : 'prev-bad');
    });
    var key = t.ok ? t.r + ',' + t.c : '';
    if (key && key !== lastPrev) Kit.sfx.click();
    lastPrev = key;
  }

  /* Play a short animation class on every cell of a placed piece. */
  function markPiece(idx, cls) {
    var occ = game.occupancy();
    for (var k = 0; k < occ.length; k++) if (occ[k] === idx && cells[k]) { cells[k].classList.remove(cls); void cells[k].offsetWidth; cells[k].classList.add(cls); }
  }

  function onUp(e) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    var d = drag;
    var t = d.moved ? target() : null;
    clearPreview();
    lastPrev = '';
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null; drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (!d.moved) {
      // a tap
      if (!d.fromBoard) {
        game.rotate(d.idx); spun = d.idx; render(); spun = -1;
        Kit.sfx.tone(600, 0.08, 'triangle', { vol: 0.08, to: 800 });
        return;
      }
      if (game.rotateInPlace(d.idx)) { render(); markPiece(d.idx, 'turn'); Kit.sfx.tone(600, 0.08, 'triangle', { vol: 0.08, to: 800 }); return; }
      // no room to turn: shake the piece, then it hops back to the tray
      markPiece(d.idx, 'nope');
      Kit.sfx.bad();
      busy = true;
      setTimeout(function () { busy = false; game.lift(d.idx); render(); }, 340);
      return;
    }
    if (t.ok && game.place(d.idx, t.r, t.c)) {
      render();
      markPiece(d.idx, 'drop');
      Kit.sfx.place();
      Kit.buzz(10);
      Kit.anim(document.getElementById('count-chip'), 'k-bump');
      if (game.isSolved()) setTimeout(win, 300);
    } else {
      render();
      Array.prototype.forEach.call(trayEl.children, function (el) { if (el._idx === d.idx) el.classList.add('back'); });
      Kit.sfx.slide();
    }
  }

  boardEl.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.sq');
    if (!el || el._piece === undefined || el._piece < 0) return;
    startDrag(e, el._piece, el, true);
  });

  /* ---------- winning ---------- */
  function win() {
    if (!game.isSolved() || Kit.overlayOpen()) return;
    var n = hints === 0 ? 3 : hints === 1 ? 2 : 1;
    if (n > (stars[game.level] || 0)) { stars[game.level] = n; Kit.save(STARS_KEY, stars); }
    boardEl.classList.remove('won'); void boardEl.offsetWidth; boardEl.classList.add('won');
    Kit.buzz([30, 40, 30]);
    saveLevel(game.level + 1);
    Kit.drop(HINTS_KEY);
    updateNav();
    setTimeout(function () {
      Kit.result({
        emoji: '🧩', title: 'Level ' + game.level + ' done!', stars: n, confetti: true, wiggle: true,
        text: n === 3 ? 'Every piece fits. No hints. Brilliant!' : 'Every piece fits! Try it with no hints for 3 stars.',
        buttons: [{ label: 'Again', value: 'again' }, { label: 'Next level', value: 'next', primary: true }]
      }).then(function (v) {
        if (v === 'next') start(game.level + 1);
        else if (v === 'again') { hints = 0; game.reset(); boardEl.classList.remove('won'); render(); }
      });
    }, 700);
  }

  /* ---------- buttons ---------- */
  document.getElementById('hint-btn').addEventListener('click', function () {
    if (drag || Kit.overlayOpen() || game.isSolved()) return;
    var i = game.hint();
    if (i < 0) return;
    hints++;
    Kit.save(HINTS_KEY, { level: game.level, n: hints });
    render();
    markPiece(i, 'flash');
    Kit.sfx.open();
    if (game.isSolved()) setTimeout(win, 700);
  });
  document.getElementById('restart-btn').addEventListener('click', function () {
    if (Kit.overlayOpen() || !game.pieces.some(function (p) { return p.pos; })) return;
    game.reset(); render(); Kit.sfx.slide();
  });
  document.getElementById('prev-btn').addEventListener('click', function () { if (game.level > 1) { Kit.sfx.tap(); start(game.level - 1); } });
  document.getElementById('next-btn').addEventListener('click', function () { if (game.level < loadLevel()) { Kit.sfx.tap(); start(game.level + 1); } });
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
    { emoji: '👆', text: 'Drag the pieces into the outline.' },
    { emoji: '🔄', text: 'Tap a piece to <b>turn</b> it.' },
    { emoji: '↩️', text: 'Drag a piece off the board to try somewhere else.' },
    { emoji: '🧩', text: 'Fill the whole shape to win. No hints for 3 stars!' }
  ];
  Kit.bindHelp(document.getElementById('help-btn'), 'shapes', HOWTO);
  Kit.bindMute(document.getElementById('mute-btn'));

  var rt = 0;
  function relayout() { clearTimeout(rt); rt = setTimeout(function () { if (game && !drag) fitTray(); }, 60); }
  if (window.ResizeObserver) { new ResizeObserver(relayout).observe(trayEl); new ResizeObserver(relayout).observe(boardEl); }
  window.addEventListener('resize', relayout);

  var saved = ShapesGame.loadSaved();
  var reached = loadLevel();
  if (saved && saved.level === (saved.level | 0) && saved.level >= 1 && saved.level <= reached) start(saved.level, saved); else start(reached);
  Kit.howTo('shapes', HOWTO);

  window.__shapes = { game: function () { return game; }, level: function () { return level; }, start: start, render: render };
})();
