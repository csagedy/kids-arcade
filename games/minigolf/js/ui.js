/* Mini Golf screen, on the arcade kit. Pull back anywhere on the course and
   let go to putt. One or two players (pass the iPad), three courses of six
   holes, a scorecard, best scores per hole, and a save after every putt.

   The physics (js/sim.js) runs at a fixed 120 steps a second from a global
   tick, so windmills and gates move the same way every time; drawing is in
   js/draw.js. */
(function () {
  'use strict';
  var S = GolfSim, D = GolfDraw, COURSES = GolfHoles.COURSES;
  var MAX_STROKES = 8;
  var SAVE = 'golf.game', BEST = 'golf.best', PLAYERS = 'golf.players';
  var PLAYER = [
    { name: 'Red', color: '#ff5d73', edge: '#b51b3a', emoji: '🔴' },
    { name: 'Blue', color: '#4cc2ff', edge: '#1a6fb0', emoji: '🔵' }
  ];

  var courseEl = document.getElementById('course');
  var canvas = document.getElementById('cv'), ctx = canvas.getContext('2d');
  var bannerEl = document.getElementById('banner');

  var game = null;      // the saved round: { course, hole, np, turn, first, scores, strokes, ball }
  var world = null, ball = null, view = null, layer = null;
  var tick = 0, phase = 'idle';     // idle | aim | roll | sink | hop | wait
  var aim = null, drag = null, particles = [], anim = null, trail = [];
  var lastClick = 0, flagLift = 0;
  var best = Kit.load(BEST, {}) || {};

  function course() { return COURSES[game.course]; }
  function holeDef() { return course().holes[game.hole]; }
  function starsFor(strokes, par) { return strokes < par ? 3 : strokes === par ? 2 : 1; }

  /* ---------- layout ---------- */
  var W = 0, H = 0, dpr = 1;
  function resize() {
    var r = courseEl.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && h === H && layer) return;
    W = w; H = h;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    rebuild();
  }
  function rebuild() {
    if (!world || !W) return;
    view = D.layout(W, H, world, dpr);
    layer = D.buildStatic(world, course().id, view);
  }

  /* ---------- holes ---------- */
  function startHole(keepBall) {
    var def = holeDef();
    world = S.world(def);
    ball = S.newBall(world);
    if (keepBall && game.ball) {
      ball.x = game.ball.x; ball.y = game.ball.y; ball.lastX = game.ball.lastX; ball.lastY = game.ball.lastY;
      if (!S.inFloor(world, ball.x, ball.y)) { ball.x = world.tee.x; ball.y = world.tee.y; }
    }
    tick = 0; particles = []; trail = []; anim = null; aim = null; drag = null; flagLift = 0;
    phase = 'aim';
    rebuild();
    renderHud();
  }

  function newRound(ci, np) {
    game = { course: ci, hole: 0, np: np, turn: 0, first: 0, scores: [[], []], strokes: 0, ball: null };
    Kit.save(PLAYERS, np);
    startHole(false);
    save();
    introBanner();
  }

  function save() {
    if (!game) return;
    game.ball = ball && !ball.done ? { x: ball.x, y: ball.y, lastX: ball.lastX, lastY: ball.lastY } : null;
    Kit.save(SAVE, game);
  }

  function introBanner() {
    var def = holeDef();
    var who = game.np > 1 ? '<div class="banner__par"><i class="turn__ball" style="--ball:' + PLAYER[game.turn].color + ';--ball-edge:' + PLAYER[game.turn].edge + '"></i>' + PLAYER[game.turn].name + ' goes first</div>' : '';
    showBanner('<div class="banner__kicker">' + Kit.esc(course().name) + ' · Hole ' + def.n + ' of ' + course().holes.length + '</div>' +
      '<div class="banner__title">' + Kit.esc(def.name) + '</div>' +
      '<div class="banner__sub">' + Kit.esc(def.tip) + '</div>' +
      '<div class="banner__par">Par ' + def.par + ' ' + starRow(3, 'sm') + '</div>' + who, 2600);
  }

  function starRow(n, cls) {
    var h = '<span class="turn__stars">';
    for (var i = 0; i < 3; i++) h += '<span class="' + (i < n ? '' : 'off') + '">' + Kit.icon('star') + '</span>';
    return h + '</span>';
  }

  var bannerTimer = 0;
  function showBanner(html, ms, big) {
    clearTimeout(bannerTimer);
    bannerEl.innerHTML = html;
    bannerEl.classList.toggle('big', !!big);
    bannerEl.classList.remove('show', 'gone'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
    bannerTimer = setTimeout(hideBanner, ms || 2000);
  }
  function hideBanner(now) {
    clearTimeout(bannerTimer);
    if (now) { bannerEl.classList.add('gone'); void bannerEl.offsetWidth; }
    bannerEl.classList.remove('show');
    if (now) setTimeout(function () { bannerEl.classList.remove('gone'); }, 30);
  }

  /* ---------- HUD ---------- */
  function renderHud() {
    if (!game) return;
    var def = holeDef(), p = PLAYER[game.turn];
    document.body.classList.toggle('solo', game.np < 2);
    document.getElementById('hole').textContent = def.n + '/' + course().holes.length;
    document.getElementById('par').textContent = def.par;
    document.getElementById('shots').textContent = game.strokes;
    var left = starsFor(game.strokes + 1, def.par);
    Array.prototype.forEach.call(document.querySelectorAll('.turn'), function (t) {
      var ballEl = t.querySelector('.turn__ball');
      ballEl.style.setProperty('--ball', p.color); ballEl.style.setProperty('--ball-edge', p.edge);
      t.querySelector('.turn__name').textContent = game.np > 1 ? p.name + "'s turn" : 'Stars';
      var st = t.querySelector('.turn__stars');
      st.innerHTML = starRow(left).replace(/^<span class="turn__stars">|<\/span>$/g, '');
      t.setAttribute('aria-label', (game.np > 1 ? p.name + "'s turn. " : '') + left + ' stars still possible');
    });
  }

  /* ---------- input: pull back anywhere, let go to putt ---------- */
  function fullPull() { return Math.max(110, Math.min(300, Math.min(W, H) * 0.36)); }
  function pointerPos(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  function onDown(e) {
    if (drag || phase !== 'aim' || Kit.overlayOpen() || !view) return;
    if (e.button !== undefined && e.button > 0) return;
    hideBanner(true);
    drag = { id: e.pointerId, start: pointerPos(e) };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    updateAim(drag.start);
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    updateAim(pointerPos(e));
  }
  function updateAim(p) {
    var dX = drag.start[0] - p[0], dY = drag.start[1] - p[1], len = Math.sqrt(dX * dX + dY * dY);
    var power = Math.min(1, len / fullPull());
    var lastP = aim ? aim.power : 0;
    if (len < 8) { aim = { ball: ball, power: 0, dir: [0, -1], path: [[ball.x, ball.y]], len: 0, idle: true }; return; }
    var d = D.vecToLogical(view, dX, dY), l = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
    var dir = [d[0] / l, d[1] / l], reach = 14 + power * 62;
    aim = { ball: ball, power: power, dir: dir, len: reach, path: S.aimPath(world, ball.x, ball.y, dir[0], dir[1], reach, 1) };
    // a soft tick each time the power crosses a fifth
    if (Math.ceil(power * 5) !== Math.ceil(lastP * 5) && power > 0.02) Kit.sfx.tone(300 + Math.ceil(power * 5) * 90, 0.03, 'sine', { vol: 0.03 });
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var a = aim;
    drag = null; aim = null;
    if (e.type === 'pointercancel' || !a || a.idle || a.power < 0.04 || phase !== 'aim') return;
    putt(a.dir[0], a.dir[1], a.power);
  }

  function putt(dx, dy, power) {
    hideBanner(true);
    S.shoot(ball, dx, dy, power);
    game.strokes++;
    phase = 'roll';
    trail = [];
    Kit.sfx.tone(250 - power * 80, 0.08, 'triangle', { vol: 0.08 + power * 0.16 });
    Kit.sfx.tone(1700 - power * 500, 0.025, 'square', { vol: 0.02 + power * 0.03 });
    Kit.buzz(6 + Math.round(power * 10));
    renderHud();
    Kit.anim(document.getElementById('shots-chip'), 'k-bump');
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', function (e) { if (drag && e.pointerId === drag.id) { drag = null; aim = null; } });

  /* ---------- simulation loop ---------- */
  var acc = 0, lastT = 0, time = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t; time += dt;
    if (!world || !view) return;
    acc += dt;
    var steps = 0, ev = [];
    while (acc >= S.DT && steps < 12) {
      acc -= S.DT; steps++;
      tick++;
      if (phase === 'roll' || (phase === 'aim' && world.hasMovers)) S.step(world, ball, tick, ev);
    }
    if (steps >= 12) acc = 0;
    if (world.hasMovers) S.placeMovers(world, tick);
    if (ev.length) handleEvents(ev);
    if (phase === 'roll' && ball.moving && !Kit.reduced) {
      trail.push([ball.x, ball.y]);
      if (trail.length > 7) trail.shift();
    } else if (trail.length) trail.shift();
    // safety: a putt that rolls for ages is called finished
    if (phase === 'roll' && ball.rollT > 25 && ball.moving) { ball.moving = false; ball.vx = ball.vy = 0; afterRest(); }
    stepParticles(dt);
    stepAnim(dt);
    draw();
  }

  function handleEvents(ev) {
    var now = performance.now();
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i], p = view ? D.toScreen(view, e.x, e.y) : [0, 0];
      switch (e.t) {
        case 'wall':
          if (now - lastClick > 45) {
            lastClick = now;
            var vol = Math.min(0.11, 0.015 + e.v / 1800);
            if (course().id === 'pirate') Kit.sfx.tone(420 + Math.random() * 60, 0.05, 'triangle', { vol: vol * 1.4 });
            else Kit.sfx.tone(1150 + Math.random() * 200, 0.03, 'square', { vol: vol * 0.6 });
            if (e.v > 60) puff(p, 'rgba(255,255,255,0.9)', 4, 0.5);
          }
          break;
        case 'bump':
          Kit.sfx.tone(380, 0.16, 'sine', { vol: 0.14, to: 820 });
          Kit.buzz(10);
          ring(p, '#fff', view.s * 6);
          puff(p, D.THEMES[course().id].bumperHi, 8, 1);
          break;
        case 'mover':
          if (now - lastClick > 60) { lastClick = now; Kit.sfx.tone(200, 0.08, 'triangle', { vol: 0.11, to: 150 }); }
          break;
        case 'sand':
          Kit.sfx.tone(160, 0.14, 'triangle', { vol: 0.07, to: 90 });
          puff(p, '#f2c763', 10, 0.8);
          break;
        case 'warp':
          Kit.sfx.tone(240, 0.45, 'sine', { vol: 0.11, to: 1400 });
          ring(p, '#d6c4ff', view.s * 8);
          var o = D.toScreen(view, e.ox, e.oy);
          ring(o, '#d6c4ff', view.s * 8);
          puff(o, '#d6c4ff', 10, 1.2);
          break;
        case 'lip':
          Kit.sfx.tone(1500, 0.03, 'square', { vol: 0.04 });
          Kit.sfx.tone(1100, 0.03, 'square', { vol: 0.04, when: 0.05 });
          break;
        case 'splash':
          Kit.sfx.tone(700, 0.3, 'sine', { vol: 0.13, to: 140 });
          Kit.sfx.tone(1300, 0.16, 'sine', { vol: 0.05, to: 300, when: 0.06 });
          splash(p);
          afterSplash();
          break;
        case 'cup':
          sink(e);
          break;
        case 'rest':
          if (phase === 'roll') afterRest();
          break;
      }
    }
  }

  function afterRest() {
    phase = 'aim';
    save();
    renderHud();
    if (game.strokes >= MAX_STROKES) hopIn();
  }
  function afterSplash() {
    phase = 'aim';
    Kit.toast('Splash! Try again from here.', { icon: 'undo', ms: 1600 });
    save();
    renderHud();
    if (game.strokes >= MAX_STROKES) setTimeout(hopIn, 500);
  }

  /* ---------- holing out ---------- */
  function sink(e) {
    phase = 'sink';
    var from = [ball.x, ball.y];
    ball.done = false;   // keep drawing it while it drops
    anim = { kind: 'sink', t: 0, dur: Kit.reduced ? 0.01 : 0.28, from: from };
    // rattle in the cup
    [1400, 1020, 1260, 860].forEach(function (f, i) { Kit.sfx.tone(f, 0.035, 'square', { vol: 0.05, when: 0.05 + i * 0.06 + i * i * 0.008 }); });
    Kit.buzz([15, 40, 15]);
  }

  function hopIn() {
    if (phase !== 'aim') return;
    phase = 'hop';
    anim = { kind: 'hop', t: 0, dur: Kit.reduced ? 0.01 : 0.9, from: [ball.x, ball.y] };
    showBanner('<div class="banner__title">Let\'s try the next one!</div><div class="banner__sub">The ball hops in for you.</div>', 1700);
    Kit.sfx.tone(500, 0.5, 'sine', { vol: 0.1, to: 1000 });
  }

  function stepAnim(dt) {
    if (!anim) return;
    anim.t += dt;
    var k = Math.min(1, anim.t / anim.dur), cx = world.cup.x, cy = world.cup.y;
    if (anim.kind === 'sink') {
      var e = 1 - (1 - k) * (1 - k);
      ball.x = anim.from[0] + (cx - anim.from[0]) * e; ball.y = anim.from[1] + (cy - anim.from[1]) * e;
      ball.scale = 1 - 0.45 * k;
      flagLift = k;
    } else if (anim.kind === 'hop') {
      ball.x = anim.from[0] + (cx - anim.from[0]) * k; ball.y = anim.from[1] + (cy - anim.from[1]) * k;
      ball.hop = Math.sin(k * Math.PI) * 18;
      ball.scale = k > 0.85 ? 1 - (k - 0.85) / 0.15 * 0.45 : 1;
      flagLift = Math.max(0, (k - 0.6) / 0.4);
    }
    if (k >= 1) {
      var kind = anim.kind;
      anim = null; ball.hop = 0; ball.scale = 0; ball.done = true;
      holed(kind === 'hop');
    }
  }

  function holed(hopped) {
    phase = 'wait';
    var def = holeDef(), n = game.strokes, stars = starsFor(n, def.par);
    if (hopped) stars = 1;
    game.scores[game.turn][game.hole] = n;
    var newBest = !best[def.id] || n < best[def.id];
    if (!hopped && newBest) { best[def.id] = n; Kit.save(BEST, best); }
    writeStat();
    game.ball = null;
    game.strokes = 0;
    var p = view ? D.toScreen(view, world.cup.x, world.cup.y) : [W / 2, H / 2];
    var r = canvas.getBoundingClientRect(), px = r.left + p[0], py = r.top + p[1];
    var word, sub, big = false;
    if (n === 1) { word = 'Hole in one!'; sub = 'WOW! One putt!'; big = true; }
    else if (hopped) { word = 'All done!'; sub = 'On to the next hole.'; }
    else if (n <= def.par - 2) { word = 'Amazing!'; sub = n + ' shots, under par!'; big = true; }
    else if (n < def.par) { word = 'Super!'; sub = n + ' shots, under par!'; big = true; }
    else if (n === def.par) { word = 'Par! Nice!'; sub = n + ' shots, right on par.'; }
    else { word = 'You did it!'; sub = n + ' shots.'; }
    if (game.np > 1) sub = PLAYER[game.turn].name + ': ' + sub;
    if (!hopped) {
      Kit.confetti({ x: px, y: py, count: big ? 110 : 50 });
      setTimeout(function () { if (big) Kit.sfx.win(); else Kit.sfx.good(); }, 260);
    }
    if (!Kit.reduced) for (var s = 0; s < stars; s++) (function (s) { setTimeout(function () { Kit.sfx.star(s); }, 600 + s * 160); })(s);
    var html = '<div class="banner__title">' + word + '</div><div class="banner__sub">' + Kit.esc(sub) + '</div><div class="banner__stars">';
    for (var i = 0; i < 3; i++) html += '<span class="' + (i < stars ? 'on' : '') + '">' + Kit.icon('star') + '</span>';
    html += '</div>' + (!hopped && newBest && n > 1 ? '<div class="banner__par">New best for this hole!</div>' : '');
    showBanner(html, 2200, big);
    renderHud();
    nextTimer = setTimeout(next, Kit.reduced ? 1600 : 2300);
  }
  var nextTimer = 0;

  function next() {
    hideBanner();
    // 2 players: the other one plays this hole if they haven't yet
    if (game.np > 1) {
      var other = 1 - game.turn;
      if (game.scores[other][game.hole] == null) {
        game.turn = other;
        startHole(false);
        save();
        passTo(other);
        return;
      }
    }
    if (game.hole + 1 >= course().holes.length) { finishCourse(); return; }
    game.hole++;
    game.first = game.np > 1 ? game.hole % 2 : 0;
    game.turn = game.first;
    startHole(false);
    save();
    introBanner();
  }

  function passTo(pl, text) {
    var p = PLAYER[pl];
    phase = 'wait';
    return Kit.result({
      emoji: p.emoji, title: p.name + "'s turn!", sound: 'good',
      text: text || 'Pass the ' + device() + ' to <b>' + p.name + '</b>.',
      buttons: [{ label: "I'm ready!", value: 'go', primary: true }]
    }).then(function () { phase = 'aim'; renderHud(); });
  }
  function device() { return Math.min(window.innerWidth, window.innerHeight) >= 600 ? 'iPad' : 'phone'; }

  function totals(pl) {
    var t = 0, par = 0, stars = 0;
    course().holes.forEach(function (h, i) {
      var s = game.scores[pl][i];
      if (s != null) { t += s; par += h.par; stars += starsFor(s, h.par); }
    });
    return { shots: t, par: par, stars: stars };
  }

  function finishCourse() {
    var c = course(), ci = game.course;
    var a = totals(0), b = game.np > 1 ? totals(1) : null;
    var card = scorecardHTML(true);
    var title, emoji, text;
    if (b) {
      if (a.shots === b.shots) { title = "It's a tie!"; emoji = '🤝'; }
      else { var wn = a.shots < b.shots ? 0 : 1; title = PLAYER[wn].name + ' wins!'; emoji = '🏆'; }
      text = 'Fewest shots wins. ' + card;
    } else {
      title = c.name + ' done!'; emoji = '🏆';
      text = card;
    }
    var stars = a.stars >= 15 ? 3 : a.stars >= 10 ? 2 : 1;
    Kit.drop(SAVE);
    var nextCi = (ci + 1) % COURSES.length;
    phase = 'wait';
    Kit.result({
      emoji: emoji, wiggle: true, confetti: true, title: title, text: text,
      stars: b ? undefined : stars,
      stats: b ? [{ label: PLAYER[0].name, value: a.shots, hi: a.shots <= b.shots }, { label: PLAYER[1].name, value: b.shots, hi: b.shots <= a.shots }, { label: 'Par', value: a.par }]
               : [{ label: 'Shots', value: a.shots, hi: true }, { label: 'Par', value: a.par }, { label: 'Stars', value: a.stars + '/' + c.holes.length * 3 }],
      buttons: [{ label: 'Play again', value: 'again' }, { label: COURSES[nextCi].name, value: 'next', primary: true, icon: 'next' }]
    }).then(function (v) {
      var np = game.np;
      if (v === 'again') newRound(ci, np);
      else newRound(nextCi, np);
    });
  }

  function writeStat() {
    var total = 0, max = 0;
    COURSES.forEach(function (c) { c.holes.forEach(function (h) { max += 3; if (best[h.id]) total += starsFor(best[h.id], h.par); }); });
    Kit.stat('minigolf', '★ ' + total + ' / ' + max);
  }

  /* ---------- scorecard ---------- */
  function scorecardHTML(compact) {
    var c = course(), h = '<div class="scard-wrap"><table class="scard"><thead><tr><th></th>';
    c.holes.forEach(function (hd) { h += '<th>' + hd.n + '</th>'; });
    h += '<th>All</th></tr></thead><tbody><tr class="par"><th>Par</th>';
    var parT = 0;
    c.holes.forEach(function (hd) { h += '<td>' + hd.par + '</td>'; parT += hd.par; });
    h += '<td>' + parT + '</td></tr>';
    for (var pl = 0; pl < game.np; pl++) {
      var p = PLAYER[pl], tot = 0;
      h += '<tr><th><i class="dot" style="--ball:' + p.color + '"></i>' + (game.np > 1 ? p.name : 'You') + '</th>';
      c.holes.forEach(function (hd, i) {
        var s = game.scores[pl][i], cls = '';
        if (s != null) { tot += s; cls = s < hd.par ? 'under' : s === hd.par ? 'even' : ''; }
        if (i === game.hole && pl === game.turn && phase !== 'wait' && !compact) cls += ' now';
        h += '<td class="' + cls + '">' + (s != null ? s : (i === game.hole && pl === game.turn && game.strokes ? '<small>' + game.strokes + '…</small>' : '·')) + '</td>';
      });
      h += '<td class="tot">' + tot + '</td></tr>';
    }
    if (!compact) {
      h += '<tr class="par"><th>Best</th>';
      c.holes.forEach(function (hd) { h += '<td>' + (best[hd.id] || '–') + '</td>'; });
      h += '<td></td></tr>';
    }
    h += '</tbody></table></div>';
    if (!compact) h += '<div class="scard-key"><span><i style="background:#ffd23f"></i>Under par ★★★</span><span><i style="background:#3ddc84"></i>Par ★★</span><span>More ★</span></div>';
    return h;
  }
  function showScorecard() {
    if (Kit.overlayOpen() || !game) return;
    Kit.sfx.open();
    Kit.sheet({ title: course().emoji + ' ' + course().name, html: scorecardHTML(false), buttons: [{ label: 'Back to the hole', value: 'ok', primary: true }] });
  }

  /* ---------- course picker ---------- */
  function courseStars(c) {
    var n = 0;
    c.holes.forEach(function (h) { if (best[h.id]) n += starsFor(best[h.id], h.par); });
    return n;
  }
  function pickCourse(first) {
    if (Kit.overlayOpen()) return;
    var np = (game && game.np) || Kit.load(PLAYERS, 1) || 1;
    var html = '<div class="pick"><div class="k-seg players" role="group" aria-label="Players">' +
      '<button type="button" data-n="1" class="' + (np === 1 ? 'k-on' : '') + '">1 player</button>' +
      '<button type="button" data-n="2" class="' + (np === 2 ? 'k-on' : '') + '">2 players</button></div><div class="courses">';
    COURSES.forEach(function (c, i) {
      var playing = game && game.course === i && (game.hole > 0 || game.strokes > 0 || game.scores[0].length);
      html += '<button type="button" class="cc" data-c="' + i + '" style="--c1:' + c.c1 + ';--c2:' + c.c2 + '">' +
        (playing ? '<span class="cc__note">Hole ' + (game.hole + 1) + ' · keep going</span>' : '') +
        '<span class="cc__art">' + c.emoji + '</span><span class="cc__name">' + Kit.esc(c.name) + '</span>' +
        '<span class="cc__stars">' + Kit.icon('star') + courseStars(c) + ' / ' + c.holes.length * 3 + '</span></button>';
    });
    html += '</div></div>';
    Kit.sfx.open();
    var chosenNp = np;
    Kit.sheet({
      title: 'Pick a course', html: html, dismissValue: first ? 'first' : null,
      onOpen: function (card, close) {
        card.querySelectorAll('.players button').forEach(function (b) {
          b.addEventListener('click', function () {
            chosenNp = +b.getAttribute('data-n');
            card.querySelectorAll('.players button').forEach(function (x) { x.classList.toggle('k-on', x === b); });
            Kit.sfx.tap();
            // the "keep going" note only applies to the same number of players
            card.querySelectorAll('.cc__note').forEach(function (n) { n.style.display = game && game.np === chosenNp ? '' : 'none'; });
          });
        });
        card.querySelectorAll('.cc').forEach(function (b) {
          b.addEventListener('click', function () { Kit.sfx.tap(); close({ c: +b.getAttribute('data-c'), np: chosenNp }); });
        });
      }
    }).then(function (v) {
      if (v === 'first') { newRound(0, 1); return; }
      if (!v || typeof v !== 'object') return;
      var inProgress = game && (game.hole > 0 || game.strokes > 0 || game.scores[0].length || game.scores[1].length);
      if (game && game.course === v.c && game.np === v.np && inProgress) { Kit.sfx.close(); return; }   // keep going
      if (inProgress) {
        Kit.confirm({ title: 'Start ' + COURSES[v.c].name + '?', text: 'This round of ' + course().name + ' will stop. Best scores are kept.', yes: 'Start', no: 'Keep playing', emoji: COURSES[v.c].emoji })
          .then(function (yes) { if (yes) { clearTimeout(nextTimer); newRound(v.c, v.np); } });
      } else { clearTimeout(nextTimer); newRound(v.c, v.np); }
    });
  }

  /* ---------- particles ---------- */
  function puff(p, color, n, speed) {
    if (Kit.reduced) return;
    var s = view.s;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (0.5 + Math.random()) * s * 9 * speed;
      particles.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: s * (0.5 + Math.random() * 0.7), age: 0, life: 0.35 + Math.random() * 0.3, color: color });
    }
  }
  function ring(p, color, grow) {
    if (Kit.reduced) return;
    particles.push({ x: p[0], y: p[1], r: view.s * 2.5, grow: grow, ring: true, age: 0, life: 0.35, color: color, w: Math.max(2, view.s * 0.6) });
  }
  function splash(p) {
    if (Kit.reduced) return;
    ring(p, '#ffffff', view.s * 9);
    var s = view.s;
    for (var i = 0; i < 18; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = (0.6 + Math.random()) * s * 22;
      particles.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: s * 60, r: s * (0.5 + Math.random() * 0.6), age: 0, life: 0.5 + Math.random() * 0.3, color: i % 3 ? '#bfe9ff' : '#ffffff' });
    }
  }
  function stepParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; p.vx *= 0.94; if (!p.g) p.vy *= 0.94; }
    }
  }

  /* ---------- drawing ---------- */
  var drawState = { balls: [], particles: particles };
  function draw() {
    if (!layer) return;
    var p = PLAYER[game.turn];
    var balls = [];
    if (ball && !ball.done) balls.push({ show: true, x: ball.x, y: ball.y, color: p.color, edge: p.edge, scale: ball.scale, hop: ball.hop,
      trail: trail, glow: phase === 'aim' && !drag && !Kit.reduced });
    drawState.view = view; drawState.world = world; drawState.layer = layer; drawState.theme = course().id;
    drawState.time = time; drawState.tick = tick; drawState.reduced = Kit.reduced; drawState.balls = balls;
    drawState.aim = aim && !aim.idle ? aim : null; drawState.particles = particles;
    drawState.flagLift = flagLift; drawState.flagAlpha = 1 - flagLift * 0.4;
    D.frame(ctx, drawState);
  }

  /* ---------- buttons ---------- */
  var HOW = [
    { emoji: '👆', text: 'Put your finger <b>anywhere</b> and pull back, like a slingshot.' },
    { emoji: '🎯', text: 'The dots show where the ball goes. The ring shows how hard.' },
    { emoji: '⛳', text: 'Let go to putt. Get it in the cup in as few shots as you can!' },
    { emoji: '⭐', text: 'Under par = 3 stars, par = 2 stars. Water sends you back; after 8 shots the ball hops in.' }
  ];
  document.getElementById('card-btn').addEventListener('click', showScorecard);
  document.getElementById('menu-btn').addEventListener('click', function () { pickCourse(false); });
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindMute(document.getElementById('mute-btn2'));
  Kit.bindHelp(document.getElementById('help-btn'), 'minigolf', HOW);
  Kit.bindHelp(document.getElementById('help-btn2'), 'minigolf', HOW);

  if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(courseEl);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  /* A save made between holes (the page closed during the cheer) still
     says the finished hole: move it on to whoever plays next. Returns
     false when the course was already over. */
  function settle(g) {
    var holes = COURSES[g.course].holes;
    for (var guard = 0; guard < 40 && g.scores[g.turn][g.hole] != null; guard++) {
      g.strokes = 0; g.ball = null;
      if (g.np > 1 && g.scores[1 - g.turn][g.hole] == null) { g.turn = 1 - g.turn; continue; }
      g.hole++;
      if (g.hole >= holes.length) return false;
      g.first = g.np > 1 ? g.hole % 2 : 0; g.turn = g.first;
    }
    return true;
  }

  /* ---------- start ---------- */
  function boot() {
    var saved = Kit.load(SAVE, null);
    var ok = saved && COURSES[saved.course] && COURSES[saved.course].holes[saved.hole] && saved.scores;
    resize();
    if (ok) {
      game = saved;
      game.scores = [game.scores[0] || [], game.scores[1] || []];
      ok = settle(game);
    }
    if (ok) {
      startHole(true);
      resize();
      showBanner('<div class="banner__kicker">Welcome back!</div><div class="banner__title">' + Kit.esc(holeDef().name) + '</div><div class="banner__sub">' +
        Kit.esc(course().name) + ' · Hole ' + holeDef().n + (game.np > 1 ? ' · ' + PLAYER[game.turn].name + "'s turn" : '') + '</div>', 2200);
      Kit.howTo('minigolf', HOW);
    } else {
      game = { course: 0, hole: 0, np: 1, turn: 0, first: 0, scores: [[], []], strokes: 0, ball: null };
      startHole(false);
      resize();
      Kit.howTo('minigolf', HOW).then(function () { pickCourse(true); });
    }
    writeStat();
    requestAnimationFrame(loop);
  }
  boot();

  // hooks for tests
  window.__golf = {
    state: function () { return { phase: phase, overlay: Kit.overlayOpen(), course: game.course, hole: game.hole, turn: game.turn, strokes: game.strokes, scores: game.scores, ball: ball && { x: ball.x, y: ball.y, moving: ball.moving, done: ball.done }, tick: tick, rot: view && view.rot, s: view && view.s }; },
    toScreen: function (x, y) { var p = D.toScreen(view, x, y), r = canvas.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; },
    vecToScreen: function (dx, dy) { return view.rot ? [-dy * view.s, dx * view.s] : [dx * view.s, dy * view.s]; },
    fullPull: fullPull,
    setTick: function (t) { tick = t; acc = 0; },
    putt: function (dx, dy, p) { if (phase === 'aim') putt(dx, dy, p); },
    newRound: newRound, pick: pickCourse, scorecard: showScorecard,
    goto: function (ci, hi, np) { newRound(ci, np || 1); game.hole = hi; game.turn = 0; startHole(false); save(); }
  };
})();
