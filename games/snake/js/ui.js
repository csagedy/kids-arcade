(function () {
  var canvas = document.getElementById('screen');
  var ctx = Cabinet.fit(canvas, W, H);
  var game = new SnakeGame(), playing = false, flash = 0;

  function attract() {
    playing = false;
    game = new SnakeGame();
    Cabinet.showOverlay({ title: 'SNAKE', lines: ['Swipe to turn', 'Eat the apples'], scores: 'snake', button: 'PRESS START', onButton: start });
  }
  function start() { game = new SnakeGame(); playing = true; }

  function update(dt) {
    if (!playing) return;
    var r = game.update(dt);
    if (r === 'eat') { Cabinet.beep(880, 60); flash = 2; }
    else if (r === 'die') {
      playing = false;
      Cabinet.beep(200, 500, 'sawtooth', 0.15, 50);
      setTimeout(function () { Cabinet.gameOver('snake', game.score, start); }, 800);
    }
  }

  function render() {
    ctx.fillStyle = flash > 0 ? '#0f2a12' : '#06100a';
    if (flash > 0) flash--;
    ctx.fillRect(0, 0, W, H);
    Cabinet.text(ctx, 'SCORE ' + game.score, 4, 4, 1, '#5eff5e');
    Cabinet.text(ctx, 'LEN ' + game.snake.length, W - 4, 4, 1, '#7d879b', 'right');
    ctx.fillStyle = '#153a1a'; ctx.fillRect(0, 15, W, 1);

    // faint grid dots
    ctx.fillStyle = '#0c1a0f';
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) ctx.fillRect(c * CELL + 3, 16 + r * CELL + 3, 2, 2);

    if (game.apple) {
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(game.apple[0] * CELL + 1, 16 + game.apple[1] * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#5eff5e';
      ctx.fillRect(game.apple[0] * CELL + 4, 16 + game.apple[1] * CELL, 2, 2);
    }
    game.snake.forEach(function (s, i) {
      ctx.fillStyle = i === 0 ? '#c8ffc8' : (i % 2 ? '#5eff5e' : '#3ed63e');
      ctx.fillRect(s[0] * CELL + 1, 16 + s[1] * CELL + 1, CELL - 2, CELL - 2);
    });
    if (game.dead) { ctx.fillStyle = 'rgba(255,60,60,0.25)'; ctx.fillRect(0, 16, W, H - 16); }
  }

  /* Swipe anywhere; a short flick is enough. */
  var start0 = null;
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); start0 = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', function (e) {
    if (!start0 || !playing) return;
    var dx = e.clientX - start0.x, dy = e.clientY - start0.y;
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
    if (Math.abs(dx) > Math.abs(dy)) game.turn(dx > 0 ? 1 : -1, 0); else game.turn(0, dy > 0 ? 1 : -1);
    start0 = null;   // one turn per swipe; lift and swipe again
  });
  function up() { start0 = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  document.addEventListener('keydown', function (e) {
    var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (m && playing) { e.preventDefault(); game.turn(m[0], m[1]); }
  });

  Cabinet.wireMute(document.getElementById('mute-btn'));
  window.addEventListener('resize', function () { ctx = Cabinet.fit(canvas, W, H); });
  attract();
  Cabinet.loop(update, render);
  window.__snake = { game: function () { return game; }, start: start };
})();
