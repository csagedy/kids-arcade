(function () {
  var boardEl = document.getElementById('board');
  var game, cardEls = [], locked = false;

  function sizeFromStore() {
    try { return localStorage.getItem('mm.size') || 'easy'; } catch (e) { return 'easy'; }
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
      el.classList.toggle('up', game.matched[i] || game.open.indexOf(i) >= 0);
      el.classList.toggle('matched', game.matched[i]);
    });
    document.getElementById('moves').textContent = game.moves;
    var best = MMGame.loadBest(game.size.id);
    document.getElementById('best').textContent = best ? 'Best ' + best : '';
    document.querySelectorAll('.size-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.size === game.size.id);
    });
  }

  function tap(i) {
    if (locked) return;
    var r = game.flip(i);
    render();
    if (r === 'match') {
      cardEls[i].classList.add('pop');
      if (game.isWon()) setTimeout(win, 500);
    } else if (r === 'miss') {
      locked = true;
      setTimeout(function () { game.hideOpen(); locked = false; render(); }, 750);
    }
  }

  function win() {
    var isBest = game.recordWin();
    MMGame.clearSaved();
    document.getElementById('win-moves').textContent = game.moves;
    document.getElementById('win-best').classList.toggle('hidden', !isBest);
    document.getElementById('win').classList.remove('hidden');
  }

  function newGame(sizeId) {
    MMGame.clearSaved();
    rememberSize(sizeId);
    game = new MMGame(sizeId);
    game.save();
    locked = false;
    document.getElementById('win').classList.add('hidden');
    build();
  }

  function resumeOrNew() {
    var saved = MMGame.loadSaved();
    if (saved && saved.size) {
      game = new MMGame(saved.size, saved);
      if (!game.isWon()) { build(); return; }
    }
    newGame(sizeFromStore());
  }

  document.querySelectorAll('.size-btn').forEach(function (b) {
    b.addEventListener('click', function () { newGame(b.dataset.size); });
  });
  document.getElementById('restart-btn').addEventListener('click', function () { newGame(game.size.id); });
  document.getElementById('win-again').addEventListener('click', function () { newGame(game.size.id); });

  resumeOrNew();
  window.__mm = { game: function () { return game; }, tap: tap, newGame: newGame };
})();
