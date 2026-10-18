/* Four in a Row UI: DOM board, drop animation, computer turns. */
(function () {
  var boardEl = document.getElementById('board'), statusEl = document.getElementById('status');
  var subEl = document.getElementById('sub'), winsEl = document.getElementById('wins');
  var hintEl = document.getElementById('hint');
  var board, turn, mode, over = false, busy = false, discs = [], timers = [];
  var NAMES = { 1: 'Red', 2: 'Yellow' };

  // build the 7 columns of 6 holes once
  var cols = [];
  for (var c = 0; c < 7; c++) {
    var col = document.createElement('div');
    col.className = 'col';
    col.setAttribute('data-c', c);
    for (var r = 0; r < 6; r++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      var hole = document.createElement('div');
      hole.className = 'hole';
      cell.appendChild(hole);
      col.appendChild(cell);
    }
    boardEl.appendChild(col);
    cols.push(col);
  }
  function holeAt(r, c) { return cols[c].children[r].firstChild; }

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

  function place(r, c, p, animate) {
    var d = document.createElement('div');
    d.className = 'disc p' + p;
    if (animate) { d.className += ' drop'; d.style.setProperty('--rows', r); }
    holeAt(r, c).appendChild(d);
    discs[r * 7 + c] = d;
  }

  function render() {
    clearTimers();
    discs = [];
    for (var i = 0; i < 42; i++) {
      var h = holeAt(Math.floor(i / 7), i % 7);
      h.innerHTML = '';
      if (board[i]) place(Math.floor(i / 7), i % 7, board[i], false);
    }
  }

  function vsComputer() { return mode !== 'two'; }

  function setStatus() {
    var s;
    if (!vsComputer()) s = NAMES[turn] + "'s turn";
    else s = turn === 1 ? 'Your turn' : 'Thinking…';
    statusEl.textContent = s;
    statusEl.style.color = turn === 1 ? 'var(--red)' : 'var(--yellow)';
    boardEl.classList.toggle('locked', busy || (vsComputer() && turn === 2));
    subEl.style.visibility = vsComputer() ? 'visible' : 'hidden';
  }

  function persist() { C4.save({ board: board, turn: turn, mode: mode }); }

  function newGame(m) {
    mode = m; board = C4.empty(); turn = 1; over = false; busy = false;
    render(); persist(); setStatus();
    hintEl.classList.remove('hidden');
    document.getElementById('over').classList.add('hidden');
    document.getElementById('setup').classList.add('hidden');
  }

  function play(c) {
    var r = C4.dropRow(board, c);
    if (r < 0) return;
    hintEl.classList.add('hidden');
    var p = turn;
    board[r * 7 + c] = p;
    busy = true;
    place(r, c, p, true);
    var w = C4.winner(board);
    if (!w && !C4.isFull(board)) turn = 3 - p;
    persist();
    setStatus();
    later(function () {
      busy = false;
      if (w) return finish(w);
      if (C4.isFull(board)) return finish(null);
      setStatus();
      if (vsComputer() && turn === 2) computerTurn();
    }, 650);
  }

  function computerTurn() {
    later(function () {
      if (over) return;
      play(C4.aiMove(board, 2, mode));
    }, 250);
  }

  function finish(w) {
    over = true;
    C4.clearSave();
    boardEl.classList.add('locked');
    var emoji = '🤝', title = "It's a tie!";
    if (w) {
      for (var i = 0; i < w.cells.length; i++) discs[w.cells[i]].classList.add('win');
      if (!vsComputer()) { emoji = '🎉'; title = NAMES[w.player] + ' wins!'; }
      else if (w.player === 1) { emoji = '🎉'; title = 'You win!'; winsEl.textContent = C4.addWin(); }
      else { emoji = '🙂'; title = 'Good game! Try again?'; }
      if (navigator.vibrate) navigator.vibrate(w.player === 1 ? 60 : 20);
    }
    statusEl.textContent = w ? (w.player === 1 ? (vsComputer() ? 'You win!' : 'Red wins!') : (vsComputer() ? 'Computer wins' : 'Yellow wins!')) : 'Tie';
    later(function () {
      document.getElementById('over-emoji').textContent = emoji;
      document.getElementById('over-title').textContent = title;
      document.getElementById('over').classList.remove('hidden');
    }, w ? 1400 : 700);
  }

  boardEl.addEventListener('click', function (e) {
    if (over || busy || (vsComputer() && turn === 2)) return;
    var el = e.target;
    while (el && el !== boardEl && !el.hasAttribute('data-c')) el = el.parentNode;
    if (!el || el === boardEl) return;
    play(parseInt(el.getAttribute('data-c'), 10));
  });

  function showSetup(canCancel) {
    document.getElementById('setup-cancel').classList.toggle('hidden', !canCancel);
    document.getElementById('setup').classList.remove('hidden');
  }
  var modeBtns = document.querySelectorAll('[data-mode]');
  for (var i = 0; i < modeBtns.length; i++) {
    modeBtns[i].addEventListener('click', function (e) { newGame(e.currentTarget.getAttribute('data-mode')); });
  }
  document.getElementById('menu-btn').addEventListener('click', function () { showSetup(!over); });
  document.getElementById('setup-cancel').addEventListener('click', function () {
    document.getElementById('setup').classList.add('hidden');
  });
  document.getElementById('over-again').addEventListener('click', function () { newGame(mode); });
  document.getElementById('over-menu').addEventListener('click', function () {
    document.getElementById('over').classList.add('hidden'); showSetup(false);
  });

  winsEl.textContent = C4.loadWins();
  var saved = C4.loadSaved();
  if (saved && !C4.winner(saved.board) && !C4.isFull(saved.board)) {
    mode = saved.mode || 'easy'; board = saved.board; turn = saved.turn;
    render(); setStatus();
    if (vsComputer() && turn === 2) computerTurn();
  } else {
    mode = 'easy'; board = C4.empty(); turn = 1; render(); setStatus();
    showSetup(false);
  }
})();
