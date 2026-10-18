(function () {
  var libEl = document.getElementById('lib');
  var playEl = document.getElementById('play');
  var gridEl = document.getElementById('grid');
  var game = null, cellEls = [], mode = 1;   // 1 fill, 2 cross
  var drag = null, undoStack = [], toastTimer = 0;

  /* ---------- library ---------- */
  function sizeName(w) {
    return w <= 4 ? 'Tiny' : w <= 5 ? 'Small' : w <= 7 ? 'Medium' : w <= 8 ? 'Big' : 'Huge';
  }

  function inProgress(def) {
    try {
      var s = localStorage.getItem('nono.p.' + def.id);
      return !!s && s.indexOf('1') >= 0;
    } catch (e) { return false; }
  }

  function showLibrary() {
    game = null;
    playEl.classList.add('hidden');
    libEl.classList.remove('hidden');
    document.getElementById('win').classList.add('hidden');
    var solved = NonoGame.solvedSet();
    var list = document.getElementById('lib-grid');
    list.innerHTML = '';
    var lastW = 0;
    NONO_PUZZLES.forEach(function (def, i) {
      var w = def.art[0].length;
      if (w !== lastW) {
        lastW = w;
        var hd = document.createElement('div');
        hd.className = 'lib-head';
        hd.textContent = sizeName(w) + ' · ' + w + '×' + def.art.length;
        list.appendChild(hd);
      }
      var done = !!solved[def.id];
      var b = document.createElement('button');
      b.className = 'lvl' + (done ? ' done' : (inProgress(def) ? ' going' : ''));
      b.innerHTML = '<div class="lvl-n"></div><div class="lvl-size"></div>';
      b.querySelector('.lvl-n').textContent = done ? def.name : String(i + 1);
      b.querySelector('.lvl-size').textContent = done ? '✓' : w + '×' + def.art.length;
      if (done) b.style.background = def.color;
      b.addEventListener('click', function () { open(def); });
      list.appendChild(b);
    });
  }

  /* ---------- play ---------- */
  function open(def) {
    try { localStorage.setItem('nono.last', def.id); } catch (e) {}
    game = new NonoGame(def);
    libEl.classList.add('hidden');
    playEl.classList.remove('hidden');
    document.getElementById('title').textContent = def.art[0].length + '×' + def.art.length;
    document.getElementById('win').classList.add('hidden');
    undoStack = [];
    var tip = document.getElementById('tip');
    tip.classList.toggle('hidden', Object.keys(NonoGame.solvedSet()).length > 0);
    build();
  }

  function build() {
    var w = game.w, h = game.h;
    var maxRow = Math.max.apply(null, game.rowClues.map(function (c) { return c.length; }));
    var maxCol = Math.max.apply(null, game.colClues.map(function (c) { return c.length; }));
    gridEl.innerHTML = '';
    gridEl.style.setProperty('--w', w);
    gridEl.style.setProperty('--h', h);
    gridEl.style.setProperty('--rc', maxRow);
    gridEl.style.setProperty('--cc', maxCol);

    // corner
    gridEl.appendChild(document.createElement('div')).className = 'corner';
    // column clues
    for (var c = 0; c < w; c++) {
      var cc = document.createElement('div');
      cc.className = 'clue col' + (c % 5 === 4 && c < w - 1 ? ' b5' : '');
      cc.id = 'cc' + c;
      game.colClues[c].forEach(function (n) {
        var s = document.createElement('span'); s.textContent = n; cc.appendChild(s);
      });
      gridEl.appendChild(cc);
    }
    cellEls = [];
    for (var r = 0; r < h; r++) {
      var rc = document.createElement('div');
      rc.className = 'clue row' + (r % 5 === 4 && r < h - 1 ? ' b5' : '');
      rc.id = 'rc' + r;
      game.rowClues[r].forEach(function (n) {
        var s = document.createElement('span'); s.textContent = n; rc.appendChild(s);
      });
      gridEl.appendChild(rc);
      for (var c2 = 0; c2 < w; c2++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        if (c2 % 5 === 4 && c2 < w - 1) cell.className += ' b5r';
        if (r % 5 === 4 && r < h - 1) cell.className += ' b5b';
        cell.dataset.i = r * w + c2;
        gridEl.appendChild(cell);
        cellEls.push(cell);
      }
    }
    render();
  }

  function render() {
    for (var i = 0; i < cellEls.length; i++) {
      var v = game.cells[i];
      cellEls[i].className = cellEls[i].className.replace(/ (on|x)\b/g, '') + (v === 1 ? ' on' : v === 2 ? ' x' : '');
      if (v === 1) cellEls[i].style.background = game.color; else cellEls[i].style.background = '';
    }
    for (var r = 0; r < game.h; r++) document.getElementById('rc' + r).classList.toggle('done', game.rowDone(r));
    for (var c = 0; c < game.w; c++) document.getElementById('cc' + c).classList.toggle('done', game.colDone(c));
    document.getElementById('mode-fill').classList.toggle('on', mode === 1);
    document.getElementById('mode-x').classList.toggle('on', mode === 2);
    document.getElementById('undo-btn').disabled = !undoStack.length;
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* One undo step per stroke (or per hint / clear). */
  function pushUndo() {
    undoStack.push(new Uint8Array(game.cells));
    if (undoStack.length > 60) undoStack.shift();
  }

  /* Paint by dragging: the first cell decides whether this stroke sets or
     clears, and the stroke is locked to a row or column so a wobbly finger
     doesn't scribble. */
  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || !el.classList.contains('cell')) return -1;
    return +el.dataset.i;
  }

  gridEl.addEventListener('pointerdown', function (e) {
    if (drag || !game) return;   // second finger: ignore
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    var cur = game.cells[i];
    var value = cur === mode ? 0 : mode;   // tap again to clear
    drag = { id: e.pointerId, value: value, r: Math.floor(i / game.w), c: i % game.w, axis: null, last: i, start: i, pushed: false };
    paint(i);
  });

  function paint(i) {
    var cur = game.cells[i];
    if (i !== drag.start) {
      // Mid-stroke never overwrites the other kind of mark, and an erase
      // stroke only removes the kind it started on.
      if (drag.value && cur && cur !== drag.value) return;
      if (!drag.value && cur !== mode) return;
    }
    if (cur === drag.value) return;
    if (!drag.pushed) { pushUndo(); drag.pushed = true; }
    game.set(i, drag.value); game.save(); render();
  }

  window.addEventListener('pointermove', function (e) {
    if (!drag || !game || e.pointerId !== drag.id) return;
    e.preventDefault();
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === drag.last) return;
    var r = Math.floor(i / game.w), c = i % game.w;
    if (!drag.axis) {
      if (r !== drag.r && c !== drag.c) return;
      drag.axis = r === drag.r ? 'row' : 'col';
    }
    if (drag.axis === 'row' && r !== drag.r) return;
    if (drag.axis === 'col' && c !== drag.c) return;
    // Fast swipes skip cells; fill in everything between the last one and this.
    var step = drag.axis === 'row' ? 1 : game.w;
    var dir = i > drag.last ? step : -step;
    for (var j = drag.last + dir; j !== i + dir; j += dir) { drag.last = j; paint(j); }
  }, { passive: false });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    drag = null;
    checkSolved();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  function checkSolved() {
    if (game && game.isSolved()) setTimeout(win, 250);
  }

  /* ---------- undo and hints ---------- */
  function undo() {
    if (!game || !undoStack.length) return;
    game.cells = undoStack.pop();
    game.save(); render();
  }

  /* Which cells of a line are forced? `cur` holds 0 unknown, 1 filled, 2 empty.
     Tries every way to lay out the clue and keeps what all of them agree on.
     Returns an array of -1 (not forced), 0 or 1 per cell. */
  function forced(clue, cur) {
    var n = cur.length, can0 = [], can1 = [], any = false, i;
    for (i = 0; i < n; i++) { can0.push(false); can1.push(false); }
    var line = [];
    function place(k, pos) {
      if (k === clue.length) {
        for (var p = pos; p < n; p++) if (cur[p] === 1) return;
        any = true;
        for (var q = 0; q < n; q++) { if (line[q]) can1[q] = true; else can0[q] = true; }
        return;
      }
      var rest = 0;
      for (var m = k + 1; m < clue.length; m++) rest += clue[m] + 1;
      for (var s = pos; s + clue[k] + rest <= n; s++) {
        var ok = true, t;
        for (t = pos; t < s; t++) if (cur[t] === 1) { ok = false; break; }
        if (!ok) break;   // a filled cell was skipped; later starts only skip more
        for (t = s; t < s + clue[k]; t++) if (cur[t] === 2) { ok = false; break; }
        if (ok && s + clue[k] < n && cur[s + clue[k]] === 1) ok = false;
        if (!ok) continue;
        var saved = line.slice();
        for (t = pos; t < s; t++) line[t] = 0;
        for (t = s; t < s + clue[k]; t++) line[t] = 1;
        if (s + clue[k] < n) line[s + clue[k]] = 0;
        place(k + 1, Math.min(n, s + clue[k] + 1));
        line = saved;
      }
    }
    if (clue.length === 1 && clue[0] === 0) clue = [];
    // line[] is filled left to right as we place; unplaced tails stay empty.
    for (i = 0; i < n; i++) line.push(0);
    place(0, 0);
    var out = [];
    for (i = 0; i < n; i++) out.push(!any ? -1 : (can1[i] && !can0[i]) ? 1 : (can0[i] && !can1[i]) ? 0 : -1);
    return out;
  }

  function flash(i, cls) {
    var el = cellEls[i];
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 1900);
  }

  /* Hints are gentle: first they quietly fix any wrong squares, otherwise
     they fill in one square that can be worked out from the numbers. */
  function hint() {
    if (!game || drag) return;
    var i, wrong = [];
    for (i = 0; i < game.cells.length; i++) {
      if ((game.cells[i] === 1 && !game.solution[i]) || (game.cells[i] === 2 && game.solution[i])) wrong.push(i);
    }
    pushUndo();
    if (wrong.length) {
      wrong.forEach(function (w) { game.cells[w] = 0; });
      game.save(); render();
      wrong.forEach(function (w) { flash(w, 'oops'); });
      toast(wrong.length === 1 ? 'Oops, one was wrong. Fixed it!' : 'Oops, ' + wrong.length + ' were wrong. Fixed them!');
      return;
    }
    var pick = -1, val = 0, r, c;
    for (r = 0; r < game.h && pick < 0; r++) {
      var f = forced(game.rowClues[r], game.row(game.cells, r));
      for (c = 0; c < game.w; c++) {
        if (f[c] >= 0 && !game.cells[r * game.w + c]) { pick = r * game.w + c; val = f[c] ? 1 : 2; break; }
      }
    }
    for (c = 0; c < game.w && pick < 0; c++) {
      var g = forced(game.colClues[c], game.col(game.cells, c));
      for (r = 0; r < game.h; r++) {
        if (g[r] >= 0 && !game.cells[r * game.w + c]) { pick = r * game.w + c; val = g[r] ? 1 : 2; break; }
      }
    }
    if (pick < 0) {   // shouldn't happen for line-solvable pictures; reveal any missing square
      for (i = 0; i < game.cells.length; i++) if (game.solution[i] && game.cells[i] !== 1) { pick = i; val = 1; break; }
    }
    if (pick < 0) { undoStack.pop(); toast('Looks finished!'); return; }
    game.cells[pick] = val;
    game.save(); render();
    flash(pick, 'hint');
    toast(val === 1 ? 'This square is filled' : 'This square stays empty');
    checkSolved();
  }

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

  function win() {
    if (!game) return;
    game.markSolved();
    // Show the picture clean: crosses vanish.
    for (var i = 0; i < game.cells.length; i++) if (game.cells[i] === 2) game.cells[i] = 0;
    game.save();
    render();
    // A diagonal wave of pops across the revealed picture.
    for (i = 0; i < cellEls.length; i++) {
      if (game.cells[i] !== 1) continue;
      cellEls[i].style.setProperty('--d', (((i % game.w) + Math.floor(i / game.w)) * 0.04) + 's');
      cellEls[i].classList.add('reveal');
    }
    confetti();
    try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {}
    document.getElementById('win-name').textContent = game.name;
    var nextEl = document.getElementById('win-next');
    nextEl.textContent = nextUnsolved() ? 'Next picture' : 'All pictures';
    document.getElementById('win').classList.remove('hidden');
  }

  /* The next picture after this one that isn't solved yet, wrapping round. */
  function nextUnsolved() {
    var solved = NonoGame.solvedSet();
    var idx = NONO_PUZZLES.map(function (p) { return p.id; }).indexOf(game.id);
    for (var k = 1; k < NONO_PUZZLES.length; k++) {
      var p = NONO_PUZZLES[(idx + k) % NONO_PUZZLES.length];
      if (!solved[p.id]) return p;
    }
    return null;
  }

  document.getElementById('mode-fill').addEventListener('click', function () { mode = 1; render(); });
  document.getElementById('mode-x').addEventListener('click', function () { mode = 2; render(); });
  document.getElementById('clear-btn').addEventListener('click', function () {
    if (!game || !game.cells.some(function (v) { return v; })) return;
    pushUndo();
    game.clear(); render();
    toast('Cleared. Tap Undo to bring it back');
  });
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('hint-btn').addEventListener('click', hint);
  document.getElementById('back-btn').addEventListener('click', showLibrary);
  document.getElementById('win-lib').addEventListener('click', showLibrary);
  document.getElementById('win-next').addEventListener('click', function () {
    var next = nextUnsolved();
    if (next) open(next); else showLibrary();
  });

  // Reopen the last picture the kid was on, if unsolved.
  var last = null;
  try { last = localStorage.getItem('nono.last'); } catch (e) {}
  var def = NONO_PUZZLES.filter(function (p) { return p.id === last; })[0];
  if (def && !NonoGame.solvedSet()[def.id]) open(def); else showLibrary();

  window.__nono = { game: function () { return game; }, open: open, showLibrary: showLibrary, render: render };
})();
