(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;
  var game = new PongGame(false), playing = false, flash = 0;

  function attract() {
    playing = false;
    game = new PongGame(false);
    Cabinet.showOverlay({
      title: 'PONG', lines: ['First to 7', 'Two players share the phone'],
      buttons: [{ text: '1 PLAYER', onClick: function () { start(false); } }, { text: '2 PLAYERS', onClick: function () { start(true); } }]
    });
  }
  function start(two) { game = new PongGame(two); playing = true; }

  function update(dt) {
    if (!playing) return;
    var r = game.update(dt);
    if (r === 'paddle') Cabinet.beep(440, 40);
    else if (r === 'wall') Cabinet.beep(220, 30);
    else if (r === 'point') { Cabinet.beep(160, 250, 'square', 0.1, 80); flash = 6; }
    else if (r === 'over') {
      playing = false;
      var p1 = game.score[0] > game.score[1];
      Cabinet.beep(p1 ? 880 : 200, 400, 'square', 0.12, p1 ? 1320 : 60);
      setTimeout(function () {
        Cabinet.showOverlay({
          title: game.twoPlayer ? (p1 ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS') : (p1 ? 'YOU WIN!' : 'COMPUTER WINS'),
          lines: [game.score[0] + ' - ' + game.score[1]],
          buttons: [{ text: 'AGAIN', onClick: function () { start(game.twoPlayer); } }, { text: 'MENU', onClick: attract }]
        });
      }, 900);
    }
  }

  function render() {
    var g = game;
    ctx.fillStyle = flash > 0 ? '#14141c' : '#05060c';
    if (flash > 0) flash--;
    ctx.fillRect(0, 0, W, H);
    // centre line
    ctx.fillStyle = '#2a2f40';
    for (var x = 4; x < W; x += 12) ctx.fillRect(x, H / 2, 6, 2);
    // scores, each readable from that player's side
    Cabinet.text(ctx, String(g.score[0]), W / 2, H / 2 + 12, 3, '#3a4a7a', 'center');
    ctx.save(); ctx.translate(W / 2, H / 2 - 12); ctx.rotate(Math.PI);
    Cabinet.text(ctx, String(g.score[1]), 0, 0, 3, '#3a4a7a', 'center');
    ctx.restore();
    // paddles
    ctx.fillStyle = '#ffffff';
    g.paddles.forEach(function (p) { ctx.fillRect(Math.round(p.x - PADDLE_W / 2), Math.round(p.y - 2), PADDLE_W, 4); });
    // ball
    if (g.wait <= 0) ctx.fillRect(Math.round(g.ball.x - 2), Math.round(g.ball.y - 2), 4, 4);
    if (!g.twoPlayer) Cabinet.text(ctx, 'CPU', W - 4, 24, 1, '#3a4a7a', 'right');
  }

  /* Each finger controls the paddle on its own half; track by pointerId so
     two kids can play at once. Movement is relative, like Breakout. */
  var fingers = {};
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing) return;
    var p = Cabinet.pointer(canvas, e);
    var side = p.y > H / 2 ? 0 : 1;
    if (side === 1 && !game.twoPlayer) side = 0;   // single player: whole screen drives the bottom paddle
    fingers[e.pointerId] = { side: side, x: p.x, px: game.paddles[side].x };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    var f = fingers[e.pointerId];
    if (!f || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    game.move(f.side, f.px + (p.x - f.x) * 1.4);
  });
  function up(e) { delete fingers[e.pointerId]; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  Cabinet.wireMute(document.getElementById('mute-btn'));
  attract();
  Cabinet.loop(update, render);
  window.__pong = { game: function () { return game; }, start: start };
})();
