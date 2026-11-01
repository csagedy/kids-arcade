(function () {
  var canvas = document.getElementById('screen');
  // The river and road are only 13 rows, so don't stretch taller than about
  // 20: a longer screen was just sky and grass, with a tiny frog in between.
  var SCREEN = { minAspect: 0.62, maxAspect: 1.5, minShort: 230 };
  var ctx, game, playing = false, message = null, bg = null;
  var fx = new Cabinet.Fx(), COL = Cabinet.COL;

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h;
    bg = null;
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'lives', label: 'Frogs', hearts: true },
    { id: 'level', label: 'Level', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('lives', game.lives);
    Cabinet.setHud('level', game.level);
  }

  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; game = new FroggerGame(); }
    hud();
    Cabinet.attract({ title: 'Frogger', lines: ['Help the frog cross the road and the river to get home!'], scores: 'frogger',
      resume: pending && ('level ' + game.level + ', ' + game.score + ' points') })
      .then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; Cabinet.countdown(); }
        else Cabinet.firstHelp().then(start);
      });
  }

  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     Kept: level, score, frogs, the frogs already home, the fly, and how far
     up this frog has scored (so rows aren't paid twice). After a reload the
     frog starts again from the bottom strip (a frog that was mid-splat has
     used its life). A turn of the screen keeps the frog on its row, and the
     lanes are rebuilt for the new width with the frog's lane slid so it is
     on a log (or in a gap between cars), never dropped in the water. */
  function save() {
    var g = game, f = g.frog, lives = g.lives, dead = g.dead > 0;
    if (dead) lives--;
    if (lives <= 0) return null;   // that was the last frog
    return { score: g.score, level: g.level, lives: lives, homes: g.homes, time: g.time,
      up: dead ? 0 : g.startRow - f.row, fx: (f.x + f.w / 2) / W, best: g.startRow - g.bestRow,
      fly: g.fly, flyIn: g.flyIn };
  }
  function restore(d, live) {
    var C = Cabinet;
    layout();
    var g = new FroggerGame();
    g.level = C.int(d.level, 1, 9999);
    g.time = C.num(d.time, 0, 1e7);
    g.buildLanes();
    g.score = C.int(d.score, 0, 1e9);
    g.lives = C.int(d.lives, 1, 5);
    C.check(C.list(d.homes, 5).length === 5);
    g.homes = d.homes.map(C.bool);
    C.check(!g.homes.every(function (h) { return h; }));
    if (d.fly === null) g.fly = null;
    else { C.check(d.fly && typeof d.fly === 'object'); g.fly = { bay: C.int(d.fly.bay, 0, 4), t: C.num(d.fly.t, 0, 5) }; if (g.homes[g.fly.bay]) g.fly = null; }
    g.flyIn = C.num(d.flyIn, -100, 20);
    var up = C.int(d.up, 0, 11), best = C.int(d.best, 0, 11), f = g.frog;
    g.bestRow = g.startRow - best;
    if (live && up > 0) {
      f.row = g.startRow - up;
      f.x = Math.max(0, Math.min(W - f.w, Math.round(C.num(d.fx, 0, 1) * W - f.w / 2)));
      g.prev = { x: f.x, row: f.row };
      g.hopT = 99;
      safeLane(g);
    }
    game = g;
    fx.clear(); message = null; bg = null;
    hud();
  }
  /* Slide the frog's lane so it lands on a ride (or between cars). */
  function safeLane(g) {
    var lane = g.laneAt(g.frog.row);
    if (!lane) return;
    var cx = g.frog.x + g.frog.w / 2, best = null;
    var target = lane.kind === 'car' ? cx - lane.len - lane.gap / 2 : cx - lane.len / 2;
    for (var j = 0; j < lane.items.length; j++) {
      if (lane.kind === 'turtle' && lane.dives && j % 2 === 0) continue;   // only turtles that never dive
      var dd = target - lane.items[j];
      if (best === null || Math.abs(dd) < Math.abs(best)) best = dd;
    }
    if (best !== null) for (var k = 0; k < lane.items.length; k++) lane.items[k] += best;
  }
  Cabinet.keep({ id: 'frogger', save: save, restore: restore });

  function start() {
    Cabinet.stopCount();
    layout();
    game = new FroggerGame(); playing = true; fx.clear(); hud();
    say('HOP HOME FROGGY!', 1400, COL.green);
    Cabinet.sfx.start();
  }
  function say(t, ms, c) { message = { text: t, until: performance.now() + ms, color: c || COL.yellow }; }

  function rowY(r) { return OY + r * CELL; }
  function frogXY() { return { x: game.frog.x + game.frog.w / 2, y: rowY(game.frog.row) + CELL / 2 }; }

  /* React to a result from hop() or update(). */
  function react(r) {
    var p = frogXY();
    if (r === 'hop') { Cabinet.beep(440, 35, 'square', 0.05, 660); fx.burst(p.x, p.y + 5, 3, ['#ffffff', '#9fd4ff'], 20, 0.25, { gravity: 0 }); }
    else if (r === 'blocked') {
      if (game.bumped) { game.bumped = false; Cabinet.beep(160, 80, 'square', 0.06); say('SOMEONE\'S HOME!', 800, COL.orange); }
    }
    else if (r === 'home') {
      var b = game.lastBay;
      Cabinet.jingle([784, 988, 1175], 70, 90, 'square', 0.08);
      fx.burst(b.x, b.y, 20, [COL.green, COL.yellow, '#fff'], 70, 0.7, { angle: -Math.PI / 2, spread: 2.5 });
      fx.ring(b.x, b.y, COL.green, 18, 0.4);
      fx.pop('+50', b.x, b.y - 10, COL.green);
      say('SAFE!', 700, COL.green);
      if (game.gotFly) {
        Cabinet.sfx.coin();
        fx.burst(b.x, b.y, 16, [COL.yellow, '#fff'], 80, 0.7);
        fx.pop('+200', b.x, b.y - 22, COL.yellow, Cabinet.fs(2));
        say('YUM! BONUS FLY', 1100, COL.yellow);
      }
    } else if (r === 'level') {
      Cabinet.sfx.levelUp(); fx.flash('#fff', 0.35);
      fx.burst(W / 2, H / 3, 50, [COL.yellow, COL.pink, COL.cyan, COL.green], 110, 1.0);
      say('ALL HOME! LEVEL ' + game.level, 1600);
    } else if (r === 'die') {
      if (game.deathKind === 'splash') {
        Cabinet.noise(300, 0.16, 1400); Cabinet.beep(500, 300, 'sine', 0.1, 120);
        fx.burst(p.x, p.y, 22, ['#4cc2ff', '#9fd4ff', '#fff'], 70, 0.6, { angle: -Math.PI / 2, spread: 2 });
        say('SPLASH!', 900, COL.cyan);
      } else {
        Cabinet.noise(120, 0.18); Cabinet.beep(220, 260, 'square', 0.1, 60);
        fx.burst(p.x, p.y, 22, [COL.green, COL.lime, '#fff'], 80, 0.6);
        fx.shake(4); fx.flash(COL.red, 0.25);
        say('SPLAT!', 900, COL.red);
      }
      Cabinet.vibrate(60);
    }
    hud();
  }

  function update(dt) {
    fx.update(dt);
    if (!playing) { if (game) game.time += dt * 0; return; }
    var r = game.update(dt);
    if (r === 'die') react('die');
    else if (r === 'over') {
      playing = false;
      Cabinet.sfx.over();
      setTimeout(function () { Cabinet.gameOver('frogger', game.score, start, { stats: [{ label: 'Level', value: game.level }] }); }, 900);
    }
    hud();
  }

  /* ---------- art ---------- */
  function rot(rows) {   // turn a sprite a quarter clockwise
    var h = rows.length, w = rows[0].length, out = [];
    for (var x = 0; x < w; x++) { var line = ''; for (var y = h - 1; y >= 0; y--) line += rows[y][x]; out.push(line); }
    return out;
  }
  var FROG_SIT = [
    '............',
    '.g........g.',
    'gg.gg..gg.gg',
    '..gwkggkwg..',
    '..gggggggg..',
    '.gggllllggg.',
    '.ggllllllgg.',
    '.ggllllllgg.',
    '..gggggggg..',
    '...gggggg...',
    'gg.gg..gg.gg',
    'g..........g'
  ];
  var FROG_JUMP = [
    'g..........g',
    '.g........g.',
    '..gwkggkwg..',
    '..gggggggg..',
    '..gggggggg..',
    '.gggllllggg.',
    '.ggllllllgg.',
    '.ggllllllgg.',
    '..gggggggg..',
    '..g.gggg.g..',
    '.g........g.',
    'g..........g'
  ];
  // index by face: 1 up, 2 right, -1 down, -2 left
  var FROGS = {};
  [FROG_SIT, FROG_JUMP].forEach(function (base, j) {
    var r1 = rot(base), r2 = rot(r1), r3 = rot(r2);
    FROGS[j + ':1'] = base; FROGS[j + ':2'] = r1; FROGS[j + ':-1'] = r2; FROGS[j + ':-2'] = r3;
  });
  var FROG_PAL = { g: '#3ddc84', l: '#b6ff6a', w: '#ffffff', k: '#05060f' };
  function drawFrog(x, y, face, jump, pal) {
    Cabinet.sprite(ctx, FROGS[(jump ? 1 : 0) + ':' + face] || FROG_SIT, x, y, pal || FROG_PAL);
  }

  function drawVehicle(x, y, len, color, dir, edge) {
    x = Math.round(x);
    var front = dir > 0 ? x + len : x;
    ctx.fillStyle = '#111322';   // wheels
    ctx.fillRect(x + 2, y + 2, 4, 2); ctx.fillRect(x + len - 6, y + 2, 4, 2);
    ctx.fillRect(x + 2, y + 12, 4, 2); ctx.fillRect(x + len - 6, y + 12, 4, 2);
    if (len >= 32) {
      // truck: a long trailer and a cab at the front
      var cabX = dir > 0 ? x + len - 11 : x + 1;
      var trX = dir > 0 ? x + 1 : x + 12;
      ctx.fillStyle = '#d8e4ff'; ctx.fillRect(trX, y + 3, len - 13, 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(trX, y + 3, len - 13, 1);
      ctx.fillStyle = '#9aa8cc'; ctx.fillRect(trX, y + 12, len - 13, 1);
      ctx.fillStyle = color; ctx.fillRect(cabX, y + 4, 10, 8);
      ctx.fillStyle = edge; ctx.fillRect(cabX, y + 11, 10, 1);
      ctx.fillStyle = '#9fe6ff'; ctx.fillRect(dir > 0 ? cabX + 6 : cabX + 2, y + 5, 2, 6);
    } else {
      ctx.fillStyle = color; ctx.fillRect(x + 1, y + 4, len - 2, 8); ctx.fillRect(x, y + 5, len, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 2, y + 4, len - 4, 1);
      ctx.fillStyle = edge; ctx.fillRect(x + 1, y + 11, len - 2, 1);
      // roof and windows
      var roofW = Math.round(len * 0.45), roofX = dir > 0 ? x + Math.round(len * 0.3) : x + len - Math.round(len * 0.3) - roofW;
      ctx.fillStyle = '#9fe6ff'; ctx.fillRect(roofX - 1, y + 5, roofW + 2, 6);
      ctx.fillStyle = color; ctx.fillRect(roofX + 1, y + 6, roofW - 2, 4);
    }
    ctx.fillStyle = COL.yellow;   // headlights
    ctx.fillRect(dir > 0 ? front - 1 : front, y + 5, 1, 2); ctx.fillRect(dir > 0 ? front - 1 : front, y + 9, 1, 2);
  }
  var EDGE = { '#ffd23f': '#d69a00', '#ff9f43': '#c86a12', '#a77bff': '#6c45c9', '#4cc2ff': '#1a7fc0', '#ff4d6d': '#c12c47' };

  function drawLog(x, y, len) {
    x = Math.round(x);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x + 1, y + 3, len - 2, 10); ctx.fillRect(x, y + 4, len, 8);
    ctx.fillStyle = '#b3772e'; ctx.fillRect(x + 1, y + 4, len - 2, 3);
    ctx.fillStyle = '#5e3a17';
    for (var i = 6; i < len - 6; i += 9) { ctx.fillRect(x + i, y + 8, 4, 1); ctx.fillRect(x + i + 3, y + 10, 3, 1); }
    // cut ends with rings
    ctx.fillStyle = '#e8c08a'; ctx.fillRect(x, y + 5, 2, 6); ctx.fillRect(x + len - 2, y + 5, 2, 6);
    ctx.fillStyle = '#b3772e'; ctx.fillRect(x, y + 7, 1, 2); ctx.fillRect(x + len - 1, y + 7, 1, 2);
  }

  function drawTurtle(x, y, dir, t, warn, sink) {
    x = Math.round(x);
    var shell = warn ? (Math.floor(t * 6) % 2 ? '#ff7a7a' : '#3ddc84') : '#3ddc84';
    var dark = warn ? '#b0213f' : '#1f9a57';
    y += sink;
    var paddle = Math.floor(t * 4) % 2;
    ctx.fillStyle = '#b6ff6a';   // flippers and head
    ctx.fillRect(x + 2, y + 3 + paddle, 3, 2); ctx.fillRect(x + 11, y + 3 + paddle, 3, 2);
    ctx.fillRect(x + 2, y + 11 - paddle, 3, 2); ctx.fillRect(x + 11, y + 11 - paddle, 3, 2);
    ctx.fillRect(dir > 0 ? x + 14 : x - 1, y + 6, 3, 4);
    Cabinet.disc(ctx, x + 8, y + 8, 5, shell);
    ctx.fillStyle = dark; ctx.fillRect(x + 6, y + 6, 4, 4); ctx.fillRect(x + 4, y + 8, 1, 1); ctx.fillRect(x + 11, y + 8, 1, 1); ctx.fillRect(x + 8, y + 4, 1, 1); ctx.fillRect(x + 8, y + 12, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 6, y + 4, 3, 1);
  }

  function backdrop() {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), s = game.startRow, hr = game.homeRow;
    var y0 = rowY(hr), yWater = rowY(hr + 1), yMed = rowY(s - 6), yRoad = rowY(s - 5), yStart = rowY(s);
    // sky above the homes
    g.fillStyle = '#05060f'; g.fillRect(0, 0, W, H);
    for (var st = 0; st < W * y0 / 300; st++) { g.fillStyle = st % 5 ? '#2a3160' : '#8a90c0'; g.fillRect(Math.floor(Cabinet.hash(st) * W), Math.floor(Cabinet.hash(st + 500) * Math.max(1, y0 - 2)), 1, 1); }
    // hedge with bays
    g.fillStyle = '#1f6a3a'; g.fillRect(0, y0, W, CELL);
    g.fillStyle = '#2f8a4a';
    for (var hx = 0; hx < W; hx += 6) { g.fillRect(hx, y0 + 1 + (hx % 4), 4, 3); g.fillRect(hx + 2, y0 + 8 + (hx % 3), 3, 3); }
    // water
    g.fillStyle = '#123d8a'; g.fillRect(0, yWater, W, yMed - yWater);
    for (var b = 0; b < 5; b++) {
      var bx = Math.round(game.bayX(b));
      g.fillStyle = '#123d8a'; g.fillRect(bx - 14, y0 + 2, 28, CELL - 2);
      g.fillStyle = '#1f6a3a'; g.fillRect(bx - 15, y0 + 2, 1, CELL - 2); g.fillRect(bx + 14, y0 + 2, 1, CELL - 2);
      g.fillStyle = '#2fae5a'; g.fillRect(bx - 5, y0 + 9, 10, 4); g.fillRect(bx - 4, y0 + 8, 8, 6);   // lily pad
      g.fillStyle = '#123d8a'; g.fillRect(bx, y0 + 8, 1, 3);
    }
    // median: a purple sidewalk
    g.fillStyle = '#5a3a9a'; g.fillRect(0, yMed, W, CELL);
    g.fillStyle = '#7a5ac0'; for (var mx = 0; mx < W; mx += 8) { g.fillRect(mx, yMed + 1, 7, 6); g.fillRect(mx + 4, yMed + 9, 7, 6); }
    g.fillStyle = '#3d2670'; g.fillRect(0, yMed + 15, W, 1);
    // road with dashes
    g.fillStyle = '#1b1d30'; g.fillRect(0, yRoad, W, yStart - yRoad);
    g.fillStyle = '#4a4f6a';
    for (var r = 1; r < 5; r++) for (var dx = 4; dx < W; dx += 24) g.fillRect(dx, yRoad + r * CELL, 12, 1);
    g.fillStyle = '#ffd23f'; g.fillRect(0, yRoad, W, 1); g.fillRect(0, yStart - 1, W, 1);
    // start strip and grass below, with flowers
    g.fillStyle = '#5a3a9a'; g.fillRect(0, yStart, W, CELL);
    g.fillStyle = '#7a5ac0'; for (var sx = 0; sx < W; sx += 8) { g.fillRect(sx, yStart + 1, 7, 6); g.fillRect(sx + 4, yStart + 9, 7, 6); }
    g.fillStyle = '#1f5a2a'; g.fillRect(0, yStart + CELL, W, H - yStart - CELL);
    for (var f = 0; f < W * (H - yStart) / 160; f++) {
      var fx0 = Math.floor(Cabinet.hash(f) * W), fy0 = yStart + CELL + 2 + Math.floor(Cabinet.hash(f + 999) * Math.max(1, H - yStart - CELL - 4));
      g.fillStyle = ['#ff7ac6', '#ffd23f', '#ffffff', '#2f7a3a'][f % 4]; g.fillRect(fx0, fy0, 2, 2);
    }
    return c;
  }

  function render() {
    var g = game, t = g.time;
    if (!bg) bg = backdrop();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.drawImage(bg, 0, 0);
    var hr = g.homeRow;

    // shimmering water
    var yW = rowY(hr + 1), yM = rowY(g.startRow - 6);
    ctx.fillStyle = '#2a63c8';
    for (var w = 0; w < W * 5 / 16; w++) {
      var wy = yW + 3 + (w * 37) % (yM - yW - 4), wx = Math.round(((w * 53) + t * (w % 2 ? 9 : -7)) % W + W) % W;
      ctx.fillRect(wx, wy, 3, 1);
    }

    // homes: frogs at home and the bonus fly
    for (var b = 0; b < 5; b++) {
      var bx = Math.round(g.bayX(b)), by = rowY(hr);
      if (g.homes[b]) drawFrog(bx - 6, by + 2, -1, false);
      else if (g.fly && g.fly.bay === b && (g.fly.t > 1.5 || Math.floor(t * 8) % 2)) {
        var fxx = bx + Math.round(Math.sin(t * 7) * 4), fyy = by + 6 + Math.round(Math.cos(t * 9) * 2);
        ctx.fillStyle = Math.floor(t * 20) % 2 ? '#ffffff' : '#c8d8ff'; ctx.fillRect(fxx - 3, fyy - 2, 3, 2); ctx.fillRect(fxx + 1, fyy - 2, 3, 2);
        ctx.fillStyle = COL.yellow; ctx.fillRect(fxx - 1, fyy, 3, 3);
      }
    }

    g.lanes.forEach(function (l) {
      var y = rowY(l.row);
      l.items.forEach(function (x, ix) {
        if (l.kind === 'turtle') {
          var st = g.turtleState(l, ix);
          for (var k = 0; k < l.len; k += 16) {
            if (st === 2) { ctx.fillStyle = '#9fd4ff'; ctx.fillRect(Math.round(x + k + 6), y + 7 + (Math.floor(t * 4 + k) % 3), 2, 2); continue; }
            drawTurtle(x + k, y, l.dir, t + k * 0.1, st === 1, st === 1 ? 1 : 0);
          }
        } else if (l.kind === 'log') drawLog(x, y, l.len);
        else drawVehicle(x, y, l.len, l.color, l.dir, EDGE[l.color] || '#333');
      });
    });

    // frog: slides between cells over a hop, with a jump pose
    var f = g.frog;
    if (g.dead) {
      var dt0 = 50 - g.dead, fy = rowY(f.row) + 2;
      if (g.deathKind === 'splash') {
        if (dt0 < 20) drawFrog(f.x, fy + Math.round(dt0 * 0.3), g.face, false, { g: '#2fae5a', l: '#7fd46a', w: '#9fd4ff', k: '#123d8a' });
        ctx.strokeStyle = '#9fd4ff'; ctx.lineWidth = 1;
        for (var rr = 0; rr < 2; rr++) {
          var rad = (dt0 + rr * 8) % 24;
          ctx.globalAlpha = 1 - rad / 24;
          ctx.strokeRect(Math.round(f.x + 6 - rad * 0.6) + 0.5, Math.round(fy + 6 - rad * 0.3) + 0.5, Math.round(rad * 1.2), Math.round(rad * 0.6));
        }
        ctx.globalAlpha = 1;
      } else {
        // flattened, with dizzy eyes
        ctx.fillStyle = g.dead % 10 < 5 ? COL.green : COL.lime;
        ctx.fillRect(Math.round(f.x) - 3, fy + 4, f.w + 6, 5);
        ctx.fillStyle = '#05060f';
        ctx.fillRect(Math.round(f.x) + 2, fy + 5, 1, 1); ctx.fillRect(Math.round(f.x) + 3, fy + 6, 1, 1); ctx.fillRect(Math.round(f.x) + 4, fy + 5, 1, 1);
        ctx.fillRect(Math.round(f.x) + 7, fy + 5, 1, 1); ctx.fillRect(Math.round(f.x) + 8, fy + 6, 1, 1); ctx.fillRect(Math.round(f.x) + 9, fy + 5, 1, 1);
        for (var sp = 0; sp < 3; sp++) {   // little stars spinning overhead
          var a = t * 6 + sp * 2.1;
          ctx.fillStyle = COL.yellow; ctx.fillRect(Math.round(f.x + 6 + Math.cos(a) * 8), Math.round(fy - 2 + Math.sin(a) * 3), 1, 1);
        }
      }
    } else {
      var k2 = Math.min(1, g.hopT / 7), pv = g.prev || f;
      var dx = pv.x + (f.x - pv.x) * k2, dy = rowY(pv.row) + (rowY(f.row) - rowY(pv.row)) * k2;
      var lift = g.hopT < 7 ? Math.round(Math.sin(k2 * Math.PI) * 2) : 0;
      if (lift) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(dx) + 2, Math.round(dy) + 12, 8, 2); }
      drawFrog(dx, dy + 2 - lift, g.face, g.hopT < 6);
    }

    fx.draw(ctx);
    if (message && performance.now() < message.until) Cabinet.text(ctx, message.text, W / 2, Math.round(rowY(g.startRow - 6) + 4), Cabinet.fs(2), message.color, 'center', '#000');
    // first-hop hint: an arrow over the frog
    if (playing && g.bestRow === g.startRow && f.row === g.startRow && !g.dead && Math.floor(performance.now() / 400) % 2) {
      var ax = Math.round(f.x + 6), ay = rowY(f.row) - 10;
      ctx.fillStyle = COL.yellow;
      for (var i = 0; i < 4; i++) ctx.fillRect(ax - i, ay + i, i * 2 + 1, 1);
      ctx.fillRect(ax - 1, ay + 4, 3, 4);
      Cabinet.text(ctx, 'TAP UP HERE', ax, ay - 12, Cabinet.fs(1), COL.ink, 'center', '#000');
    }
    fx.end(ctx, W, H);
  }

  /* Tap relative to the frog: above hops up, below hops down, beside sidesteps. */
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!playing || Cabinet.paused()) return;
    var p = Cabinet.pointer(canvas, e);
    var c = frogXY(), dx = p.x - c.x, dy = p.y - c.y;
    var r = Math.abs(dx) > Math.abs(dy) * 1.6 ? game.hop(dx > 0 ? 1 : -1, 0) : game.hop(0, dy < 0 ? 1 : -1);
    react(r);
  });
  document.addEventListener('keydown', function (e) {
    var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!m || !playing || Cabinet.paused() || Cabinet.overlayOpen()) return;
    e.preventDefault();
    react(game.hop(m[0], m[1]));
  });

  Cabinet.setup({
    id: 'frogger', isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: 'Tap <b>above</b> the frog to hop up, <b>beside</b> it to hop sideways.' },
      { icon: 'heart', text: 'Dodge the cars. In the river, ride the logs and turtles: the water is too deep!' },
      { icon: 'star', text: 'Red-blinking turtles are about to dive. Hop off!' },
      { icon: 'home', text: 'Fill all five lily pads. Catch a fly in a bay for <b>+200</b>.' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || game.over) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new FroggerGame(); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__frog = { game: function () { return game; }, start: start };
})();
