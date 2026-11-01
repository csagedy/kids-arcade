(function () {
  var canvas = document.getElementById('screen');
  var SCREEN = { minAspect: 0.5, maxAspect: 1.8 };
  var ctx, game, playing = false, message = null, bg = null, marks = [];
  var fx = new Cabinet.Fx(), COL = Cabinet.COL, lastChain = 1;

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h; GROUND = H - 22;
    bg = null;
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'ammo', label: 'Rockets' },
    { id: 'wave', label: 'Wave', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('ammo', game.battery.ammo);
    Cabinet.setHud('wave', game.wave);
  }

  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; game = new MissileGame(); }
    hud();
    Cabinet.attract({ title: 'Missile Command', lines: ['Rockets are falling! Tap the sky to pop them and save the cities.'], scores: 'missile',
      resume: pending && ('wave ' + game.wave + ', ' + game.score + ' points') })
      .then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; Cabinet.countdown(); }
        else Cabinet.firstHelp().then(start);
      });
  }

  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     Everything is kept as it is, in flight, with positions as shares of the
     sky (x of the width, y of the height above the ground), so it fits any
     shape of screen: the cities, rockets left in the battery (never
     refilled), the rockets still to come this wave, the ones falling, your
     shots and the explosions. */
  function save() {
    var g = game, w = W, gr = GROUND;
    return {
      score: g.score, wave: g.wave, cities: g.cities.map(function (c) { return c.alive; }), ammo: g.battery.ammo,
      toSpawn: g.toSpawn, spawnTimer: g.spawnTimer, reload: g.reload || 0, time: g.time,
      enemies: g.enemies.map(function (m) { return [m.x / w, m.y / gr, m.sx / w, m.sy / gr, m.tx / w, m.splitAt / gr]; }),
      shots: g.shots.map(function (q) { return [q.x / w, q.y / gr, q.ox / w, q.oy / gr, q.tx / w, q.ty / gr]; }),
      booms: g.booms.map(function (b) { return [b.x / w, b.y / gr, b.r, b.max, ['grow', 'hold', 'shrink'].indexOf(b.phase), b.t || 0, b.chain]; })
    };
  }
  function restore(d) {
    var C = Cabinet;
    layout();
    var g = new MissileGame();
    g.wave = C.int(d.wave, 1, 9999) - 1;
    g.startWave();   // the wave's speed, rockets and ammo...
    var fullAmmo = g.battery.ammo, fullSpawn = g.toSpawn;
    g.score = C.int(d.score, 0, 1e9);
    C.check(C.list(d.cities, 6).length === 6);
    d.cities.forEach(function (a, i) { g.cities[i].alive = C.bool(a); });
    g.battery.ammo = C.int(d.ammo, 0, fullAmmo);   // ...then what is left of them
    g.toSpawn = C.int(d.toSpawn, 0, fullSpawn);
    g.spawnTimer = C.num(d.spawnTimer, -10, 10);
    g.reload = C.num(d.reload, 0, 10);
    g.time = C.num(d.time, 0, 1e7);
    function X(v) { return C.num(v, -0.5, 1.5) * W; }
    function Y(v) { return C.num(v, -0.5, 1.5) * GROUND; }
    g.enemies = C.list(d.enemies, 200).map(function (e) {
      C.list(e, 6);
      var x = X(e[0]), y = Y(e[1]), tx = X(e[4]);
      var dd = Math.hypot(tx - x, GROUND - y) || 1;
      return { x: x, y: y, sx: X(e[2]), sy: Y(e[3]), vx: (tx - x) / dd * g.enemySpeed, vy: Math.abs(GROUND - y) / dd * g.enemySpeed, tx: tx, splitAt: e[5] ? Y(e[5]) : 0 };
    });
    var sp = 240 * g.scale;
    g.shots = C.list(d.shots, 60).map(function (q) {
      C.list(q, 6);
      var x = X(q[0]), y = Y(q[1]), tx = X(q[4]), ty = Y(q[5]), dd = Math.hypot(tx - x, ty - y) || 1;
      return { x: x, y: y, ox: X(q[2]), oy: Y(q[3]), tx: tx, ty: ty, vx: (tx - x) / dd * sp, vy: (ty - y) / dd * sp };
    });
    g.booms = C.list(d.booms, 200).map(function (b) {
      C.list(b, 7);
      var max = C.num(b[3], 1, 26);
      return { x: X(b[0]), y: Y(b[1]), r: C.num(b[2], -48, max), max: max, phase: ['grow', 'hold', 'shrink'][C.int(b[4], 0, 2)], t: C.num(b[5], -1, 1), chain: C.int(b[6], 0, 999) };
    });
    C.check(g.aliveCities() > 0 || g.enemies.length || g.booms.length);
    game = g;
    fx.clear(); marks = []; message = null;
    hud();
  }
  Cabinet.keep({ id: 'missile', save: save, restore: restore });

  function start() {
    Cabinet.stopCount();
    layout();
    game = new MissileGame(); playing = true; fx.clear(); marks = [];
    say('WAVE 1', 'SAVE THE CITIES!', 1600);
    Cabinet.sfx.start();
    hud();
  }
  function say(t, sub, ms) { message = { text: t, sub: sub, until: performance.now() + ms }; }

  function update(dt) {
    fx.update(dt);
    for (var i = marks.length - 1; i >= 0; i--) { marks[i].t -= dt; if (marks[i].t <= 0) marks.splice(i, 1); }
    if (!playing) return;
    var ev = game.update(dt);
    while (game.hits.length) {
      var h = game.hits.shift();
      if (h.city) {
        fx.burst(h.x, h.y, 26, [COL.cyan, '#fff', '#5a5f80', COL.orange], 90, 1.0);
        fx.ring(h.x, h.y, COL.orange, 30, 0.5);
      } else if (h.ground) fx.burst(h.x, h.y, 14, [COL.yellow, COL.orange, '#c9a227'], 80, 0.7);
      else {
        fx.burst(h.x, h.y, 10, ['#fff', COL.yellow, COL.orange], 60, 0.5);
        lastChain = h.chain;
        fx.pop('+' + h.pts, h.x, h.y - 10, h.chain > 1 ? COL.pink : COL.yellow, h.chain > 2 ? Cabinet.fs(2) : undefined);
      }
    }
    for (var k = 0; k < ev.length; k++) {
      switch (ev[k]) {
        case 'boom': Cabinet.noise(260, 0.12, 900); fx.shake(1.2); break;
        case 'split': Cabinet.beep(700, 90, 'triangle', 0.06, 350); break;
        case 'kill': Cabinet.beep(900 + Math.min(lastChain, 6) * 120 + Math.random() * 80, 80, 'square', 0.06, 1600); break;
        case 'reload': Cabinet.beep(1500, 25, 'square', 0.03); break;
        case 'battery': fx.flash(COL.orange, 0.25); break;
        case 'city': Cabinet.noise(600, 0.22, 600); Cabinet.beep(110, 500, 'sawtooth', 0.12, 40); fx.shake(6); fx.flash(COL.red, 0.35); Cabinet.vibrate(80); break;
        case 'wave':
          Cabinet.sfx.levelUp();
          say('WAVE ' + game.wave, (game.rebuilt ? 'CITY REBUILT!  ' : '') + 'BONUS +' + game.bonus, 2200);
          fx.burst(W / 2, H * 0.4, 40, [COL.yellow, COL.cyan, COL.pink, '#fff'], 110, 0.9);
          break;
        case 'over':
          playing = false;
          Cabinet.sfx.over(); fx.flash('#fff', 0.6); fx.shake(6);
          say('THE END', '', 1500);
          setTimeout(function () { Cabinet.gameOver('missile', game.score, start, { stats: [{ label: 'Wave', value: game.wave }] }); }, 1300);
          break;
      }
    }
    hud();
  }

  function backdrop() {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    for (var y = 0; y < H; y++) {
      var f = y / GROUND;
      g.fillStyle = 'rgb(' + Math.round(5 + 30 * f * f) + ',' + Math.round(6 + 10 * f * f) + ',' + Math.round(20 + 40 * f) + ')';
      g.fillRect(0, y, W, 1);
    }
    // stars, more of them up high
    for (var s = 0; s < W * H / 600; s++) {
      var sx = (s * 7919) % W, sy = Math.floor(Math.pow(((s * 104729) % 997) / 997, 1.6) * (GROUND - 40));
      g.fillStyle = s % 7 ? '#2a3160' : '#8a90c0';
      g.fillRect(sx, sy, 1, 1);
    }
    // rolling hills, then the ground strip
    g.fillStyle = '#3a2a12';
    for (var x = 0; x < W; x++) {
      var hh = Math.round(4 + 3 * Math.sin(x / 17) + 2 * Math.sin(x / 7.3));
      g.fillRect(x, GROUND - hh, 1, hh);
    }
    g.fillStyle = '#c9a227'; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#e8c547'; g.fillRect(0, GROUND, W, 1);
    g.fillStyle = '#8a6d14';
    for (var d = 0; d < W; d += 5) g.fillRect(d + (d % 3), GROUND + 4 + (d * 7) % (H - GROUND - 6), 2, 1);
    // the battery's mound
    var bx = Math.round(W / 2);
    g.fillStyle = '#c9a227';
    for (var r = 0; r < 8; r++) g.fillRect(bx - 18 + r * 2, GROUND - r - 1, 36 - r * 4, 1);
    g.fillStyle = '#e8c547';
    for (var r2 = 0; r2 < 8; r2++) g.fillRect(bx - 18 + r2 * 2, GROUND - r2 - 1, 1, 1);
    return c;
  }

  var CITY = [
    '......bb.........',
    '......bb....cc...',
    '..cc..bb....cc...',
    '..cc.bbbb..bbbb..',
    'b.ccbbwbb..bwbb.b',
    'bbbwbbbbbbcbbbbbb',
    'bwbbbwbbwbbwbbbwb',
    'bbbbbbbbbbbbbbbbb'
  ];
  var RUBBLE = [
    '.................',
    '.................',
    '.................',
    '.................',
    '......r..........',
    '..r..rrr....r....',
    '.rrr.rrrr..rrr.r.',
    'rrrrrrrrrrrrrrrrr'
  ];

  function render() {
    var g = game, t = Cabinet.time, now = performance.now();
    if (!bg) bg = backdrop();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.drawImage(bg, 0, 0);

    g.cities.forEach(function (c, i) {
      if (c.alive) {
        var lit = Math.floor(t * 0.7 + i) % 4 === 0;
        Cabinet.sprite(ctx, CITY, c.x - 8, GROUND - 8, { b: '#4cc2ff', c: '#2ee6c9', w: lit ? '#fff' : COL.yellow });
      } else {
        Cabinet.sprite(ctx, RUBBLE, c.x - 8, GROUND - 8, { r: '#4a4f6a' });
        if (playing && Math.random() < 0.08) fx.burst(c.x + (Math.random() - 0.5) * 10, GROUND - 4, 1, ['#3a3f5a', '#5a5f7a'], 10, 1.2, { angle: -Math.PI / 2, spread: 0.6, gravity: -8 });
      }
    });

    // battery: a dome with a barrel that points where you last tapped
    var bx = g.battery.x, by = GROUND - 10;
    Cabinet.disc(ctx, bx, by + 1, 5, '#d8e4ff');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 3, by - 3, 3, 1);
    ctx.fillStyle = '#d8e4ff';
    for (var bi = 3; bi <= 9; bi++) ctx.fillRect(Math.round(bx + Math.cos(g.battery.aim) * bi), Math.round(by + Math.sin(g.battery.aim) * bi), 2, 2);
    var low = g.battery.ammo < 5;
    if (!low || Math.floor(t * 4) % 2) Cabinet.text(ctx, String(g.battery.ammo), bx, GROUND + 6, 1, low ? COL.red : '#3b2a00', 'center');

    // enemy rockets: a long fading trail and a blinking head
    g.enemies.forEach(function (m) {
      var len = Math.hypot(m.x - m.sx, m.y - m.sy), steps = Math.max(1, Math.floor(len / 2));
      for (var i = 0; i <= steps; i++) {
        var f = i / steps, px = m.sx + (m.x - m.sx) * f, py = m.sy + (m.y - m.sy) * f;
        var tail = len * (1 - f);
        ctx.fillStyle = tail < 14 ? COL.red : tail < 40 ? '#a8203e' : '#4a1028';
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
      ctx.fillStyle = Math.floor(t * 12) % 2 ? '#fff' : COL.yellow;
      ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 3, 3);
    });
    // your rockets: a cyan streak and an X on the target
    g.shots.forEach(function (s) {
      ctx.strokeStyle = 'rgba(124,242,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.ox + 0.5, s.oy + 0.5); ctx.lineTo(s.x + 0.5, s.y + 0.5); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
      var tx = Math.round(s.tx), ty = Math.round(s.ty);
      ctx.fillStyle = Math.floor(t * 10) % 2 ? COL.cyan : '#fff';
      for (var d = -3; d <= 3; d++) { ctx.fillRect(tx + d, ty + d, 1, 1); ctx.fillRect(tx + d, ty - d, 1, 1); }
    });
    // explosions: discs of shifting colour with a bright core
    var cols = ['#ffffff', COL.yellow, COL.orange, COL.red, COL.pink, COL.cyan];
    g.booms.forEach(function (b, i) {
      var r = Math.round(b.r);
      Cabinet.disc(ctx, b.x, b.y, r, cols[(Math.floor(now / 50) + i) % cols.length]);
      if (r > 4 && b.phase !== 'shrink') Cabinet.disc(ctx, b.x, b.y, Math.round(r * 0.35), '#fff');
    });
    // "no rockets" feedback where a tap landed
    marks.forEach(function (m) { Cabinet.text(ctx, 'EMPTY', m.x, m.y, 1, COL.red, 'center', '#000'); });

    fx.draw(ctx);
    if (message && now < message.until) {
      Cabinet.text(ctx, message.text, W / 2, Math.round(H * 0.3), Cabinet.fs(3), COL.yellow, 'center', '#000');
      if (message.sub) Cabinet.text(ctx, message.sub, W / 2, Math.round(H * 0.3) + 26, Cabinet.fs(1), COL.cyan, 'center', '#000');
    }
    if (playing && g.wave === 1 && g.time < 6 && !g.shots.length && g.battery.ammo === 22 && Math.floor(now / 450) % 2)
      Cabinet.text(ctx, 'TAP THE SKY!', W / 2, Math.round(H * 0.55), Cabinet.fs(2), COL.ink, 'center', '#000');
    fx.end(ctx, W, H);
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    if (game.fire(p.x, p.y)) { Cabinet.beep(420, 90, 'square', 0.05, 1200); fx.ring(p.x, Math.min(p.y, GROUND - 20), COL.cyan, 6, 0.2); }
    else { Cabinet.beep(120, 80, 'square', 0.06); if (marks.length < 3) marks.push({ x: p.x, y: Math.min(p.y, GROUND - 20), t: 0.6 }); }
    hud();
  });

  Cabinet.setup({
    id: 'missile', isPlaying: function () { return playing; },
    help: [
      { icon: 'star', text: 'Tap the sky where a rocket is heading. <b>Pop!</b>' },
      { icon: 'heart', text: 'Save the six cities. Lose them all and it’s game over.' },
      { icon: 'trophy', text: 'One pop can set off another: <b>chains</b> score double, triple…' },
      { icon: 'restart', text: 'Rockets come back every wave, and a lost city is rebuilt now and then.' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || game.over) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new MissileGame(); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__mc = { game: function () { return game; }, start: start };
})();
