(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h;
  var diffKey = 'medium';
  try { var saved = localStorage.getItem('pong.diff'); if (DIFFS[saved]) diffKey = saved; } catch (e) {}
  var game = new PongGame(false, diffKey), playing = false, flash = 0;
  var parts = [], trail = [], padFlash = [0, 0], wallFlash = 0, lastWait = 0;
  var fingers = {};

  function attract() {
    playing = false; fingers = {};
    game = new PongGame(false, diffKey);
    Cabinet.showOverlay({
      title: 'PONG', lines: ['First to 7', 'Two players share the phone'],
      buttons: [
        { text: '1 PLAYER', onClick: function () { start(false); } },
        { text: '2 PLAYERS', onClick: function () { start(true); } },
        { text: 'CPU: ' + DIFFS[diffKey].name, onClick: cycleDiff }
      ]
    });
  }
  /* Easy -> Medium -> Hard -> Easy, remembered, then back to the menu. */
  function cycleDiff() {
    diffKey = diffKey === 'easy' ? 'medium' : diffKey === 'medium' ? 'hard' : 'easy';
    try { localStorage.setItem('pong.diff', diffKey); } catch (e) {}
    attract();
  }
  function start(two) { fingers = {}; parts = []; trail = []; game = new PongGame(two, diffKey); playing = true; }

  function burst(x, y, n, speed, dirY, colors) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 + dirY * v * 0.5, life: 0.25 + Math.random() * 0.35,
        c: colors[Math.floor(Math.random() * colors.length)], s: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  function update(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0) parts.splice(i, 1);
    }
    padFlash[0] = Math.max(0, padFlash[0] - dt * 6); padFlash[1] = Math.max(0, padFlash[1] - dt * 6);
    wallFlash = Math.max(0, wallFlash - dt * 5);
    if (!playing) return;
    var g = game, b = g.ball;
    // countdown ticks on each serve
    if (g.wait > 0) {
      var n = Math.ceil(g.wait / (g.waitMax / 3));
      if (n !== lastWait) { lastWait = n; Cabinet.beep(n === 1 ? 660 : 440, 60, 'square', 0.06); }
    } else {
      trail.push({ x: b.x, y: b.y, life: 0.18 });
    }
    for (var t = trail.length - 1; t >= 0; t--) { trail[t].life -= dt; if (trail[t].life <= 0) trail.splice(t, 1); }

    var r = g.update(dt);
    if (r === 'paddle') {
      Cabinet.beep(440 + Math.min(g.rally, 12) * 25, 40);   // rises with the rally
      var h = g.lastHit; padFlash[h.side] = 1;
      burst(h.x, h.y + (h.side === 0 ? -3 : 3), 8, 70, h.side === 0 ? -1 : 1, ['#fff', '#7cf2ff']);
    }
    else if (r === 'wall') { Cabinet.beep(220, 30); wallFlash = 1; burst(b.x, b.y, 4, 40, 0, ['#fff', '#3a4a7a']); }
    else if (r === 'point') {
      Cabinet.beep(160, 250, 'square', 0.1, 80); flash = 6; trail = [];
      var lost = g.lastPoint === 0 ? 1 : 0;   // the ball left on the loser's side
      burst(W / 2, lost === 0 ? H - 4 : 4, 26, 110, lost === 0 ? -1 : 1, ['#ffb300', '#fff', '#ff6bd6']);
      if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
    }
    else if (r === 'over') {
      playing = false;
      var p1 = g.score[0] > g.score[1];
      Cabinet.beep(p1 ? 880 : 200, 400, 'square', 0.12, p1 ? 1320 : 60);
      burst(W / 2, H / 2, 50, 130, 0, ['#ffb300', '#fff', '#ff6bd6', '#4de8ff']);
      setTimeout(function () {
        Cabinet.showOverlay({
          title: g.twoPlayer ? (p1 ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS') : (p1 ? 'YOU WIN!' : 'COMPUTER WINS'),
          lines: [g.score[0] + ' - ' + g.score[1]],
          buttons: [{ text: 'AGAIN', onClick: function () { start(g.twoPlayer); } }, { text: 'MENU', onClick: attract }]
        });
      }, 900);
    }
  }

  function render() {
    var g = game;
    ctx.fillStyle = flash > 0 ? '#14141c' : '#05060c';
    if (flash > 0) flash--;
    ctx.fillRect(0, 0, W, H);
    // side walls glow briefly on a bounce
    if (wallFlash > 0) {
      ctx.globalAlpha = wallFlash * 0.5; ctx.fillStyle = '#4de8ff';
      ctx.fillRect(0, 0, 2, H); ctx.fillRect(W - 2, 0, 2, H); ctx.globalAlpha = 1;
    }
    // centre line
    ctx.fillStyle = '#2a2f40';
    for (var x = 4; x < W; x += 12) ctx.fillRect(x, H / 2, 6, 2);
    // scores, each readable from that player's side
    Cabinet.text(ctx, String(g.score[0]), W / 2, H / 2 + 12, 3, '#3a4a7a', 'center');
    ctx.save(); ctx.translate(W / 2, H / 2 - 12); ctx.rotate(Math.PI);
    Cabinet.text(ctx, String(g.score[1]), 0, 0, 3, '#3a4a7a', 'center');
    ctx.restore();
    // paddles (flash bright on a hit)
    g.paddles.forEach(function (p, i) {
      ctx.fillStyle = padFlash[i] > 0.3 ? '#7cf2ff' : '#ffffff';
      var grow = padFlash[i] > 0.3 ? 1 : 0;
      ctx.fillRect(Math.round(p.x - PADDLE_W / 2) - grow, Math.round(p.y - 2) - grow, PADDLE_W + grow * 2, 4 + grow * 2);
    });
    // ball trail, faster rallies leave a longer tail
    for (var t = 0; t < trail.length; t++) {
      ctx.globalAlpha = trail[t].life * 3; ctx.fillStyle = '#7cf2ff';
      ctx.fillRect(Math.round(trail[t].x - 1), Math.round(trail[t].y - 1), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    var b = g.ball;
    if (g.wait <= 0) ctx.fillRect(Math.round(b.x - 2), Math.round(b.y - 2), 4, 4);
    else if (playing) {
      // serve: the ball pulses at the centre with arrows showing where it will go, and a 3-2-1
      var pulse = Math.floor(g.wait * 6) % 2 ? 5 : 4;
      ctx.fillRect(Math.round(b.x - pulse / 2), Math.round(b.y - pulse / 2), pulse, pulse);
      ctx.fillStyle = '#ffb300';
      var dir = g.serveDir;   // +1 toward the bottom player
      for (var k = 1; k <= 3; k++) {
        // a little V chevron whose tip points the way the ball will go
        var ay = Math.round(H / 2 + dir * (6 + k * 6));
        for (var c = -2; c <= 2; c++) ctx.fillRect(W / 2 - 28 + c, ay + dir * (2 - Math.abs(c)), 1, 1);
      }
    }
    if (playing && g.wait > 0) {
      var n = Math.ceil(g.wait / (g.waitMax / 3));
      Cabinet.text(ctx, String(n), W / 2 + 26, H / 2 - 5, 2, '#ffb300', 'center');
    }
    // particles
    for (var i = 0; i < parts.length; i++) {
      var pp = parts[i]; ctx.globalAlpha = Math.min(1, pp.life * 3);
      ctx.fillStyle = pp.c; ctx.fillRect(Math.round(pp.x), Math.round(pp.y), pp.s, pp.s);
    }
    ctx.globalAlpha = 1;
    if (!g.twoPlayer) Cabinet.text(ctx, 'CPU', W - 4, 24, 1, '#3a4a7a', 'right');
    else {
      Cabinet.text(ctx, 'P1', 4, H - 8, 1, '#3a4a7a');
      ctx.save(); ctx.translate(W - 4, 8); ctx.rotate(Math.PI); Cabinet.text(ctx, 'P2', 0, 0, 1, '#3a4a7a'); ctx.restore();
    }
  }

  /* Each finger controls the paddle on its own half, tracked by pointerId so
     two kids can play at once. Movement is relative (so the finger never hides
     the paddle) and incremental (so a finger that runs off the edge responds
     the moment it turns round). A new finger on a side takes that paddle over
     from any older one. */
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    var side = p.y > H / 2 ? 0 : 1;
    if (side === 1 && !game.twoPlayer) side = 0;   // single player: whole screen drives the bottom paddle
    for (var id in fingers) if (fingers[id].side === side) delete fingers[id];
    fingers[e.pointerId] = { side: side, x: p.x };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    var f = fingers[e.pointerId];
    if (!f || !playing) return;
    var p = Cabinet.pointer(canvas, e);
    if (!Cabinet.paused()) game.move(f.side, game.paddles[f.side].x + (p.x - f.x) * 1.5);
    f.x = p.x;
  });
  function up(e) { delete fingers[e.pointerId]; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);

  Cabinet.wireMute(document.getElementById('mute-btn'));
  Cabinet.addPauseButton(function () { return playing; });
  Cabinet.autoPause(function () { return playing; });
  attract();
  Cabinet.loop(update, render);
  window.__pong = { game: function () { return game; }, start: start };
})();
