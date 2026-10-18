(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;   // set before the first game so rocks and the ship centre on the real height
  var game = new AsteroidsGame(), playing = false, message = null, flash = 0, hint = 0;
  var puffs = [];   // little explosion sparks
  var stars = [];
  for (var si = 0; si < 30; si++) stars.push({ x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) });

  function attract() {
    playing = false;
    game = new AsteroidsGame();
    Cabinet.showOverlay({ title: 'ASTEROIDS', lines: ['Hold your finger down', 'The ship turns to you', 'and shoots by itself'], scores: 'asteroids', button: 'PRESS START', onButton: start });
  }
  function start() { game = new AsteroidsGame(); playing = true; puffs = []; hint = 6; say('GO!', 900); }
  function say(t, ms) { message = { text: t, until: performance.now() + ms }; }

  function burst(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, v = 20 + Math.random() * 40;
      puffs.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, c: color });
    }
  }

  var lastRocks = [];
  function update(dt) {
    for (var p = puffs.length - 1; p >= 0; p--) {
      var q = puffs[p]; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.life <= 0) puffs.splice(p, 1);
    }
    if (!playing) return;
    if (hint > 0) hint -= dt;
    var before = game.rocks.slice();
    var ev = game.update(dt);
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'shoot': Cabinet.beep(700, 70, 'square', 0.04, 250); break;
        case 'thrust': break;
        case 'boom3': Cabinet.noise(160, 0.16); break;
        case 'boom2': Cabinet.noise(110, 0.13); break;
        case 'boom1': Cabinet.noise(70, 0.1); break;
        case 'ufo': Cabinet.beep(500, 300, 'triangle', 0.05, 700); break;
        case 'ufoboom': Cabinet.beep(900, 250, 'square', 0.1, 200); say('UFO! +200', 900); break;
        case 'die': Cabinet.beep(150, 500, 'sawtooth', 0.16, 40); burst(game.ship.x, game.ship.y, 16, '#ffffff'); flash = 6; say('OUCH', 900); break;
        case 'wave': Cabinet.beep(660, 80); setTimeout(function () { Cabinet.beep(990, 160); }, 100); say('WAVE ' + game.wave, 1400); break;
        case 'over':
          playing = false;
          burst(game.ship.x, game.ship.y, 20, '#ffffff');
          Cabinet.beep(80, 800, 'sawtooth', 0.2, 30);
          setTimeout(function () { Cabinet.gameOver('asteroids', game.score, start); }, 1000);
          break;
      }
    }
    // sparks where rocks vanished (a split makes two new ones, so diff by identity)
    for (var r = 0; r < before.length; r++) {
      if (game.rocks.indexOf(before[r]) < 0) burst(before[r].x, before[r].y, before[r].size * 3, '#ffd34d');
    }
  }

  function poly(pts, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 1.5; ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(Math.round(pts[0][0]), Math.round(pts[0][1]));
    for (var i = 1; i < pts.length; i++) ctx.lineTo(Math.round(pts[i][0]), Math.round(pts[i][1]));
    ctx.closePath();
    ctx.stroke();
  }

  function shipPoly(x, y, a, sc) {
    var c = Math.cos(a), s = Math.sin(a);
    var local = [[8, 0], [-6, 5], [-3, 0], [-6, -5]];
    return local.map(function (p) { return [x + (p[0] * c - p[1] * s) * sc, y + (p[0] * s + p[1] * c) * sc]; });
  }

  function render() {
    var g = game;
    ctx.fillStyle = flash > 0 ? '#1a1030' : '#05060c';
    if (flash > 0) flash--;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a3150';
    for (var i = 0; i < stars.length; i++) ctx.fillRect(stars[i].x, stars[i].y, 1, 1);

    // rocks (drawn again offset at the edges so wrap looks seamless)
    g.rocks.forEach(function (r) {
      var pts = [], n = r.pts.length;
      for (var k = 0; k < n; k++) {
        var a = r.rot + k / n * Math.PI * 2;
        pts.push([r.x + Math.cos(a) * r.pts[k], r.y + Math.sin(a) * r.pts[k]]);
      }
      poly(pts, r.size === 3 ? '#9fb4ff' : r.size === 2 ? '#7cf2ff' : '#5eff5e', 1.5);
    });

    // ufo
    if (g.ufo) {
      var ux = Math.round(g.ufo.x), uy = Math.round(g.ufo.y);
      ctx.fillStyle = '#ff6bd6';
      ctx.fillRect(ux - 8, uy, 16, 3);
      ctx.fillRect(ux - 4, uy - 3, 8, 3);
      ctx.fillRect(ux - 5, uy + 3, 10, 1);
    }
    ctx.fillStyle = '#ff3b3b';
    g.ufoShots.forEach(function (b) { ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3); });

    // shots
    ctx.fillStyle = '#ffffff';
    g.shots.forEach(function (b) { ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2); });

    // ship (blinks while safe)
    var blink = g.invuln > 0 && Math.floor(g.invuln * 8) % 2;
    if (g.respawn <= 0 && !blink && !g.over) {
      poly(shipPoly(g.ship.x, g.ship.y, g.ship.a, 1), '#ffffff', 1.5);
      if (g.thrusting && Math.floor(performance.now() / 70) % 2) {
        var b = shipPoly(g.ship.x, g.ship.y, g.ship.a, 1);
        var bx = (b[1][0] + b[3][0]) / 2, by = (b[1][1] + b[3][1]) / 2;
        var fx = bx - Math.cos(g.ship.a) * 6, fy = by - Math.sin(g.ship.a) * 6;
        poly([[b[1][0], b[1][1]], [fx, fy], [b[3][0], b[3][1]]], '#ffb300', 1.5);
      }
    }

    puffs.forEach(function (q) { ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); });

    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'WAVE ' + g.wave, W / 2, 3, 1, '#ffb300', 'center');
    for (var l = 0; l < g.lives; l++) {
      poly(shipPoly(W - 10 - l * 12, 8, -Math.PI / 2, 0.7), '#5eff5e', 1);
    }
    if (playing && hint > 0 && !touching) Cabinet.text(ctx, 'HOLD TO STEER', W / 2, H - 24, 1, '#ffffff', 'center');
    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, H / 3, 2, '#ffb300', 'center');
  }

  // Hold anywhere: the ship turns toward the finger, drifts after it, and fires.
  var touching = null;
  function aim(e) {
    var p = Cabinet.pointer(canvas, e);
    game.setTarget(p.x, p.y);
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused() || touching !== null) return;
    touching = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    aim(e);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== touching || !playing || Cabinet.paused()) return;
    aim(e);
  });
  function up(e) {
    if (e.pointerId !== touching) return;
    touching = null;
    game.setTarget(null);
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);

  Cabinet.wireMute(document.getElementById('mute-btn'));
  Cabinet.addPauseButton(function () { return playing; });
  Cabinet.autoPause(function () { return playing; });
  attract();
  Cabinet.loop(update, render);
  window.__ast = { game: function () { return game; }, start: start };
})();
