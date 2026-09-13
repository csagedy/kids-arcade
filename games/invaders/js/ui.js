(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;
  var game = new InvadersGame(), playing = false, flash = 0, message = null;

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
    Cabinet.showOverlay({ title: 'INVADERS', lines: ['Slide to move', 'The ship fires itself'], scores: 'invaders', button: 'PRESS START', onButton: start });
  }
  function start() { game = new InvadersGame(); playing = true; }
  function say(t, ms) { message = { text: t, until: performance.now() + ms }; }

  function update(dt) {
    if (!playing) return;
    var ev = game.update(dt);
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'shoot': Cabinet.beep(900, 40, 'square', 0.05, 300); break;
        case 'hit': Cabinet.noise(90, 0.12); flash = 1; break;
        case 'die': Cabinet.beep(150, 500, 'sawtooth', 0.16, 40); say('OUCH', 900); break;
        case 'wave': Cabinet.beep(660, 80); setTimeout(function () { Cabinet.beep(990, 160); }, 100); say('WAVE ' + game.level, 1400); break;
        case 'over':
          playing = false;
          Cabinet.beep(80, 800, 'sawtooth', 0.2, 30);
          setTimeout(function () { Cabinet.gameOver('invaders', game.score, start); }, 1000);
          break;
      }
    }
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
    ctx.fillStyle = flash > 0 ? '#111a2a' : '#05060c';
    if (flash > 0) flash--;
    ctx.fillRect(0, 0, W, H);
    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'WAVE ' + g.level, W / 2, 3, 1, '#ffb300', 'center');
    ctx.fillStyle = '#5eff5e';
    for (var i = 0; i < g.lives; i++) ctx.fillRect(W - 8 - i * 8, 4, 5, 3);

    var frame = Math.floor(g.anim * 2) % 2;
    g.aliens.forEach(function (a) { if (a.alive) sprite(a.kind, frame, Math.round(a.x), Math.round(a.y), COLORS[a.kind]); });

    ctx.fillStyle = '#3fb950';
    g.shields.forEach(function (s) { ctx.fillRect(s.x, s.y, 4, 4); });

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

  var down = null;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing) return;
    var p = Cabinet.pointer(canvas, e);
    down = { x: p.x, sx: game.ship.x };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    game.moveShip(down.sx + (p.x - down.x) * 1.3);
  });
  function up() { down = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  Cabinet.wireMute(document.getElementById('mute-btn'));
  attract();
  Cabinet.loop(update, render);
  window.__inv = { game: function () { return game; }, start: start };
})();
