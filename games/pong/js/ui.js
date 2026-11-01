(function () {
  var canvas = document.getElementById('screen');
  // Laid out in portrait; in landscape the court turns so paddles are left and right.
  var SCREEN = { minAspect: 0.5, maxAspect: 0.85, turn: true };
  var ctx, turned = false, game, playing = false, twoPlayer = false;
  var fx = new Cabinet.Fx(), COL = Cabinet.COL;
  var trail = [], padFlash = [0, 0], wallFlash = 0, lastWait = 0, banner = null;
  var fingers = {};
  var diffKey = 'medium';
  try { var saved = localStorage.getItem('pong.diff'); if (DIFFS[saved]) diffKey = saved; } catch (e) {}
  var PCOL = [COL.cyan, COL.pink];

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h; turned = s.turned;
  }

  function hudFor(two) {
    Cabinet.hud([
      { id: 'p1', label: two ? 'Player 1' : 'You', accent: true },
      { id: 'p2', label: two ? 'Player 2' : 'CPU' },
      { id: 'cpu', label: 'Level', more: true }
    ]);
  }
  function hud() {
    Cabinet.setHud('p1', game.score[0]);
    Cabinet.setHud('p2', game.score[1]);
    Cabinet.setHud('cpu', game.twoPlayer ? '2P' : DIFFS[diffKey].name.charAt(0) + DIFFS[diffKey].name.slice(1).toLowerCase());
  }

  function wins() { try { return +localStorage.getItem('pong.wins') || 0; } catch (e) { return 0; } }

  var pending = null;   // a saved match, waiting behind the attract card
  function attract() {
    playing = false; fingers = {};
    layout();
    pending = Cabinet.loadSave();
    if (pending && Cabinet.tryRestore(pending, false)) {
      var g0 = game;
      Cabinet.attract({ title: 'Pong', resume: g0.twoPlayer ? 'Player 1 has ' + g0.score[0] + ', Player 2 has ' + g0.score[1]
        : 'you ' + g0.score[0] + ', computer ' + g0.score[1] }).then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; Cabinet.countdown(); }
        else attract();   // the level choice is on the plain attract card
      });
      return;
    }
    pending = null;
    game = new PongGame(false, diffKey);
    hudFor(false); hud();
    var segs = ['easy', 'medium', 'hard'].map(function (k) {
      return '<button type="button" data-d="' + k + '">' + DIFFS[k].name.charAt(0) + DIFFS[k].name.slice(1).toLowerCase() + '</button>';
    }).join('');
    var w = wins();
    Cabinet.attract({
      title: 'Pong', lines: ['First to 7 wins! ' + (w ? 'You have beaten the computer ' + w + (w === 1 ? ' time.' : ' times.') : 'Play the computer, or a friend on the same screen.')],
      html: '<span class="k-label">Computer</span><div class="k-seg" role="group" aria-label="Computer level">' + segs + '</div>',
      buttons: [{ label: '2 Players', value: 2, icon: 'heart' }, { label: '1 Player', value: 1, primary: true, icon: 'play' }],
      onOpen: function (card) {
        var btns = card.querySelectorAll('.k-seg button');
        function paint() { for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('k-on', btns[i].getAttribute('data-d') === diffKey); }
        for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () {
          diffKey = this.getAttribute('data-d');
          try { localStorage.setItem('pong.diff', diffKey); } catch (e) {}
          Kit.sfx.click(); paint();
          game = new PongGame(false, diffKey); hud();
        });
        paint();
      }
    }).then(function (v) { Cabinet.firstHelp().then(function () { start(v === 2); }); });
  }
  /* ---------- keeping the match (reload, iOS dropping the tab, a turn of the screen) ----------
     A reload keeps the players, level and score and serves again; a turn of
     the screen carries the paddles and ball across as they are
     (relayoutMatch below). */
  function save() { return { two: game.twoPlayer, diff: diffKey, score: game.score }; }
  function restore(d, live) {
    var C = Cabinet;
    if (live) { relayoutMatch(); return; }
    var two = C.bool(d.two);
    C.check(DIFFS.hasOwnProperty(d.diff));
    C.list(d.score, 2);
    var sc = [C.int(d.score[0], 0, TARGET - 1), C.int(d.score[1], 0, TARGET - 1)];
    layout();
    twoPlayer = two; diffKey = d.diff;
    game = new PongGame(two, diffKey);
    game.score = sc;
    fingers = {}; trail = []; fx.clear(); banner = null;
    hudFor(two); hud();
  }
  Cabinet.keep({ id: 'pong', save: save, restore: restore });

  function start(two) {
    Cabinet.stopCount();
    if (two === undefined) two = twoPlayer;
    twoPlayer = !!two;
    fingers = {}; trail = []; fx.clear(); banner = null;
    layout();
    game = new PongGame(twoPlayer, diffKey);
    hudFor(twoPlayer); hud();
    playing = true;
    Cabinet.sfx.start();
  }

  /* game frame -> screen (canvas) pixels */
  function toScreen(gx, gy) { return turned ? { x: H - gy, y: gx } : { x: gx, y: gy }; }

  function update(dt) {
    fx.update(dt);
    padFlash[0] = Math.max(0, padFlash[0] - dt * 5); padFlash[1] = Math.max(0, padFlash[1] - dt * 5);
    wallFlash = Math.max(0, wallFlash - dt * 5);
    for (var t = trail.length - 1; t >= 0; t--) { trail[t].life -= dt; if (trail[t].life <= 0) trail.splice(t, 1); }
    if (banner && performance.now() > banner.until) banner = null;
    if (!playing) return;
    var g = game, b = g.ball;
    if (g.wait > 0) {
      var n = Math.ceil(g.wait / (g.waitMax / 3));
      if (n !== lastWait) { lastWait = n; Cabinet.beep(n === 1 ? 660 : 440, 70, 'square', 0.06); }
    } else trail.push({ x: b.x, y: b.y, life: 0.2, c: g.lastHit ? PCOL[g.lastHit.side] : '#fff' });

    var r = g.update(dt);
    if (r === 'paddle') {
      Cabinet.beep(440 + Math.min(g.rally, 14) * 30, 50, 'square', 0.09);
      var h = g.lastHit; padFlash[h.side] = 1;
      fx.burst(h.x, h.y + (h.side === 0 ? -3 : 3), 10, [PCOL[h.side], '#fff'], 70, 0.4, { angle: h.side === 0 ? -Math.PI / 2 : Math.PI / 2, spread: 2.4, gravity: 0 });
      if (g.rally >= 5 && g.rally % 5 === 0) { banner = { text: 'RALLY ' + g.rally + '!', until: performance.now() + 900, c: COL.yellow }; Cabinet.beep(1320, 80, 'square', 0.06, 1760); }
      fx.shake(Math.min(3, 0.5 + g.rally * 0.15));
    }
    else if (r === 'wall') { Cabinet.beep(220, 30, 'square', 0.06); wallFlash = 1; fx.burst(b.x, b.y, 4, ['#fff', '#3a4a7a'], 40, 0.3, { gravity: 0 }); }
    else if (r === 'point' || r === 'over') {
      var winner = g.lastPoint;   // 0 bottom / player 1, 1 top
      trail = [];
      fx.shake(4); fx.flash(PCOL[winner], 0.3);
      var at = winner === 0 ? 4 : H - 4;   // the ball left on the loser's side
      fx.burst(W / 2, at, 30, [PCOL[winner], '#fff', COL.yellow], 120, 0.7, { angle: winner === 0 ? Math.PI / 2 : -Math.PI / 2, spread: 2.5, gravity: 0 });
      Cabinet.vibrate(40);
      if (r === 'point') {
        if (!g.twoPlayer && winner === 1) Cabinet.beep(220, 260, 'square', 0.09, 110);
        else Cabinet.jingle([660, 880], 80, 90, 'square', 0.08);
        banner = { text: g.twoPlayer ? 'POINT P' + (winner + 1) : winner === 0 ? 'POINT!' : 'CPU POINT', until: performance.now() + 900, c: PCOL[winner] };
      }
    }
    if (r === 'over') {
      playing = false;
      Cabinet.dropSave();
      var p1 = g.score[0] > g.score[1];
      fx.burst(W / 2, H / 2, 60, [COL.yellow, '#fff', COL.pink, COL.cyan], 140, 1.0, { gravity: 0 });
      if (!g.twoPlayer && p1) { try { localStorage.setItem('pong.wins', String(wins() + 1)); } catch (e) {} if (window.Kit) Kit.stat('pong', 'Wins ' + wins()); sideInfo(); }
      if (g.twoPlayer || p1) Cabinet.sfx.levelUp(); else Cabinet.sfx.over();
      setTimeout(function () {
        var title = g.twoPlayer ? (p1 ? 'Player 1 wins!' : 'Player 2 wins!') : (p1 ? 'You win!' : 'The computer wins');
        Cabinet.card({
          title: title, icon: g.twoPlayer || p1 ? 'trophy' : 'star',
          text: !g.twoPlayer && !p1 ? (diffKey === 'easy' ? 'So close! Have another go.' : 'Try Easy for a bigger paddle.') : 'What a game!',
          stats: [{ label: g.twoPlayer ? 'Player 1' : 'You', value: g.score[0], hi: p1 }, { label: g.twoPlayer ? 'Player 2' : 'CPU', value: g.score[1], hi: !p1 }],
          confetti: g.twoPlayer || p1, sound: false, guard: 700,
          buttons: [{ label: 'Menu', value: 'menu', icon: 'menu' }, { label: 'Again', value: 'again', primary: true, icon: 'restart' }]
        }).then(function (v) { if (v === 'menu') attract(); else start(g.twoPlayer); });
      }, 900);
    }
    hud();
  }

  function paddle(p, i) {
    var x = Math.round(p.x - p.w / 2), y = Math.round(p.y - 3), fl = padFlash[i] > 0.4 ? 1 : 0;
    var c = PCOL[i];
    ctx.fillStyle = fl ? '#fff' : c;
    ctx.fillRect(x + 1, y - fl, p.w - 2, 6 + fl * 2); ctx.fillRect(x - fl, y + 1, p.w + fl * 2, 4);
    if (!fl) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 2, y + (i === 0 ? 1 : 4), p.w - 4, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 2, y + (i === 0 ? 4 : 1), p.w - 4, 1);
    }
  }

  function render() {
    var g = game, now = performance.now(), sw = canvas.width, sh = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, sw, sh);
    Cabinet.frame(ctx);
    fx.begin(ctx);
    // court: faint side lines, each half tinted its player's colour
    ctx.fillStyle = 'rgba(124,242,255,0.05)'; ctx.fillRect(0, H / 2, W, H / 2);
    ctx.fillStyle = 'rgba(255,122,198,0.05)'; ctx.fillRect(0, 0, W, H / 2);
    if (wallFlash > 0) {
      ctx.globalAlpha = wallFlash * 0.6; ctx.fillStyle = COL.cyan;
      ctx.fillRect(0, 0, 2, H); ctx.fillRect(W - 2, 0, 2, H); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#2a3160';
    for (var x = 2; x < W; x += 10) ctx.fillRect(x, Math.round(H / 2) - 1, 6, 2);
    ctx.fillStyle = '#1a1f3d'; ctx.fillRect(0, 0, 1, H); ctx.fillRect(W - 1, 0, 1, H);
    g.paddles.forEach(paddle);

    for (var t = 0; t < trail.length; t++) {
      ctx.globalAlpha = trail[t].life * 3; ctx.fillStyle = trail[t].c;
      ctx.fillRect(Math.round(trail[t].x - 1), Math.round(trail[t].y - 1), 3, 3);
    }
    ctx.globalAlpha = 1;
    var b = g.ball;
    if (g.wait <= 0) Cabinet.disc(ctx, b.x, b.y, 3, '#ffffff');
    else if (playing) {
      // serve: the ball pulses at the centre and chevrons show where it will go
      Cabinet.disc(ctx, b.x, b.y, Math.floor(g.wait * 6) % 2 ? 4 : 3, '#ffffff');
      ctx.fillStyle = COL.yellow;
      for (var k = 1; k <= 3; k++) {
        var ay = Math.round(H / 2 + g.serveDir * (8 + k * 6));
        if (Math.floor(now / 150) % 3 !== k - 1) continue;
        for (var c = -3; c <= 3; c++) ctx.fillRect(Math.round(W / 2) + c, ay + g.serveDir * (3 - Math.abs(c)), 1, 2);
      }
    }
    fx.draw(ctx);
    fx.end(ctx, W, H);

    // text in screen space, so it is upright either way round
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var big = Cabinet.fs(4);
    var s1 = toScreen(W / 2, H * 0.75), s2 = toScreen(W / 2, H * 0.25);
    Cabinet.text(ctx, String(g.score[0]), s1.x, s1.y - big * 2.5, big, '#24406a', 'center');
    if (g.twoPlayer && !turned) {
      // player 2 sits across the table: their score faces them
      ctx.save(); ctx.translate(s2.x, s2.y); ctx.rotate(Math.PI);
      Cabinet.text(ctx, String(g.score[1]), 0, -big * 2.5, big, '#5a2a5a', 'center');
      ctx.restore();
    } else Cabinet.text(ctx, String(g.score[1]), s2.x, s2.y - big * 2.5, big, '#5a2a5a', 'center');
    if (playing && g.wait > 0) {
      var n = Math.ceil(g.wait / (g.waitMax / 3)), c0 = toScreen(W / 2, H / 2);
      Cabinet.text(ctx, String(n), c0.x + (turned ? 0 : 30), c0.y - (turned ? 30 : 6), Cabinet.fs(2), COL.yellow, 'center', '#000');
    }
    if (banner) { var c1 = toScreen(W / 2, H / 2); Cabinet.text(ctx, banner.text, c1.x, c1.y + (turned ? 18 : 14), Cabinet.fs(2), banner.c, 'center', '#000'); }
    if (playing && g.wait > 0 && g.score[0] + g.score[1] === 0) {
      var hp = toScreen(W / 2, H - 34), msg = g.twoPlayer ? 'SLIDE ON YOUR SIDE' : 'SLIDE TO MOVE';
      Cabinet.text(ctx, msg, hp.x, hp.y + (turned ? -40 : 0), Cabinet.fs(1), PCOL[0], 'center', '#000');
    }
  }

  /* Each finger controls the paddle on its own half, tracked by pointerId so
     two kids can play at once. Movement is relative (so the finger never hides
     the paddle) and incremental (so a finger that runs off the edge responds
     the moment it turns round). Gain is in logical px, so the paddle moves the
     same share of the court for the same share of the screen on any device.
     A new finger on a side takes that paddle over from any older one. */
  var GAIN = 1.5;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    var side = p.y > H / 2 ? 0 : 1;
    if (side === 1 && !game.twoPlayer) side = 0;   // single player: whole screen drives your paddle
    for (var id in fingers) if (fingers[id].side === side) delete fingers[id];
    fingers[e.pointerId] = { side: side, x: p.x };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    var f = fingers[e.pointerId];
    if (!f || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    if (!Cabinet.paused()) game.move(f.side, game.paddles[f.side].x + (p.x - f.x) * GAIN);
    f.x = p.x;
  });
  function up(e) { delete fingers[e.pointerId]; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  var keys = {};
  document.addEventListener('keydown', function (e) { keys[e.key] = true; });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });
  setInterval(function () {
    if (!playing || Cabinet.paused() || Cabinet.overlayOpen()) return;
    var d = (keys.ArrowRight || keys.ArrowDown ? 1 : 0) - (keys.ArrowLeft || keys.ArrowUp ? 1 : 0);
    if (d) game.move(0, game.paddles[0].x + d * 3);
    var d2 = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    if (d2 && game.twoPlayer) game.move(1, game.paddles[1].x + d2 * 3);
  }, 16);

  Cabinet.setup({
    id: 'pong', scores: false, isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: 'Slide your finger to move your paddle. Hit the ball back!' },
      { icon: 'heart', text: '<b>2 players</b>: each slides on their own half of the screen.' },
      { icon: 'trophy', text: 'First to <b>7</b> wins. On <b>Easy</b> your paddle is bigger.' }
    ]
  });
  function sideInfo() {
    var box = document.getElementById('cab-hi');
    if (box) box.innerHTML = '<div class="cab-hi-title">Wins against the computer</div><div class="cab-table cab-table--empty" style="font-size:28px;color:#ffd23f">' + wins() + '</div>';
  }
  sideInfo();
  Cabinet.onRestart(function () { start(twoPlayer); });
  /* Turning the screen mid-match turns the court (the frame is always
     portrait, so only the scale changes): rebuild the screen and carry the
     paddles and ball across instead of shrinking the old picture. */
  function relayoutMatch() {
    var ow = W, oh = H, g = game;
    layout();
    var sx = W / ow, sy = H / oh, k0 = g.speedK;
    PADDLE_W = Math.round(W / 6);
    g.speedK = Math.max(1, H / 320);
    g.paddles.forEach(function (p, i) { p.w = Math.round(p.w * sx); p.y = i ? 14 : H - 14; g.move(i, p.x * sx); });
    g.ball.x *= sx; g.ball.y *= sy;
    g.ball.vx *= g.speedK / k0; g.ball.vy *= g.speedK / k0;
    trail = []; fingers = {};
  }
  Cabinet.onLayout(function () {
    if (playing) relayoutMatch();
    else if (game.over) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new PongGame(twoPlayer, diffKey); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__pong = { game: function () { return game; }, start: start };
})();
