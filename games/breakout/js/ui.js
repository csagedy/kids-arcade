(function () {
  var canvas = document.getElementById('screen');
  var ctx = Cabinet.fit(canvas, W, H);
  var game = null, playing = false, flash = 0, shake = 0, message = null;

  function attract() {
    playing = false;
    game = new BreakoutGame();
    Cabinet.showOverlay({
      title: 'BREAKOUT', lines: ['Slide to move', 'Tap to launch'],
      scores: 'breakout', button: 'PRESS START', onButton: start
    });
  }

  function start() {
    game = new BreakoutGame();
    playing = true;
    message = null;
  }

  function say(text, ms) { message = { text: text, until: performance.now() + ms }; }

  function update(dt) {
    if (!playing) return;
    var ev = game.update(dt);
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'wall': Cabinet.beep(220, 30); break;
        case 'paddle': Cabinet.beep(440, 40); break;
        case 'brick': Cabinet.beep(880 + Math.random() * 200, 50); flash = 2; break;
        case 'lose': Cabinet.beep(160, 300, 'sawtooth', 0.15, 60); shake = 12; say('OUCH', 900); break;
        case 'clear': Cabinet.beep(660, 80); setTimeout(function () { Cabinet.beep(880, 80); }, 90); setTimeout(function () { Cabinet.beep(1320, 160); }, 180); say('LEVEL ' + (game.levelIndex + 1), 1400); break;
        case 'over':
          playing = false;
          Cabinet.beep(120, 600, 'sawtooth', 0.15, 40);
          setTimeout(function () { Cabinet.gameOver('breakout', game.score, start); }, 700);
          break;
      }
    }
  }

  function render() {
    var g = game;
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3); shake--; }
    ctx.fillStyle = flash > 0 ? '#101a2a' : '#06070c';
    if (flash > 0) flash--;
    ctx.fillRect(0, 0, W, H);

    // header line
    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'LV ' + (g.levelIndex + 1), W / 2, 3, 1, '#ffb300', 'center');
    ctx.fillStyle = '#ffffff';
    for (var l = 0; l < g.lives; l++) ctx.fillRect(W - 8 - l * 8, 4, 5, 3);
    ctx.fillStyle = '#2a2f40'; ctx.fillRect(0, 11, W, 1);

    // bricks
    g.bricks.forEach(function (k) {
      ctx.fillStyle = k.color;
      ctx.fillRect(k.x, k.y, BRICK_W, BRICK_H);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(k.x, k.y + BRICK_H - 2, BRICK_W, 2);
      if (k.hp > 1) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(k.x + 2, k.y + 2, BRICK_W - 4, 1); }
    });

    // paddle
    ctx.fillStyle = '#e8f0ff';
    ctx.fillRect(Math.round(g.px - g.paddleW / 2), H - 24, g.paddleW, 5);
    ctx.fillStyle = '#7cf2ff';
    ctx.fillRect(Math.round(g.px - g.paddleW / 2), H - 24, 4, 5);
    ctx.fillRect(Math.round(g.px + g.paddleW / 2) - 4, H - 24, 4, 5);

    // ball
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(g.ball.x - 2), Math.round(g.ball.y - 2), 4, 4);

    if (g.stuck && playing) Cabinet.text(ctx, 'TAP TO LAUNCH', W / 2, H - 60, 1, '#7d879b', 'center');
    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, H / 2 - 10, 2, '#ffb300', 'center');
    ctx.restore();
  }

  /* Controls: any horizontal finger movement steers, a tap launches. */
  var down = null;
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing) return;
    var p = Cabinet.pointer(canvas, e);
    down = { x: p.x, px: game.px, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    if (Math.abs(p.x - down.x) > 2) down.moved = true;
    // Relative steering, so a thumb at the edge can still reach the middle.
    game.movePaddle(down.px + (p.x - down.x) * 1.4);
  });
  function up() {
    if (!down) return;
    if (!down.moved && playing) game.launch();
    down = null;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  Cabinet.wireMute(document.getElementById('mute-btn'));
  window.addEventListener('resize', function () { ctx = Cabinet.fit(canvas, W, H); });

  attract();
  Cabinet.loop(update, render);
  window.__bo = { game: function () { return game; }, start: start };
})();
