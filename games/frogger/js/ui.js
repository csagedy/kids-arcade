(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;
  var game = new FroggerGame(), playing = false, message = null;

  function attract() {
    playing = false;
    game = new FroggerGame();
    Cabinet.showOverlay({ title: 'FROGGER', lines: ['Tap above the frog to hop up', 'Tap beside it to sidestep'], scores: 'frogger', button: 'PRESS START', onButton: start });
  }
  function start() { game = new FroggerGame(); playing = true; }
  function say(t, ms) { message = { text: t, until: performance.now() + ms }; }

  function update(dt) {
    if (!playing) return;
    var r = game.update(dt);
    if (r === 'die') Cabinet.beep(200, 300, 'sawtooth', 0.15, 60);
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
      ctx.fillStyle = '#0d2a52'; ctx.fillRect(bx - 12, hr * CELL, 24, CELL);
      if (g.homes[b]) drawFrog(bx - 6, hr * CELL + 2, '#5eff5e');
    }
    // lanes
    g.lanes.forEach(function (l) {
      var y = l.row * CELL;
      l.items.forEach(function (x) {
        if (l.kind === 'turtle') {
          ctx.fillStyle = l.color;
          for (var t = 0; t < l.len; t += 16) { ctx.fillRect(x + t + 2, y + 4, 12, 9); ctx.fillStyle = '#1f7a2f'; ctx.fillRect(x + t + 5, y + 6, 6, 5); ctx.fillStyle = l.color; }
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
    if (g.dead) {
      var k = g.dead % 10 < 5;
      ctx.fillStyle = k ? '#ff3b3b' : '#ffe93b';
      ctx.fillRect(g.frog.x - 2, g.frog.row * CELL + 2, g.frog.w + 4, 12);
    } else {
      drawFrog(g.frog.x, g.frog.row * CELL + 2, '#5eff5e');
    }
    // hud
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, 12);
    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'LV ' + g.level, W / 2, 3, 1, '#ffb300', 'center');
    ctx.fillStyle = '#5eff5e';
    for (var i = 0; i < g.lives; i++) ctx.fillRect(W - 8 - i * 8, 4, 5, 4);
    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, H / 2, 2, '#ffb300', 'center');
  }

  function drawFrog(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y, 8, 12);
    ctx.fillRect(x, y + 2, 2, 4); ctx.fillRect(x + 10, y + 2, 2, 4);
    ctx.fillRect(x, y + 8, 2, 4); ctx.fillRect(x + 10, y + 8, 2, 4);
    ctx.fillStyle = '#111'; ctx.fillRect(x + 3, y + 2, 2, 2); ctx.fillRect(x + 7, y + 2, 2, 2);
  }

  /* Tap relative to the frog: above hops up, below hops down, beside sidesteps. */
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing) return;
    var p = Cabinet.pointer(canvas, e);
    var fx = game.frog.x + game.frog.w / 2, fy = game.frog.row * CELL + CELL / 2;
    var dx = p.x - fx, dy = p.y - fy, r;
    if (Math.abs(dx) > Math.abs(dy) * 1.6) r = game.hop(dx > 0 ? 1 : -1, 0);
    else r = game.hop(0, dy < 0 ? 1 : -1);
    if (r === 'hop') Cabinet.beep(520, 40, 'square', 0.06);
    if (r === 'home') { Cabinet.beep(880, 80); setTimeout(function () { Cabinet.beep(1320, 120); }, 90); }
    if (r === 'level') { say('LEVEL ' + game.level, 1400); Cabinet.beep(660, 100); setTimeout(function () { Cabinet.beep(990, 200); }, 120); }
  });

  Cabinet.wireMute(document.getElementById('mute-btn'));
  attract();
  Cabinet.loop(update, render);
  window.__frog = { game: function () { return game; }, start: start };
})();
