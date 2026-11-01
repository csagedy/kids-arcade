(function () {
  var canvas = document.getElementById('screen');
  var SCREEN = { minAspect: 0.5, maxAspect: 1.15 };
  var ctx, game = null, playing = false, message = null;
  var fx = new Cabinet.Fx(), trail = [], squash = 0, bg = null;
  var COL = Cabinet.COL;

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h;
    bg = null;
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'lives', label: 'Balls', hearts: true },
    { id: 'level', label: 'Level', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('lives', game.lives);
    Cabinet.setHud('level', game.levelIndex + 1);
  }

  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; game = new BreakoutGame(); }
    hud();
    Cabinet.attract({ title: 'Breakout', lines: ['Bounce the ball and smash every brick!'], scores: 'breakout',
      resume: pending && ('level ' + (game.levelIndex + 1) + ', ' + game.score + ' points') }).then(function (v) {
      pending = null;
      if (v === 'continue') { playing = true; Cabinet.countdown(); }
      else Cabinet.firstHelp().then(start);
    });
  }

  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     Bricks are kept as grid cells, the paddle and balls as shares of the
     court, so the round fits any shape of screen. After a reload the ball
     waits on the paddle again (the start of the current ball), with score,
     balls, level and every brick as they were; a turn of the screen keeps
     the balls and capsules in flight. */
  function zoneY() { return BRICK_TOP + game.rowCount * (BRICK_H + BRICK_GAP); }
  function yOut(y) { var zb = zoneY(); return y <= zb ? y / zb : 1 + (y - zb) / Math.max(1, game.paddleY - zb); }
  function yIn(v, g) { var zb = BRICK_TOP + g.rowCount * (BRICK_H + BRICK_GAP); return v <= 1 ? v * zb : zb + (v - 1) * (g.paddleY - zb); }
  function save() {
    var g = game;
    return {
      level: g.levelIndex, score: g.score, lives: g.lives, px: g.px / W, wide: g.wide, slow: g.slow, stuck: g.stuck,
      bricks: g.bricks.map(function (b) { return [b.row, Math.round((b.x - g.brickX0) / g.pitch), b.hp]; }),
      balls: g.balls.map(function (b) { return [b.x / W, yOut(b.y), b.vx / g.speedK, b.vy / g.speedK]; }),
      caps: g.caps.map(function (c) { return [c.x / W, yOut(c.y), c.type, c.t]; })
    };
  }
  function restore(d, live) {
    var C = Cabinet;
    layout();
    var g = new BreakoutGame();
    var lvl = C.int(d.level, 0, 9999), rows = LEVELS[lvl % LEVELS.length];
    g.loadLevel(lvl);
    g.score = C.int(d.score, 0, 1e9);
    g.lives = C.int(d.lives, 1, 5);
    var seen = {}, bricks = [];
    C.list(d.bricks, 200).forEach(function (b) {
      C.list(b, 3);
      var r = C.int(b[0], 0, rows.length - 1), c = C.int(b[1], 0, 9), ch = rows[r][c];
      C.check(ch && ch !== '.' && !seen[r + ',' + c]);
      seen[r + ',' + c] = 1;
      var max = ch === ch.toUpperCase() ? 2 : 1;
      bricks.push({ x: g.brickX0 + c * g.pitch, y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), color: BRICK_COLORS[ch.toLowerCase()],
        hp: C.int(b[2], 1, max), max: max, row: r, hit: 0 });
    });
    C.check(bricks.length > 0);
    g.bricks = bricks;
    g.movePaddle(C.num(d.px, 0, 1) * W);
    g.serve();
    if (live && !C.bool(d.stuck)) {
      var sp = g.baseSpeed * 1.5;
      g.balls = C.list(d.balls, 6).map(function (b) {
        C.list(b, 4);
        return { x: C.num(b[0], -0.1, 1.1) * W, y: yIn(C.num(b[1], 0, 3), g), vx: C.num(b[2], -sp, sp) * g.speedK, vy: C.num(b[3], -sp, sp) * g.speedK, r: 3 };
      });
      C.check(g.balls.length > 0);
      g.stuck = false; g.lockT = 0;
    }
    if (live) {
      g.caps = C.list(d.caps, 4).map(function (c) {
        C.list(c, 4); C.check(POWERS.indexOf(c[2]) >= 0);
        return { x: C.num(c[0], -0.1, 1.1) * W, y: yIn(C.num(c[1], 0, 3), g), type: c[2], t: C.num(c[3], 0, 1e4) };
      });
      g.wide = C.num(d.wide, -1, 12); if (g.wide > 0) g.setWide(true);
      g.slow = C.num(d.slow, -1, 9);
    }
    game = g;
    trail = []; fx.clear(); message = null;
    hud();
  }
  Cabinet.keep({ id: 'breakout', save: save, restore: restore });

  function start() {
    Cabinet.stopCount();
    layout();
    game = new BreakoutGame();
    playing = true;
    message = null; trail = [];
    fx.clear();
    hud();
    say('LEVEL 1', 1300);
    Cabinet.sfx.start();
  }

  function say(text, ms, color) { message = { text: text, until: performance.now() + ms, color: color || COL.yellow, t0: performance.now() }; }

  var POWER_NAMES = { W: 'BIG PADDLE!', S: 'SLOW BALL', M: 'MULTI BALL!', '+': 'EXTRA BALL!' };
  var POWER_COLS = { W: COL.cyan, S: COL.purple, M: COL.pink, '+': COL.green };

  function update(dt) {
    fx.update(dt);
    if (squash > 0) squash -= dt;
    for (var t = trail.length - 1; t >= 0; t--) { trail[t].life -= dt; if (trail[t].life <= 0) trail.splice(t, 1); }
    if (!playing) return;
    var ev = game.update(dt);
    if (!game.stuck) game.balls.forEach(function (b) { trail.push({ x: b.x, y: b.y, life: 0.12 }); });
    while (game.fxQueue.length) {
      var q = game.fxQueue.shift();
      if (q.kind === 'brick') {
        fx.burst(q.x, q.y, 12, [q.color, q.color, '#ffffff'], 70, 0.5, { gravity: 140 });
        fx.ring(q.x, q.y, q.color, 12, 0.25);
      } else if (q.kind === 'paddle') {
        squash = 0.12;
        fx.burst(q.x, q.y, 4, [COL.cyan, '#fff'], 40, 0.25, { angle: -Math.PI / 2, spread: 2, gravity: 60 });
      } else if (q.kind === 'power') {
        fx.burst(q.x, q.y, 18, [POWER_COLS[q.type], '#fff'], 80, 0.6, { angle: -Math.PI / 2, spread: 2.2 });
        fx.pop('+50', q.x, q.y - 10, POWER_COLS[q.type]);
      }
    }
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'wall': Cabinet.beep(240, 25, 'square', 0.05); break;
        case 'paddle': Cabinet.beep(392, 45, 'square', 0.09); break;
        case 'brick':
          // each brick in a quick run rings a step higher
          combo = performance.now() - lastBrick < 900 ? Math.min(combo + 1, 12) : 0; lastBrick = performance.now();
          Cabinet.beep(523 * Math.pow(1.06, combo), 60, 'square', 0.08);
          fx.shake(1.2); break;
        case 'dent': Cabinet.beep(180, 50, 'square', 0.08); fx.shake(0.8); break;
        case 'power':
          Cabinet.sfx.power();
          say(POWER_NAMES[game.lastPower], 1000, POWER_COLS[game.lastPower]);
          break;
        case 'lose':
          Cabinet.sfx.lose(); fx.shake(4); fx.flash(COL.red, 0.35); Cabinet.vibrate(60);
          say('OOPS! TRY AGAIN', 1100, COL.orange); trail = [];
          break;
        case 'clear':
          fx.clear(); trail = [];
          Cabinet.sfx.levelUp(); fx.flash('#fff', 0.4);
          fx.burst(W / 2, H / 3, 50, [COL.yellow, COL.pink, COL.cyan, COL.green], 120, 1.0);
          say('LEVEL ' + (game.levelIndex + 1), 1600);
          break;
        case 'over':
          playing = false;
          fx.shake(5); fx.flash(COL.red, 0.5);
          Cabinet.sfx.over();
          setTimeout(function () { Cabinet.gameOver('breakout', game.score, start); }, 900);
          break;
      }
    }
    hud();
  }
  var combo = 0, lastBrick = 0;

  /* The backdrop is drawn once per screen size: a deep blue fade with a faint grid. */
  function backdrop() {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    for (var y = 0; y < H; y++) {
      var f = y / H;
      g.fillStyle = 'rgb(' + Math.round(6 + 8 * f) + ',' + Math.round(7 + 4 * f) + ',' + Math.round(22 + 22 * f) + ')';
      g.fillRect(0, y, W, 1);
    }
    g.fillStyle = 'rgba(124,242,255,0.05)';
    for (var x = 0; x < W; x += 12) g.fillRect(x, 0, 1, H);
    for (var yy = 0; yy < H; yy += 12) g.fillRect(0, yy, W, 1);
    return c;
  }

  function drawBrick(k) {
    var x = k.x, y = k.y, w = game.brickW, h = BRICK_H;
    if (k.hit > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); return; }
    ctx.fillStyle = k.color; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 1, y, 1, h);
    if (k.max > 1) {
      // armoured: a silver frame with rivets; cracked once it has been hit
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x + 2, y + 3, 2, 2); ctx.fillRect(x + w - 4, y + 3, 2, 2);
      if (k.hp < k.max) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        var m = x + Math.floor(w / 2);
        ctx.fillRect(m - 3, y + 2, 1, 2); ctx.fillRect(m - 2, y + 4, 2, 1); ctx.fillRect(m, y + 5, 1, 2); ctx.fillRect(m + 1, y + 7, 2, 1);
      }
    }
  }

  function drawPaddle() {
    var g = game, w = g.paddleW, sq = squash > 0 ? 1 : 0;
    var x = Math.round(g.px - w / 2) - sq, y = g.paddleY + sq, ww = w + sq * 2, h = 6 - sq;
    // red caps, a cyan-white body with a highlight and a dark underside
    ctx.fillStyle = COL.red; ctx.fillRect(x, y + 1, 5, h - 1); ctx.fillRect(x + ww - 5, y + 1, 5, h - 1);
    ctx.fillRect(x + 1, y, 4, 1); ctx.fillRect(x + ww - 5, y, 4, 1);
    ctx.fillStyle = g.wide > 0 ? COL.cyan : '#d8e4ff'; ctx.fillRect(x + 5, y, ww - 10, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 5, y + 1, ww - 10, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 5, y + h - 1, ww - 10, 1);
    ctx.fillStyle = '#ffb3c1'; ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + ww - 4, y + 1, 2, 1);
    if (g.wide > 0 && g.wide < 2 && Math.floor(g.wide * 8) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x, y, ww, h); }
  }

  var BALL = ['.www.', 'wWwww', 'wwwww', 'wwwwg', '.wgg.'];
  function drawBall(b) {
    var pal = { w: game.slow > 0 ? '#e7d4ff' : '#ffffff', W: '#ffffff', g: game.slow > 0 ? '#a77bff' : '#9fb2d8' };
    Cabinet.sprite(ctx, BALL, b.x - 2, b.y - 2, pal);
  }

  function drawCap(c) {
    var x = Math.round(c.x) - 7, y = Math.round(c.y) - 4, col = POWER_COLS[c.type];
    ctx.fillStyle = col; ctx.fillRect(x + 1, y, 12, 8); ctx.fillRect(x, y + 1, 14, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + 2, y + 1, 10, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 1, y + 7, 12, 1);
    Cabinet.text(ctx, c.type, x + 7, y + 2, 1, '#0b0c1a', 'center');
    if (Math.floor(c.t * 6) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y + 3, 1, 2); ctx.fillRect(x + 14, y + 3, 1, 2); }
  }

  function render() {
    var g = game;
    if (!bg) bg = backdrop();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.drawImage(bg, 0, 0);

    g.bricks.forEach(drawBrick);
    g.caps.forEach(drawCap);

    // ball trail
    for (var t = 0; t < trail.length; t++) {
      ctx.globalAlpha = trail[t].life * 4;
      ctx.fillStyle = g.slow > 0 ? COL.purple : COL.cyan;
      ctx.fillRect(Math.round(trail[t].x) - 1, Math.round(trail[t].y) - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
    g.balls.forEach(drawBall);
    drawPaddle();

    // power-up timers along the bottom
    if (g.wide > 0) { ctx.fillStyle = COL.cyan; ctx.fillRect(2, H - 4, Math.round((W / 2 - 4) * Math.min(1, g.wide / 12)), 2); }
    if (g.slow > 0) { var sw = Math.round((W / 2 - 4) * Math.min(1, g.slow / 9)); ctx.fillStyle = COL.purple; ctx.fillRect(W - 2 - sw, H - 4, sw, 2); }

    if (g.stuck && playing && Math.floor(performance.now() / 500) % 2 === 0) Cabinet.text(ctx, 'SLIDE AND LET GO!', W / 2, g.paddleY - 30, Cabinet.fs(1), COL.ink, 'center', '#000');
    fx.draw(ctx);
    if (message && performance.now() < message.until) {
      var s = Cabinet.fs(W >= 300 ? 3 : 2), age = performance.now() - message.t0;
      var yy = Math.round(H * 0.55) - (age < 160 ? Math.round((160 - age) / 20) : 0);
      Cabinet.text(ctx, message.text, W / 2, yy, s, message.color, 'center', '#000');
    }
    fx.end(ctx, W, H);
  }

  /* Controls: any horizontal finger movement steers, lifting the finger launches. */
  var down = null;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused() || down) return;
    var p = Cabinet.pointer(canvas, e);
    down = { id: e.pointerId, x: p.x, px: game.px };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId || !playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    // Relative steering, so a thumb at the edge can still reach the middle.
    game.movePaddle(down.px + (p.x - down.x) * 1.4);
  });
  function up(e) {
    if (!down || down.id !== e.pointerId) return;
    if (playing && !Cabinet.paused() && game.launch()) Cabinet.beep(660, 50, 'square', 0.07, 990);
    down = null;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', function () { down = null; });
  var keys = {};
  document.addEventListener('keydown', function (e) {
    if (!playing || Cabinet.paused() || Cabinet.overlayOpen()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = true; e.preventDefault(); }
    if (e.key === ' ' || e.key === 'ArrowUp') { if (game.launch()) Cabinet.beep(660, 50, 'square', 0.07, 990); e.preventDefault(); }
  });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });
  setInterval(function () {
    if (!playing || Cabinet.paused()) return;
    if (keys.ArrowLeft) game.movePaddle(game.px - 5);
    if (keys.ArrowRight) game.movePaddle(game.px + 5);
  }, 16);

  Cabinet.setup({
    id: 'breakout', isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: 'Slide your finger anywhere to move the paddle.' },
      { icon: 'play', text: 'Lift your finger to <b>launch</b> the ball.' },
      { icon: 'star', text: 'Catch falling capsules: <b>W</b> big paddle, <b>S</b> slow ball, <b>M</b> more balls, <b>+</b> extra ball.' },
      { icon: 'heart', text: 'Shiny bricks need two hits. Clear the wall for a bonus ball!' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || game.lives <= 0) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new BreakoutGame(); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__bo = { game: function () { return game; }, start: start, playing: function () { return playing; } };
})();
