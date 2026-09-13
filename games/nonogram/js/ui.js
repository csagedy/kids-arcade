(function () {
  var libEl = document.getElementById('lib');
  var playEl = document.getElementById('play');
  var gridEl = document.getElementById('grid');
  var game = null, cellEls = [], mode = 1;   // 1 fill, 2 cross
  var drag = null;

  /* ---------- library ---------- */
  function showLibrary() {
    game = null;
    playEl.classList.add('hidden');
    libEl.classList.remove('hidden');
    var solved = NonoGame.solvedSet();
    var list = document.getElementById('lib-grid');
    list.innerHTML = '';
    NONO_PUZZLES.forEach(function (def, i) {
      var b = document.createElement('button');
      b.className = 'lvl' + (solved[def.id] ? ' done' : '');
      var size = def.art[0].length + '×' + def.art.length;
      b.innerHTML = '<div class="lvl-n"></div><div class="lvl-size"></div>';
      b.querySelector('.lvl-n').textContent = solved[def.id] ? def.name : String(i + 1);
      b.querySelector('.lvl-size').textContent = solved[def.id] ? '✓' : size;
      if (solved[def.id]) b.style.background = def.color;
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
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0 || !game) return;
    e.preventDefault();
    var cur = game.cells[i];
    var value = cur === mode ? 0 : mode;   // tap again to clear
    drag = { value: value, r: Math.floor(i / game.w), c: i % game.w, axis: null, last: i };
    paint(i);
  });

  function paint(i) {
    if (drag.value === 1 && game.cells[i] === 2 && i !== drag.last) return;   // don't fill over crosses mid-stroke
    if (game.set(i, drag.value)) { game.save(); render(); }
  }

  window.addEventListener('pointermove', function (e) {
    if (!drag || !game) return;
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

  function endDrag() {
    if (!drag) return;
    drag = null;
    if (game && game.isSolved()) setTimeout(win, 250);
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  function win() {
    game.markSolved();
    // Show the picture clean: crosses vanish.
    for (var i = 0; i < game.cells.length; i++) if (game.cells[i] === 2) game.cells[i] = 0;
    game.save();
    render();
    document.getElementById('win-name').textContent = game.name;
    document.getElementById('win').classList.remove('hidden');
  }

  document.getElementById('mode-fill').addEventListener('click', function () { mode = 1; render(); });
  document.getElementById('mode-x').addEventListener('click', function () { mode = 2; render(); });
  document.getElementById('clear-btn').addEventListener('click', function () {
    if (!game) return;
    game.clear(); render();
  });
  document.getElementById('back-btn').addEventListener('click', showLibrary);
  document.getElementById('win-lib').addEventListener('click', showLibrary);
  document.getElementById('win-next').addEventListener('click', function () {
    var idx = NONO_PUZZLES.map(function (p) { return p.id; }).indexOf(game.id);
    var next = NONO_PUZZLES[(idx + 1) % NONO_PUZZLES.length];
    open(next);
  });

  // Reopen the last picture the kid was on, if unsolved.
  var last = null;
  try { last = localStorage.getItem('nono.last'); } catch (e) {}
  var def = NONO_PUZZLES.filter(function (p) { return p.id === last; })[0];
  if (def && !NonoGame.solvedSet()[def.id]) open(def); else showLibrary();

  window.__nono = { game: function () { return game; }, open: open, showLibrary: showLibrary, render: render };
})();
