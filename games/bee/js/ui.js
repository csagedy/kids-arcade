/* Busy Bee: drawing, input, sound and the cabinet glue (see js/game.js for
   the design note and the rules). */
(function () {
  var canvas = document.getElementById('screen');
  var stage = document.querySelector('.k-stage');
  var SCREEN = { minAspect: 0.5, maxAspect: 2, minShort: 170 };
  var W = 240, H = 320;
  var ctx, game, playing = false, message = null, hint = 0, moved = false;
  var bg = null, flies = [];
  var fx = new Cabinet.Fx(), COL = Cabinet.COL;

  function layout() {
    var s = Cabinet.screen(canvas, SCREEN);
    ctx = s.ctx; W = s.w; H = s.h;
    bg = null;
    flies = [];
    for (var i = 0; i < 7; i++) flies.push({ x: Cabinet.hash(i + 40) * W, y: Cabinet.hash(i + 90) * H, p: Cabinet.hash(i + 7) * 6 });
  }

  Cabinet.hud([
    { id: 'score', label: 'Score', accent: true },
    { id: 'lives', label: 'Hearts', hearts: true },
    { id: 'level', label: 'Level', more: true }
  ]);
  function hud() {
    Cabinet.setHud('score', game.score);
    Cabinet.setHud('lives', game.lives);
    Cabinet.setHud('level', game.level);
  }

  /* ---------- the attract card and starting ---------- */
  var pending = null;   // a saved round, waiting behind the attract card
  function attract() {
    playing = false;
    layout();
    pending = Cabinet.loadSave();
    if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; game = new BeeGame(W, H, true); }
    hud();
    Cabinet.attract({ title: 'Busy Bee', lines: ['Fly to the flowers, bring the pollen home and fill the hive with honey!'], scores: 'bee',
      resume: pending && ('level ' + game.level + ', ' + game.score + ' points') })
      .then(function (v) {
        pending = null;
        if (v === 'continue') { playing = true; moved = true; Cabinet.countdown(); }
        else Cabinet.firstHelp().then(start);
      });
  }

  function start() {
    Cabinet.stopCount();
    layout();
    game = new BeeGame(W, H, false);
    playing = true; moved = false; hint = 7;
    fx.clear(); message = null;
    hud();
    say('FLY TO A FLOWER!', 1800);
    Cabinet.sfx.start();
  }
  function say(t, ms, c) { message = { text: t, until: performance.now() + ms, color: c || COL.yellow }; }

  /* ---------- keeping the round (reload, iOS dropping the tab, a turn of the screen) ----------
     Kept: score, hearts, level, honey, the pollen being carried, and every
     flower, wasp and spilled pollen ball as shares of the meadow (so the
     round fits any shape of screen; the hive is always in the middle). After
     a reload the bee waits at the hive door, which is safe; a turn keeps it
     where it was. Either way it comes back blinking (safe for a moment). */
  var KINDS = ['n', 'gold', 'heart'], MODES = ['wander', 'chase', 'bored', 'leave'];
  function save() {
    var g = game, b = g.bee;
    if (g.over || g.demo) return null;
    return {
      score: g.score, lives: g.lives, level: g.level, honey: g.honey, t: g.t,
      waspTimer: g.waspTimer, spiderTimer: g.spiderTimer, grace: g.levelGrace,
      bee: [b.x / W, b.y / H, b.carry],
      flowers: g.flowers.map(function (f) { return [f.x / W, f.y / H, KINDS.indexOf(f.kind), FLOWER_COLS.indexOf(f.col), f.age, f.life]; }),
      wasps: g.wasps.map(function (a) { return [a.x / W, a.y / H, MODES.indexOf(a.mode)]; }),
      crumbs: g.crumbs.map(function (c) { return [c.x / W, c.y / H, c.t]; }),
      spider: g.spider ? [g.spider.x / W, g.spider.ty / H] : null
    };
  }
  function restore(d, live) {
    var C = Cabinet;
    layout();
    var g = new BeeGame(W, H, false);
    g.score = C.int(d.score, 0, 1e9);
    g.lives = C.int(d.lives, 1, 3);
    g.level = C.int(d.level, 1, 999);
    g.need = g.needFor(g.level);
    g.honey = C.int(d.honey, 0, g.need - 1);
    g.t = C.num(d.t, 0, 1e7);
    g.waspTimer = C.num(d.waspTimer, -100, 100);
    g.spiderTimer = Math.max(3, C.num(d.spiderTimer, -100, 100));
    g.levelGrace = C.num(d.grace, -100, 5);
    C.list(d.bee, 3);
    var b = g.bee;
    b.carry = C.int(d.bee[2], 0, BEE.CARRY_MAX);
    if (live) { b.x = C.num(d.bee[0], 0, 1) * W; b.y = C.num(d.bee[1], 0, 1) * H; }
    else { C.num(d.bee[0], 0, 1); C.num(d.bee[1], 0, 1); b.x = g.hive.x; b.y = g.hive.y - 26; }
    b.invuln = 2.5;
    g.flowers = [];
    C.list(d.flowers, 12).forEach(function (q) {
      C.list(q, 6);
      var f = { x: C.num(q[0], 0, 1) * W, y: C.num(q[1], 0, 1) * H, kind: KINDS[C.int(q[2], 0, 2)], col: FLOWER_COLS[C.int(q[3], 0, FLOWER_COLS.length - 1)],
        age: C.num(q[4], 0, 60), life: C.num(q[5], 1, 60) };
      // a turn can squeeze a flower into the hive's yard: let it go
      if (Math.hypot(f.x - g.hive.x, f.y - g.hive.y) > BEE.SAFE_R + 6) g.flowers.push(f);
    });
    g.wasps = C.list(d.wasps, 12).map(function (q) {
      C.list(q, 3);
      var m = MODES[C.int(q[2], 0, 3)];
      var a = { x: C.num(q[0], -0.3, 1.3) * W, y: C.num(q[1], -0.3, 1.3) * H, vx: 0, vy: 0, mode: m === 'chase' ? 'bored' : m, t: 0, face: 1 };
      g.pickWander(a);
      return a;
    });
    g.crumbs = C.list(d.crumbs, 12).map(function (q) {
      C.list(q, 3);
      return { x: C.num(q[0], 0, 1) * W, y: C.num(q[1], 0, 1) * H, vx: 0, vy: 0, z: 0, vz: 0, t: Math.max(2.5, C.num(q[2], -10, 10)) };
    });
    if (d.spider !== null) {
      C.list(d.spider, 2);
      C.num(d.spider[0], 0, 1); C.num(d.spider[1], 0, 1);
      // a dangling spider goes back up its thread and comes again later
      g.spider = null; g.spiderTimer = Math.max(g.spiderTimer, 4);
    }
    g.target = null;
    game = g;
    fx.clear(); message = null; hint = 0;
    hud();
  }
  Cabinet.keep({ id: 'bee', save: save, restore: restore });

  /* ---------- update ---------- */
  var PICK_NOTES = [0, 659, 740, 831, 932, 1047, 1175];
  function update(dt) {
    fx.update(dt);
    flies.forEach(function (f) { f.p += dt; });
    if (!game) return;
    if (!playing) {
      // the attract screen: the bee plays by itself
      if (game.demo) { autopilot(); game.update(dt); game.fx.length = 0; }
      return;
    }
    if (hint > 0) hint -= dt;
    if (keys.x || keys.y) {
      var b = game.bee, t = game.target || { x: b.x, y: b.y };
      game.setTarget(t.x + keys.x * 160 * dt, t.y + keys.y * 160 * dt);
      moved = true;
    }
    var ev = game.update(dt);
    effects();
    for (var i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case 'pick': Cabinet.beep(PICK_NOTES[game.bee.carry] || 1175, 70, 'square', 0.07); Cabinet.beep((PICK_NOTES[game.bee.carry] || 1175) * 1.5, 90, 'triangle', 0.06, 0, 0.06); break;
        case 'crumb': Cabinet.beep(PICK_NOTES[game.bee.carry] || 1175, 50, 'square', 0.06); break;
        case 'gold': Cabinet.sfx.power(); break;
        case 'heart': Cabinet.sfx.coin(); say('EXTRA HEART!', 1100, COL.pink); break;
        case 'full': Cabinet.beep(330, 80, 'square', 0.07); Cabinet.beep(262, 120, 'square', 0.07, 0, 0.09); say('FULL! FLY HOME', 1200, COL.orange); break;
        case 'bank':
          var n = game.fxLastBank || 1, notes = [];
          for (var k = 0; k < n; k++) notes.push(523 * Math.pow(2, [0, 4, 7, 12, 16, 19][k] / 12));
          Cabinet.jingle(notes, 65, 90, 'square', 0.07);
          break;
        case 'notice': Cabinet.beep(700, 90, 'square', 0.05, 1100); Cabinet.noise(160, 0.05, 600); break;
        case 'wasp': Cabinet.noise(260, 0.06, 450); break;
        case 'spider': Cabinet.beep(1200, 500, 'triangle', 0.05, 300); break;
        case 'hurt':
          Cabinet.sfx.lose(); fx.shake(5); fx.flash(COL.red, 0.3); Cabinet.vibrate(80);
          say('OUCH!', 900, COL.orange);
          break;
        case 'level':
          Cabinet.sfx.levelUp(); fx.flash(COL.yellow, 0.3);
          say('LEVEL ' + game.level + '!', 1800);
          break;
        case 'over':
          playing = false;
          fx.shake(7); fx.flash(COL.red, 0.45);
          Cabinet.sfx.over(); Cabinet.vibrate(160);
          say('OH NO!', 1400, COL.orange);
          var g = game;
          setTimeout(function () { Cabinet.gameOver('bee', g.score, start, { stats: [{ label: 'Level', value: g.level }] }); }, 1300);
          break;
      }
    }
    hud();
  }

  // pick the effects out of the game's queue
  function effects() {
    var q = game.fx;
    for (var i = 0; i < q.length; i++) {
      var e = q[i];
      switch (e.k) {
        case 'pick':
          fx.burst(e.x, e.y, 12, [COL[e.col] || COL.pink, '#fff', COL.yellow], 55, 0.5, { gravity: 40 });
          fx.ring(e.x, e.y, COL[e.col] || COL.pink, 12, 0.3);
          fx.pop(e.carry + '', e.x, e.y - 12, COL.yellow);
          break;
        case 'crumb': fx.burst(e.x, e.y, 5, [COL.yellow, COL.orange], 30, 0.3, { gravity: 0 }); break;
        case 'gold':
          fx.burst(e.x, e.y, 22, [COL.yellow, '#fff', COL.orange], 80, 0.7, { gravity: 30 });
          fx.ring(e.x, e.y, COL.yellow, 18, 0.4); fx.pop('+50', e.x, e.y - 12, COL.yellow);
          break;
        case 'heart':
          fx.burst(e.x, e.y, 16, [COL.pink, COL.red, '#fff'], 60, 0.6, { gravity: -20 });
          fx.ring(e.x, e.y, COL.pink, 16, 0.4);
          break;
        case 'bank':
          game.fxLastBank = e.n;
          fx.burst(e.x, e.y - 6, 8 + e.n * 5, [COL.yellow, COL.orange, '#fff'], 55 + e.n * 8, 0.7, { angle: -Math.PI / 2, spread: 2.4, gravity: 120 });
          fx.ring(e.x, e.y, COL.yellow, 16 + e.n * 3, 0.45);
          fx.pop('+' + e.pts, e.x, e.y - 24, e.n >= 4 ? COL.pink : COL.yellow, e.n >= 4 ? Cabinet.fs(2) : undefined);
          if (e.n >= 4) fx.shake(2);
          if (e.n >= 5) say(e.n === 6 ? 'HONEY HERO!' : 'SWEET!', 1000, COL.pink);
          hivePulse = 0.35;
          break;
        case 'level':
          for (var k = 0; k < 4; k++) fx.burst(W * (0.2 + 0.2 * k), H * 0.35, 14, [COL.yellow, COL.pink, COL.cyan, '#fff'], 90, 0.9, { gravity: 80 });
          break;
        case 'hurt': fx.burst(e.x, e.y, 18, ['#fff', COL.yellow, COL.orange], 70, 0.6, { gravity: 0 }); fx.ring(e.x, e.y, COL.red, 14, 0.3); break;
        case 'full': fx.ring(e.x, e.y, COL.orange, 12, 0.3); break;
      }
    }
    q.length = 0;
  }

  // the attract screen's bee: to the nearest flower, home with three
  function autopilot() {
    var g = game, b = g.bee, goal = null;
    if (b.carry >= 3) goal = g.hive;
    else {
      var best = 1e9;
      g.flowers.forEach(function (f) { var d = Math.hypot(f.x - b.x, f.y - b.y); if (f.age > 0.5 && d < best) { best = d; goal = f; } });
    }
    if (goal) g.setTarget(goal.x, goal.y); else g.setTarget(g.hive.x + Math.sin(Cabinet.time) * 40, g.hive.y - 30);
  }

  /* ---------- sprites ---------- */
  // facing right; flipped for left
  var BEE_BODY = [
    '.....oooooo.....',
    '...oykkykkyyo...',
    '..ohhkkykkyyyo..',
    '.ohyykkykkywwyo.',
    '.oyyykkykkywkyo.',
    'soyyykkykkywkyo.',
    '.oyyykkykkpyyko.',
    '.oyyykkykkykkyo.',
    '..oyykkykkyyyo..',
    '...oykkykkyyo...',
    '.....oooooo.....'
  ];
  var BEE_WING = [
    ['.www.www.', 'wcccwcccw', 'wcccwcccw', '.www.www.'],
    ['.........', '.www.www.', 'wcccwcccw', '.wwwwwww.']
  ];
  var WASP_BODY = [
    '...........oooo.',
    '..ooooooo.obbrro',
    '.orkrrkrroorrbbo',
    '.orkrrkrrorrrwwo',
    'srrkrrkrrorrrwko',
    '.orkrrkrroorkkro',
    '.orkrrkrro.oooo.',
    '..ooooooo.......'
  ];
  var FLOWER = [
    '...cc.cc...',
    '..cdccdcc..',
    '.ccyyyyycc.',
    'ccyyyyyyycc',
    '.cykyyykyc.',
    'ccykyyykycc',
    '.cpkyyykpc.',
    'ccyykkkyycc',
    '.ccyyyyycc.',
    '..ccccccc..',
    '...cc.cc...'
  ];
  var FLOWER_BLINK = [
    '...cc.cc...',
    '..cdccdcc..',
    '.ccyyyyycc.',
    'ccyyyyyyycc',
    '.cyyyyyyyc.',
    'cckkyyykkcc',
    '.cpkyyykpc.',
    'ccyykkkyycc',
    '.ccyyyyycc.',
    '..ccccccc..',
    '...cc.cc...'
  ];
  var BUD = ['.c.', 'ccc', 'ccc', '.g.'];
  var HEART = ['.ppp.ppp.', 'pwwpppppp', 'pwppppppp', 'ppppppppp', '.ppppppp.', '..ppppp..', '...ppp...', '....p....'];
  var SPIDER = [
    'l...ppp...l',
    '.l.ppppp.l.',
    '..lpppppl..',
    'llpwwpwwpll',
    '..pkwpkwp..',
    '.lpppppppl.',
    'l.lpppppl.l',
    '...l...l...'
  ];
  var SPIDER2 = [
    '....ppp....',
    'l..ppppp..l',
    '.llpppppll.',
    '..pwwpwwp..',
    'llpkwpkwpll',
    '..ppppppp..',
    '.llpppppll.',
    'l..l...l..l'
  ];
  var DARK = { pink: '#7a2f5c', cyan: '#2f6c78', purple: '#4f3a85', orange: '#7a4a1e', blue: '#253f80', red: '#7a2633' };

  /* ---------- the meadow (drawn once per layout) ---------- */
  // smooth value noise, then an ordered dither between a few greens: soft
  // patches of grass that are still made of crisp pixels
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function vnoise(x, y, cell, seed) {
    var gx = Math.floor(x / cell), gy = Math.floor(y / cell), fx = x / cell - gx, fy = y / cell - gy;
    function v(i, j) { return Cabinet.hash(i * 57 + j * 131 + seed); }
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = v(gx, gy) + (v(gx + 1, gy) - v(gx, gy)) * fx, b = v(gx, gy + 1) + (v(gx + 1, gy + 1) - v(gx, gy + 1)) * fx;
    return a + (b - a) * fy;
  }
  function meadow() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var hx = Math.round(W / 2), hy = Math.round(H / 2) + 2;
    var SH = ['#081a12', '#0b2216', '#0f2b1c', '#133422'];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var n = vnoise(x, y, 22, 3) * 0.7 + vnoise(x, y, 7, 9) * 0.3;
      // darker toward the edges, a touch lighter round the hive
      var ex = Math.min(x, W - 1 - x, y, H - 1 - y);
      if (ex < 10) n -= (10 - ex) * 0.035;
      var v = n * 3 + BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.5;
      g.fillStyle = SH[Math.max(0, Math.min(3, Math.floor(v)))];
      g.fillRect(x, y, 1, 1);
    }
    // the hive's yard: a worn round patch of earth
    for (var yy = -12; yy <= 12; yy++) for (var xx = -26; xx <= 26; xx++) {
      var e = (xx * xx) / (26 * 26) + (yy * yy) / (12 * 12);
      if (e > 1) continue;
      var tone = e + BAYER[((yy + 64) % 4) * 4 + ((xx + 64) % 4)] / 16 * 0.5;
      if (tone < 0.75) { g.fillStyle = tone < 0.4 ? '#2a2414' : '#1f2616'; g.fillRect(hx + xx, hy + 10 + yy, 1, 1); }
    }
    // grass tufts
    for (var k = 0; k < W * H / 170; k++) {
      var tx = Math.floor(Cabinet.hash(k + 900) * W), ty = Math.floor(Cabinet.hash(k + 1900) * H);
      if (Math.abs(tx - hx) < 24 && Math.abs(ty - hy - 10) < 10) continue;
      var light = Cabinet.hash(k + 2900);
      g.fillStyle = light < 0.45 ? '#1b4a2e' : light < 0.85 ? '#246038' : '#2f7a46';
      g.fillRect(tx, ty, 1, 2); g.fillRect(tx - 1, ty - 1, 1, 1); g.fillRect(tx + 1, ty - 1, 1, 1);
      if (light > 0.7) g.fillRect(tx + 2, ty - 2, 1, 1);
    }
    // tiny sleeping daisies, clovers and pebbles
    for (var d = 0; d < W * H / 1800; d++) {
      var dx = Math.floor(Cabinet.hash(d + 5000) * W), dy = Math.floor(Cabinet.hash(d + 6000) * H), kind = Cabinet.hash(d + 7000);
      if (Math.hypot(dx - hx, (dy - hy) * 1.4) < 44) continue;
      if (kind < 0.4) {
        g.fillStyle = '#4b5878'; g.fillRect(dx - 1, dy, 3, 1); g.fillRect(dx, dy - 1, 1, 3);
        g.fillStyle = '#9a8a3e'; g.fillRect(dx, dy, 1, 1);
      } else if (kind < 0.8) {
        g.fillStyle = '#1f6b3c'; g.fillRect(dx, dy, 2, 2); g.fillRect(dx + 2, dy + 1, 2, 2); g.fillRect(dx + 1, dy + 2, 2, 2);
        g.fillStyle = '#2a8a4c'; g.fillRect(dx, dy, 1, 1);
      } else {
        g.fillStyle = '#2b3348'; g.fillRect(dx, dy, 3, 2); g.fillStyle = '#3e4862'; g.fillRect(dx, dy, 2, 1);
      }
    }
    return c;
  }

  /* ---------- drawing ---------- */
  var hivePulse = 0;
  function drawHive(g, t) {
    var hx = g.hive.x, hy = g.hive.y, pulse = hivePulse > 0 ? 2 : 0;
    // the safe zone: a slow ring of dashes
    var n = 28;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + t * 0.2;
      if (i % 2) continue;
      ctx.fillStyle = 'rgba(255, 210, 63, 0.5)';
      ctx.fillRect(Math.round(hx + Math.cos(a) * BEE.SAFE_R), Math.round(hy + 2 + Math.sin(a) * BEE.SAFE_R * 0.8), 2, 1);
    }
    // straw skep: bands from the base up
    var bands = [30, 30, 29, 27, 24, 20, 14, 8];
    var base = hy + 11;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(hx - 17, base, 34, 2); ctx.fillRect(hx - 14, base + 2, 28, 1);
    for (var b = 0; b < bands.length; b++) {
      var w = bands[b] + pulse, y = base - b * 3 - 3, x0 = Math.round(hx - w / 2);
      ctx.fillStyle = '#5a3008'; ctx.fillRect(x0, y + 2, w, 1);
      ctx.fillStyle = b % 2 ? '#f2b640' : '#e0a02e'; ctx.fillRect(x0, y, w, 2);
      ctx.fillStyle = '#ffe28e'; ctx.fillRect(x0 + 2, y, Math.max(1, Math.round(w * 0.22)), 1);
      ctx.fillStyle = '#a8681a'; ctx.fillRect(x0 + w - 3, y, 2, 2);
      // straw stitches
      for (var s = x0 + 3 + (b % 2) * 2; s < x0 + w - 3; s += 5) { ctx.fillStyle = '#b87822'; ctx.fillRect(s, y + 1, 1, 1); }
    }
    ctx.fillStyle = '#5a3008'; ctx.fillRect(hx - 2, base - 27, 4, 3);   // top knob
    ctx.fillStyle = '#e0a02e'; ctx.fillRect(hx - 1, base - 27, 2, 1);
    // door, glowing a little when honey's coming
    ctx.fillStyle = '#1a0d02'; ctx.fillRect(hx - 4, base - 6, 8, 6); ctx.fillRect(hx - 3, base - 7, 6, 1);
    if (g.bee.carry > 0) { ctx.fillStyle = Math.floor(t * 4) % 2 ? '#5a3a08' : '#3a2404'; ctx.fillRect(hx - 3, base - 5, 6, 5); }
    // honey dripping down the front, more as the hive fills
    var f = g.honey / g.need;
    var drips = [[-10, 0.1], [8, 0.3], [-5, 0.5], [11, 0.7], [3, 0.85]];
    drips.forEach(function (d) {
      if (f < d[1]) return;
      var len = 2 + Math.round((Math.sin(t * 1.3 + d[0]) + 1) * 1.5);
      ctx.fillStyle = COL.yellow; ctx.fillRect(hx + d[0], base - 21, 2, len + 2); ctx.fillRect(hx + d[0], base - 19 + len, 1, 2);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(hx + d[0], base - 21, 1, 1);
    });
    // a sleepy friend peeks out of the door now and then
    if (Math.floor(t / 2.5) % 3 === 1) {
      ctx.fillStyle = COL.yellow; ctx.fillRect(hx - 2, base - 5, 4, 3);
      ctx.fillStyle = '#2a1a08'; ctx.fillRect(hx - 1, base - 5, 1, 3); ctx.fillStyle = '#fff'; ctx.fillRect(hx + 1, base - 5, 1, 1);
    }
    // honey bar under the hive: a row of honeycomb cells
    var cells = Math.min(g.need, 15), per = g.need / cells, cw = 3, bw = cells * cw + 1, bx = Math.round(hx - bw / 2), by = base + 5;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    for (var k = 0; k < cells; k++) {
      var full = g.honey >= (k + 1) * per - 0.001;
      ctx.fillStyle = full ? COL.yellow : '#3a2a0a';
      ctx.fillRect(bx + 1 + k * cw, by, cw - 1, 4);
      if (full) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(bx + 1 + k * cw, by, 1, 1); }
    }
  }

  function drawFlower(f, t, seed) {
    var x = Math.round(f.x), y = Math.round(f.y), left = f.life - f.age;
    var c = f.kind === 'gold' ? COL.yellow : COL[f.col] || COL.pink;
    // stem and leaves
    ctx.fillStyle = '#2f9a52'; ctx.fillRect(x, y + 4, 1, 8);
    ctx.fillStyle = '#3ddc84'; ctx.fillRect(x + 1, y + 8, 2, 1); ctx.fillRect(x + 2, y + 7, 1, 1); ctx.fillRect(x - 2, y + 10, 2, 1); ctx.fillRect(x - 3, y + 9, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 2, y + 12, 5, 1);
    if (f.age < 0.45 || left < 0.35) {
      Cabinet.sprite(ctx, BUD, x - 1, y + (f.age < 0.2 || left < 0.15 ? 3 : 1), { c: c, g: '#2f9a52' });
      return;
    }
    if (f.kind === 'heart') {
      var hb = Math.round(Math.sin(t * 4 + seed) * 1.2);
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 6); ctx.strokeStyle = COL.pink;
      ctx.beginPath(); ctx.arc(x + 0.5, y + hb + 0.5, 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      Cabinet.sprite(ctx, HEART, x - 4, y - 4 + hb, { p: COL.red, w: '#fff' });
      return;
    }
    var wilting = left < 2 && Math.floor(t * 6) % 2;
    var pal = wilting ? { c: DARK[f.col] || '#555', d: '#444', y: '#8a7a3a', k: '#1a1030', p: '#8a7a3a' }
      : { c: c, d: f.kind === 'gold' ? '#fffbe0' : '#ffffff', y: f.kind === 'gold' ? '#fff6c8' : COL.yellow, k: '#1a1030', p: f.kind === 'gold' ? COL.orange : '#ff9fb0' };
    var ph = (t * 0.7 + seed) % 4;
    // a little sway, and a pop when it has just opened
    var sway = Math.round(Math.sin(t * 2 + seed) * 0.6);
    var popUp = f.age < 0.6 ? -1 : 0;
    Cabinet.sprite(ctx, ph < 0.12 ? FLOWER_BLINK : FLOWER, x - 5 + sway, y - 5 + popUp, pal);
    // pollen sparkle
    if (!wilting && Math.floor(t * 5 + seed * 3) % 8 < 4) {
      var a = seed + Math.floor(t * 5 + seed * 3) * 1.7;
      ctx.fillStyle = f.kind === 'gold' ? '#fff' : COL.yellow;
      ctx.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y + Math.sin(a) * 8), 1, 1);
    }
    if (f.kind === 'gold') {
      var k = Math.floor(t * 8) % 4;
      ctx.fillStyle = '#fff';
      var sp = [[-7, -7], [7, -6], [7, 5], [-7, 4]][k];
      ctx.fillRect(x + sp[0], y + sp[1] - 1, 1, 3); ctx.fillRect(x + sp[0] - 1, y + sp[1], 3, 1);
    }
  }

  var bodyPal = { o: '#2a1a08', y: '#ffd23f', h: '#fff3b0', k: '#2a1a08', w: '#ffffff', p: '#ff7ac6', s: '#2a1a08' };
  var wingPal = { w: '#e8f6ff', c: '#8fdcff' };
  var waspPal = { o: '#1a0508', r: '#ff5a4a', k: '#1a0508', w: '#ffffff', b: '#1a0508', s: '#1a0508' };
  var spiderPal = { l: '#c9b8ff', p: '#a77bff', w: '#ffffff', k: '#1a1030' };

  function drawBee(g, t) {
    var b = g.bee, flip = b.face < 0;
    if (b.invuln > 0 && !g.over && Math.floor(b.invuln * 10) % 2) return;
    var bob = Math.round(Math.sin(t * 7) * 1);
    var x = Math.round(b.x) - 8, y = Math.round(b.y) - 5 + bob;
    // shadow on the grass
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(b.x) - 4, Math.round(b.y) + 10, 9, 2);
    // pollen balls hanging on its legs
    var spots = [[-3, 10], [1, 10], [-5, 13], [-1, 13], [3, 13], [-3, 16]];
    for (var i = 0; i < b.carry; i++) {
      var sx = Math.round(b.x) + (flip ? -spots[i][0] - 2 : spots[i][0]), sy = y + spots[i][1];
      ctx.fillStyle = '#2a1a08'; ctx.fillRect(sx + 1, sy - 1, 1, 1);
      ctx.fillStyle = '#c0650f'; ctx.fillRect(sx, sy, 3, 3);
      ctx.fillStyle = COL.orange; ctx.fillRect(sx, sy, 2, 2);
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(sx, sy, 1, 1);
    }
    var wing = BEE_WING[(g.over ? 0 : Math.floor(t * 22)) % 2];
    Cabinet.sprite(ctx, wing, x + (flip ? 3 : 4), y - 3, wingPal, flip);
    var pal = bodyPal;
    if (g.over || b.dizzy > 0) pal = { o: '#2a1a08', y: '#ffd23f', h: '#fff3b0', k: '#2a1a08', w: '#2a1a08', p: '#ff7ac6', s: '#2a1a08' };
    Cabinet.sprite(ctx, BEE_BODY, x, y, pal, flip);
    if (g.over || b.dizzy > 0) {   // x_x eyes
      var ex = flip ? x + 3 : x + 11;
      ctx.fillStyle = '#fff'; ctx.fillRect(ex, y + 3, 2, 3);
      ctx.fillStyle = '#2a1a08'; ctx.fillRect(ex, y + 3, 1, 1); ctx.fillRect(ex + 1, y + 4, 1, 1); ctx.fillRect(ex, y + 5, 1, 1);
    }
    // antennae
    ctx.fillStyle = '#2a1a08';
    var ax = flip ? x + 4 : x + 11, dir = flip ? -1 : 1;
    ctx.fillRect(ax, y - 2, 1, 2); ctx.fillRect(ax + dir, y - 3, 1, 1);
    ctx.fillStyle = COL.yellow; ctx.fillRect(ax + dir * 2, y - 4, 1, 1);
    // dizzy stars
    if (b.dizzy > 0 || g.over) {
      for (var k = 0; k < 3; k++) {
        var a = t * 6 + k * 2.1;
        ctx.fillStyle = k % 2 ? COL.yellow : '#fff';
        var sx2 = Math.round(b.x + Math.cos(a) * 8), sy2 = Math.round(y - 4 + Math.sin(a) * 2);
        ctx.fillRect(sx2, sy2, 1, 1); if (k === 0) { ctx.fillRect(sx2 - 1, sy2, 3, 1); ctx.fillRect(sx2, sy2 - 1, 1, 3); }
      }
    }
  }

  function drawWasp(a, t, i) {
    var flip = a.face < 0;
    var x = Math.round(a.x) - 8, y = Math.round(a.y) - 4 + Math.round(Math.sin(t * 9 + i) * 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(a.x) - 4, Math.round(a.y) + 9, 8, 2);
    Cabinet.sprite(ctx, BEE_WING[Math.floor(t * 26 + i) % 2], x + (flip ? 5 : 2), y - 3, { w: '#ffe0e6', c: '#ffb0b8' }, flip);
    Cabinet.sprite(ctx, WASP_BODY, x, y, waspPal, flip);
    if (a.mode === 'chase' && a.t < 0.8) Cabinet.text(ctx, '!', Math.round(a.x), y - 10, Cabinet.fs(1), COL.yellow, 'center', '#000');
    if (a.mode === 'bored' && a.t < 1.1) Cabinet.text(ctx, '?', Math.round(a.x), y - 10, Cabinet.fs(1), COL.cyan, 'center', '#000');
  }

  function drawSpider(s, t) {
    var x = s.x;
    if (s.st === 'warn') {
      // its shadow where it will land, blinking, and a warning up top
      if (Math.floor(t * 8) % 2) { ctx.fillStyle = 'rgba(167, 123, 255, 0.5)'; ctx.fillRect(x - 5, s.ty + 5, 11, 2); ctx.fillRect(x - 3, s.ty + 4, 7, 4); }
      Cabinet.text(ctx, '!', x, 3, Cabinet.fs(1), COL.purple, 'center', '#000');
      return;
    }
    ctx.fillStyle = 'rgba(220, 220, 255, 0.6)';
    ctx.fillRect(x, 0, 1, Math.max(0, Math.round(s.y) - 3));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x - 4, s.ty + 6, 9, 2);
    Cabinet.sprite(ctx, Math.floor(t * 6) % 2 ? SPIDER : SPIDER2, x - 5, Math.round(s.y) - 4, spiderPal);
  }

  function render() {
    if (!ctx || !game) return;
    var g = game, t = Cabinet.time, now = performance.now();
    if (hivePulse > 0) hivePulse -= 1 / 60;
    if (!bg) bg = meadow();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fx.begin(ctx);
    ctx.drawImage(bg, 0, 0);
    // fireflies
    flies.forEach(function (f, i) {
      var on = (Math.sin(f.p * 2.2 + i) + 1) / 2;
      if (on < 0.4) return;
      ctx.globalAlpha = on * 0.8;
      ctx.fillStyle = COL.lime;
      ctx.fillRect(Math.round((f.x + Math.sin(f.p * 0.3) * 20 + W) % W), Math.round((f.y + Math.cos(f.p * 0.23) * 16 + H) % H), 1, 1);
    });
    ctx.globalAlpha = 1;

    drawHive(g, t);
    g.crumbs.forEach(function (c) {
      if (c.t < 1.5 && Math.floor(c.t * 8) % 2) return;
      var cx = Math.round(c.x), cy = Math.round(c.y - c.z);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(cx - 1, Math.round(c.y) + 2, 3, 1);
      ctx.fillStyle = COL.orange; ctx.fillRect(cx - 1, cy - 1, 3, 3);
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(cx - 1, cy - 1, 1, 1);
    });
    g.flowers.forEach(function (f, i) { drawFlower(f, t, (f.x * 13 + f.y * 7) % 10); });
    if (g.spider && g.spider.st === 'warn') drawSpider(g.spider, t);

    // a little arrow home when the bee has a good load (or a full one)
    var b = g.bee;
    if ((playing || g.demo) && b.carry > 0 && (b.carry >= BEE.CARRY_MAX || (g.level <= 2 && b.carry >= 2)) && Math.floor(t * 3) % 3) {
      var dx = g.hive.x - b.x, dy = g.hive.y - b.y, d = Math.hypot(dx, dy);
      if (d > 34) {
        var ux = dx / d, uy = dy / d, ax = b.x + ux * 14, ay = b.y + uy * 14;
        ctx.fillStyle = COL.yellow;
        for (var k = 0; k < 4; k++) ctx.fillRect(Math.round(ax + ux * k - uy * (k === 3 ? 0 : 0)), Math.round(ay + uy * k), 1, 1);
        ctx.fillRect(Math.round(ax + ux * 3 - uy * 2 - ux * 2), Math.round(ay + uy * 3 + ux * 2 - uy * 2), 1, 1);
        ctx.fillRect(Math.round(ax + ux * 3 + uy * 2 - ux * 2), Math.round(ay + uy * 3 - ux * 2 - uy * 2), 1, 1);
      }
    }

    g.wasps.forEach(function (a, i) { drawWasp(a, t, i); });
    drawBee(g, t);
    if (g.spider && g.spider.st !== 'warn') drawSpider(g.spider, t);

    fx.draw(ctx);
    if (playing && !moved && hint > 0 && Math.floor(now / 500) % 2) {
      Cabinet.text(ctx, 'SLIDE YOUR FINGER', W / 2, Math.round(H * 0.8), Cabinet.fs(1), COL.ink, 'center', '#000');
      Cabinet.text(ctx, 'TO FLY', W / 2, Math.round(H * 0.8) + 8, Cabinet.fs(1), COL.ink, 'center', '#000');
    }
    if (message && now < message.until) {
      var ms = Cabinet.fs(2);
      while (ms > 1 && Cabinet.textWidth(message.text, ms) > W - 10) ms--;
      Cabinet.text(ctx, message.text, W / 2, Math.round(H * 0.18), ms, message.color, 'center', '#000');
    }
    fx.end(ctx, W, H);
  }

  /* ---------- input ---------- */
  // Slide anywhere: the bee moves with the finger (relative, a bit faster than
  // the finger). A quick tap sends it to that spot. The whole stage listens,
  // so a touch on the bezel counts too.
  var touch = null, GAIN = 1.35;
  stage.style.touchAction = 'none';
  stage.addEventListener('pointerdown', function (e) {
    if (!playing || Cabinet.paused() || touch) return;
    e.preventDefault();
    var p = Cabinet.pointer(canvas, e);
    touch = { id: e.pointerId, x: p.x, y: p.y, sx: e.clientX, sy: e.clientY, t0: performance.now(), far: false };
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    if (!game.target) game.setTarget(game.bee.x, game.bee.y);
  });
  stage.addEventListener('pointermove', function (e) {
    if (!touch || e.pointerId !== touch.id) return;
    if (!playing || Cabinet.paused()) { touch.x = Cabinet.pointer(canvas, e).x; touch.y = Cabinet.pointer(canvas, e).y; return; }
    var p = Cabinet.pointer(canvas, e);
    var t = game.target || { x: game.bee.x, y: game.bee.y };
    game.setTarget(t.x + (p.x - touch.x) * GAIN, t.y + (p.y - touch.y) * GAIN);
    touch.x = p.x; touch.y = p.y;
    if (Math.hypot(e.clientX - touch.sx, e.clientY - touch.sy) > 10) { touch.far = true; moved = true; }
  });
  function up(e) {
    if (!touch || e.pointerId !== touch.id) return;
    var tap = !touch.far && performance.now() - touch.t0 < 320;
    touch = null;
    if (tap && playing && !Cabinet.paused() && e.type === 'pointerup') {
      var p = Cabinet.pointer(canvas, e);
      game.setTarget(p.x, p.y);
      moved = true;
    }
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('lostpointercapture', up);

  var keys = { x: 0, y: 0 }, held = {};
  var KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
  function keyAxes() {
    keys.x = 0; keys.y = 0;
    for (var k in held) if (held[k]) { keys.x += KEYS[k][0]; keys.y += KEYS[k][1]; }
  }
  document.addEventListener('keydown', function (e) { if (KEYS[e.key] && playing) { held[e.key] = true; keyAxes(); e.preventDefault(); } });
  document.addEventListener('keyup', function (e) { if (KEYS[e.key]) { held[e.key] = false; keyAxes(); } });
  window.addEventListener('blur', function () { held = {}; keyAxes(); });

  Cabinet.setup({
    id: 'bee', isPlaying: function () { return playing; },
    help: [
      { icon: 'next', text: '<b>Slide</b> your finger anywhere and the bee flies with it. Or tap where it should go.' },
      { icon: 'star', text: 'Touch a <b>flower</b> to pick up its pollen. Fly it <b>home to the hive</b> to make honey.' },
      { icon: 'trophy', text: 'Carry more at once for more points! Fill the honey bar to reach the next level.' },
      { icon: 'heart', text: 'Watch out for <b>wasps</b> and the <b>spider</b>. The hive is safe: wasps can\'t come in.' }
    ]
  });
  Cabinet.onRestart(start);
  Cabinet.onLayout(function () {
    if (playing || (game && game.over)) Cabinet.refit();
    else if (!pending || !Cabinet.tryRestore(pending, false)) { pending = null; layout(); game = new BeeGame(W, H, true); }
  });

  attract();
  Cabinet.loop(update, render);
  window.__bee = { game: function () { return game; }, start: start, playing: function () { return playing; } };
})();
