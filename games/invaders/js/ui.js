(function () {
  var canvas = document.getElementById('screen');
  var SCREEN = { minAspect: 0.5, maxAspect: 1.35 };
  var ctx, game, playing = false, message = null, bg = null, booms = [];
  var fx = new Cabinet.Fx(), COL = Cabinet.COL;

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h;
    bg = null;
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'lives', label: 'Ships', hearts: true },
    { id: 'wave', label: 'Wave', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('lives', game.lives);
    Cabinet.setHud('wave', game.level);
  }

  // Two frames each: squid (top row), crab, octopus. 'w' are the eyes.
  var SPRITES = [
    [['...XXXX.....', '..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXwwXXwwXXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX'],
     ['...XXXX.....', '..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXwwXXwwXXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..XX....XX..']],
    [['..X.....X..', '...X...X...', '..XXXXXXX..', '.XXwXXXwXX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
     ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXXwXXXwXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.']],
    [['...XX...', '..XXXX..', '.XXXXXX.', 'XXwXXwXX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X'],
     ['...XX...', '..XXXX..', '.XXXXXX.', 'XXwXXwXX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.']]
  ];
  // kind 0 bottom rows (octopus art index 0), 1 middle (crab), 2 top (squid)
  var ART_FOR_KIND = [0, 1, 2];
  var COLORS = [COL.green, COL.cyan, COL.pink];
  var SHIP = ['......X......', '.....XXX.....', '.....XcX.....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XX.........XX'];
  var UFO = ['.....XXXXXX.....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XXwXXwXXwXXwXX.', 'XXXXXXXXXXXXXXXX', '..XXX..XX..XXX..', '...X........X...'];
  var BOOM = ['X...X..X...X', '.X...XX...X.', '..X......X..', 'XX........XX', '..X......X..', '.X...XX...X.', 'X...X..X...X'];

  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; game = new InvadersGame(); }
    hud();
    Cabinet.attract({ title: 'Space Invaders', lines: ['Slide your ship to stop the invaders. It fires all by itself!'], scores: 'invaders',
      resume: pending && ('wave ' + game.level + ', ' + game.score + ' points') })
      .then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; Cabinet.countdown(); }
        else Cabinet.firstHelp().then(start);
      });
  }

  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     Kept: score, ships, wave, which aliens are left (as grid cells), how far
     the block has marched across and down (as shares of the room it has, so
     it is just as close to landing on any shape of screen), every shield's
     bitten pixels and the ship's place. Bombs, bullets and the mystery ship
     in flight are dropped. */
  function blockOf(g) {
    var cols = g.cols, minC = 99, maxC = -1, maxR = -1;
    g.aliens.forEach(function (a, i) { if (!a.alive) return; var c = i % cols, r = Math.floor(i / cols); minC = Math.min(minC, c); maxC = Math.max(maxC, c); maxR = Math.max(maxR, r); });
    var top = 26 + Math.min(g.level - 1, 3) * 8;
    return { minC: minC, maxC: maxC, maxR: maxR, top: top,
      // the room the live columns have to march in, and the drop left before they land
      xRoom: Math.max(1, (W - 12) - 12 - (maxC - minC) * 22), yRoom: Math.max(1, (g.shipY - 12) - (top + maxR * 16)) };
  }
  function save() {
    var g = game, b = blockOf(g), a0 = g.aliens[0];
    return {
      score: g.score, lives: g.lives, level: g.level, cols: g.cols, rows: g.aliens.length / g.cols,
      alive: g.aliens.map(function (a) { return a.alive ? 1 : 0; }).join(''),
      fx: (a0.x + b.minC * 22 - 12) / b.xRoom, fy: (a0.y - b.top) / b.yRoom, dir: g.dir,
      stepTimer: g.stepTimer, frame: g.frame, steps: g.steps,
      shields: g.shields.map(function (sh) { return Array.prototype.join.call(sh.px, ''); }),
      ship: g.ship.x / W, respawn: g.respawn, pause: g.pause, bombTimer: g.bombTimer, ufoTimer: g.ufoTimer
    };
  }
  function restore(d) {
    var C = Cabinet;
    layout();
    var g = new InvadersGame();
    g.level = C.int(d.level, 1, 9999);
    g.score = C.int(d.score, 0, 1e9);
    g.lives = C.int(d.lives, 1, 3);
    var cols = C.int(d.cols, 7, 11), rows = C.int(d.rows, 4, 5);
    C.check(typeof d.alive === 'string' && /^[01]+$/.test(d.alive) && d.alive.length === cols * rows && d.alive.indexOf('1') >= 0);
    g.cols = cols;
    g.aliens = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++)
      g.aliens.push({ x: c * 22, y: r * 16, kind: r < 1 ? 2 : r < 3 ? 1 : 0, alive: d.alive[r * cols + c] === '1' });
    g.total = g.aliens.length;
    var b = blockOf(g);
    var ox = 12 + C.num(d.fx, -0.2, 1.2) * b.xRoom - b.minC * 22, oy = b.top + Math.round(C.num(d.fy, -0.5, 1.2) * b.yRoom);
    g.aliens.forEach(function (a) { a.x += Math.round(ox); a.y += oy; });
    g.dir = d.dir === -1 ? -1 : (C.check(d.dir === 1), 1);
    g.stepTimer = C.num(d.stepTimer, 0, 2);
    g.frame = C.int(d.frame, 0, 1);
    g.steps = C.int(d.steps, 0, 1e9);
    var n = C.int(C.list(d.shields, 4).length, 3, 4);
    g.buildShields(n);
    d.shields.forEach(function (str, i) {
      C.check(typeof str === 'string' && str.length === SHIELD_W * SHIELD_H && /^[01]+$/.test(str));
      for (var k = 0; k < str.length; k++) g.shields[i].px[k] = str.charCodeAt(k) - 48;
    });
    g.moveShip(C.num(d.ship, 0, 1) * W);
    g.respawn = C.num(d.respawn, -1, 1.4);
    g.pause = C.num(d.pause, -1, 1.2);
    g.bombTimer = C.num(d.bombTimer, -10, 10);
    g.ufoTimer = C.num(d.ufoTimer, -10, 30);
    g.fireTimer = 0.4;
    game = g;
    fx.clear(); booms = []; message = null; bg = null;
    hud();
  }
  Cabinet.keep({ id: 'invaders', save: save, restore: restore });

  function start() {
    Cabinet.stopCount();
    layout();
    game = new InvadersGame(); playing = true; fx.clear(); booms = []; hud();
    say('WAVE 1', 1200);
    Cabinet.sfx.start();
  }
  function say(t, ms, c) { message = { text: t, until: performance.now() + ms, color: c || COL.yellow }; }

  var MARCH = [98, 92, 87, 82];
  function update(dt) {
    fx.update(dt);
    for (var i = booms.length - 1; i >= 0; i--) { booms[i].t -= dt; if (booms[i].t <= 0) booms.splice(i, 1); }
    if (!playing) return;
    var ev = game.update(dt);
    game.kills.forEach(function (k) {
      if (k.kind === 3) {
        fx.burst(k.x, k.y, 30, [COL.red, COL.yellow, '#fff'], 90, 0.8); fx.ring(k.x, k.y, COL.red, 22, 0.4);
        fx.pop(String(k.pts), k.x, k.y + 6, COL.yellow, Cabinet.fs(2));
      } else if (k.kind === 4) fx.burst(k.x, k.y, 6, [COL.red, '#fff'], 40, 0.3, { gravity: 0 });
      else {
        booms.push({ x: k.x, y: k.y, t: 0.18, c: COLORS[k.kind] });
        fx.burst(k.x, k.y, 10, [COLORS[k.kind], '#fff'], 60, 0.45, { gravity: 40 });
        fx.pop('+' + k.pts, k.x, k.y - 10, COLORS[k.kind]);
      }
    });
    game.kills.length = 0;
    game.chips.forEach(function (c) { fx.burst(c.x, c.y, 3, [COL.green, COL.lime], 30, 0.3, { gravity: 30 }); });
    game.chips.length = 0;
    for (var e = 0; e < ev.length; e++) {
      switch (ev[e]) {
        case 'shoot': Cabinet.beep(1400, 50, 'square', 0.035, 500); break;
        case 'step': Cabinet.beep(MARCH[game.steps % 4], 90, 'square', 0.1); break;
        case 'hit': Cabinet.noise(110, 0.12, 2400); Cabinet.beep(330, 70, 'square', 0.05, 120); fx.shake(1); break;
        case 'ufo': Cabinet.beep(700, 160, 'sine', 0.05, 1000); break;
        case 'ufohit': Cabinet.sfx.coin(); fx.shake(4); fx.flash('#fff', 0.25); break;
        case 'landed':
          Cabinet.sfx.lose(); fx.shake(6); fx.flash(COL.red, 0.4); Cabinet.vibrate(80);
          say('THEY LANDED! PUSH THEM BACK!', 1500, COL.orange);
          break;
        case 'die':
          Cabinet.sfx.lose(); say('OUCH!', 900, COL.orange); fx.shake(6); fx.flash(COL.red, 0.35);
          fx.burst(game.ship.x, game.shipY, 30, [COL.green, COL.yellow, '#fff'], 90, 0.7);
          Cabinet.vibrate(80); break;
        case 'wave':
          Cabinet.sfx.levelUp(); fx.flash('#fff', 0.3);
          say('WAVE ' + game.level, 1500); break;
        case 'over':
          playing = false; fx.shake(8); fx.flash(COL.red, 0.5);
          fx.burst(game.ship.x, game.shipY, 40, [COL.green, COL.yellow, COL.red], 110, 0.9);
          Cabinet.sfx.over();
          setTimeout(function () { Cabinet.gameOver('invaders', game.score, start, { stats: [{ label: 'Wave', value: game.level }] }); }, 1100);
          break;
      }
    }
    hud();
  }

  function backdrop() {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#05060f'; g.fillRect(0, 0, W, H);
    for (var s = 0; s < W * H / 450; s++) {
      g.fillStyle = s % 6 ? '#1f2550' : '#6a70a8';
      g.fillRect(Math.floor(Cabinet.hash(s) * W), Math.floor(Cabinet.hash(s + 77) * H), 1, 1);
    }
    // planet surface along the bottom
    g.fillStyle = '#1f9a57'; g.fillRect(0, H - 10, W, 1);
    g.fillStyle = '#0e3a22'; g.fillRect(0, H - 9, W, 9);
    g.fillStyle = '#16502e';
    for (var x = 0; x < W; x += 7) g.fillRect(x + Math.floor(Cabinet.hash(x) * 4), H - 6 + Math.floor(Cabinet.hash(x + 3) * 4), 2, 1);
    return c;
  }

  var shieldCanvas = {};
  function drawShield(sh, i) {
    var c = shieldCanvas[i];
    if (!c || sh.dirty || c._for !== sh) {
      c = shieldCanvas[i] = shieldCanvas[i] || document.createElement('canvas');
      c.width = SHIELD_W; c.height = SHIELD_H; c._for = sh;
      var g = c.getContext('2d');
      g.clearRect(0, 0, SHIELD_W, SHIELD_H);
      for (var y = 0; y < SHIELD_H; y++) for (var x = 0; x < SHIELD_W; x++) {
        if (!sh.px[y * SHIELD_W + x]) continue;
        // lighter on top edges, darker underneath: a chunky green bunker
        var above = y > 0 && sh.px[(y - 1) * SHIELD_W + x];
        g.fillStyle = !above ? '#b6ff6a' : (y > 10 ? '#1f9a57' : '#3ddc84');
        g.fillRect(x, y, 1, 1);
      }
      sh.dirty = false;
    }
    ctx.drawImage(c, Math.round(sh.x), Math.round(sh.y));
  }

  function render() {
    var g = game, t = Cabinet.time;
    if (!bg) bg = backdrop();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.drawImage(bg, 0, 0);

    g.aliens.forEach(function (a) {
      if (!a.alive) return;
      var art = SPRITES[ART_FOR_KIND[a.kind]][g.frame], w = art[0].length;
      Cabinet.sprite(ctx, art, a.x - Math.floor(w / 2), a.y - 4, { X: COLORS[a.kind], w: '#ffffff' });
    });
    booms.forEach(function (b) { Cabinet.sprite(ctx, BOOM, b.x - 6, b.y - 3, { X: Math.floor(b.t * 40) % 2 ? '#fff' : b.c }); });
    g.shields.forEach(drawShield);
    if (g.ufo) {
      var blink = Math.floor(t * 8) % 4;
      Cabinet.sprite(ctx, UFO, g.ufo.x - 8, 6, { X: COL.red, w: blink === 0 ? COL.yellow : '#ffd0d8' });
    }

    // shots: a bright white bolt; bombs: a red zig-zag
    g.shots.forEach(function (s) { ctx.fillStyle = '#fff'; ctx.fillRect(s.x, Math.round(s.y), 1, 5); ctx.fillStyle = COL.cyan; ctx.fillRect(s.x, Math.round(s.y) + 5, 1, 2); });
    g.bombs.forEach(function (b) {
      var y = Math.round(b.y), z = Math.floor(b.t * 12) % 2;
      ctx.fillStyle = COL.red;
      for (var k = 0; k < 6; k++) ctx.fillRect(b.x + ((k + z) % 2 ? 1 : -1), y + k, 1, 1);
      ctx.fillStyle = COL.yellow; ctx.fillRect(b.x, y + 5, 1, 1);
    });

    // ship (blinks while respawning)
    if (!g.over && !(g.respawn > 0 && Math.floor(g.respawn * 10) % 2)) {
      Cabinet.sprite(ctx, SHIP, Math.round(g.ship.x) - 6, g.shipY - 4, { X: COL.green, c: COL.cyan });
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(Math.round(g.ship.x) - 5, g.shipY, 11, 1);
    }
    fx.draw(ctx);
    if (message && performance.now() < message.until) {
      var s = Cabinet.fs(message.text.length > 14 ? 1 : 2);
      Cabinet.text(ctx, message.text, W / 2, Math.round(H * 0.55), s, message.color, 'center', '#000');
    }
    if (playing && g.level === 1 && g.score === 0 && g.pause <= 0 && Math.floor(performance.now() / 450) % 2)
      Cabinet.text(ctx, 'SLIDE TO MOVE', W / 2, g.shipY - 58, Cabinet.fs(1), COL.ink, 'center', '#000');
    fx.end(ctx, W, H);
  }

  /* Relative slide, tracked by pointerId so a second finger or a stray
     pointerup can't leave the ship stuck. Deltas are incremental (in logical
     px, so the feel is the same at every screen size), and a finger that runs
     past the screen edge responds the moment it turns around. */
  var GAIN = 1.4, down = null;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused() || down) return;
    var p = Cabinet.pointer(canvas, e);
    down = { id: e.pointerId, x: p.x };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || down.id !== e.pointerId || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    if (!Cabinet.paused()) game.moveShip(game.ship.x + (p.x - down.x) * GAIN);
    down.x = p.x;
  });
  function up(e) { if (down && down.id === e.pointerId) down = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  var keys = {};
  document.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = true; e.preventDefault(); } });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });
  setInterval(function () {
    if (!playing || Cabinet.paused() || Cabinet.overlayOpen()) return;
    if (keys.ArrowLeft) game.moveShip(game.ship.x - 2.5);
    if (keys.ArrowRight) game.moveShip(game.ship.x + 2.5);
  }, 16);

  Cabinet.setup({
    id: 'invaders', isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: 'Slide your finger anywhere to move your ship. It fires by itself!' },
      { icon: 'heart', text: 'Dodge the red zig-zag bombs. Hide behind the green bunkers.' },
      { icon: 'star', text: 'Hit the red flying saucer for a big bonus.' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || game.over) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new InvadersGame(); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__inv = { game: function () { return game; }, start: start };
})();
