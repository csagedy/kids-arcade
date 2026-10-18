(function () {
  var board = document.getElementById('board');
  var game = null;
  var selected = -1;
  var justPoured = {};   // tube index -> how many segments to animate in
  var pourFx = null;     // {from, to, dx, dy, rot, color, level} for the pour animation
  var hintTo = -1;       // tube the hint wants the pour to go to
  var checkTimer = null;
  var won = false;        // true between solving a level and leaving the win card
  var tipWanted = false;  // first-ever level: show how to play
  var cheerNext = {};    // tubes that just became complete
  var muted = false;
  try { muted = localStorage.getItem('ws.mute') === '1'; } catch (e) {}

  /* ---- sound: soft synthesised blips, no files. iOS only starts audio from a
     touch, so the context is created and resumed on the first gesture. ---- */
  var actx = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended' && actx.resume) actx.resume();
    return actx;
  }
  function tone(freq, when, dur, vol, glideTo) {
    if (muted || !actx) return;
    try {
      var t = actx.currentTime + when;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  var sfx = {
    select: function () { tone(520, 0, 0.09, 0.08, 700); },
    pour: function (n) {   // a few rising glugs, one per segment poured
      for (var i = 0; i < Math.min(n, 4); i++) tone(300 + i * 40, 0.12 + i * 0.09, 0.1, 0.1, 480 + i * 40);
    },
    done: function () { [659, 784, 1047].forEach(function (f, i) { tone(f, 0.35 + i * 0.08, 0.25, 0.1); }); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.11, 0.35, 0.12); }); }
  };
  // iOS counts touchend/click (not always pointerdown) as the unlocking gesture.
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(function (n) {
    document.addEventListener(n, audio, { passive: true });
  });
  function setMuteButton() {
    var b = document.getElementById('mute-btn');
    b.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  }

  /* localStorage can throw in private browsing; never let that stop play. */
  function saveLevel(n) {
    try {
      localStorage.setItem('ws.level', String(n));
      localStorage.setItem('arcade.stat.watersort', 'Level ' + n);   // shown on the arcade menu
    } catch (e) {}
  }
  function loadLevel() {
    try { return Math.max(1, parseInt(localStorage.getItem('ws.level'), 10) || 1); }
    catch (e) { return 1; }
  }

  /* The deal in progress is saved after every pour: the starting layout plus
     the moves made so far. Reopening the app replays them instead of dealing
     a fresh board, so half-solved puzzles survive a phone going to sleep. */
  function saveGame() {
    try {
      localStorage.setItem('ws.game', JSON.stringify({
        level: game.level, colors: game.colors, start: game.start,
        moves: game.history.map(function (m) { return [m.from, m.to]; })
      }));
    } catch (e) {}
  }
  function loadGame() {
    try {
      var s = JSON.parse(localStorage.getItem('ws.game'));
      if (!s || !s.start || s.level !== loadLevel()) return null;
      var g = new Game({ number: s.level, colors: s.colors, state: s.start });
      (s.moves || []).forEach(function (m) { g.pour(m[0], m[1]); });
      return g.isSolved() ? null : g;
    } catch (e) { return null; }
  }

  function start(n, resumed) {
    game = resumed || new Game(makeLevel(n));
    selected = -1;
    justPoured = {};
    pourFx = null; hintTo = -1; cheerNext = {}; won = false;
    document.getElementById('level-n').textContent = n;
    document.getElementById('win').classList.add('hidden');
    saveLevel(n);
    saveGame();
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
    // Few tubes on a tall screen: let the liquid grow taller so small hands
    // have a big target, as far as the board height allows.
    var rows = n <= 6 ? 1 : 2;
    var segH = Math.round(w * 0.62);
    var roomH = (board.clientHeight - rows * 70) / (rows * CAP);
    if (roomH > segH) segH = Math.round(Math.min(w * 1.05, roomH));
    board.style.setProperty('--seg-h', segH + 'px');
    game.tubes.forEach(function (tube, i) {
      var el = document.createElement('div');
      el.className = 'tube';
      if (i === selected) el.className += ' sel';
      if (game.isDone(i)) el.className += ' full-done';
      if (i === hintTo) el.className += ' hint-to';
      if (cheerNext[i]) el.className += ' cheer';
      if (pourFx && i === pourFx.from) {
        el.className += ' pouring';
        el.style.setProperty('--dx', pourFx.dx + 'px');
        el.style.setProperty('--dy', pourFx.dy + 'px');
        el.style.setProperty('--rot', pourFx.rot + 'deg');
      }

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
    cheerNext = {};
    if (pourFx) { streamFx(pourFx); pourFx = null; }
    document.getElementById('undo-btn').disabled = game.history.length === 0;
    // Dead ends are reachable in this game, so say so rather than let a kid
    // stare at a board that cannot be finished.
    var stuck = !game.isSolved() && !game.hasMoves();
    showStuck(stuck ? 'No moves left' : null);
    document.getElementById('tip').classList.toggle('hidden', !(tipWanted && game.history.length === 0 && selected < 0));
    scheduleDeadEndCheck();
  }

  function showStuck(text) {
    document.getElementById('stuck').classList.toggle('hidden', !text);
    if (text) document.getElementById('stuck-text').textContent = text;
  }

  /* Moves can still exist on a board that can no longer be finished. Look for
     that quietly after each pour (capped, so it never janks the phone). */
  function scheduleDeadEndCheck() {
    clearTimeout(checkTimer);
    if (game.isSolved() || !game.hasMoves()) return;
    checkTimer = setTimeout(function () {
      var r = solve(game.tubes, 6000);
      if (!r.moves && r.exhausted) showStuck('This one can\u2019t be finished');
    }, 350);
  }

  /* A thin stream of liquid from the pouring tube down into the one receiving. */
  function streamFx(fx) {
    var to = board.children[fx.to];
    if (!to) return;
    var r = to.getBoundingClientRect();
    var segH = parseFloat(board.style.getPropertyValue('--seg-h')) || 34;
    var surface = r.bottom - 4 - game.tubes[fx.to].length * (segH + 1);
    var top = Math.max(0, r.top - 34);
    var h = Math.max(10, surface - top);
    var d = document.createElement('div');
    d.className = 'stream';
    d.style.left = (r.left + r.width / 2) + 'px';
    d.style.top = top + 'px';
    d.style.height = h + 'px';
    d.style.background = COLORS[fx.color];
    d.style.animationDelay = '0.18s';
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 800);
  }

  function tap(i) {
    if (won) return;
    hintTo = -1;
    if (selected < 0) {
      if (game.tubes[i].length) { selected = i; sfx.select(); render(); }
      return;
    }
    if (selected === i) { selected = -1; render(); return; }

    var from = selected;
    var wasDone = game.isDone(i);
    var color = game.tubes[from].length ? game.tubes[from][game.tubes[from].length - 1] : 0;
    var a = board.children[from], b = board.children[i];
    var n = game.pour(from, i);
    if (n > 0) {
      justPoured[i] = n;
      if (a && b) {
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        var right = rb.left + rb.width / 2 >= ra.left + ra.width / 2;
        // Park the source above the receiver, tipped towards it. The selected
        // tube is lifted 16px already, hence the +16 to measure from rest.
        pourFx = {
          from: from, to: i, color: color,
          dx: (rb.left - ra.left) + (right ? -rb.width * 0.55 : rb.width * 0.55),
          dy: (rb.top - ra.top) + 16 - ra.height * 0.45,
          rot: right ? 70 : -70
        };
      }
      tipWanted = false;
      sfx.pour(n);
      if (!wasDone && game.isDone(i)) { cheerNext[i] = true; sfx.done(); }
      selected = -1;
      saveGame();
      render();
      if (game.isSolved()) { won = true; setTimeout(win, 750); }
    } else {
      // Not a legal pour — treat the tap as picking a different tube instead
      // of just rejecting it, which is what a kid expects.
      selected = game.tubes[i].length ? i : -1;
      if (selected >= 0) sfx.select();
      render();
    }
  }

  function win() {
    if (!game.isSolved()) { won = false; return; }
    confetti();
    sfx.win();
    document.getElementById('win-n').textContent = game.level;
    document.getElementById('win').classList.remove('hidden');
    saveLevel(game.level + 1);
  }

  document.getElementById('undo-btn').addEventListener('click', function () {
    if (won) return;
    if (game.undo()) { selected = -1; hintTo = -1; saveGame(); render(); }
  });

  document.getElementById('restart-btn').addEventListener('click', function () {
    if (won) return;
    game.reset();
    selected = -1; hintTo = -1;
    saveGame();
    render();
  });

  document.getElementById('win-next').addEventListener('click', function () { start(game.level + 1); });
  document.getElementById('win-replay').addEventListener('click', function () {
    document.getElementById('win').classList.add('hidden');
    won = false;
    game.reset();
    selected = -1; hintTo = -1;
    saveGame();
    render();
  });

  document.getElementById('stuck-undo').addEventListener('click', function () {
    if (won) return;
    if (game.undo()) { selected = -1; hintTo = -1; saveGame(); render(); }
  });

  /* Hint: ask the solver for a winning move from here, select its source tube
     and mark where it goes. If the board is a dead end, point at undo instead. */
  document.getElementById('hint-btn').addEventListener('click', function () {
    if (won || game.isSolved()) return;
    var r = solve(game.tubes, 30000);
    if (r.moves && r.moves.length) {
      selected = r.moves[0][0];
      hintTo = r.moves[0][1];
      render();
    } else {
      var u = document.getElementById('undo-btn');
      u.classList.remove('nudge');
      void u.offsetWidth;
      u.classList.add('nudge');
      showStuck(r.exhausted ? 'This one can\u2019t be finished' : 'Hmm, tricky! Try undoing');
    }
  });

  /* A short burst of paper bits on a throwaway canvas; stops by itself. */
  function confetti() {
    var c = document.getElementById('confetti');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bits = [];
    for (var i = 0; i < 80; i++) {
      bits.push({
        x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.45,
        vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 12 - 3,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        s: 6 + Math.random() * 6, c: COLORS[i % COLORS.length]
      });
    }
    var t0 = performance.now();
    (function tick(now) {
      var age = now - t0;
      ctx.clearRect(0, 0, W, H);
      if (age > 2800) return;
      bits.forEach(function (b) {
        b.vy += 0.32; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= 0.99;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (2800 - age) / 500);
        ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });
      requestAnimationFrame(tick);
    })(t0);
  }

  document.getElementById('mute-btn').addEventListener('click', function () {
    muted = !muted;
    try { localStorage.setItem('ws.mute', muted ? '1' : '0'); } catch (e) {}
    setMuteButton();
    if (!muted) { audio(); sfx.select(); }
  });
  setMuteButton();

  var resumed = loadGame();
  // First time ever: a line of how-to under the tubes until the first pour.
  try {
    if (!localStorage.getItem('ws.level') && !localStorage.getItem('ws.game')) tipWanted = true;
  } catch (e) {}
  start(resumed ? resumed.level : loadLevel(), resumed);

  window.__ws = { game: function () { return game; }, start: start, tap: tap };
})();
