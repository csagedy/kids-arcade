(function () {
  var canvas = document.getElementById('screen');
  var SCREEN = { minAspect: 0.5, maxAspect: 1.8 };
  var ctx, game, playing = false, message = null, hint = 0, stars = [], ring = null;
  var fx = new Cabinet.Fx(), COL = Cabinet.COL;

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h;
    stars = [];
    for (var i = 0; i < W * H / 900; i++) stars.push({ x: Cabinet.hash(i) * W, y: Cabinet.hash(i + 300) * H, d: 1 + Math.floor(Cabinet.hash(i + 600) * 3) });
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'lives', label: 'Ships', hearts: true },
    { id: 'wave', label: 'Wave', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('lives', game.lives);
    Cabinet.setHud('wave', game.wave);
  }

  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; game = new AsteroidsGame(); }
    hud();
    Cabinet.attract({ title: 'Asteroids', lines: ['Fly your ship and blast the space rocks into tiny pieces!'], scores: 'asteroids',
      resume: pending && ('wave ' + game.wave + ', ' + game.score + ' points') })
      .then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; Cabinet.countdown(); }
        else Cabinet.firstHelp().then(start);
      });
  }

  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     Kept: score, ships, wave, and every rock where it is (as shares of the
     sky, so it fits any shape of screen) with its speed and shape. The ship
     keeps its place too and comes back inside its blinking shield, so a rock
     that ends up beside it can't hit it the moment play goes on. Shots and
     the UFO in flight are dropped. */
  function save() {
    var g = game, s = g.ship;
    return {
      score: g.score, lives: g.lives, wave: g.wave, ufoTimer: g.ufoTimer, waveDelay: g.waveDelay, respawn: g.respawn, invuln: g.invuln,
      ship: [s.x / W, s.y / H, s.vx, s.vy, s.a],
      rocks: g.rocks.map(function (r) { return [r.x / W, r.y / H, r.vx, r.vy, r.size, r.rot, r.spin].concat(r.pts); })
    };
  }
  function restore(d) {
    var C = Cabinet;
    layout();
    var g = new AsteroidsGame();
    g.score = C.int(d.score, 0, 1e9);
    g.lives = C.int(d.lives, 1, 3);
    g.wave = C.int(d.wave, 1, 9999);
    g.ufoTimer = C.num(d.ufoTimer, -100, 100);
    g.waveDelay = C.num(d.waveDelay, -10, 2);
    g.respawn = C.num(d.respawn, -10, 1.2);
    g.invuln = Math.max(2.5, C.num(d.invuln, -100, 3));
    C.list(d.ship, 5);
    var s = g.ship;
    s.x = C.num(d.ship[0], -0.2, 1.2) * W; s.y = C.num(d.ship[1], -0.2, 1.2) * H;
    s.vx = C.num(d.ship[2], -100, 100); s.vy = C.num(d.ship[3], -100, 100); s.a = C.num(d.ship[4], -100, 100);
    g.rocks = C.list(d.rocks, 300).map(function (q) {
      C.list(q, 16);
      var size = C.int(q[4], 1, 3), pts = q.slice(7).map(function (p) { return C.num(p, 0, 30); });
      C.check(pts.length === 9);
      return { x: C.num(q[0], -0.5, 1.5) * W, y: C.num(q[1], -0.5, 1.5) * H, vx: C.num(q[2], -500, 500), vy: C.num(q[3], -500, 500),
        size: size, r: ROCK_R[size], rot: C.num(q[5], -1e6, 1e6), spin: C.num(q[6], -5, 5), pts: pts };
    });
    g.standoff = Math.max(34, Math.round(70 / Cabinet.cssPerPx()));
    game = g;
    fx.clear(); message = null; hint = 0;
    hud();
  }
  Cabinet.keep({ id: 'asteroids', save: save, restore: restore });

  function start() {
    Cabinet.stopCount();
    layout();
    game = new AsteroidsGame(); playing = true; fx.clear(); hint = 6; hud();
    // keep the ship about 70 CSS px from the finger, so the finger never sits on top of it
    game.standoff = Math.max(34, Math.round(70 / Cabinet.cssPerPx()));
    say('GO!', 900);
    Cabinet.sfx.start();
  }
  function say(t, ms, c) { message = { text: t, until: performance.now() + ms, color: c || COL.yellow }; }

  var ROCK_COL = [null, COL.lime, COL.cyan, '#9fb4ff'];
  function update(dt) {
    fx.update(dt);
    if (ring) { ring.t -= dt; if (ring.t <= 0) ring = null; }
    // stars drift slowly against the ship's motion
    if (game) stars.forEach(function (s) {
      s.x -= game.ship.vx * dt * 0.08 * s.d; s.y -= game.ship.vy * dt * 0.08 * s.d;
      if (s.x < 0) s.x += W; if (s.x >= W) s.x -= W; if (s.y < 0) s.y += H; if (s.y >= H) s.y -= H;
    });
    if (!playing) return;
    if (hint > 0) hint -= dt;
    var ev = game.update(dt);
    game.broken.forEach(function (b) {
      var c = b.size === 4 ? COL.pink : ROCK_COL[b.size];
      fx.burst(b.x, b.y, b.size * 6, [c, '#fff', COL.yellow], 40 + b.size * 15, 0.6, { gravity: 0 });
      fx.ring(b.x, b.y, c, 6 + b.size * 6, 0.35);
      fx.pop('+' + b.pts, b.x, b.y - 8, c);
      if (b.size >= 3) fx.shake(2.5);
    });
    game.broken.length = 0;
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'shoot': Cabinet.beep(880, 60, 'square', 0.035, 330); break;
        case 'thrust': if (Math.random() < 0.15) Cabinet.noise(60, 0.03, 500); break;
        case 'boom3': Cabinet.noise(320, 0.18, 700); break;
        case 'boom2': Cabinet.noise(200, 0.15, 1100); break;
        case 'boom1': Cabinet.noise(110, 0.12, 2000); break;
        case 'ufo': Cabinet.beep(500, 300, 'triangle', 0.05, 700); say('UFO!', 900, COL.pink); break;
        case 'ufoboom': Cabinet.sfx.coin(); fx.flash('#fff', 0.25); say('UFO! +200', 900, COL.pink); break;
        case 'die':
          Cabinet.sfx.lose(); fx.burst(game.ship.x, game.ship.y, 30, ['#fff', COL.yellow, COL.orange], 80, 0.8, { gravity: 0 });
          fx.shake(6); fx.flash(COL.red, 0.35); Cabinet.vibrate(80); say('OUCH!', 900, COL.orange);
          break;
        case 'wave':
          Cabinet.sfx.levelUp(); fx.flash('#fff', 0.25);
          say('WAVE ' + game.wave, 1400); break;
        case 'over':
          playing = false;
          fx.burst(game.ship.x, game.ship.y, 40, ['#fff', COL.yellow, COL.red], 100, 1.0, { gravity: 0 }); fx.shake(8); fx.flash(COL.red, 0.5);
          Cabinet.sfx.over();
          setTimeout(function () { Cabinet.gameOver('asteroids', game.score, start, { stats: [{ label: 'Wave', value: game.wave }] }); }, 1100);
          break;
      }
    }
    hud();
  }

  function poly(pts, stroke, fill) {
    ctx.beginPath();
    ctx.moveTo(Math.round(pts[0][0]) + 0.5, Math.round(pts[0][1]) + 0.5);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(Math.round(pts[i][0]) + 0.5, Math.round(pts[i][1]) + 0.5);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  }
  function shipPoly(x, y, a, sc) {
    var c = Math.cos(a), s = Math.sin(a);
    var local = [[8, 0], [-6, 5], [-3, 0], [-6, -5]];
    return local.map(function (p) { return [x + (p[0] * c - p[1] * s) * sc, y + (p[0] * s + p[1] * c) * sc]; });
  }
  function rockPts(r, ox, oy) {
    var pts = [], n = r.pts.length;
    for (var k = 0; k < n; k++) {
      var a = r.rot + k / n * Math.PI * 2;
      pts.push([r.x + ox + Math.cos(a) * r.pts[k], r.y + oy + Math.sin(a) * r.pts[k]]);
    }
    return pts;
  }

  function render() {
    var g = game, t = Cabinet.time, now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.fillStyle = '#05060f'; ctx.fillRect(-8, -8, W + 16, H + 16);
    stars.forEach(function (s) { ctx.fillStyle = s.d === 3 ? '#8a90c0' : s.d === 2 ? '#3a4170' : '#1f2550'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); });

    // rocks: dark bodies with a bright rim, drawn again at the edges so the wrap is seamless
    g.rocks.forEach(function (r) {
      var col = ROCK_COL[r.size], fill = r.size === 3 ? '#1b2050' : r.size === 2 ? '#13304a' : '#163a26';
      var offs = [[0, 0]];
      if (r.x < r.r) offs.push([W, 0]); if (r.x > W - r.r) offs.push([-W, 0]);
      if (r.y < r.r) offs.push([0, H]); if (r.y > H - r.r) offs.push([0, -H]);
      offs.forEach(function (o) {
        poly(rockPts(r, o[0], o[1]), col, fill);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';   // a crater or two
        ctx.fillRect(Math.round(r.x + o[0] - r.r * 0.3), Math.round(r.y + o[1] - r.r * 0.2), Math.max(1, Math.round(r.r / 5)), Math.max(1, Math.round(r.r / 5)));
      });
    });

    if (g.ufo) {
      var ux = Math.round(g.ufo.x), uy = Math.round(g.ufo.y);
      Cabinet.sprite(ctx, ['....cccc....', '...cwwwwc...', '.pppppppppp.', 'pyppyppyppyp', '.pppppppppp.', '...p....p...'], ux - 6, uy - 3,
        { c: COL.cyan, w: '#d8fbff', p: COL.pink, y: Math.floor(t * 8) % 2 ? COL.yellow : '#fff' });
    }
    g.ufoShots.forEach(function (b) { ctx.fillStyle = Math.floor(t * 12) % 2 ? COL.red : COL.orange; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3); });
    g.shots.forEach(function (b) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2); ctx.fillStyle = COL.cyan; ctx.fillRect(Math.round(b.x - b.vx * 0.012), Math.round(b.y - b.vy * 0.012), 1, 1); });

    // ship: blinks inside a shield bubble while it is safe
    var s = g.ship, safe = g.invuln > 0 && g.respawn <= 0;
    if (g.respawn <= 0 && !g.over && !(safe && Math.floor(g.invuln * 8) % 2)) {
      var p = shipPoly(s.x, s.y, s.a, 1);
      if (g.thrusting) {
        var bx = (p[1][0] + p[3][0]) / 2, by = (p[1][1] + p[3][1]) / 2, len = 5 + Math.random() * 4;
        poly([[p[1][0] * 0.6 + bx * 0.4, p[1][1] * 0.6 + by * 0.4], [bx - Math.cos(s.a) * len, by - Math.sin(s.a) * len], [p[3][0] * 0.6 + bx * 0.4, p[3][1] * 0.6 + by * 0.4]], COL.orange, COL.yellow);
      }
      poly(p, '#ffffff', '#2d3275');
      ctx.fillStyle = COL.cyan; ctx.fillRect(Math.round(s.x + Math.cos(s.a) * 2), Math.round(s.y + Math.sin(s.a) * 2), 2, 2);
    }
    if (safe && g.respawn <= 0) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 10);
      ctx.strokeStyle = COL.cyan; ctx.beginPath(); ctx.arc(Math.round(s.x) + 0.5, Math.round(s.y) + 0.5, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // where the finger is: a little target the ship flies toward
    if (playing && g.target && g.respawn <= 0) {
      var tx = Math.round(g.target.x), ty = Math.round(g.target.y);
      ctx.fillStyle = 'rgba(124,242,255,0.6)';
      ctx.fillRect(tx - 5, ty, 3, 1); ctx.fillRect(tx + 3, ty, 3, 1); ctx.fillRect(tx, ty - 5, 1, 3); ctx.fillRect(tx, ty + 3, 1, 3);
    }

    fx.draw(ctx);
    if (playing && hint > 0 && !touching && Math.floor(now / 450) % 2) Cabinet.text(ctx, 'HOLD YOUR FINGER DOWN', W / 2, Math.round(H * 0.72), Cabinet.fs(1), COL.ink, 'center', '#000');
    if (message && now < message.until) Cabinet.text(ctx, message.text, W / 2, Math.round(H / 3), Cabinet.fs(2), message.color, 'center', '#000');
    fx.end(ctx, W, H);
  }

  // Hold anywhere: the ship turns toward the finger, drifts after it, and fires.
  var touching = null;
  function aim(e) { var p = Cabinet.pointer(canvas, e); game.setTarget(p.x, p.y); }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused() || touching !== null) return;
    touching = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
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

  Cabinet.setup({
    id: 'asteroids', isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: '<b>Hold</b> a finger on the screen. Your ship turns and flies toward it.' },
      { icon: 'star', text: 'While you hold, it fires by itself. Big rocks break into small ones.' },
      { icon: 'heart', text: 'After a bump you get a shield bubble for a few seconds.' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || game.over) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new AsteroidsGame(); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__ast = { game: function () { return game; }, start: start };
})();
