(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;
  var game = new FroggerGame(), playing = false, message = null;
  var parts = [];   // particles: { x, y, vx, vy, life, max, c, s }

  function attract() {
    playing = false;
    game = new FroggerGame();
    Cabinet.showOverlay({ title: 'FROGGER', lines: ['Tap above the frog to hop up', 'Tap beside it to sidestep', 'Ride the logs, dodge cars'], scores: 'frogger', button: 'PRESS START', onButton: start });
  }
  function start() { game = new FroggerGame(); playing = true; }
  function say(t, ms, c) { message = { text: t, until: performance.now() + ms, color: c || '#ffb300' }; }

  function burst(x, y, n, colors, speed, up) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), life: 0.5 + Math.random() * 0.4, max: 0.9,
        c: colors[Math.floor(Math.random() * colors.length)], s: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function froggyXY() { return { x: game.frog.x + game.frog.w / 2, y: game.frog.row * CELL + CELL / 2 }; }

  /* React to a result from hop() or update(). */
  function react(r) {
    var p = froggyXY();
    if (r === 'hop') Cabinet.beep(520, 40, 'square', 0.06);
    else if (r === 'home') {
      Cabinet.beep(880, 80); setTimeout(function () { Cabinet.beep(1320, 120); }, 90);
      burst(lastBay.x, lastBay.y, 18, ['#5eff5e', '#ffe93b', '#fff'], 60, 20); say('SAFE!', 700, '#5eff5e');
      if (game.gotFly) {
        setTimeout(function () { Cabinet.beep(1760, 160); }, 200);
        burst(lastBay.x, lastBay.y, 14, ['#ffe93b', '#fff'], 70, 30); say('BONUS FLY +200', 1000, '#ffe93b');
      }
    } else if (r === 'level') {
      Cabinet.beep(660, 100); setTimeout(function () { Cabinet.beep(990, 200); }, 120);
      burst(W / 2, H / 3, 40, ['#ffe93b', '#ff6bd6', '#4de8ff', '#5eff5e'], 90, 30);
      say('LEVEL ' + game.level, 1400);
    } else if (r === 'die') {
      if (game.deathKind === 'splash') {
        Cabinet.noise(220, 0.14); Cabinet.beep(320, 260, 'sine', 0.1, 90);
        burst(p.x, p.y, 22, ['#4da3ff', '#9fd4ff', '#fff'], 70, 40); say('SPLASH!', 800, '#7cf2ff');
      } else {
        Cabinet.beep(200, 300, 'sawtooth', 0.15, 60);
        burst(p.x, p.y, 22, ['#5eff5e', '#ff3b3b', '#ffe93b'], 80, 10); say('SPLAT!', 800, '#ff6b6b');
      }
      if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
    }
  }
  var lastBay = { x: 0, y: 0 };

  function update(dt) {
    if (!playing) return;
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt;
      if (q.life <= 0) parts.splice(i, 1);
    }
    var r = game.update(dt);
    if (r === 'die') react('die');
    else if (r === 'over') {
      playing = false;
      Cabinet.beep(90, 700, 'sawtooth', 0.18, 30);
      setTimeout(function () { Cabinet.gameOver('frogger', game.score, start); }, 900);
    }
  }

  function render() {
    var g = game, s = g.startRow, hr = g.homeRow;
    // sky above home, water, median, road, grass
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0d2a52'; ctx.fillRect(0, hr * CELL, W, 6 * CELL);
    ctx.fillStyle = '#1a2b1a'; ctx.fillRect(0, hr * CELL, W, CELL);
    ctx.fillStyle = '#3a2a6a'; ctx.fillRect(0, (s - 6) * CELL, W, CELL);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, (s - 5) * CELL, W, 5 * CELL);
    ctx.fillStyle = '#2a4a1a'; ctx.fillRect(0, s * CELL, W, H - s * CELL);
    // lane dashes on the road
    ctx.fillStyle = '#3a3a48';
    for (var r = s - 4; r <= s - 1; r++) for (var x = 4; x < W; x += 24) ctx.fillRect(x, r * CELL, 12, 1);
    // home bays
    for (var b = 0; b < 5; b++) {
      var bx = b * (W / 5) + W / 10;
      ctx.fillStyle = '#0d2a52'; ctx.fillRect(bx - 14, hr * CELL, 28, CELL);
      if (g.homes[b]) drawFrog(bx - 6, hr * CELL + 2, '#5eff5e');
      else if (g.fly && g.fly.bay === b) {   // bonus fly: buzzes about, blinks when about to leave
        if (g.fly.t > 1.5 || Math.floor(g.time * 8) % 2) {
          var fx = bx + Math.round(Math.sin(g.time * 7) * 4), fyy = hr * CELL + 6 + Math.round(Math.cos(g.time * 9) * 2);
          ctx.fillStyle = '#fff'; ctx.fillRect(fx - 3, fyy - 2, 3, 2); ctx.fillRect(fx + 1, fyy - 2, 3, 2);
          ctx.fillStyle = '#ffe93b'; ctx.fillRect(fx - 1, fyy, 3, 3);
        }
      }
    }
    // lanes
    g.lanes.forEach(function (l) {
      var y = l.row * CELL;
      l.items.forEach(function (x, ix) {
        if (l.kind === 'turtle') {
          var st = g.turtleState(l, ix);
          if (st === 2) {   // underwater: just a few bubbles
            ctx.fillStyle = '#9fd4ff';
            ctx.fillRect(Math.round(x + 6), y + 6, 2, 2); ctx.fillRect(Math.round(x + l.len - 8), y + 9, 2, 2);
            return;
          }
          // about to dive: flash between green and a pale warning colour and sink a little
          var warn = st === 1, flash = warn && Math.floor(g.time * 5) % 2 === 0;
          ctx.fillStyle = flash ? '#e8ffe8' : l.color;
          if (warn) y += 2;
          for (var t = 0; t < l.len; t += 16) { ctx.fillRect(x + t + 2, y + 4, 12, 9); ctx.fillStyle = flash ? '#ff6b6b' : '#1f7a2f'; ctx.fillRect(x + t + 5, y + 6, 6, 5); ctx.fillStyle = flash ? '#e8ffe8' : l.color; }
          if (warn) y -= 2;
        } else if (l.kind === 'log') {
          ctx.fillStyle = l.color; ctx.fillRect(x, y + 3, l.len, 10);
          ctx.fillStyle = '#7a4d1a'; ctx.fillRect(x + 4, y + 5, l.len - 8, 2);
        } else {
          ctx.fillStyle = l.color; ctx.fillRect(x, y + 3, l.len, 10);
          ctx.fillStyle = '#111'; ctx.fillRect(x + 2, y + 11, 4, 3); ctx.fillRect(x + l.len - 6, y + 11, 4, 3);
          ctx.fillStyle = '#fff'; ctx.fillRect(l.dir > 0 ? x + l.len - 3 : x + 1, y + 5, 2, 2);
        }
      });
    });
    // frog
    var fy = g.frog.row * CELL + 2;
    if (g.dead) {
      var t = 50 - g.dead;   // frames since death
      if (g.deathKind === 'splash') {
        // sink: shrink away under expanding rings
        if (t < 24) drawFrog(g.frog.x, fy + t * 0.3, '#5eff5e', 1 - t / 24);
        ctx.strokeStyle = '#9fd4ff'; ctx.lineWidth = 1;
        for (var rr = 0; rr < 2; rr++) {
          var rad = (t + rr * 8) % 24;
          ctx.globalAlpha = 1 - rad / 24;
          ctx.strokeRect(Math.round(g.frog.x + 6 - rad * 0.6), Math.round(fy + 6 - rad * 0.3), Math.round(rad * 1.2), Math.round(rad * 0.6));
        }
        ctx.globalAlpha = 1;
      } else {
        // squashed flat with an X
        ctx.fillStyle = g.dead % 10 < 5 ? '#ff3b3b' : '#ffe93b';
        ctx.fillRect(g.frog.x - 2, fy + 5, g.frog.w + 4, 4);
        ctx.fillStyle = '#111';
        ctx.fillRect(g.frog.x + 2, fy + 5, 1, 1); ctx.fillRect(g.frog.x + 4, fy + 6, 1, 1);
        ctx.fillRect(g.frog.x + 7, fy + 5, 1, 1); ctx.fillRect(g.frog.x + 9, fy + 6, 1, 1);
      }
    } else {
      // little hop: lift and stretch for a few frames
      var lift = g.hopT < 8 ? Math.round(Math.sin(g.hopT / 8 * Math.PI) * 3) : 0;
      drawFrog(g.frog.x, fy - lift, '#5eff5e', 1);
    }
    // particles
    for (var pi = 0; pi < parts.length; pi++) {
      var pp = parts[pi];
      ctx.globalAlpha = Math.min(1, pp.life * 2.5);
      ctx.fillStyle = pp.c; ctx.fillRect(Math.round(pp.x), Math.round(pp.y), pp.s, pp.s);
    }
    ctx.globalAlpha = 1;
    // hud
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, 12);
    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'LV ' + g.level, W / 2, 3, 1, '#ffb300', 'center');
    ctx.fillStyle = '#5eff5e';
    for (var i = 0; i < g.lives; i++) ctx.fillRect(W - 8 - i * 8, 4, 5, 4);
    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, H / 2, 2, message.color, 'center');
  }

  function drawFrog(x, y, color, k) {
    if (k !== undefined && k < 1) {   // shrinking sink animation
      var w = Math.max(2, Math.round(12 * k));
      ctx.fillStyle = color; ctx.fillRect(Math.round(x + 6 - w / 2), Math.round(y + 6 - w / 2), w, w);
      return;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y, 8, 12);
    ctx.fillRect(x, y + 2, 2, 4); ctx.fillRect(x + 10, y + 2, 2, 4);
    ctx.fillRect(x, y + 8, 2, 4); ctx.fillRect(x + 10, y + 8, 2, 4);
    ctx.fillStyle = '#111'; ctx.fillRect(x + 3, y + 2, 2, 2); ctx.fillRect(x + 7, y + 2, 2, 2);
  }

  /* Tap relative to the frog: above hops up, below hops down, beside sidesteps. */
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    var fx = game.frog.x + game.frog.w / 2, fy = game.frog.row * CELL + CELL / 2;
    var dx = p.x - fx, dy = p.y - fy, r;
    if (!game.dead) {
      var f0 = game.frog, bx0 = Math.min(4, Math.floor((f0.x + f0.w / 2) / (W / 5)));
      lastBay = { x: bx0 * (W / 5) + W / 10, y: game.homeRow * CELL + 8 };
    }
    if (Math.abs(dx) > Math.abs(dy) * 1.6) r = game.hop(dx > 0 ? 1 : -1, 0);
    else r = game.hop(0, dy < 0 ? 1 : -1);
    react(r);
  });

  Cabinet.wireMute(document.getElementById('mute-btn'));
  Cabinet.addPauseButton(function () { return playing; });
  Cabinet.autoPause(function () { return playing; });
  attract();
  Cabinet.loop(update, render);
  window.__frog = { game: function () { return game; }, start: start };
})();
