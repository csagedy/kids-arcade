(function () {
  var canvas = document.getElementById('screen');
  var fit = Cabinet.fit(canvas, W, 320, 460);
  var ctx = fit.ctx;
  H = fit.h; GROUND = H - 22;
  var game = new MissileGame(), playing = false, shake = 0, message = null;

  function attract() {
    playing = false;
    game = new MissileGame();
    Cabinet.showOverlay({ title: 'MISSILE COMMAND', lines: ['Tap to fire', 'Save the cities'], scores: 'missile', button: 'PRESS START', onButton: start });
  }
  function start() { game = new MissileGame(); playing = true; message = { text: 'WAVE 1', until: performance.now() + 1200 }; }

  function update(dt) {
    if (!playing) return;
    var ev = game.update(dt);
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'boom': Cabinet.noise(180, 0.12); break;
        case 'kill': Cabinet.beep(1200, 60, 'square', 0.08, 300); break;
        case 'city': Cabinet.beep(90, 500, 'sawtooth', 0.18, 30); shake = 14; break;
        case 'wave':
          Cabinet.beep(660, 80); setTimeout(function () { Cabinet.beep(990, 160); }, 100);
          message = { text: 'WAVE ' + game.wave, until: performance.now() + 1400 };
          break;
        case 'over':
          playing = false;
          Cabinet.beep(60, 900, 'sawtooth', 0.2, 30);
          setTimeout(function () { Cabinet.gameOver('missile', game.score, start); }, 1000);
          break;
      }
    }
  }

  function render() {
    var g = game;
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4); shake--; }
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = '#1c2240';
    for (var s = 0; s < 40; s++) ctx.fillRect((s * 53) % W, (s * 91) % (GROUND - 40) + 14, 1, 1);

    Cabinet.text(ctx, 'SCORE ' + g.score, 4, 3, 1, '#7cf2ff');
    Cabinet.text(ctx, 'WAVE ' + g.wave, W / 2, 3, 1, '#ffb300', 'center');
    Cabinet.text(ctx, 'AMMO ' + g.battery.ammo, W - 4, 3, 1, g.battery.ammo < 5 ? '#ff3b3b' : '#7d879b', 'right');

    // ground
    ctx.fillStyle = '#c9a227'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#8a6d14'; ctx.fillRect(0, GROUND, W, 2);

    // cities
    g.cities.forEach(function (c) {
      if (c.alive) {
        ctx.fillStyle = '#4de8ff';
        ctx.fillRect(c.x - 9, GROUND - 6, 18, 6);
        ctx.fillRect(c.x - 6, GROUND - 10, 4, 4);
        ctx.fillRect(c.x + 1, GROUND - 12, 5, 6);
      } else {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(c.x - 9, GROUND - 3, 18, 3);
      }
    });
    // battery
    ctx.fillStyle = '#e8f0ff';
    ctx.fillRect(g.battery.x - 10, GROUND - 6, 20, 6);
    ctx.fillRect(g.battery.x - 3, GROUND - 10, 6, 4);

    // enemy trails
    g.enemies.forEach(function (m) {
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m.sx, m.sy); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 3, 3);
    });
    // player shots
    g.shots.forEach(function (s) {
      ctx.strokeStyle = '#4de8ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.battery.x, GROUND); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(s.tx) - 2, Math.round(s.ty), 5, 1); ctx.fillRect(Math.round(s.tx), Math.round(s.ty) - 2, 1, 5);
    });
    // explosions: rings of shifting colour
    g.booms.forEach(function (b, i) {
      var cols = ['#ffffff', '#ffe93b', '#ff9f1c', '#ff3b3b', '#c96bff'];
      ctx.fillStyle = cols[(Math.floor(performance.now() / 60) + i) % cols.length];
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });

    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, 110, 2, '#ffb300', 'center');
    ctx.restore();
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing) return;
    var p = Cabinet.pointer(canvas, e);
    if (game.fire(p.x, p.y)) Cabinet.beep(500, 50, 'square', 0.06, 900);
    else Cabinet.beep(120, 60, 'square', 0.05);
  });

  Cabinet.wireMute(document.getElementById('mute-btn'));
  attract();
  Cabinet.loop(update, render);
  window.__mc = { game: function () { return game; }, start: start };
})();
