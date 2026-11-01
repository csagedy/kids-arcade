/* 2048 screen, on the arcade kit (kit/kit.js). This is the reference game
   for putting a puzzle on the kit: shell and icons come from the HTML,
   overlays / sounds / storage / swipes from Kit.*, and only the board is
   drawn here.

   Tiles are persistent elements: a move slides each one to where it ends
   up, both tiles of a merging pair slide into the same cell, and when the
   slide lands the one underneath is removed and the survivor turns into the
   new value with a bump. */
(function () {
  var boardEl = document.getElementById('board');
  var tilesEl = document.getElementById('tiles');
  var scoreChip = document.getElementById('score-chip');
  var SLIDE_MS = 110;

  var game;
  var cells = {};          // board index -> tile element
  var pending = null;      // { timer, finish } while a slide is landing
  var bestAtStart = 0;     // to cheer once when this game passes the old best

  function label(v) { return String(Math.pow(2, v)); }

  function build() {
    for (var i = 0; i < N * N; i++) {
      var b = document.createElement('div');
      b.className = 'bg';
      document.getElementById('cells').appendChild(b);
    }
  }

  function pos(el, i) {
    el.style.setProperty('--r', Math.floor(i / N));
    el.style.setProperty('--c', i % N);
  }

  function setValue(el, v) {
    var s = label(v);
    el.className = 'tile v' + Math.min(v, 13) + ' d' + Math.min(s.length, 5);
    el.firstChild.textContent = s;
  }

  function makeTile(i, v, cls) {
    var t = document.createElement('div');
    t.appendChild(document.createElement('div')).className = 'tile-in';
    setValue(t, v);
    if (cls) t.classList.add(cls);
    pos(t, i);
    tilesEl.appendChild(t);
    return t;
  }

  /* Draw every tile from scratch (start, undo, new game). */
  function renderAll() {
    tilesEl.innerHTML = '';
    cells = {};
    for (var i = 0; i < N * N; i++) if (game.grid[i]) cells[i] = makeTile(i, game.grid[i]);
    renderStats();
  }

  function renderStats() {
    document.getElementById('score').textContent = game.score;
    document.getElementById('best').textContent = game.best;
    document.getElementById('undo-btn').disabled = !game.prev;
    var have = Math.max(1, game.maxTile()), next = Math.min(have + 1, 17);
    var h = document.getElementById('goal-have'), n = document.getElementById('goal-next');
    h.className = 'mini v' + Math.min(have, 13); h.textContent = label(have);
    n.className = 'mini v' + Math.min(next, 13); n.textContent = label(next);
  }

  /* ---------- moving ---------- */
  function move(dir) {
    if (Kit.overlayOpen()) return;
    if (pending) pending.finish();          // a quick second swipe lands the first one at once
    var res = game.move(dir);
    if (!res) { nudge(dir); return; }

    // Slide every tile to its destination. The second tile to arrive in a
    // cell is the one that disappears; it slides underneath the first.
    var next = {}, dying = [];
    Object.keys(cells).forEach(function (k) {
      var el = cells[k], to = res.from[k];
      el.classList.remove('new', 'merged');
      if (to === undefined) { dying.push(el); return; }
      pos(el, to);
      if (next[to]) { el.classList.add('under'); dying.push(el); } else next[to] = el;
    });
    cells = next;
    Kit.sfx.slide();

    function finish() {
      if (!pending) return;
      clearTimeout(pending.timer);
      pending = null;
      dying.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      var top = 0;
      res.merges.forEach(function (m) {
        var el = cells[m];
        if (!el) return;
        setValue(el, game.grid[m]);
        el.classList.add('merged');
        top = Math.max(top, game.grid[m]);
      });
      if (res.spawned >= 0) cells[res.spawned] = makeTile(res.spawned, game.grid[res.spawned], 'new');
      renderStats();
      if (top) {
        Kit.sfx.pop(260 * Math.pow(1.12, top));
        Kit.buzz(top >= 7 ? 18 : 8);
      }
      if (res.gained) {
        Kit.anim(scoreChip, 'k-bump');
        Kit.floatText('+' + res.gained, scoreChip);
      }
      if (bestAtStart > 0 && game.score > bestAtStart) {
        bestAtStart = 0;
        Kit.toast('New best score!', { icon: 'star', top: true });
        Kit.sfx.good();
      }
      if (game.won && !game.keepGoing) { setTimeout(won, 250); return; }
      if (!game.canMove()) setTimeout(over, 500);
    }
    pending = { timer: setTimeout(finish, SLIDE_MS), finish: finish };
  }

  function nudge(dir) {
    var d = [[-1, 0], [0, -1], [1, 0], [0, 1]][dir];
    tilesEl.style.transition = 'transform 70ms';
    tilesEl.style.transform = 'translate(' + d[0] * 1.2 + 'cqw,' + d[1] * 1.2 + 'cqw)';
    setTimeout(function () { tilesEl.style.transform = ''; }, 80);
    Kit.sfx.tone(150, 0.06, 'triangle', { vol: 0.06 });
  }

  /* ---------- results ---------- */
  function won() {
    // The cheer is on a timer: an undo or new game in the meantime cancels it.
    if (!game.won || game.keepGoing || Kit.overlayOpen()) return;
    Kit.result({
      emoji: '🏆', wiggle: true, confetti: true,
      title: 'You made 2048!',
      text: 'Amazing! Keep going to build even bigger tiles.',
      stats: [{ label: 'Score', value: game.score, hi: true }, { label: 'Best', value: game.best }],
      buttons: [{ label: 'New game', value: 'new' }, { label: 'Keep going', value: 'go', primary: true }]
    }).then(function (v) {
      if (v === 'new') { newGame(); return; }
      game.keepGoing = true; game.save();
      if (!game.canMove()) over();
    });
    Kit.buzz([30, 40, 30]);
  }

  function over() {
    if (game.canMove() || Kit.overlayOpen()) return;
    var isBest = game.score > 0 && game.score >= game.best;
    boardEl.classList.add('dim');
    var buttons = [];
    if (game.prev) buttons.push({ label: 'Undo', value: 'undo', icon: 'undo' });
    buttons.push({ label: 'Play again', value: 'again', primary: true });
    Kit.result({
      emoji: isBest ? '🌟' : '🎈',
      title: 'No moves left',
      badge: isBest ? 'New best score!' : '',
      stats: [
        { label: 'Score', value: game.score, hi: isBest },
        { label: 'Biggest', value: label(game.maxTile()) },
        { label: 'Best', value: game.best }
      ],
      buttons: buttons,
      sound: isBest ? 'win' : 'lose',
      confetti: isBest
    }).then(function (v) {
      if (v === 'undo') undo(); else newGame();
    });
  }

  /* ---------- buttons ---------- */
  function undo() {
    if (pending) pending.finish();
    if (!game.undo()) return;
    Kit.closeAll();
    boardEl.classList.remove('dim');
    Kit.sfx.tone(520, 0.1, 'sine', { vol: 0.08, to: 340 });
    renderAll();
  }

  function newGame() {
    if (pending) pending.finish();
    Kit.drop(G2048.SAVE_KEY);
    game = new G2048();
    game.save();
    bestAtStart = game.best;
    Kit.closeAll();
    boardEl.classList.remove('dim');
    renderAll();
    Kit.sfx.open();
  }

  /* A game in progress is worth a second thought before it's thrown away. */
  function askNew() {
    if (Kit.overlayOpen()) return;
    if (game.score === 0) { newGame(); return; }
    Kit.confirm({ title: 'Start a new game?', text: 'This game will be gone for good.', yes: 'New game', no: 'Keep playing', emoji: '🤔' })
      .then(function (yes) { if (yes) newGame(); });
  }

  function resumeOrNew() {
    var saved = G2048.loadSaved();
    if (!saved) { newGame(); return; }
    game = new G2048(saved);
    if (!game.canMove()) { newGame(); return; }
    bestAtStart = game.score < game.best ? game.best : 0;
    renderAll();
    if (game.won && !game.keepGoing) won();
  }

  var HOW = [
    { emoji: '👆', text: 'Swipe up, down, left or right. <b>Every</b> tile slides.' },
    { emoji: '✨', text: 'Two tiles with the same number join up: 2&nbsp;+&nbsp;2&nbsp;=&nbsp;4.' },
    { emoji: '🏆', text: 'Keep joining to make a <b>2048</b> tile!' },
    { icon: 'undo', text: 'Oops? Undo takes back your last move.' }
  ];

  Kit.swipe(document, move);
  document.getElementById('restart-btn').addEventListener('click', askNew);
  document.getElementById('undo-btn').addEventListener('click', undo);
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindHelp(document.getElementById('help-btn'), '2048', HOW);

  build();
  resumeOrNew();
  if (!Kit.overlayOpen()) Kit.howTo('2048', HOW);

  window.__g2048 = { game: function () { return game; }, move: move, newGame: newGame, undo: undo };
})();
