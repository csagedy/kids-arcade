(function () {
  var board = document.getElementById('board');
  var game = null;
  var selected = -1;
  var justPoured = {};   // tube index -> how many segments to animate in

  /* localStorage can throw in private browsing; never let that stop play. */
  function saveLevel(n) { try { localStorage.setItem('ws.level', String(n)); } catch (e) {} }
  function loadLevel() {
    try { return Math.max(1, parseInt(localStorage.getItem('ws.level'), 10) || 1); }
    catch (e) { return 1; }
  }

  function start(n) {
    game = new Game(makeLevel(n));
    selected = -1;
    justPoured = {};
    document.getElementById('level-n').textContent = n;
    document.getElementById('win').classList.add('hidden');
    saveLevel(n);
    render();
  }

  function render() {
    board.innerHTML = '';
    // Size the tubes so they wrap into even rows instead of leaving orphans.
    var n = game.tubes.length;
    var perRow = n <= 6 ? n : Math.ceil(n / 2);
    var avail = board.clientWidth - 28;
    var w = Math.max(40, Math.min(62, Math.floor((avail - (perRow - 1) * 14) / perRow)));
    board.style.setProperty('--tube-w', w + 'px');
    board.style.setProperty('--seg-h', Math.round(w * 0.62) + 'px');
    game.tubes.forEach(function (tube, i) {
      var el = document.createElement('div');
      el.className = 'tube';
      if (i === selected) el.className += ' sel';
      if (game.isDone(i)) el.className += ' full-done';

      var animate = justPoured[i] || 0;
      tube.forEach(function (color, depth) {
        var seg = document.createElement('div');
        seg.className = 'seg';
        // Only the segments that just arrived should animate.
        if (depth >= tube.length - animate) seg.className += ' pour-in';
        seg.style.background = COLORS[color];
        el.appendChild(seg);
      });

      el.addEventListener('click', function () { tap(i); });
      board.appendChild(el);
    });
    justPoured = {};
    document.getElementById('undo-btn').disabled = game.history.length === 0;
    // Dead ends are reachable in this game, so say so rather than let a kid
    // stare at a board that cannot be finished.
    var stuck = !game.isSolved() && !game.hasMoves();
    document.getElementById('stuck').classList.toggle('hidden', !stuck);
  }

  function tap(i) {
    if (selected < 0) {
      if (game.tubes[i].length) { selected = i; render(); }
      return;
    }
    if (selected === i) { selected = -1; render(); return; }

    var n = game.pour(selected, i);
    if (n > 0) {
      justPoured[i] = n;
      selected = -1;
      render();
      if (game.isSolved()) setTimeout(win, 380);
    } else {
      // Not a legal pour — treat the tap as picking a different tube instead
      // of just rejecting it, which is what a kid expects.
      selected = game.tubes[i].length ? i : -1;
      render();
    }
  }

  function win() {
    document.getElementById('win-n').textContent = game.level;
    document.getElementById('win').classList.remove('hidden');
    saveLevel(game.level + 1);
  }

  document.getElementById('undo-btn').addEventListener('click', function () {
    if (game.undo()) { selected = -1; render(); }
  });

  document.getElementById('restart-btn').addEventListener('click', function () {
    game.reset();
    selected = -1;
    render();
  });

  document.getElementById('win-next').addEventListener('click', function () { start(game.level + 1); });
  document.getElementById('win-replay').addEventListener('click', function () {
    document.getElementById('win').classList.add('hidden');
    game.reset();
    selected = -1;
    render();
  });

  start(loadLevel());

  window.__ws = { game: function () { return game; }, start: start, tap: tap };
})();
