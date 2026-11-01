(function () {
  var canvas = document.getElementById('screen');
  var SCREEN = { minAspect: 0.45, maxAspect: 1.7 };
  var ctx, game, playing = false, dying = 0, bg = null, ox = 0, oy = 0, chomp = 0;
  var fx = new Cabinet.Fx(), COL = Cabinet.COL;
  // Wrap-around is the default for new players: kinder for little ones.
  var wrap = true;
  try { wrap = localStorage.getItem('snake.wrap') !== '0'; } catch (e) {}
  function scoreId() { return wrap ? 'snake-wrap' : 'snake'; }

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h;
    snakeGrid();
    ox = Math.floor((W - COLS * CELL) / 2); oy = Math.floor((H - ROWS * CELL) / 2);
    bg = null;
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'len', label: 'Length' },
    { id: 'best', label: 'Best', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('len', game.snake.length);
    Cabinet.setHud('best', Math.max(Cabinet.best(scoreId()), game.score));
  }

  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (pending && Cabinet.tryRestore(pending, false)) {
      hud();
      Cabinet.attract({ title: 'Snake', scores: scoreId(), resume: 'length ' + game.snake.length + ', ' + game.score + ' points' }).then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; Cabinet.countdown(); }
        else attract();   // the walls choice is on the plain attract card
      });
      return;
    }
    pending = null;
    game = new SnakeGame(wrap);
    hud();
    Cabinet.sideScores(scoreId());
    Cabinet.attract({
      title: 'Snake', lines: ['Gobble the apples and grow super long!'], scores: scoreId(),
      html: '<span class="k-label">Walls</span><div class="k-seg" role="group" aria-label="Walls">' +
        '<button type="button" data-w="1">Wrap around</button><button type="button" data-w="0">Bump = out</button></div>',
      onOpen: function (card) {
        var btns = card.querySelectorAll('.k-seg button');
        function paint() {
          for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('k-on', (btns[i].getAttribute('data-w') === '1') === wrap);
          var t = card.querySelector('.cab-card-scores');
          if (t) t.innerHTML = Cabinet.tableHtml(scoreId());
        }
        for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () {
          wrap = this.getAttribute('data-w') === '1';
          try { localStorage.setItem('snake.wrap', wrap ? '1' : '0'); } catch (e) {}
          Kit.sfx.click();
          game = new SnakeGame(wrap); hud();
          Cabinet.sideScores(scoreId());
          paint();
        });
        paint();
      }
    }).then(function () { Cabinet.firstHelp().then(start); });
  }
  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     The whole snake, its apples and speed are kept as grid cells. The grid's
     size follows the screen, so on a new shape the board is turned a
     quarter if the screen turned (so a long snake still fits) and centred;
     anything still off the board is slid back on (or wrapped). */
  function save() {
    var g = game;
    return { wrap: g.wrap, cols: COLS, rows: ROWS, snake: g.snake, dir: g.dir, apple: g.apple, gold: g.gold,
      goldIn: g.goldIn, score: g.score, apples: g.apples, step: g.stepTime };
  }
  function restore(d, live) {
    var C = Cabinet;
    layout();
    var g = new SnakeGame(C.bool(d.wrap));
    var oc = C.int(d.cols, 10, 400), or = C.int(d.rows, 10, 400);
    function cell(p) { C.list(p, 2); return [C.int(p[0], 0, oc - 1), C.int(p[1], 0, or - 1)]; }
    var body = C.list(d.snake, oc * or).map(cell);
    C.check(body.length >= 1);
    for (var i = 1; i < body.length; i++) {   // each piece touches the next (maybe across a wrap)
      var ddx = Math.abs(body[i][0] - body[i - 1][0]), ddy = Math.abs(body[i][1] - body[i - 1][1]);
      if (ddx === oc - 1) ddx = 1; if (ddy === or - 1) ddy = 1;
      C.check(ddx + ddy <= 1);
    }
    C.list(d.dir, 2);
    var dir = [C.int(d.dir[0], -1, 1), C.int(d.dir[1], -1, 1)];
    C.check(Math.abs(dir[0]) + Math.abs(dir[1]) === 1);
    var apple = d.apple === null ? null : cell(d.apple);
    var gold = null;
    if (d.gold !== null) { C.check(d.gold && typeof d.gold === 'object'); gold = cell([d.gold.c, d.gold.r]); gold.t = C.num(d.gold.t, 0, 7); }
    // turn the board a quarter (clockwise) when the screen turned, so a long
    // snake still fits; turning is rigid, so the room ahead stays the same
    var turn = oc !== or && (oc > or) !== (COLS > ROWS);
    var bw = turn ? or : oc, bh = turn ? oc : or;
    function tr(p) { return turn ? [or - 1 - p[1], p[0]] : [p[0], p[1]]; }
    body = body.map(tr); if (apple) apple = tr(apple); if (gold) { var gt = gold.t; gold = tr(gold); gold.t = gt; }
    if (turn) dir = [-dir[1], dir[0]];
    var sx = Math.floor((COLS - bw) / 2), sy = Math.floor((ROWS - bh) / 2);
    // slide the snake back on the board if it hangs off an edge
    var minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    body.forEach(function (p) { minC = Math.min(minC, p[0] + sx); maxC = Math.max(maxC, p[0] + sx); minR = Math.min(minR, p[1] + sy); maxR = Math.max(maxR, p[1] + sy); });
    if (maxC - minC < COLS) { if (minC < 0) sx -= minC; else if (maxC >= COLS) sx -= maxC - COLS + 1; }
    if (maxR - minR < ROWS) { if (minR < 0) sy -= minR; else if (maxR >= ROWS) sy -= maxR - ROWS + 1; }
    function put(p) { return [((p[0] + sx) % COLS + COLS) % COLS, ((p[1] + sy) % ROWS + ROWS) % ROWS]; }
    g.snake = body.map(put);
    var used = {};
    g.snake.forEach(function (p) { C.check(!used[p + '']); used[p + ''] = 1; });
    g.dir = dir; g.queue = [];
    g.score = C.int(d.score, 0, 1e9);
    g.apples = C.int(d.apples, 0, 1e6);
    g.stepTime = C.num(d.step, 0.085, 0.2);
    g.goldIn = C.int(d.goldIn, -99, 99);
    g.gold = null; g.apple = null;
    if (gold) { var gp = put(gold); if (!used[gp + '']) { g.gold = { c: gp[0], r: gp[1], t: gold.t }; used[gp + ''] = 1; } }
    if (apple) { var ap = put(apple); if (!used[ap + '']) g.apple = ap; }
    if (!g.apple) g.placeApple();
    C.check(!!g.apple);
    g.acc = live ? 0 : -0.6;
    game = g;
    wrap = g.wrap;
    try { localStorage.setItem('snake.wrap', wrap ? '1' : '0'); } catch (e) {}
    dying = 0; fx.clear();
    Cabinet.sideScores(scoreId());
    hud();
  }
  Cabinet.keep({ id: 'snake', save: save, restore: restore });

  function start() {
    Cabinet.stopCount();
    layout();
    game = new SnakeGame(wrap); playing = true; dying = 0; fx.clear(); hud();
    Cabinet.sideScores(scoreId());
    Cabinet.sfx.start();
  }

  function cx(c) { return ox + c * CELL + CELL / 2; }
  function cy(r) { return oy + r * CELL + CELL / 2; }

  function update(dt) {
    fx.update(dt);
    if (chomp > 0) chomp -= dt;
    if (dying > 0) {
      // the snake pops apart, head first, then the score card
      var before = Math.floor(dying * 30);
      dying += dt;
      var now = Math.floor(dying * 30);
      for (var i = before; i < now && i < game.snake.length; i++) {
        var s = game.snake[i];
        fx.burst(cx(s[0]), cy(s[1]), 5, [COL.green, COL.lime, '#fff'], 50, 0.5);
        if (i % 3 === 0) Cabinet.beep(600 - i * 6, 30, 'square', 0.04);
      }
      if (now >= game.snake.length + 12 && dying < 99) {
        dying = 99;
        Cabinet.gameOver(scoreId(), game.score, start, game.won ? { title: 'You filled it!', icon: 'trophy' } : {});
      }
      return;
    }
    if (!playing) return;
    var r = game.update(dt);
    if (r === 'eat' || r === 'win') {
      var h = game.snake[0], gold = game.ate === 'gold';
      chomp = 0.15;
      var n = Math.min(game.apples, 24);
      if (gold) Cabinet.sfx.coin(); else { Cabinet.beep(660 * Math.pow(1.03, n), 50, 'square', 0.09); Cabinet.beep(990 * Math.pow(1.03, n), 70, 'square', 0.07, 0, 0.05); }
      fx.burst(cx(h[0]), cy(h[1]), gold ? 20 : 10, gold ? [COL.yellow, '#fff', COL.orange] : [COL.red, COL.yellow, '#fff'], gold ? 80 : 55, 0.5);
      fx.ring(cx(h[0]), cy(h[1]), gold ? COL.yellow : COL.red, 16, 0.3);
      fx.pop('+' + game.lastPts, cx(h[0]), oy + h[1] * CELL - 8, gold ? COL.yellow : COL.lime);
      if (game.apples && game.apples % 4 === 0 && game.ate === 'apple') fx.pop('FASTER!', W / 2, H * 0.3, COL.cyan, Cabinet.fs(2));
    }
    if (r === 'die' || r === 'win') {
      playing = false;
      game.won = r === 'win';
      fx.shake(4); fx.flash(r === 'win' ? '#fff' : COL.red, 0.4);
      Cabinet.vibrate(70);
      if (r === 'win') Cabinet.sfx.levelUp(); else Cabinet.sfx.lose();
      setTimeout(function () { dying = 0.001; }, 450);
    }
    hud();
  }

  function backdrop() {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#04120a'; g.fillRect(0, 0, W, H);
    for (var r = 0; r < ROWS; r++) for (var col = 0; col < COLS; col++) {
      g.fillStyle = (r + col) % 2 ? '#0b2615' : '#0e2d19';
      g.fillRect(ox + col * CELL, oy + r * CELL, CELL, CELL);
    }
    // little grass tufts
    g.fillStyle = '#16422a';
    for (var i = 0; i < COLS * ROWS / 6; i++) {
      var tc = (i * 7919) % COLS, tr = (i * 104729) % ROWS;
      g.fillRect(ox + tc * CELL + 3 + (i % 5), oy + tr * CELL + 6, 1, 2); g.fillRect(ox + tc * CELL + 5 + (i % 5), oy + tr * CELL + 5, 1, 3);
    }
    return c;
  }

  var APPLE = ['.....s....', '....s.ll..', '..rrsrrl..', '.rwwrrrrr.', '.rwrrrrrr.', '.rrrrrrrr.', '.rrrrrrrd.', '..rrrrrd..', '...rdrd...'];
  function drawApple(c, r, gold, t) {
    var bob = Math.round(Math.sin(t * 4 + c) * 0.6);
    var pal = gold ? { r: COL.yellow, w: '#fff', d: '#d69a00', s: '#8a5a2b', l: COL.green }
                   : { r: COL.red, w: '#ffd0d8', d: '#b0213f', s: '#8a5a2b', l: COL.green };
    Cabinet.sprite(ctx, APPLE, ox + c * CELL + 1, oy + r * CELL + 2 + bob, pal);
    if (gold && Math.floor(t * 6) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(ox + c * CELL + 10, oy + r * CELL, 1, 3); ctx.fillRect(ox + c * CELL + 9, oy + r * CELL + 1, 3, 1); }
  }

  function render() {
    var g = game, t = Cabinet.time;
    if (!bg) bg = backdrop();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.drawImage(bg, 0, 0);
    // walls: a solid fence in classic, glowing portals when wrapping
    ctx.fillStyle = g.wrap ? (Math.floor(t * 2) % 2 ? '#2a6aff' : '#3a7cff') : '#ff9f43';
    var bw = COLS * CELL, bh = ROWS * CELL;
    if (g.wrap) {
      for (var d = 0; d < bw; d += 6) { ctx.fillRect(ox + d, oy, 3, 1); ctx.fillRect(ox + d, oy + bh - 1, 3, 1); }
      for (var e = 0; e < bh; e += 6) { ctx.fillRect(ox, oy + e, 1, 3); ctx.fillRect(ox + bw - 1, oy + e, 1, 3); }
    } else {
      ctx.fillRect(ox, oy, bw, 1); ctx.fillRect(ox, oy + bh - 1, bw, 1); ctx.fillRect(ox, oy, 1, bh); ctx.fillRect(ox + bw - 1, oy, 1, bh);
    }

    if (g.apple) drawApple(g.apple[0], g.apple[1], false, t);
    if (g.gold && (g.gold.t > 2 || Math.floor(t * 8) % 2)) drawApple(g.gold.c, g.gold.r, true, t);

    var popped = dying > 0 ? Math.floor(dying * 30) : 0;
    var n = g.snake.length;
    for (var i = n - 1; i >= popped; i--) {
      var s = g.snake[i], x = ox + s[0] * CELL, y = oy + s[1] * CELL;
      var dead = g.dead && Math.floor(t * 10) % 2;
      var body = dead ? '#ffffff' : (i % 2 ? '#3ddc84' : '#2fc172');
      var inset = i === n - 1 && n > 2 ? 2 : 1;
      ctx.fillStyle = body;
      ctx.fillRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
      // join to the next segment toward the head (skip across a wrap)
      if (i > 0) {
        var p = g.snake[i - 1], dx = p[0] - s[0], dy = p[1] - s[1];
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          if (dx) ctx.fillRect(x + (dx > 0 ? CELL - 1 : -1), y + 2, 2, CELL - 4);
          else ctx.fillRect(x + 2, y + (dy > 0 ? CELL - 1 : -1), CELL - 4, 2);
        }
      }
      if (i > 0 && !dead) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x + 2, y + 2, CELL - 6, 2);
        ctx.fillStyle = '#1f9a57'; ctx.fillRect(x + 4, y + 6, 2, 2); ctx.fillRect(x + 7, y + 5, 2, 2);
      }
    }
    if (popped === 0) {
      // head: bigger, with eyes that look where it's going and a flicking tongue
      var h = g.snake[0], hx = ox + h[0] * CELL, hy = oy + h[1] * CELL, f = g.dir, sd = [-f[1], f[0]];
      var c0 = hx + CELL / 2, c1 = hy + CELL / 2;
      ctx.fillStyle = g.dead ? '#fff' : COL.lime;
      ctx.fillRect(hx, hy, CELL, CELL);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(hx + 1, hy + 1, CELL - 3, 2);
      for (var k = -1; k <= 1; k += 2) {
        var ex = Math.round(c0 + f[0] * 1 + sd[0] * 3 * k) - 2, ey = Math.round(c1 + f[1] * 1 + sd[1] * 3 * k) - 2;
        ctx.fillStyle = '#fff'; ctx.fillRect(ex, ey, 4, 4);
        ctx.fillStyle = '#06100a';
        if (g.dead) { ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex + 3, ey + 3, 1, 1); ctx.fillRect(ex + 1, ey + 1, 2, 2); ctx.fillRect(ex + 3, ey, 1, 1); ctx.fillRect(ex, ey + 3, 1, 1); }
        else ctx.fillRect(ex + 1 + f[0], ey + 1 + f[1], 2, 2);
      }
      if (!g.dead && (chomp > 0 || (t % 1.6) < 0.2)) {
        var tx = Math.round(c0 + f[0] * 6), ty = Math.round(c1 + f[1] * 6);
        ctx.fillStyle = chomp > 0 ? COL.yellow : COL.red;
        if (chomp > 0) { ctx.fillRect(tx - 2, ty - 2, 4, 4); }
        else {
          ctx.fillRect(tx + (f[0] < 0 ? -2 : 0), ty + (f[1] < 0 ? -2 : 0), f[0] ? 3 : 1, f[1] ? 3 : 1);
          ctx.fillRect(tx + f[0] * 3 + sd[0], ty + f[1] * 3 + sd[1], 1, 1); ctx.fillRect(tx + f[0] * 3 - sd[0], ty + f[1] * 3 - sd[1], 1, 1);
        }
      }
    }
    if (playing && game.acc < 0 && Math.floor(performance.now() / 400) % 2 === 0) Cabinet.text(ctx, 'SWIPE TO TURN', W / 2, H * 0.3, Cabinet.fs(2), COL.ink, 'center', '#000');
    fx.draw(ctx);
    fx.end(ctx, W, H);
  }

  /* Swipe anywhere; a short flick is enough. One continuous drag can zig-zag
     (right, then down) without lifting; buffered turns keep them in order. */
  var start0 = null;
  function turn(dx, dy) { if (game.turn(dx, dy)) Cabinet.beep(dy ? 300 : 340, 18, 'square', 0.03); }
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); start0 = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener('pointermove', function (e) {
    if (!start0 || start0.id !== e.pointerId || !playing || Cabinet.paused()) return;
    var dx = e.clientX - start0.x, dy = e.clientY - start0.y;
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1);
    start0.x = e.clientX; start0.y = e.clientY;
  });
  function up() { start0 = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  document.addEventListener('keydown', function (e) {
    var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[e.key];
    if (m && playing && !Cabinet.paused() && !Cabinet.overlayOpen()) { e.preventDefault(); turn(m[0], m[1]); }
  });

  Cabinet.setup({
    id: 'snake', scoresId: scoreId(), isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: 'Swipe anywhere to turn the snake.' },
      { icon: 'heart', text: 'Eat the red apples to grow. Gold apples are worth <b>50</b>!' },
      { icon: 'star', text: 'Don’t bite your own tail. Pick <b>Wrap around</b> to fly through the walls.' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || dying || game.dead) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new SnakeGame(wrap); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__snake = { game: function () { return game; }, start: start };
})();
