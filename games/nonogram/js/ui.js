/* Picture Puzzles (nonograms), on the arcade kit.

   Library: pictures in sections by size; each card shows the solved picture,
   the squares filled so far, or a "?". Play: one .k-fit box with the clues
   and the grid, sized from the grid plus the room its clues need. Tap or
   drag along a row/column to fill (or mark with an X in Mark mode); the
   row and column under your finger light up their clues. A line whose
   fills are right gets its spare squares crossed out and its clue dimmed. */
(function () {
  var libEl = document.getElementById('lib');
  var playEl = document.getElementById('play');
  var gridEl = document.getElementById('grid');
  var game = null, cellEls = [], rowEls = [], colEls = [], mode = 1;   // 1 fill, 2 cross
  var drag = null, undoStack = [], hot = -1, linesDone = 0;

  function sizeName(w) {
    return w <= 3 ? 'Tiny' : w <= 4 ? 'Little' : w <= 5 ? 'Small' : w <= 6 ? 'Medium' : w <= 7 ? 'Bigger' : w <= 8 ? 'Big' : 'Huge';
  }
  function saved(def) { return Kit.raw('nono.p.' + def.id) || ''; }

  /* ---------- library ---------- */
  function showLibrary() {
    game = null;
    drag = null;
    tutEnd();
    Kit.closeAll();
    playEl.hidden = true;
    libEl.hidden = false;
    var solved = NonoGame.solvedSet();
    var list = document.getElementById('lib-grid');
    list.innerHTML = '';
    var lastW = 0, g = null, nDone = 0;
    NONO_PUZZLES.forEach(function (def, i) {
      var w = def.art[0].length, h = def.art.length;
      if (w !== lastW) {
        lastW = w;
        var hd = document.createElement('div');
        hd.className = 'sec';
        hd.innerHTML = '<h2>' + sizeName(w) + '</h2><span>' + w + ' × ' + h + '</span>';
        list.appendChild(hd);
        g = document.createElement('div');
        g.className = 'grid';
        list.appendChild(g);
      }
      var done = !!solved[def.id], s = done ? '' : saved(def);
      var going = s.indexOf('1') >= 0;
      if (done) nDone++;
      var b = document.createElement('button');
      b.className = 'pz' + (done ? ' done' : going ? ' going' : '');
      b.style.setProperty('--i', i);
      b.style.setProperty('--c', def.color);
      var art = '<div class="pz-art" style="grid-template-columns: repeat(' + w + ', 1fr)">';
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var on = done ? def.art[y][x] === '#' : s[y * w + x] === '1';
        art += '<i' + (on ? ' class="on"' : '') + '></i>';
      }
      art += '</div>';
      b.innerHTML = art + (done || going ? '' : '<span class="pz-q">?</span>') + '<div class="pz-label"></div>' +
        (done ? '<span class="tick">' + Kit.icon('check') + '</span>' : going ? '<span class="part">…</span>' : '');
      b.querySelector('.pz-label').textContent = done ? def.name : 'Puzzle ' + (i + 1);
      b.addEventListener('click', function () { Kit.sfx.tap(); open(def); });
      g.appendChild(b);
    });
    document.getElementById('lib-done').textContent = nDone + '/' + NONO_PUZZLES.length;
  }

  /* ---------- play ---------- */
  function open(def) {
    Kit.closeAll();
    Kit.setRaw('nono.last', def.id);
    game = new NonoGame(def);
    libEl.hidden = true;
    playEl.hidden = false;
    document.getElementById('title').textContent = game.w + '×' + game.h;
    undoStack = [];
    build();
    if (!tutStart() && !Object.keys(NonoGame.solvedSet()).length) {
      Kit.toast('Tap a square to fill it, or drag along a row', { ms: 3500, top: true });
    }
  }

  function shade(hex, k) {
    var c = hex.replace('#', '');
    var v = [0, 2, 4].map(function (i) { return Math.round(parseInt(c.substr(i, 2), 16) * (1 + k)); });
    return 'rgb(' + v.join(',') + ')';
  }

  /* Room the clues need, in cells. */
  function clueWidth(clue) {
    var u = 0.5;
    clue.forEach(function (n, k) { u += String(n).length * 0.3 + (k ? 0.2 : 0); });
    return u;
  }
  function clueHeight(clue) { return 0.55 + clue.length * 0.46 + (clue.length - 1) * 0.1; }

  function build() {
    var w = game.w, h = game.h;
    var rcw = Math.max.apply(null, game.rowClues.map(clueWidth));
    var cch = Math.max.apply(null, game.colClues.map(clueHeight));
    var wu = w + rcw + 0.12, hu = h + cch + 0.12;
    gridEl.style.setProperty('--wu', wu);
    gridEl.style.setProperty('--w', w);
    gridEl.style.setProperty('--h', h);
    gridEl.style.setProperty('--rcw', 'calc(var(--cell) * ' + rcw + ')');
    gridEl.style.setProperty('--cch', 'calc(var(--cell) * ' + cch + ')');
    gridEl.style.setProperty('--k-aspect', wu / hu);
    gridEl.style.setProperty('--k-fit-max', Math.round(wu * 118) + 'px');   // tiny puzzles: big, not giant
    gridEl.style.setProperty('--c', game.color);
    gridEl.style.setProperty('--e', shade(game.color, -0.3));
    gridEl.classList.remove('solved');
    gridEl.innerHTML = '';

    var cr = document.createElement('div'); cr.className = 'clues-r';
    var cc = document.createElement('div'); cc.className = 'clues-c';
    var cells = document.createElement('div'); cells.className = 'cells';
    rowEls = []; colEls = []; cellEls = [];
    game.colClues.forEach(function (clue) {
      var el = document.createElement('div'); el.className = 'clue';
      el.innerHTML = clue.map(function (n) { return '<span>' + n + '</span>'; }).join('');
      cc.appendChild(el); colEls.push(el);
    });
    game.rowClues.forEach(function (clue) {
      var el = document.createElement('div'); el.className = 'clue';
      el.innerHTML = clue.map(function (n) { return '<span>' + n + '</span>'; }).join('');
      cr.appendChild(el); rowEls.push(el);
    });
    for (var i = 0; i < w * h; i++) {
      var c = document.createElement('div');
      c.className = 'cell';
      c.dataset.i = i;
      cells.appendChild(c); cellEls.push(c);
    }
    gridEl.appendChild(cc); gridEl.appendChild(cr); gridEl.appendChild(cells);
    // a guide line every five squares
    for (var k = 5; k < w; k += 5) addGuide('left: calc(var(--rcw) + ' + k + ' * var(--cell) + var(--gap) * 0.2); top: var(--cch); width: calc(var(--gap) * 0.6); height: calc(var(--h) * var(--cell) + var(--gap));');
    for (k = 5; k < h; k += 5) addGuide('top: calc(var(--cch) + ' + k + ' * var(--cell) + var(--gap) * 0.2); left: var(--rcw); height: calc(var(--gap) * 0.6); width: calc(var(--w) * var(--cell) + var(--gap));');
    linesDone = -1;
    render();
  }
  function addGuide(css) {
    var g = document.createElement('div');
    g.className = 'guide'; g.style.cssText = css;
    gridEl.appendChild(g);
  }

  function render(popAt) {
    for (var i = 0; i < cellEls.length; i++) {
      var v = game.cells[i];
      var cls = 'cell' + (v === 1 ? ' on' : v === 2 ? ' x' : '');
      if (hot >= 0 && v !== 1 && (Math.floor(i / game.w) === Math.floor(hot / game.w) || i % game.w === hot % game.w)) cls += ' hot';
      if (i === popAt && v === 1) cls += ' pop';
      if (cellEls[i].classList.contains('tuthl')) cls += ' tuthl';
      if (cellEls[i].className !== cls) cellEls[i].className = cls;
    }
    var n = 0, r, c;
    for (r = 0; r < game.h; r++) { var dr = game.rowDone(r); rowEls[r].classList.toggle('done', dr); if (dr) n++; rowEls[r].classList.toggle('hot', hot >= 0 && Math.floor(hot / game.w) === r); }
    for (c = 0; c < game.w; c++) { var dc = game.colDone(c); colEls[c].classList.toggle('done', dc); if (dc) n++; colEls[c].classList.toggle('hot', hot >= 0 && hot % game.w === c); }
    document.getElementById('lines').textContent = n + '/' + (game.w + game.h);
    if (linesDone >= 0 && n > linesDone) Kit.anim(document.getElementById('lines-chip'), 'k-bump');
    linesDone = n;
    document.getElementById('mode-fill').classList.toggle('k-on', mode === 1);
    document.getElementById('mode-x').classList.toggle('k-on', mode === 2);
    document.getElementById('undo-btn').disabled = !undoStack.length;
    tutCheck();
  }

  /* ---------- first-run tutorial (3x3 starter, shown once) ---------- */
  var tutEl = document.getElementById('tut'), tutStep = -1, tutLine = -1, tutHl = [];

  function tutClear() {
    tutHl.forEach(function (el) { el.classList.remove('tuthl'); });
    tutHl = [];
  }
  function tutHighlight(els) {
    tutClear();
    els.forEach(function (el) { if (el) { el.classList.add('tuthl'); tutHl.push(el); } });
  }
  function tutStart() {
    tutStep = -1;
    tutEl.hidden = true;
    if (Kit.raw('nono.tut') || game.w !== 3 || game.cells.some(function (v) { return v; }) ||
        Object.keys(NonoGame.solvedSet()).length) return false;
    Kit.setRaw('nono.tut', '1');
    Kit.setRaw('arcade.howto.nonogram', '1');   // the tutorial covers it
    tutLine = -1;   // a row whose clue fills the whole line
    for (var r = 0; r < game.h; r++) if (game.rowClues[r][0] === game.w) { tutLine = r; break; }
    tutShow(0);
    return true;
  }
  function tutShow(n) {
    var txt, btn = 'Next', hl = [];
    if (n === 0) {
      txt = 'The number says how many squares to fill in that row.';
      if (tutLine >= 0) hl = [rowEls[tutLine]];
    } else if (n === 1 && tutLine >= 0) {
      txt = 'A ' + game.w + ' fills the whole row. Tap the squares, or drag across them!';
      for (var c = 0; c < game.w; c++) hl.push(cellEls[tutLine * game.w + c]);
      btn = 'Skip';
    } else if (n === 2) {
      txt = 'Nice! A finished row dims its number, and spare squares get an X.';
    } else {
      txt = 'Now the columns: their numbers go down. Stuck? Tap Hint!';
      btn = 'Got it';
      n = 3;
    }
    tutStep = n;
    tutEl.querySelector('.tut-txt').textContent = txt;
    document.getElementById('tut-next').textContent = btn;
    tutEl.hidden = false;
    tutHighlight(hl);
    Kit.sfx.open();
  }
  function tutNext() {
    if (tutStep < 0) return;
    Kit.sfx.tap();
    if (tutStep >= 3) { tutEnd(); return; }
    tutShow(tutStep === 0 && tutLine < 0 ? 2 : tutStep + 1);
  }
  function tutEnd() { tutStep = -1; tutClear(); tutEl.hidden = true; }
  function tutCheck() { if (tutStep === 1 && game && game.rowDone(tutLine)) tutShow(2); }
  document.getElementById('tut-next').addEventListener('click', tutNext);

  /* One undo step per stroke (or per hint / clear). */
  function pushUndo() {
    undoStack.push(new Uint8Array(game.cells));
    if (undoStack.length > 60) undoStack.shift();
  }

  /* ---------- painting ----------
     The first cell decides whether this stroke sets or clears, and the
     stroke is locked to a row or column so a wobbly finger doesn't scribble. */
  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || !el.classList.contains('cell') || !gridEl.contains(el)) return -1;
    return +el.dataset.i;
  }

  gridEl.addEventListener('pointerdown', function (e) {
    if (drag || !game || Kit.overlayOpen() || gridEl.classList.contains('solved')) return;   // second finger: ignore
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    var cur = game.cells[i];
    var value = cur === mode ? 0 : mode;   // tap again to clear
    drag = { id: e.pointerId, value: value, r: Math.floor(i / game.w), c: i % game.w, axis: null, last: i, start: i, pushed: false, n: 0 };
    hot = i;
    paint(i);
    render();
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
    game.set(i, drag.value);
    drag.n++;
    if (drag.value === 1) {
      Kit.sfx.tone(440 * Math.pow(1.059, Math.min(drag.n, 14) * 2), 0.07, 'sine', { vol: 0.08 });
      autoCross(i);
    } else if (drag.value === 2) Kit.sfx.tone(300, 0.05, 'triangle', { vol: 0.06 });
    else Kit.sfx.tone(240, 0.05, 'sine', { vol: 0.05 });
    game.save(); render(i);
  }

  /* When a fill makes its row or column match the clue exactly, cross out the
     rest of that line for the player (the clue dims too). Only on fills, so a
     kid can still clear a cross by tapping it. */
  function autoCross(i) {
    var r = Math.floor(i / game.w), c = i % game.w, k;
    // Only when the fills are the right ones: a wrong fill can still match
    // the clue's counts, and crossing out the true squares would mislead.
    function right(idx) { return (game.cells[idx] === 1) === (game.solution[idx] === 1); }
    var rowOk = game.rowDone(r), colOk = game.colDone(c);
    for (k = 0; k < game.w; k++) if (!right(r * game.w + k)) rowOk = false;
    for (k = 0; k < game.h; k++) if (!right(k * game.w + c)) colOk = false;
    if (rowOk) { for (k = 0; k < game.w; k++) if (!game.cells[r * game.w + k]) game.cells[r * game.w + k] = 2; lineDone(rowEls[r]); }
    if (colOk) { for (k = 0; k < game.h; k++) if (!game.cells[k * game.w + c]) game.cells[k * game.w + c] = 2; lineDone(colEls[c]); }
  }
  function lineDone(el) {
    if (el.classList.contains('done')) return;
    Kit.anim(el, 'flash');
    Kit.sfx.tone(784, 0.1, 'sine', { vol: 0.07, when: 0.05 });
    Kit.sfx.tone(1047, 0.14, 'sine', { vol: 0.06, when: 0.12 });
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
    hot = i;
    // Fast swipes skip cells; fill in everything between the last one and this.
    var step = drag.axis === 'row' ? 1 : game.w;
    var dir = i > drag.last ? step : -step;
    for (var j = drag.last + dir; j !== i + dir; j += dir) { drag.last = j; paint(j); }
    render();
  }, { passive: false });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    drag = null;
    hot = -1;
    if (game) render();
    checkSolved();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  function checkSolved() {
    if (game && game.isSolved() && !gridEl.classList.contains('solved')) setTimeout(win, 200);
  }

  /* ---------- undo and hints ---------- */
  function undo() {
    if (!game || !undoStack.length || drag || Kit.overlayOpen()) return;
    game.cells = undoStack.pop();
    game.save(); render();
    Kit.sfx.tone(600, 0.1, 'sine', { vol: 0.07, to: 380 });
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
        var keep = line.slice();
        for (t = pos; t < s; t++) line[t] = 0;
        for (t = s; t < s + clue[k]; t++) line[t] = 1;
        if (s + clue[k] < n) line[s + clue[k]] = 0;
        place(k + 1, Math.min(n, s + clue[k] + 1));
        line = keep;
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
    if (!game || drag || Kit.overlayOpen() || gridEl.classList.contains('solved')) return;
    var i, wrong = [];
    for (i = 0; i < game.cells.length; i++) {
      if ((game.cells[i] === 1 && !game.solution[i]) || (game.cells[i] === 2 && game.solution[i])) wrong.push(i);
    }
    pushUndo();
    if (wrong.length) {
      wrong.forEach(function (w) { game.cells[w] = 0; });
      game.save(); render();
      setTimeout(function () { wrong.forEach(function (w) { flash(w, 'oops'); }); }, 0);
      Kit.sfx.bad();
      Kit.toast(wrong.length === 1 ? 'Oops, one was wrong. Fixed it!' : 'Oops, ' + wrong.length + ' were wrong. Fixed them!', { icon: 'hint', top: true });
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
    if (pick < 0) { undoStack.pop(); Kit.toast('Looks finished!', { top: true }); return; }
    game.cells[pick] = val;
    if (val === 1) autoCross(pick);
    game.save(); render();
    setTimeout(function () { flash(pick, 'hint'); }, 0);
    Kit.sfx.open();
    Kit.toast(val === 1 ? 'This square is filled' : 'This square stays empty', { icon: 'hint', top: true });
    checkSolved();
  }

  /* ---------- winning ---------- */
  function win() {
    if (!game || gridEl.classList.contains('solved')) return;
    var first = !NonoGame.solvedSet()[game.id];
    game.markSolved();
    tutEnd();
    // Show the picture clean: crosses vanish, clues fade away.
    for (var i = 0; i < game.cells.length; i++) if (game.cells[i] === 2) game.cells[i] = 0;
    game.save();
    render();
    gridEl.classList.add('solved');
    // A diagonal wave of pops across the revealed picture.
    for (i = 0; i < cellEls.length; i++) {
      if (game.cells[i] !== 1) continue;
      cellEls[i].style.setProperty('--d', (((i % game.w) + Math.floor(i / game.w)) * 0.04) + 's');
      cellEls[i].classList.add('reveal');
    }
    Kit.sfx.good();
    Kit.buzz([30, 40, 30]);
    var next = nextUnsolved(), id = game.id;
    var mini = '<span class="mini-pic" style="grid-template-columns: repeat(' + game.w + ', 1fr)">';
    for (i = 0; i < game.cells.length; i++) mini += '<i style="background:' + (game.solution[i] ? game.color : 'transparent') + '"></i>';
    mini += '</span>';
    var n = Object.keys(NonoGame.solvedSet()).length;
    setTimeout(function () {
      if (!game || game.id !== id) return;
      Kit.result({
        title: game.name + '!', confetti: true,
        text: mini + (n >= NONO_PUZZLES.length ? 'Every picture solved. Amazing!' : n + ' of ' + NONO_PUZZLES.length + ' pictures solved.'),
        badge: first && n % 10 === 0 ? n + ' solved!' : '',
        buttons: [{ label: 'All pictures', value: 'lib' }, next ? { label: 'Next', value: 'next', primary: true, icon: 'next' } : { label: 'Done', value: 'lib', primary: true }]
      }).then(function (v) {
        if (v === 'next' && next) open(next);
        else if (v === 'lib') showLibrary();
      });
    }, 900 + (game.w + game.h) * 40);
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

  /* ---------- buttons ---------- */
  function setMode(m) { if (mode !== m) { mode = m; Kit.sfx.click(); if (game) render(); } }
  document.getElementById('mode-fill').addEventListener('click', function () { setMode(1); });
  document.getElementById('mode-x').addEventListener('click', function () { setMode(2); });
  document.getElementById('clear-btn').addEventListener('click', function () {
    if (!game || Kit.overlayOpen() || !game.cells.some(function (v) { return v; })) return;
    pushUndo();
    game.clear(); gridEl.classList.remove('solved'); render();
    Kit.sfx.slide();
    Kit.toast('Cleared. Undo brings it back', { icon: 'undo', top: true });
  });
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('hint-btn').addEventListener('click', hint);
  document.getElementById('back-btn').addEventListener('click', function () { Kit.sfx.tap(); showLibrary(); });

  var HOWTO = [
    { emoji: '🔢', text: 'Each number says how many squares <b>in a row</b> are filled, in order.' },
    { emoji: '👆', text: 'Tap a square to fill it, or drag along a row or column.' },
    { emoji: '❌', text: 'Switch to <b>Mark</b> to put an X where nothing goes.' },
    { icon: 'hint', text: 'Stuck? Hint fixes mistakes, then shows one square.' }
  ];
  Kit.bindHelp(document.getElementById('help-btn'), 'nonogram', HOWTO);
  Kit.bindHelp(document.getElementById('lib-help'), 'nonogram', HOWTO);
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindMute(document.getElementById('lib-mute'));

  // Reopen the last picture the kid was on, if unsolved.
  var last = Kit.raw('nono.last');
  var def = NONO_PUZZLES.filter(function (p) { return p.id === last; })[0];
  if (def && !NonoGame.solvedSet()[def.id]) open(def); else showLibrary();
  if (!game || game.w !== 3) Kit.howTo('nonogram', HOWTO);

  window.__nono = { game: function () { return game; }, open: open, showLibrary: showLibrary, render: render };
})();
