(function () {
  var boardEl = document.getElementById('board');
  var game, cardEls = [], locked = false, peeking = false, peekTimer = 0, missTimer = 0;

  function sizeFromStore() {
    try { return localStorage.getItem('mm.size') || 'easy'; } catch (e) { return 'easy'; }
  }
  function themeFromStore() {
    try { return localStorage.getItem('mm.theme') || 'animals'; } catch (e) { return 'animals'; }
  }
  function rememberTheme(id) { try { localStorage.setItem('mm.theme', id); } catch (e) {} }
  var theme = themeFromStore();

  function buildThemes() {
    var box = document.getElementById('themes');
    box.innerHTML = '';
    MM_THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'theme-btn';
      b.dataset.theme = t.id;
      b.textContent = t.icon;
      b.setAttribute('aria-label', t.name);
      b.addEventListener('click', function () {
        if (t.id === theme) return;
        theme = t.id; rememberTheme(theme);
        newGame(game.size.id);
      });
      box.appendChild(b);
    });
  }
  function rememberSize(id) { try { localStorage.setItem('mm.size', id); } catch (e) {} }

  function build() {
    boardEl.innerHTML = '';
    cardEls = [];
    boardEl.style.setProperty('--cols', game.size.cols);
    boardEl.style.setProperty('--rows', game.size.rows);
    game.cards.forEach(function (emoji, i) {
      var c = document.createElement('button');
      c.className = 'card';
      c.setAttribute('aria-label', 'Card');
      c.innerHTML = '<div class="face back"></div><div class="face front"></div>';
      c.querySelector('.front').textContent = emoji;
      c.addEventListener('click', function () { tap(i); });
      boardEl.appendChild(c);
      cardEls.push(c);
    });
    render();
  }

  function render() {
    game.cards.forEach(function (_, i) {
      var el = cardEls[i];
      el.classList.toggle('peek', peeking);
      el.classList.toggle('up', game.matched[i] || game.open.indexOf(i) >= 0);
      el.classList.toggle('matched', game.matched[i]);
    });
    document.getElementById('moves').textContent = game.moves;
    var best = MMGame.loadBest(game.size.id);
    document.getElementById('best').textContent = peeking ? 'Remember where they are!' : best ? 'Best ' + best : '';
    document.querySelectorAll('.theme-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.theme === theme);
    });
    document.querySelectorAll('.size-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.size === game.size.id);
    });
  }

  function tap(i) {
    if (locked || peeking) return;
    var r = game.flip(i);
    render();
    if (r === 'match') {
      game.matched.forEach(function (m, k) { if (m && game.cards[k] === game.cards[i]) cardEls[k].classList.add('pop'); });
      buzz(15);
      if (game.isWon()) setTimeout(win, 500);
    } else if (r === 'miss') {
      locked = true;
      var g = game;
      missTimer = setTimeout(function () { if (g !== game) return; game.hideOpen(); locked = false; render(); }, 750);
    }
  }

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

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
    var isBest = game.recordWin();
    MMGame.clearSaved();
    var pairs = game.cards.length / 2;
    var n = game.moves <= pairs * 1.6 ? 3 : game.moves <= pairs * 2.6 ? 2 : 1;
    document.getElementById('win-moves').textContent = game.moves;
    var bestEl = document.getElementById('win-best');
    bestEl.className = 'over-best';
    if (isBest && game.prevBest) bestEl.textContent = 'New best! (was ' + game.prevBest + ')';
    else if (isBest) bestEl.textContent = 'First win. That is your best!';
    else { bestEl.textContent = 'Your best is ' + game.prevBest; bestEl.className = 'over-best muted'; }
    document.getElementById('win-stars').textContent = '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
    document.getElementById('win').classList.remove('hidden');
    confetti();
    buzz([30, 40, 30]);
  }

  function newGame(sizeId) {
    MMGame.clearSaved();
    rememberSize(sizeId);
    game = new MMGame(sizeId, null, theme);
    game.save();
    locked = false;
    clearTimeout(missTimer); clearTimeout(peekTimer);
    document.getElementById('win').classList.add('hidden');
    // Easy boards start with a short look at every card.
    peeking = game.size.id === 'easy';
    build();
    if (peeking) {
      peekTimer = setTimeout(function () { peeking = false; render(); }, 2600);
    }
  }

  function resumeOrNew() {
    var saved = MMGame.loadSaved();
    if (saved && saved.size) {
      game = new MMGame(saved.size, saved);
      if (!game.isWon()) { peeking = false; build(); return; }
    }
    newGame(sizeFromStore());
  }

  document.querySelectorAll('.size-btn').forEach(function (b) {
    b.addEventListener('click', function () { newGame(b.dataset.size); });
  });
  document.getElementById('restart-btn').addEventListener('click', function () { newGame(game.size.id); });
  document.getElementById('win-again').addEventListener('click', function () { newGame(game.size.id); });

  buildThemes();
  resumeOrNew();
  window.__mm = { game: function () { return game; }, tap: tap, newGame: newGame };
})();
