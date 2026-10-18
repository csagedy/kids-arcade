(function () {
  var libEl = document.getElementById('lib');
  var playEl = document.getElementById('play');
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var game = null, dpr = 1, side = 0, hintUntil = 0, idleTimer = 0, doneAt = 0, wrongAt = -1, wrongUntil = 0, raf = null;

  /* ---------- library ---------- */
  function showLibrary() {
    game = null;
    clearTimeout(idleTimer);
    document.getElementById('win').classList.add('hidden');
    playEl.classList.add('hidden');
    libEl.classList.remove('hidden');
    var done = DotsGame.doneSet();
    var list = document.getElementById('lib-grid');
    list.innerHTML = '';
    DOT_PICTURES.forEach(function (def, i) {
      var b = document.createElement('button');
      b.className = 'lvl' + (done[def.id] ? ' done' : '');
      b.innerHTML = '<canvas width="72" height="72"></canvas><div class="lvl-name"></div>';
      b.querySelector('.lvl-name').textContent = done[def.id] ? def.name : def.points.length + ' dots';
      drawThumb(b.querySelector('canvas'), def, !!done[def.id]);
      b.addEventListener('click', function () { open(def); });
      list.appendChild(b);
    });
  }

  function drawThumb(c, def, done) {
    var g = c.getContext('2d');
    g.clearRect(0, 0, 72, 72);
    if (done) {
      g.fillStyle = def.color;
      g.beginPath();
      def.points.forEach(function (p, i) { var x = 6 + p[0] * 0.6, y = 6 + p[1] * 0.6; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath(); g.fill();
    } else {
      g.fillStyle = '#97a0b3';
      def.points.forEach(function (p) {
        g.beginPath(); g.arc(6 + p[0] * 0.6, 6 + p[1] * 0.6, 2.2, 0, Math.PI * 2); g.fill();
      });
    }
  }

  /* ---------- play ---------- */
  function open(def) {
    try { localStorage.setItem('dots.last', def.id); } catch (e) {}
    game = new DotsGame(def);
    libEl.classList.add('hidden');
    playEl.classList.remove('hidden');
    document.getElementById('title').textContent = def.name;
    document.getElementById('win').classList.add('hidden');
    layout();
    doneAt = game.isDone() ? Date.now() - 1000 : 0;   // already finished: show it filled
    render();
    armIdle();
  }

  function layout() {
    var wrap = canvas.parentNode;
    side = Math.min(wrap.clientWidth, wrap.clientHeight) - 8;
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = side + 'px';
    canvas.width = canvas.height = Math.round(side * dpr);
  }

  function pt(i) {
    var p = game.points[i];
    return { x: 10 + p[0] * (side - 20) / 100, y: 10 + p[1] * (side - 20) / 100 };
  }

  /* Dot radius: as big as reads well, but never so big that neighbours in a
     crowded picture overlap. */
  var minGap = {};
  function dotRadius() {
    var g = minGap[game.id];
    if (g === undefined) {
      g = 1e9;
      var P = game.points;
      for (var a = 0; a < P.length; a++) for (var b = a + 1; b < P.length; b++) {
        g = Math.min(g, Math.sqrt(Math.pow(P[a][0] - P[b][0], 2) + Math.pow(P[a][1] - P[b][1], 2)));
      }
      minGap[game.id] = g;
    }
    var fit = g * (side - 20) / 100 * 0.46;
    return Math.max(10, Math.min(18, side / 20, fit));
  }

  /* A reminder pulse if the kid pauses for a few seconds. */
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (game && !game.isDone()) { hintUntil = Date.now() + 2500; render(); }
    }, 6000);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, side, side);
    var n = game.points.length, done = game.isDone();
    var now = Date.now();

    // Colour creeps in as the shape is joined, then floods in once complete.
    var k, q;
    if (game.next > 2 || done) {
      ctx.globalAlpha = done ? Math.min(1, 0.3 + (now - doneAt) / 700 * 0.7) : 0.22;
      ctx.fillStyle = game.color;
      ctx.beginPath();
      var fillTo = done ? n : game.next;
      for (k = 0; k < fillTo; k++) { q = pt(k); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // joined segments so far
    if (game.next > 1 || done) {
      ctx.strokeStyle = done ? 'rgba(255,255,255,0.6)' : game.color;
      ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      var upto = done ? n : game.next;
      for (var i = 0; i < upto; i++) { var p = pt(i); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
      if (done) ctx.closePath();
      ctx.stroke();
    }

    // dots and numbers
    var r = dotRadius();
    for (var j = 0; j < n; j++) {
      var d = pt(j);
      var isNext = !done && j === game.next;
      var joined = j < game.next;
      var pulse = isNext && now < hintUntil ? 1 + 0.25 * Math.sin(now / 90) : 1;
      var wrong = j === wrongAt && now < wrongUntil;
      if (done) continue;
      ctx.beginPath(); ctx.arc(d.x, d.y, r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = wrong ? '#e5484d' : joined ? game.color : isNext ? '#ffc53d' : '#2a3040';
      ctx.fill();
      if (isNext) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); }
      ctx.fillStyle = joined ? 'rgba(0,0,0,0.55)' : isNext ? '#24201a' : '#f2f4f8';
      ctx.font = 'bold ' + Math.round(r * 1.2) + 'px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(j + 1), d.x, d.y + 0.5);
    }

    document.getElementById('progress').textContent = Math.min(game.next, n) + ' / ' + n;
    if (now < hintUntil || now < wrongUntil || (done && now - doneAt < 700)) { if (!raf) raf = requestAnimationFrame(function () { raf = null; render(); }); }
  }

  function dotAt(x, y) {
    var best = -1, bestD = Infinity;
    var r = Math.max(20, side / 16);
    for (var i = 0; i < game.points.length; i++) {
      var p = pt(i), dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (dd < r * r && dd < bestD) { best = i; bestD = dd; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!game || game.isDone()) return;
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var i = dotAt(e.clientX - rect.left, e.clientY - rect.top);
    if (i < 0) return;
    var res = game.tap(i);
    if (res === 'miss') {
      wrongAt = i; wrongUntil = Date.now() + 350;
      // Two misses in a row: pulse the right dot so nobody gets stuck.
      if (game.misses >= 2) hintUntil = Date.now() + 1500;
    } else if (res === 'done') {
      game.markDone();
      doneAt = Date.now();
      clearTimeout(idleTimer);
      confetti();
      try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {}
      setTimeout(win, 900);
    } else if (res === 'hit') {
      hintUntil = 0;
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    }
    if (!game.isDone()) armIdle();
    render();
  });

  function confetti() {
    var box = document.getElementById('confetti');
    box.innerHTML = '';
    var cols = [game.color, '#ffd645', '#e5484d', '#4fa3f7', '#3fb950', '#f06ca8'];
    for (var i = 0; i < 36; i++) {
      var d = document.createElement('i');
      d.style.left = Math.random() * 100 + '%';
      d.style.background = cols[i % cols.length];
      d.style.animationDelay = (Math.random() * 0.6) + 's';
      d.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
      box.appendChild(d);
    }
    setTimeout(function () { box.innerHTML = ''; }, 3500);
  }

  function win() {
    if (!game || !game.isDone()) return;
    document.getElementById('win-name').textContent = game.name;
    document.getElementById('win').classList.remove('hidden');
  }

  document.getElementById('back-btn').addEventListener('click', showLibrary);
  document.getElementById('clear-btn').addEventListener('click', function () { if (game) { game.reset(); hintUntil = 0; doneAt = 0; document.getElementById('win').classList.add('hidden'); render(); armIdle(); } });
  document.getElementById('win-lib').addEventListener('click', showLibrary);
  document.getElementById('win-next').addEventListener('click', function () {
    var idx = DOT_PICTURES.map(function (p) { return p.id; }).indexOf(game.id);
    open(DOT_PICTURES[(idx + 1) % DOT_PICTURES.length]);
  });
  window.addEventListener('resize', function () { if (game) { layout(); render(); } });

  var last = null;
  try { last = localStorage.getItem('dots.last'); } catch (e) {}
  var def = DOT_PICTURES.filter(function (p) { return p.id === last; })[0];
  if (def && !DotsGame.doneSet()[def.id]) open(def); else showLibrary();

  window.__dots = { game: function () { return game; }, open: open, render: render, pt: function (i) { return pt(i); } };
})();
