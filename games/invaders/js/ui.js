(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;
  var game = new InvadersGame(), playing = false, flash = 0, message = null;
  var parts = [], pops = [], shake = 0;

  // 12x8 alien sprites, two frames each, as rows of bits
  var SPRITES = [
    [['001100', '011110', '111111', '110011', '111111', '010010', '100001', '010010'],
     ['001100', '011110', '111111', '110011', '111111', '010010', '010010', '101101']],
    [['100001', '010010', '111111', '101101', '111111', '111111', '100001', '010010'],
     ['100001', '010010', '111111', '101101', '111111', '011110', '010010', '100001']],
    [['000110', '001111', '011111', '110110', '111111', '010100', '101010', '010100'],
     ['000110', '001111', '011111', '110110', '111111', '001000', '010100', '101010']]
  ];
  var COLORS = ['#5eff5e', '#4de8ff', '#ff6bd6'];

  function attract() {
    playing = false;
    game = new InvadersGame();
    Cabinet.showOverlay({ title: 'INVADERS', lines: ['Slide to move', 'The ship fires itself', 'Shoot the red mystery ship!'], scores: 'invaders', button: 'PRESS START', onButton: start });
  }
  function start() { game = new InvadersGame(); playing = true; }
  function say(t, ms) { message = { text: t, until: performance.now() + ms }; }

  function burst(x, y, n, colors, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4,
        c: colors[Math.floor(Math.random() * colors.length)], s: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  function update(dt) {
    for (var pi = parts.length - 1; pi >= 0; pi--) {
      var q = parts[pi];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0) parts.splice(pi, 1);
    }
    for (var po = pops.length - 1; po >= 0; po--) { pops[po].life -= dt; pops[po].y -= 12 * dt; if (pops[po].life <= 0) pops.splice(po, 1); }
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (!playing) return;
    var ev = game.update(dt);
    // turn this step's kills and shield chips into particles
    game.kills.forEach(function (k) {
      if (k.kind === 3) { burst(k.x, k.y, 30, ['#ff3b3b', '#ffe93b', '#fff'], 90); pops.push({ x: k.x, y: k.y + 8, text: String(k.pts), life: 1.2 }); }
      else if (k.kind === 4) burst(k.x, k.y, 6, ['#ff3b3b', '#fff'], 40);
      else burst(k.x, k.y, 12, [COLORS[k.kind], '#fff'], 60);
    });
    game.kills.length = 0;
    game.chips.forEach(function (c) { burst(c.x, c.y, 3, ['#3fb950', '#8aff9a'], 30); });
    game.chips.length = 0;
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'shoot': Cabinet.beep(900, 40, 'square', 0.05, 300); break;
        case 'hit': Cabinet.noise(90, 0.12); flash = 1; break;
        case 'ufo': Cabinet.beep(700, 120, 'sine', 0.05, 1000); break;
        case 'ufohit': Cabinet.beep(500, 250, 'square', 0.1, 1500); setTimeout(function () { Cabinet.beep(1500, 200, 'square', 0.08); }, 130); shake = 4; break;
        case 'die': Cabinet.beep(150, 500, 'sawtooth', 0.16, 40); say('OUCH', 900); shake = 6;
          burst(game.ship.x, game.shipY, 28, ['#5eff5e', '#ffe93b', '#fff'], 90);
          if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} } break;
        case 'wave': Cabinet.beep(660, 80); setTimeout(function () { Cabinet.beep(990, 160); }, 100); say('WAVE ' + game.level, 1400); break;
        case 'over':
          playing = false; shake = 8;
          burst(game.ship.x, game.shipY, 40, ['#5eff5e', '#ffe93b', '#ff3b3b'], 110);
          Cabinet.beep(80, 800, 'sawtooth', 0.2, 30);
          setTimeout(function () { Cabinet.gameOver('invaders', game.score, start); }, 1000);
          break;
      }
    }
  }

  function drawUfo(u) {
    var x = Math.round(u.x), y = 16;
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - 8, y + 2, 16, 3); ctx.fillRect(x - 5, y, 10, 2); ctx.fillRect(x - 3, y - 2, 6, 2);
    ctx.fillStyle = '#ffe93b';
    var f = Math.floor(game.anim * 8) % 3;
    for (var i = 0; i < 3; i++) if (i === f) ctx.fillRect(x - 6 + i * 5, y + 2, 2, 1);
  }

  function sprite(kind, frame, x, y, color) {
    var rows = SPRITES[kind][frame];
    ctx.fillStyle = color;
    for (var r = 0; r < rows.length; r++) {
      for (var c = 0; c < 6; c++) {
        if (rows[r][c] === '1') { ctx.fillRect(x - 6 + c * 2, y - 4 + r, 2, 1); }
      }
    }
    // mirror the right half so 6 bits make a 12-wide symmetric alien
    for (var r2 = 0; r2 < rows.length; r2++) {
      for (var c2 = 0; c2 < 6; c2++) {
        if (rows[r2][5 - c2] === '1') { ctx.fillRect(x + c2 * 2 - 6 + 6, y - 4 + r2, 2, 1); }
      }
    }
  }

  function render() {
    var g = game;
    ctx.setTransform(1, 0, 0, 1, shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0, shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0);
    ctx.fillStyle = flash > 0 ? '#111a2a' : '#05060c';
    if (flash > 0) flash--;
    ctx.fillRect(-8, -8, W + 16, H + 16);
    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'WAVE ' + g.level, W / 2, 3, 1, '#ffb300', 'center');
    ctx.fillStyle = '#5eff5e';
    for (var i = 0; i < g.lives; i++) ctx.fillRect(W - 8 - i * 8, 4, 5, 3);

    var frame = Math.floor(g.anim * 2) % 2;
    g.aliens.forEach(function (a) { if (a.alive) sprite(a.kind, frame, Math.round(a.x), Math.round(a.y), COLORS[a.kind]); });

    // shields crumble: solid, cracked (a notch out), then a couple of crumbs
    var SH = ['#1d5a28', '#2f9a40', '#3fb950'];
    g.shields.forEach(function (s) {
      ctx.fillStyle = SH[s.hp - 1] || SH[0];
      if (s.hp >= 3) ctx.fillRect(s.x, s.y, 4, 4);
      else if (s.hp === 2) { ctx.fillRect(s.x, s.y, 4, 4); ctx.fillStyle = '#05060c'; ctx.fillRect(s.x + 2, s.y + 1, 1, 2); }
      else { ctx.fillRect(s.x, s.y + 2, 2, 2); ctx.fillRect(s.x + 3, s.y, 1, 1); ctx.fillRect(s.x + 2, s.y + 2, 1, 1); }
    });
    if (g.ufo) drawUfo(g.ufo);
    // particles and score pops
    for (var pi = 0; pi < parts.length; pi++) {
      var pp = parts[pi]; ctx.globalAlpha = Math.min(1, pp.life * 3);
      ctx.fillStyle = pp.c; ctx.fillRect(Math.round(pp.x), Math.round(pp.y), pp.s, pp.s);
    }
    ctx.globalAlpha = 1;
    pops.forEach(function (p) { Cabinet.text(ctx, p.text, Math.round(p.x), Math.round(p.y), 1, '#ffe93b', 'center'); });

    ctx.fillStyle = '#ffffff';
    g.shots.forEach(function (s) { ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 5); });
    ctx.fillStyle = '#ff3b3b';
    g.bombs.forEach(function (b) { ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2, 5); });

    // ship (blinks while respawning)
    if (!(g.respawn > 0 && Math.floor(g.respawn * 10) % 2)) {
      ctx.fillStyle = '#5eff5e';
      var sx = Math.round(g.ship.x), sy = g.shipY;
      ctx.fillRect(sx - 7, sy, 14, 5);
      ctx.fillRect(sx - 5, sy - 3, 10, 3);
      ctx.fillRect(sx - 1, sy - 6, 2, 3);
    }
    ctx.fillStyle = '#3fb950'; ctx.fillRect(0, H - 10, W, 1);
    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, H / 2, 2, '#ffb300', 'center');
  }

  /* Relative slide, tracked by pointerId so a second finger or a stray
     pointerup can't leave the ship stuck. Deltas are incremental, so a finger
     that runs past the screen edge responds the moment it turns around. */
  var down = null;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    down = { id: e.pointerId, x: p.x };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    if (!Cabinet.paused()) game.moveShip(game.ship.x + (p.x - down.x) * 1.4);
    down.x = p.x;
  });
  function up(e) { if (down && down.id === e.pointerId) down = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  Cabinet.wireMute(document.getElementById('mute-btn'));
  Cabinet.addPauseButton(function () { return playing; });
  Cabinet.autoPause(function () { return playing; });
  attract();
  Cabinet.loop(update, render);
  window.__inv = { game: function () { return game; }, start: start };
})();
