/* Water Sort screen, on the arcade kit (kit/kit.js). Rules and the solver
   live in level.js / game.js; this file sizes the tubes, pours and cheers. */
(function () {
  var stageEl = document.getElementById('stage');
  var board = document.getElementById('board');
  var game = null;
  var selected = -1;
  var justPoured = {};   // tube index -> how many units to animate in
  var pourFx = null;     // { from, to, dx, dy, rot, color } for the pour animation
  var hintTo = -1;       // tube the hint wants the pour to go to
  var nope = -1;         // tube to shake once
  var checkTimer = null;
  var won = false;       // true between solving a level and leaving the win card
  var cheerNext = {};    // tubes that just became complete
  var hints = 0;         // hints used on this deal (for the stars)
  var dims = null;

  /* ---------- sound ---------- */
  var sfx = {
    select: function () { Kit.sfx.tone(520, 0.09, 'sine', { vol: 0.08, to: 700 }); },
    pour: function (n) {   // a few rising glugs, one per unit poured
      for (var i = 0; i < Math.min(n, 4); i++) Kit.sfx.tone(300 + i * 40, 0.1, 'sine', { vol: 0.1, when: 0.14 + i * 0.09, to: 480 + i * 40 });
    },
    done: function () { [659, 784, 1047].forEach(function (f, i) { Kit.sfx.tone(f, 0.25, 'sine', { vol: 0.1, when: 0.45 + i * 0.08 }); }); }
  };

  /* ---------- storage (same keys as before the kit) ---------- */
  function saveLevel(n) {
    Kit.setRaw('ws.level', n);
    Kit.stat('watersort', 'Level ' + n);
  }
  function loadLevel() { return Math.max(1, parseInt(Kit.raw('ws.level'), 10) || 1); }

  /* The deal in progress is saved after every pour: the starting layout plus
     the moves made so far. Reopening the app replays them instead of dealing
     a fresh board, so half-solved puzzles survive a phone going to sleep. */
  function saveGame() {
    Kit.save('ws.game', {
      level: game.level, colors: game.colors, start: game.start, extra: !!game.extra, hints: hints,
      moves: game.history.map(function (m) { return [m.from, m.to]; })
    });
  }
  /* A saved layout must be real tubes of real colours, each colour exactly
     CAP times; anything else (an old or damaged save) deals a fresh board. */
  function validStart(start) {
    if (!Array.isArray(start) || start.length < 2 || start.length > 16) return false;
    var count = {};
    for (var i = 0; i < start.length; i++) {
      var t = start[i];
      if (!Array.isArray(t) || t.length > CAP) return false;
      for (var j = 0; j < t.length; j++) {
        if (t[j] !== (t[j] | 0) || t[j] < 0 || t[j] >= COLORS.length) return false;
        count[t[j]] = (count[t[j]] || 0) + 1;
      }
    }
    for (var c in count) if (count[c] !== CAP) return false;
    return Object.keys(count).length > 0;
  }
  function loadGame() {
    try {
      var s = Kit.load('ws.game', null);
      if (!s || !validStart(s.start) || s.level !== loadLevel()) return null;
      var g = new Game({ number: s.level, colors: s.colors, state: s.start });
      g.extra = !!s.extra;
      g.hintsUsed = s.hints | 0;
      (s.moves || []).forEach(function (m) { g.pour(m[0], m[1]); });
      return g.isSolved() ? null : g;
    } catch (e) { return null; }
  }

  function start(n, resumed) {
    game = resumed || new Game(makeLevel(n));
    hints = (resumed && resumed.hintsUsed) || 0;
    selected = -1; justPoured = {};
    pourFx = null; hintTo = -1; cheerNext = {}; won = false; nope = -1;
    Kit.closeAll();
    document.getElementById('level-n').textContent = n;
    Kit.anim(document.getElementById('level-chip'), 'k-bump');
    saveLevel(n);
    saveGame();
    dims = null;
    render();
  }

  /* ---------- sizing ----------
     Try 1, 2 or 3 rows and keep the one with the most liquid on screen.
     Units of the tube width tw: slot = tw / 0.62 wide; a tube is 4 seg plus
     0.42 tw of neck; the slot adds 0.45 tw of lift room and 0.25 tw below. */
  function measure() {
    var cs = getComputedStyle(stageEl);
    var W = stageEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = stageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var n = game.tubes.length, best = null;
    for (var rows = 1; rows <= 3 && rows <= n; rows++) {
      var per = Math.ceil(n / rows);
      if (rows > 1 && Math.ceil(n / (rows - 1)) === per) continue;
      var tw = W / per * 0.62;
      var room = H / rows;
      if (4 * 0.66 * tw + 1.12 * tw > room) tw = room / (4 * 0.66 + 1.12);
      var seg = Math.max(0.66 * tw, Math.min(1.05 * tw, (room - 1.12 * tw) / 4));
      var score = tw * seg;
      if (!best || score > best.score * 1.05) best = { rows: rows, per: per, tw: tw, seg: seg, score: score };
    }
    best.tw = Math.floor(best.tw); best.seg = Math.floor(best.seg);
    best.slotW = Math.floor(best.tw / 0.62);
    best.slotH = Math.floor(4 * best.seg + 1.12 * best.tw);
    return best;
  }

  function applyDims() {
    var d = measure();
    if (dims && d.tw === dims.tw && d.seg === dims.seg && d.per === dims.per) return false;
    dims = d;
    var s = board.style;
    s.setProperty('--tw', d.tw + 'px');
    s.setProperty('--seg', d.seg + 'px');
    s.setProperty('--slot-w', d.slotW + 'px');
    s.setProperty('--slot-h', d.slotH + 'px');
    s.setProperty('--lift', Math.round(d.tw * 0.45) + 'px');
    s.width = (d.per * d.slotW) + 'px';
    return true;
  }

  /* ---------- drawing ---------- */
  function render() {
    applyDims();
    board.innerHTML = '';
    game.tubes.forEach(function (tube, i) {
      var slot = document.createElement('div');
      slot.className = 'slot';
      if (i === selected) slot.className += ' sel';
      if (game.isDone(i)) slot.className += ' done';
      if (cheerNext[i]) slot.className += ' cheer';
      if (i === nope) slot.className += ' nope';
      if (pourFx && i === pourFx.from) {
        slot.className += ' pouring';
        slot.style.setProperty('--dx', pourFx.dx + 'px');
        slot.style.setProperty('--dy', pourFx.dy + 'px');
        slot.style.setProperty('--rot', pourFx.rot + 'deg');
      }
      slot.setAttribute('role', 'button');
      slot.setAttribute('aria-label', 'Tube ' + (i + 1) + (tube.length ? '' : ', empty'));

      var t = document.createElement('div');
      t.className = 'tube';
      var glass = document.createElement('div');
      glass.className = 'glass';
      var liq = document.createElement('div');
      liq.className = 'liquid';
      // Runs of one colour are drawn as one block; units that just arrived
      // get a block of their own so they can rise in.
      var animate = justPoured[i] || 0, keep = tube.length - animate, j = 0;
      while (j < tube.length) {
        var k = j;
        while (k + 1 < tube.length && tube[k + 1] === tube[j] && (k + 1 < keep) === (j < keep)) k++;
        var run = document.createElement('div');
        run.className = 'run' + (j >= keep ? ' fill' : '');
        run.style.setProperty('--n', k - j + 1);
        run.style.setProperty('--c', COLORS[tube[j]]);
        liq.appendChild(run);
        j = k + 1;
      }
      t.appendChild(liq);
      t.appendChild(glass);
      if (game.isDone(i)) {
        var cork = document.createElement('div');
        cork.className = 'cork' + (cheerNext[i] ? ' new' : '');
        t.appendChild(cork);
      }
      slot.appendChild(t);
      if (i === hintTo) {
        var ar = document.createElement('div');
        ar.className = 'arrow';
        ar.innerHTML = Kit.icon('next');
        slot.appendChild(ar);
      }
      slot.addEventListener('click', function () { tap(i); });
      board.appendChild(slot);
    });
    justPoured = {}; cheerNext = {}; nope = -1;
    if (pourFx) { streamFx(pourFx); pourFx = null; }

    document.getElementById('undo-btn').disabled = game.history.length === 0;
    document.getElementById('moves').textContent = game.history.length;
    var tb = document.getElementById('tube-btn');
    tb.disabled = !!game.extra; tb.classList.toggle('k-used', !!game.extra);
    // Dead ends are reachable in this game, so say so rather than let a kid
    // stare at a board that cannot be finished.
    var stuck = !game.isSolved() && !game.hasMoves();
    showStuck(stuck ? 'No moves left' : null);
    scheduleDeadEndCheck();
  }

  function showStuck(text) {
    var el = document.getElementById('stuck');
    var was = !el.classList.contains('k-hidden');
    el.classList.toggle('k-hidden', !text);
    if (text) {
      document.getElementById('stuck-text').textContent = text;
      if (!was) Kit.sfx.bad();
    }
  }

  /* Moves can still exist on a board that can no longer be finished. Look for
     that quietly after each pour (capped, so it never janks the phone). */
  function scheduleDeadEndCheck() {
    clearTimeout(checkTimer);
    if (game.isSolved() || !game.hasMoves()) return;
    checkTimer = setTimeout(function () {
      var r = solve(game.tubes, 6000);
      if (!r.moves && r.exhausted) showStuck('This one can’t be finished');
    }, 350);
  }

  /* A stream of liquid from the pouring tube down into the one receiving. */
  function streamFx(fx) {
    var to = board.children[fx.to];
    if (!to) return;
    var r = to.querySelector('.tube').getBoundingClientRect();
    var surface = r.bottom - dims.tw * 0.08 - (game.tubes[fx.to].length - fx.n) * dims.seg;
    var top = r.top - dims.tw * 0.3;
    var d = document.createElement('div');
    d.className = 'stream';
    d.style.setProperty('--w', Math.max(5, Math.round(dims.tw * 0.14)) + 'px');
    d.style.left = (r.left + r.width / 2) + 'px';
    d.style.top = top + 'px';
    d.style.height = Math.max(10, surface - top) + 'px';
    d.style.background = COLORS[fx.color];
    d.style.animationDelay = '0.18s';
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 800);
  }

  /* ---------- play ---------- */
  function tap(i) {
    if (won || Kit.overlayOpen()) return;
    hintTo = -1;
    if (selected < 0) {
      if (game.tubes[i].length && !game.isDone(i)) { selected = i; sfx.select(); render(); }
      else if (game.isDone(i)) { nope = i; Kit.sfx.tap(); render(); }
      return;
    }
    if (selected === i) { selected = -1; Kit.sfx.tone(600, 0.07, 'sine', { vol: 0.06, to: 420 }); render(); return; }

    var from = selected;
    var wasDone = game.isDone(i);
    var color = game.tubes[from][game.tubes[from].length - 1];
    var a = board.children[from], b = board.children[i];
    var n = game.pour(from, i);
    if (n > 0) {
      justPoured[i] = n;
      if (a && b) {
        var ra = a.querySelector('.tube').getBoundingClientRect(), rb = b.querySelector('.tube').getBoundingClientRect();
        var right = rb.left + rb.width / 2 >= ra.left + ra.width / 2;
        var lift = Math.round(dims.tw * 0.45), h = ra.height, w = ra.width;
        // Park the source so that, tipped 72 degrees about its centre, its
        // mouth sits just above the receiver's. The selected tube is lifted
        // already, hence - lift to measure from where it rests.
        var reach = 0.475 * h + 0.12 * w;
        pourFx = {
          from: from, to: i, color: color, n: n,
          dx: (rb.left - ra.left) + (right ? -reach : reach),
          dy: (rb.top - ra.top) - lift - 0.345 * h - 0.3 * w,
          rot: right ? 72 : -72
        };
      }
      sfx.pour(n);
      Kit.buzz(8);
      if (!wasDone && game.isDone(i)) {
        cheerNext[i] = true; sfx.done();
        setTimeout(function () {
          var el = board.children[i];
          if (!el) return;
          var rc = el.querySelector('.tube').getBoundingClientRect();
          Kit.confetti({ x: rc.left + rc.width / 2, y: rc.top, count: 18, colors: [COLORS[color], '#ffd23f', '#ffffff'] });
          Kit.buzz(20);
        }, 450);
      }
      selected = -1;
      saveGame();
      render();
      Kit.anim(document.getElementById('moves-chip'), 'k-bump');
      if (game.isSolved()) { won = true; setTimeout(win, 1000); }
    } else if (game.tubes[i].length >= CAP) {
      // full: can't pour there
      nope = i; Kit.sfx.bad(); render();
    } else {
      // A different colour on top: treat the tap as picking that tube
      // instead, which is what a kid expects.
      selected = game.tubes[i].length && !game.isDone(i) ? i : -1;
      if (selected >= 0) sfx.select();
      render();
    }
  }

  function win() {
    if (!game.isSolved()) { won = false; return; }
    var level = game.level;
    saveLevel(level + 1);
    Kit.drop('ws.game');
    var helps = (hints ? 1 : 0) + (game.extra ? 1 : 0);
    var stars = 3 - helps;
    Kit.result({
      emoji: '🧪', wiggle: true, confetti: true,
      title: 'Level ' + level + ' done!',
      stars: stars,
      text: stars === 3 ? 'All sorted, all by yourself!' : 'All sorted! Try it with no help for <b>3 stars</b>.',
      stats: [{ label: 'Moves', value: game.history.length, hi: true }, { label: 'Colours', value: game.colors }],
      buttons: [{ label: 'Again', value: 'again', icon: 'restart' }, { label: 'Next level', value: 'next', primary: true }]
    }).then(function (v) {
      if (v === 'again') {
        // the same deal, from the top
        var g = new Game({ number: level, colors: game.colors, state: game.start.filter(function (t, i) { return !(game.extra && i === game.start.length - 1); }) });
        saveLevel(level);
        start(level, g);
      } else start(level + 1);
    });
  }

  function undo() {
    if (won || Kit.overlayOpen()) return;
    if (game.undo()) {
      selected = -1; hintTo = -1;
      Kit.sfx.tone(520, 0.1, 'sine', { vol: 0.08, to: 340 });
      saveGame(); render();
    }
  }
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('stuck-undo').addEventListener('click', undo);

  document.getElementById('restart-btn').addEventListener('click', function () {
    if (won || Kit.overlayOpen() || !game.history.length) return;
    Kit.confirm({ title: 'Start this level over?', text: 'The tubes go back to how they started.', yes: 'Start over', no: 'Keep going', emoji: '🧪' })
      .then(function (yes) {
        if (!yes) return;
        game.reset();
        selected = -1; hintTo = -1;
        saveGame(); render();
      });
  });

  document.getElementById('tube-btn').addEventListener('click', function () {
    if (won || Kit.overlayOpen() || !game.addTube()) return;
    selected = -1; hintTo = -1;
    Kit.sfx.pop(620);
    saveGame();
    dims = null;
    render();
    var el = board.lastChild;
    if (el) Kit.anim(el, 'k-pop-in');
  });

  /* Hint: ask the solver for a winning move from here, select its source tube
     and point at where it goes. If the board is a dead end, point at undo. */
  document.getElementById('hint-btn').addEventListener('click', function () {
    if (won || Kit.overlayOpen() || game.isSolved()) return;
    var r = solve(game.tubes, 30000);
    if (r.moves && r.moves.length) {
      hints++;
      saveGame();
      selected = r.moves[0][0];
      hintTo = r.moves[0][1];
      Kit.sfx.tone(880, 0.12, 'sine', { vol: 0.07, to: 1320 });
      render();
    } else {
      Kit.anim(document.getElementById('undo-btn'), 'k-shake');
      showStuck(r.exhausted ? 'This one can’t be finished' : 'Hmm, tricky! Try undoing');
    }
  });

  var HOW = [
    { emoji: '👆', text: 'Tap a tube to pick it up.' },
    { emoji: '🫗', text: 'Tap another tube to pour. The top colour must match, or the tube must be empty.' },
    { emoji: '🧪', text: 'Fill every tube with <b>just one colour</b>!' },
    { icon: 'hint', text: 'Stuck? Try a <b>hint</b>, an extra <b>tube</b>, or undo.' }
  ];
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindHelp(document.getElementById('help-btn'), 'watersort', HOW);

  // Re-layout on the next frame: doing it inside the observer callback makes
  // WebKit report a "ResizeObserver loop" error when the iPad rotates.
  var resizeRaf = 0;
  if (window.ResizeObserver) new ResizeObserver(function () {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () { if (game && applyDims()) render(); });
  }).observe(stageEl);
  else window.addEventListener('resize', function () { if (game) { dims = null; render(); } });

  var resumed = loadGame();
  start(resumed ? resumed.level : loadLevel(), resumed);
  Kit.howTo('watersort', HOW);

  window.__ws = { game: function () { return game; }, start: start, tap: tap };
})();
