/* Memory Match screen, on the arcade kit (kit/kit.js). The rules live in
   game.js; this file lays the cards out, flips them and cheers.

   Layout: the board's columns are picked to give the biggest cards for the
   stage (cards keep their reading order, so 4 x 6 standing up becomes
   6 x 4 lying down). */
(function () {
  var boardEl = document.getElementById('board');
  var stageEl = document.getElementById('stage');
  var game, cardEls = [], locked = false, peeking = false, peekTimer = 0, missTimer = 0;
  var streak = 0, layoutKey = '';

  var theme = MM_THEMES.byId(Kit.raw('mm.theme')).id;
  function sizeFromStore() { return Kit.raw('mm.size') || 'easy'; }

  /* ---------- layout ---------- */
  function layout() {
    if (!game) return;
    var n = game.cards.length;
    var cs = getComputedStyle(stageEl);
    var W = stageEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = stageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var best = { c: game.size.cols, r: game.size.rows, cell: 0 };
    best.cell = Math.min(W / best.c, H / best.r);
    for (var c = 2; c <= n / 2; c++) {
      if (n % c) continue;
      var r = n / c, cell = Math.min(W / c, H / r);
      if (cell > best.cell * 1.04) best = { c: c, r: r, cell: cell };
    }
    var key = best.c + 'x' + best.r;
    if (key === layoutKey) return;
    layoutKey = key;
    boardEl.style.setProperty('--cols', best.c);
    boardEl.style.setProperty('--rows', best.r);
    boardEl.style.setProperty('--k-aspect', best.c / best.r);
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stageEl);
  else window.addEventListener('resize', layout);

  /* ---------- side panel ---------- */
  function buildThemes() {
    var box = document.getElementById('themes');
    box.innerHTML = '';
    MM_THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'k-btn k-btn--icon theme-btn';
      b.dataset.theme = t.id;
      b.textContent = t.icon;
      b.setAttribute('aria-label', t.name);
      b.addEventListener('click', function () {
        if (t.id === theme) return;
        Kit.sfx.tap();
        ask(function () { theme = t.id; Kit.setRaw('mm.theme', theme); newGame(game.size.id); });
      });
      box.appendChild(b);
    });
  }

  /* A board with moves on it is worth a second thought before it's thrown away. */
  function ask(fn) {
    if (Kit.overlayOpen()) return;
    if (!game || game.moves === 0 || game.isWon()) { fn(); return; }
    Kit.confirm({ title: 'Start a new game?', text: 'The cards on the table will be shuffled away.', yes: 'New game', no: 'Keep playing', emoji: '🤔' })
      .then(function (yes) { if (yes) fn(); });
  }

  /* ---------- board ---------- */
  function build(deal) {
    boardEl.innerHTML = '';
    cardEls = [];
    boardEl.dataset.theme = game.theme;
    layoutKey = '';
    layout();
    var backArt = MM_THEMES.byId(game.theme).icon;
    game.cards.forEach(function (emoji, i) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'card' + (deal && !Kit.reduced ? ' deal' : '');
      c.style.setProperty('--i', i);
      c.setAttribute('aria-label', 'Card ' + (i + 1));
      c.innerHTML = '<div class="face back"><span></span></div><div class="face front"></div>';
      c.querySelector('.back span').textContent = backArt;
      c.querySelector('.front').textContent = emoji;
      c.addEventListener('click', function () { tap(i); });
      if (game.matched[i]) c.classList.add('settled');
      boardEl.appendChild(c);
      cardEls.push(c);
    });
    if (deal) setTimeout(function () { cardEls.forEach(function (c) { c.classList.remove('deal'); }); }, 900 + game.cards.length * 28);
    render();
  }

  function render() {
    game.cards.forEach(function (_, i) {
      var el = cardEls[i];
      el.classList.toggle('up', peeking || game.matched[i] || game.open.indexOf(i) >= 0);
      el.classList.toggle('matched', game.matched[i]);
      el.setAttribute('aria-label', game.matched[i] || game.open.indexOf(i) >= 0 ? game.cards[i] : 'Card ' + (i + 1));
    });
    document.getElementById('moves').textContent = game.moves;
    document.getElementById('pairs').textContent = game.pairsFound() + '/' + game.cards.length / 2;
    var best = MMGame.loadBest(game.size.id);
    document.getElementById('best').innerHTML = best ? 'Best: <b>' + best + '</b> moves' : '';
    document.querySelectorAll('.theme-btn').forEach(function (b) { b.classList.toggle('k-on', b.dataset.theme === theme); });
    document.querySelectorAll('.size-btn').forEach(function (b) { b.classList.toggle('k-on', b.dataset.size === game.size.id); });
  }

  function flipSound(up) {
    Kit.sfx.tone(up ? 480 : 620, 0.07, 'triangle', { vol: 0.07, to: up ? 760 : 420 });
  }

  function tap(i) {
    if (locked || peeking || Kit.overlayOpen()) return;
    var r = game.flip(i);
    if (r === 'ignore') return;
    flipSound(true);
    render();
    if (r === 'match') {
      streak++;
      var g = game, pair = [];
      game.matched.forEach(function (m, k) { if (m && game.cards[k] === game.cards[i]) pair.push(k); });
      setTimeout(function () {
        if (g !== game) return;
        pair.forEach(function (k) { Kit.anim(cardEls[k], 'pop'); });
        Kit.sfx.pop(440 * Math.pow(1.12, Math.min(streak, 8)));
        Kit.buzz(15);
        var el = cardEls[i], rc = el.getBoundingClientRect();
        if (streak >= 2) Kit.floatText(streak + ' in a row!', rc.left + rc.width / 2, rc.top, '#3ddc84');
        Kit.anim(document.getElementById('pairs-chip'), 'k-bump');
        Kit.confetti({ x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, count: 14 });
        setTimeout(function () { pair.forEach(function (k) { cardEls[k].classList.add('settled'); }); }, 900);
        if (game.isWon()) setTimeout(win, 650);
      }, 330);
    } else if (r === 'miss') {
      streak = 0;
      locked = true;
      var g2 = game, a = game.open[0], b = game.open[1];
      setTimeout(function () {
        if (g2 !== game) return;
        cardEls[a].classList.add('miss'); cardEls[b].classList.add('miss');
        Kit.sfx.tone(300, 0.12, 'triangle', { vol: 0.06, to: 230 });
      }, 340);
      missTimer = setTimeout(function () {
        if (g2 !== game) return;
        cardEls[a].classList.remove('miss'); cardEls[b].classList.remove('miss');
        game.hideOpen(); locked = false; render(); flipSound(false);
      }, 1050);
    }
  }

  /* ---------- results ---------- */
  function win() {
    var isBest = game.recordWin();
    MMGame.clearSaved();
    var pairs = game.cards.length / 2;
    var stars = game.moves <= pairs * 1.6 ? 3 : game.moves <= pairs * 2.6 ? 2 : 1;
    var text = isBest && game.prevBest ? 'New best! You beat <b>' + game.prevBest + '</b> moves.'
      : isBest ? 'Your first win on this board!'
      : 'Your best is <b>' + game.prevBest + '</b> moves.';
    var sizes = MM_SIZES.map(function (s) { return s.id; });
    var next = sizes[sizes.indexOf(game.size.id) + 1];
    var buttons = [{ label: 'Play again', value: 'again', primary: !next }];
    if (next) buttons.push({ label: 'Bigger board', value: 'next', primary: true });
    Kit.result({
      emoji: stars === 3 ? '🏆' : '🎉', wiggle: true, confetti: true,
      title: 'All matched!',
      stars: stars, text: text,
      badge: isBest && game.prevBest ? 'New best!' : '',
      stats: [{ label: 'Moves', value: game.moves, hi: isBest }, { label: 'Pairs', value: pairs }],
      buttons: buttons
    }).then(function (v) {
      newGame(v === 'next' ? next : game.size.id);
    });
    Kit.buzz([30, 40, 30]);
  }

  function newGame(sizeId) {
    MMGame.clearSaved();
    Kit.setRaw('mm.size', sizeId);
    game = new MMGame(sizeId, null, theme);
    game.save();
    locked = false; streak = 0;
    clearTimeout(missTimer); clearTimeout(peekTimer);
    Kit.closeAll();
    // Easy boards start with a short look at every card.
    peeking = game.size.id === 'easy';
    build(true);
    Kit.sfx.open();
    showPeek(peeking);
    if (peeking) {
      // The "remember them" line sits in the top bar where the (still empty)
      // score chips are, never over the cards the child is trying to learn.
      var ms = 3200, g = game;
      var bar = document.createElement('div');
      bar.className = 'peekbar';
      bar.innerHTML = '<i></i>';
      bar.style.setProperty('--ms', ms + 'ms');
      setTimeout(function () { if (g === game && peeking) boardEl.appendChild(bar); }, 400);
      peekTimer = setTimeout(function () {
        if (g !== game) return;
        peeking = false; showPeek(false); render(); flipSound(false);
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }, ms + 400);
    }
  }

  function showPeek(on) {
    document.getElementById('peek-msg').hidden = !on;
    document.querySelector('.k-bar .k-stats').hidden = on;
  }

  function resumeOrNew() {
    var saved = MMGame.loadSaved();
    if (saved && saved.size) {
      game = new MMGame(saved.size, saved, theme);
      if (!game.isWon()) { peeking = false; showPeek(false); build(false); return; }
    }
    newGame(sizeFromStore());
  }

  document.querySelectorAll('.size-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.size === game.size.id) return;
      Kit.sfx.tap();
      ask(function () { newGame(b.dataset.size); });
    });
  });
  document.getElementById('restart-btn').addEventListener('click', function () { ask(function () { newGame(game.size.id); }); });

  var HOW = [
    { emoji: '👆', text: 'Tap a card to turn it over, then tap another one.' },
    { emoji: '🐶', text: 'Two the same? <b>A match!</b> They stay face up.' },
    { emoji: '🙈', text: 'Not the same? They turn back. Try to remember them!' },
    { emoji: '🏆', text: 'Match every pair in as few moves as you can.' }
  ];
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindHelp(document.getElementById('help-btn'), 'memory', HOW);

  buildThemes();
  if (!Kit.raw('arcade.howto.memory')) {
    // first visit: explain, then deal
    game = new MMGame(sizeFromStore(), null, theme);
    build(false);
    Kit.howTo('memory', HOW).then(resumeOrNew);
  } else resumeOrNew();

  window.__mm = { game: function () { return game; }, tap: tap, newGame: newGame, peeking: function () { return peeking; } };
})();
