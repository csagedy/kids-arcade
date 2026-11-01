/* Four in a Row screen, on the arcade kit.

   Touch the board and a disc hovers over that column; slide along to pick
   another column and let go to drop it (a quick tap works too). Discs fall
   behind the blue frame with a little bounce. The computer slides its disc
   over before dropping, so kids can see where it went. */
(function () {
  var boardEl = document.getElementById('board');
  var frameEl = document.getElementById('frame');
  var discsEl = document.getElementById('discs');
  var ghost = document.getElementById('ghost');
  var glow = document.getElementById('glow');
  var turnEl = document.getElementById('turn');
  var statusEl = document.getElementById('status');
  var undoBtn = document.getElementById('undo-btn');

  var MODES = {
    easy:   { emoji: '🙂', label: 'Easy',    sub: 'A gentle computer' },
    medium: { emoji: '😎', label: 'Medium',  sub: 'Plays to win' },
    hard:   { emoji: '🤖', label: 'Hard',    sub: 'Thinks ahead' },
    two:    { emoji: '👫', label: 'Two players', sub: 'Take turns' }
  };
  var TALLY_KEY = 'connect4.tally';

  var board, turn, mode, moves, over = false, busy = false, discs = [], timers = [];
  var col = 3, holding = false;
  var tally = Kit.load(TALLY_KEY, null);
  if (!tally || typeof tally !== 'object' || !(tally.a >= 0) || !(tally.b >= 0)) tally = { mode: 'easy', a: 0, b: 0 };

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }
  function vsComputer() { return mode !== 'two'; }
  function myTurn() { return !over && !busy && !(vsComputer() && turn === 2); }

  /* ---------- the frame: an SVG with 42 holes cut out ---------- */
  (function drawFrame() {
    var svg = document.getElementById('front');
    svg.setAttribute('viewBox', '0 0 7.5 6.5');
    svg.setAttribute('preserveAspectRatio', 'none');
    var d = 'M0.4 0H7.1A0.4 0.4 0 0 1 7.5 0.4V6.1A0.4 0.4 0 0 1 7.1 6.5H0.4A0.4 0.4 0 0 1 0 6.1V0.4A0.4 0.4 0 0 1 0.4 0Z';
    var rings = '';
    for (var r = 0; r < 6; r++) for (var c = 0; c < 7; c++) {
      var x = 0.75 + c, y = 0.75 + r, R = 0.4;
      d += 'M' + (x - R) + ' ' + y + 'a' + R + ' ' + R + ' 0 1 0 ' + 2 * R + ' 0a' + R + ' ' + R + ' 0 1 0 ' + -2 * R + ' 0Z';
      rings += '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 0.02) + '"/>';
    }
    svg.innerHTML =
      '<defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#5a8bff"/><stop offset="1" stop-color="#3a63e6"/></linearGradient></defs>' +
      '<path d="' + d + '" fill="url(#fg)" fill-rule="evenodd"/>' +
      '<g fill="none" stroke="#2a49b8" stroke-width="0.06">' + rings + '</g>' +
      '<g fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.03" transform="translate(0 0.035)">' + rings + '</g>';
  })();
  document.getElementById('winline').setAttribute('viewBox', '0 0 7.5 6.5');

  /* ---------- discs ---------- */
  function makeDisc(r, c, p) {
    var d = document.createElement('div');
    d.className = 'disc p' + p;
    d.style.setProperty('--r', r);
    d.style.setProperty('--c', c);
    d.appendChild(document.createElement('i'));
    discsEl.appendChild(d);
    discs[r * 7 + c] = d;
    return d;
  }
  function render() {
    discsEl.innerHTML = '';
    discs = [];
    for (var i = 0; i < 42; i++) if (board[i]) makeDisc(Math.floor(i / 7), i % 7, board[i]);
    markLast();
    document.getElementById('winline').innerHTML = '';
    boardEl.classList.remove('done');
  }
  function markLast() {
    var old = discsEl.querySelector('.last');
    if (old) old.classList.remove('last');
    var m = moves[moves.length - 1];
    if (m !== undefined && discs[m]) discs[m].classList.add('last');
  }

  /* Fall from the lane into row r, land with a bounce. Calls back on landing. */
  function dropAnim(d, r, landed) {
    var ms = 240 + r * 45;
    if (Kit.reduced || !d.animate) { landed(); return 0; }
    var from = -(r + 1.25) * 100;
    d.animate([
      { transform: 'translateY(' + from + '%)', easing: 'cubic-bezier(.55,0,1,.6)' },
      { transform: 'translateY(0)', offset: 0.72, easing: 'cubic-bezier(0,.4,.6,1)' },
      { transform: 'translateY(' + -(4 + r * 2.5) + '%)', offset: 0.86, easing: 'cubic-bezier(.4,0,1,1)' },
      { transform: 'translateY(0)' }
    ], { duration: ms });
    later(landed, ms * 0.72);
    return ms;
  }

  /* ---------- status ---------- */
  function setStatus() {
    var s;
    if (over) s = statusEl.textContent;
    else if (!vsComputer()) s = (turn === 1 ? 'Red' : 'Yellow') + "'s turn";
    else s = turn === 1 ? 'Your turn' : 'Thinking…';
    statusEl.textContent = s;
    turnEl.className = 'turn p' + turn + (vsComputer() && turn === 2 && !over ? ' thinking' : '');
    document.getElementById('pl1').classList.toggle('on', !over && turn === 1);
    document.getElementById('pl2').classList.toggle('on', !over && turn === 2);
    ghost.className = 'ghost p' + turn + (over ? ' off' : '') + (holding ? ' held' : '') + (vsComputer() && turn === 2 && !over ? ' wait' : '');
    glow.classList.toggle('on', holding && myTurn());
    undoBtn.disabled = over || busy || !moves.length || (vsComputer() && (turn === 2 || moves.length < 2));
  }
  function setCol(c) {
    col = Math.max(0, Math.min(6, c));
    boardEl.style.setProperty('--col', col);
  }
  function renderPlayers() {
    var m = MODES[mode];
    document.getElementById('name1').textContent = vsComputer() ? 'You' : 'Red';
    document.getElementById('name2').textContent = vsComputer() ? 'Computer' : 'Yellow';
    document.getElementById('mode-label').textContent = m.label;
    if (tally.mode !== mode) tally = { mode: mode, a: 0, b: 0 };
    document.getElementById('score1').textContent = tally.a;
    document.getElementById('score2').textContent = tally.b;
    document.getElementById('wins').textContent = C4.loadWins();
    // the Wins chip counts wins against the computer: hide it for two players
    document.getElementById('wins-chip').hidden = !vsComputer();
  }

  function persist() { C4.save({ board: board, turn: turn, mode: mode, moves: moves }); }

  /* ---------- game flow ---------- */
  function newGame(m) {
    clearTimers();
    Kit.closeAll();
    mode = m; board = C4.empty(); turn = 1; moves = []; over = false; busy = false;
    render(); renderPlayers(); persist(); setStatus();
    Kit.sfx.slide();
  }

  function play(c) {
    var r = C4.dropRow(board, c);
    if (r < 0) {
      Kit.sfx.bad(); Kit.anim(ghost, 'k-shake');
      return false;
    }
    var p = turn;
    board[r * 7 + c] = p;
    moves.push(r * 7 + c);
    busy = true;
    setCol(c);
    var d = makeDisc(r, c, p);
    markLast();
    var w = C4.winner(board), full = C4.isFull(board);
    if (!w && !full) turn = 3 - p;
    persist();
    holding = false;
    ghost.classList.add('off');
    glow.classList.remove('on');
    var ms = dropAnim(d, r, function () {
      Kit.sfx.place();
      Kit.sfx.tone(p === 1 ? 392 : 523, 0.09, 'sine', { vol: 0.06, when: 0.02 });
      Kit.buzz(8);
    });
    later(function () {
      busy = false;
      if (w) return finish(w);
      if (full) return finish(null);
      setStatus();
      Kit.anim(turnEl, 'flash');
      if (vsComputer() && turn === 2) computerTurn();
    }, ms + 80);
    return true;
  }

  function computerTurn() {
    setStatus();
    var c = C4.aiMove(board, 2, mode);
    // slide the waiting disc over to its column, then drop
    later(function () { if (!over) setCol(c); }, 380);
    later(function () { if (!over) play(c); }, 380 + 140 + 260);
  }

  function finish(w) {
    over = true;
    C4.clearSave();
    Kit.stat('connect4', 'Wins ' + C4.loadWins());
    boardEl.classList.add('done');
    var youWon = w && w.player === 1;
    if (w) {
      for (var i = 0; i < w.cells.length; i++) discs[w.cells[i]].classList.add('win');
      var a = w.cells[0], b = w.cells[3];
      document.getElementById('winline').innerHTML = '<line x1="' + (0.75 + a % 7) + '" y1="' + (0.75 + Math.floor(a / 7)) +
        '" x2="' + (0.75 + b % 7) + '" y2="' + (0.75 + Math.floor(b / 7)) + '"/>';
      if (w.player === 1) tally.a++; else tally.b++;
      Kit.save(TALLY_KEY, tally);
      if (vsComputer() && youWon) C4.addWin();
      var pl = document.getElementById('pl' + w.player);
      Kit.anim(pl, 'bump');
      renderPlayers();
      if (vsComputer() && youWon) Kit.anim(document.getElementById('wins-chip'), 'k-bump');
      Kit.sfx.good();
      Kit.buzz(youWon || !vsComputer() ? [30, 40, 30] : 20);
    } else Kit.sfx.tone(330, 0.2, 'triangle', { vol: 0.08 });

    var title, text, emoji, conf = false, snd;
    if (!w) { emoji = '🤝'; title = "It's a tie!"; text = 'The board is full and nobody got four. So close!'; snd = 'good'; }
    else if (!vsComputer()) {
      emoji = w.player === 1 ? '🔴' : '🟡'; title = (w.player === 1 ? 'Red' : 'Yellow') + ' wins!';
      text = 'Four in a row! Great game, both of you.'; conf = true;
    } else if (youWon) {
      emoji = '🎉'; title = 'You win!'; conf = true;
      text = mode === 'hard' ? 'You beat the <b>Hard</b> computer. Wow!' : 'Four in a row! Want to try a harder computer?';
    } else { emoji = '🤖'; title = 'The computer got four'; text = 'Good game! Look for its lines and block them next time.'; snd = 'lose'; }
    statusEl.textContent = !w ? "It's a tie" : !vsComputer() ? title : youWon ? 'You win!' : 'Computer wins';
    setStatus();

    var stats = [{ label: vsComputer() ? 'You' : 'Red', value: tally.a, hi: youWon || (w && w.player === 1) },
                 { label: vsComputer() ? 'Computer' : 'Yellow', value: tally.b, hi: w && w.player === 2 }];
    later(function () {
      Kit.result({
        emoji: emoji, title: title, text: text, wiggle: conf, confetti: conf, sound: conf ? 'win' : snd, stats: stats,
        buttons: [{ label: 'Change game', value: 'menu' }, { label: 'Play again', value: 'again', primary: true }]
      }).then(function (v) {
        if (v === 'menu') showSetup(false);
        else if (v === 'again') newGame(mode);
      });
    }, w ? 1500 : 700);
  }

  function undo() {
    if (!moves.length || busy || over || Kit.overlayOpen()) return;
    var n = vsComputer() ? 2 : 1;
    if (vsComputer() && (turn === 2 || moves.length < 2)) return;
    for (var k = 0; k < n; k++) {
      var i = moves.pop();
      board[i] = 0;
      if (discs[i]) discs[i].parentNode.removeChild(discs[i]);
      discs[i] = null;
    }
    turn = vsComputer() ? 1 : 3 - turn;
    markLast(); persist(); setStatus();
    Kit.sfx.tone(600, 0.1, 'sine', { vol: 0.08, to: 380 });
  }

  /* ---------- touch: hover a disc over a column, let go to drop ---------- */
  function colAt(x) {
    var rc = frameEl.getBoundingClientRect();
    var cs = rc.width / 7.5;
    return Math.floor((x - rc.left - cs * 0.25) / cs);
  }
  var pid = null;
  boardEl.addEventListener('pointerdown', function (e) {
    if (!myTurn() || Kit.overlayOpen()) return;
    pid = e.pointerId;
    try { boardEl.setPointerCapture(pid); } catch (err) {}
    holding = true;
    setCol(colAt(e.clientX));
    Kit.sfx.click();
    setStatus();
    e.preventDefault();
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!myTurn()) return;
    if (pid === null && e.pointerType !== 'mouse') return;
    var c = Math.max(0, Math.min(6, colAt(e.clientX)));
    if (c !== col) { setCol(c); if (holding) Kit.sfx.click(); }
  });
  boardEl.addEventListener('pointerup', function (e) {
    if (e.pointerId !== pid) return;
    pid = null;
    if (!holding || !myTurn()) { holding = false; setStatus(); return; }
    var rc = boardEl.getBoundingClientRect();
    holding = false;
    if (e.clientY > rc.bottom + 60 || e.clientY < rc.top - 80) { setStatus(); return; }   // dragged off: cancel
    if (!play(col)) setStatus();
  });
  boardEl.addEventListener('pointercancel', function () { pid = null; holding = false; setStatus(); });

  // keyboard: arrows move, space/enter/down drops
  document.addEventListener('keydown', function (e) {
    if (Kit.overlayOpen() || !myTurn()) return;
    if (e.key === 'ArrowLeft') setCol(col - 1);
    else if (e.key === 'ArrowRight') setCol(col + 1);
    else if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') play(col);
    else if (e.key >= '1' && e.key <= '7') play(+e.key - 1);
    else return;
    e.preventDefault();
  });

  /* ---------- setup sheet ---------- */
  function showSetup(canCancel) {
    var html = '<p>Who do you want to play?</p><div class="modes">';
    Object.keys(MODES).forEach(function (k) {
      var m = MODES[k];
      html += '<button class="k-btn ' + (k === 'two' ? 'k-btn--purple' : k === 'easy' ? 'k-btn--good' : k === 'medium' ? 'k-btn--blue' : 'k-btn--pink') +
        (canCancel && k === mode ? ' cur' : '') + '" data-mode="' + k + '"><b>' + m.emoji + '</b><span>' + m.label + '</span><small>' + m.sub + '</small></button>';
    });
    html += '</div>';
    Kit.sfx.open();
    Kit.sheet({
      title: 'Four in a Row', html: html, dismissValue: canCancel ? null : (MODES[mode] ? mode : 'easy'),
      buttons: canCancel ? [{ label: 'Keep playing', value: null }] : [],
      onOpen: function (card, close) {
        card.querySelector('.modes').addEventListener('click', function (e) {
          var b = e.target.closest('[data-mode]');
          if (b) { Kit.sfx.tap(); close(b.getAttribute('data-mode')); }
        });
      }
    }).then(function (m) {
      if (m && MODES[m]) {
        newGame(m);
        if (!canCancel) Kit.howTo('connect4', HOWTO);
      }
    });
  }

  var HOWTO = [
    { emoji: '👆', text: 'Touch a column. Slide to pick another, let go to <b>drop</b> your disc.' },
    { emoji: '⬇️', text: 'Discs fall to the lowest empty hole.' },
    { emoji: '🔴', text: 'Get <b>four</b> of your colour in a line: across, up and down, or slanted.' },
    { emoji: '🛡️', text: 'Watch out for the other player’s lines and block them!' }
  ];

  document.getElementById('new-btn').addEventListener('click', function () {
    if (Kit.overlayOpen()) return;
    showSetup(!over && moves.length > 0);
  });
  document.getElementById('mode-btn').addEventListener('click', function () { if (!Kit.overlayOpen()) showSetup(!over && moves.length > 0); });
  undoBtn.addEventListener('click', undo);
  Kit.bindHelp(document.getElementById('help-btn'), 'connect4', HOWTO);
  Kit.bindMute(document.getElementById('mute-btn'));

  /* ---------- start ---------- */
  var saved = C4.loadSaved();
  if (saved && !C4.winner(saved.board) && !C4.isFull(saved.board)) {
    mode = MODES[saved.mode] ? saved.mode : 'easy'; board = saved.board; turn = saved.turn;
    moves = Array.isArray(saved.moves) ? saved.moves.filter(function (i) { return board[i]; }) : [];
    setCol(3); render(); renderPlayers(); setStatus();
    if (vsComputer() && turn === 2) computerTurn();
  } else {
    mode = MODES[tally.mode] ? tally.mode : 'easy'; board = C4.empty(); turn = 1; moves = [];
    setCol(3); render(); renderPlayers(); setStatus();
    showSetup(false);
  }
})();
