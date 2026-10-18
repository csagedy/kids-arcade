/* Shared "arcade cabinet" kit for the action games. Each game draws on a
   small logical canvas (say 240x320) that is scaled up with no smoothing, so
   everything is chunky on purpose. This file provides the frame, a bitmap
   font, beeps, a fixed-step game loop, high scores with initials, and the
   attract / game-over screens. Plain script, no build step. */

var Cabinet = (function () {
  var C = {};

  /* ---------- canvas ---------- */
  /* Pick the logical size. Width is fixed (240); height follows the phone's
     aspect between hMin and hMax so the picture fills the screen. The CSS
     stretches the canvas to the bezel with object-fit: contain, so the only
     job here is choosing h and setting the backing store. Returns { ctx, w, h }. */
  C.fit = function (canvas, w, hMin, hMax) {
    var bezel = canvas.closest('.cab-bezel') || canvas.parentNode;
    var ctx = canvas.getContext('2d');
    var aw = bezel.clientWidth - 20, ah = bezel.clientHeight - 20;
    // If layout isn't settled, estimate from the window (marquee + deck ~180px).
    if (aw < 40 || ah < 40 || ah < aw) { aw = window.innerWidth - 36; ah = window.innerHeight - 180; }
    var h = hMax === undefined ? hMin : Math.max(hMin, Math.min(hMax, Math.round(w * ah / aw)));
    canvas.width = w; canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    return { ctx: ctx, w: w, h: h };
  };

  /* Pointer position in logical pixels, allowing for object-fit letterboxing. */
  C.pointer = function (canvas, e) {
    var r = canvas.getBoundingClientRect();
    var scale = Math.min(r.width / canvas.width, r.height / canvas.height);
    var dw = canvas.width * scale, dh = canvas.height * scale;
    var ox = r.left + (r.width - dw) / 2, oy = r.top + (r.height - dh) / 2;
    return { x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale };
  };

  /* ---------- 3x5 bitmap font ---------- */
  var GLYPHS = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001',
    '8': '111101111101111', '9': '111101111001111',
    'A': '010101111101101', 'B': '110101110101110', 'C': '111100100100111', 'D': '110101101101110',
    'E': '111100110100111', 'F': '111100110100100', 'G': '111100101101111', 'H': '101101111101101',
    'I': '111010010010111', 'J': '001001001101111', 'K': '101101110101101', 'L': '100100100100111',
    'M': '101111111101101', 'N': '110101101101101', 'O': '111101101101111', 'P': '111101111100100',
    'Q': '111101101111001', 'R': '111101110101101', 'S': '111100111001111', 'T': '111010010010010',
    'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101',
    'Y': '101101111010010', 'Z': '111001010100111',
    ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000',
    '!': '010010010000010', '?': '111001011000010', '/': '001001010100100', '>': '100010001010100',
    '<': '001010100010001', '+': '000010111010000', "'": '010010000000000', ',': '000000000010100'
  };

  /* Draw text at (x, y) with pixel size s. align: 'left' | 'center' | 'right'. */
  C.text = function (ctx, str, x, y, s, color, align) {
    str = String(str).toUpperCase();
    s = s || 1;
    var w = str.length * 4 * s - s;
    if (align === 'center') x -= Math.floor(w / 2);
    else if (align === 'right') x -= w;
    ctx.fillStyle = color || '#fff';
    for (var i = 0; i < str.length; i++) {
      var g = GLYPHS[str[i]] || GLYPHS['?'];
      for (var k = 0; k < 15; k++) {
        if (g[k] === '1') ctx.fillRect(x + i * 4 * s + (k % 3) * s, y + Math.floor(k / 3) * s, s, s);
      }
    }
    return w;
  };

  /* ---------- sound ---------- */
  var audio = null;
  function ensureAudio() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
    return audio;
  }
  C.unlockAudio = function () {
    var a = ensureAudio();
    // iOS reports 'interrupted' after a call or Siri; resume() brings it back.
    if (a && a.state !== 'running') { try { a.resume(); } catch (e) {} }
  };
  // iOS only lets audio start inside a real gesture, so unlock on the first touches.
  (function () {
    var evs = ['touchend', 'pointerdown', 'click'];
    function unlock() {
      C.unlockAudio();
      if (audio && audio.state === 'running') evs.forEach(function (n) { document.removeEventListener(n, unlock, true); });
    }
    evs.forEach(function (n) { document.addEventListener(n, unlock, true); });
  })();
  C.vibrate = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  C.muted = function () { try { return localStorage.getItem('cab.mute') === '1'; } catch (e) { return false; } };
  C.setMuted = function (m) { try { localStorage.setItem('cab.mute', m ? '1' : '0'); } catch (e) {} };

  /* A square-wave blip. slide: optional end frequency for zaps and drops. */
  C.beep = function (freq, ms, type, vol, slide) {
    if (C.muted()) return;
    var a = ensureAudio(); if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + ms / 1000);
      // 4 ms attack so the wave doesn't start with a click, then a smooth decay.
      var v = vol || 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.01, ms / 1000));
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + Math.max(0.01, ms / 1000) + 0.03);
    } catch (e) {}
  };
  C.noise = function (ms, vol) {
    if (C.muted()) return;
    var a = ensureAudio(); if (!a) return;
    try {
      var n = Math.floor(a.sampleRate * ms / 1000), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      var atk = Math.min(n, Math.floor(a.sampleRate * 0.004)) || 1;   // short fade-in, no click
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (i < atk ? i / atk : 1);
      var src = a.createBufferSource(), g = a.createGain();
      src.buffer = buf; g.gain.value = vol || 0.2;
      src.connect(g); g.connect(a.destination); src.start();
    } catch (e) {}
  };

  /* ---------- loop ---------- */
  /* Fixed 60 Hz steps so physics is the same on a slow phone; render once per
     frame. At most 6 steps are run per frame (acc is clamped), so a slow frame
     or a tab waking from sleep can never snowball into a spiral of death. */
  var paused = false, clockReset = false;
  C.loop = function (update, render) {
    var last = 0, acc = 0, STEP = 1000 / 60, lastTick = performance.now();
    function tick(t) {
      if (!last || clockReset) { last = t; clockReset = false; acc = 0; }
      var dt = t - last; last = t;
      acc += Math.max(0, Math.min(100, dt));
      lastTick = t;
      if (paused) acc = 0;
      else { var n = 0; while (acc >= STEP && n++ < 6) { update(STEP / 1000); acc -= STEP; } if (acc > STEP) acc = 0; }
      render();
    }
    function frame(t) { tick(t); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    // Some browsers throttle rAF for a page they think is hidden while it's
    // actually visible (in-app browsers, split views). Keep time moving anyway.
    // A truly backgrounded page on iOS is frozen wholesale, so no gating needed.
    setInterval(function () {
      var now = performance.now();
      if (now - lastTick > 120) tick(now);
    }, 50);
    document.addEventListener('visibilitychange', function () { last = 0; acc = 0; });
  };

  /* ---------- pause ---------- */
  /* Pausing only stops update(); render keeps running. The PAUSED card has a
     big RESUME button. C.paused() lets a game check the state. */
  C.paused = function () { return paused; };
  C.pause = function () {
    if (paused) return;
    paused = true;
    C.showOverlay({ title: 'PAUSED', lines: ['Take a break!'], button: 'RESUME', onButton: C.resume });
  };
  C.resume = function () {
    if (!paused) return;
    paused = false; clockReset = true;
    C.closeOverlay();
  };
  /* Pause automatically when the page is hidden or the app is backgrounded.
     isPlaying() says whether a round is in progress (so menus aren't paused). */
  C.autoPause = function (isPlaying) {
    function hide() { if (isPlaying()) C.pause(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) hide(); });
    window.addEventListener('pagehide', hide);
  };
  /* Adds a pause button to the marquee (just before the mute button) so a
     game needs no HTML change. isPlaying() gates it to rounds in progress. */
  C.addPauseButton = function (isPlaying) {
    var bar = document.querySelector('.cab-marquee');
    if (!bar || bar.querySelector('.cab-pause')) return null;
    var btn = el('button', 'cab-btn-icon cab-pause', '⏸');
    btn.setAttribute('aria-label', 'Pause');
    btn.addEventListener('click', function () { if (isPlaying()) C.pause(); });
    var mute = bar.querySelector('#mute-btn');
    bar.insertBefore(btn, mute || null);
    return btn;
  };

  /* ---------- effects: particles, floating text, screen shake ---------- */
  /* var fx = new Cabinet.Fx(); then fx.burst(x, y, 12, ['#fff', '#ff0']),
     fx.pop('+25', x, y), fx.shake(4). Each frame: fx.update(dt) from the
     game's update(), and in render: fx.begin(ctx) ... draw the world ...
     fx.draw(ctx) ... fx.end(ctx). Everything is cheap fillRects. */
  C.Fx = function () { this.parts = []; this.pops = []; this.amp = 0; };
  C.Fx.prototype.burst = function (x, y, n, colors, speed, life) {
    colors = colors || ['#fff']; speed = speed || 60; life = life || 0.5;
    for (var i = 0; i < n && this.parts.length < 160; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.6 + Math.random() * 0.4), life: life,
        c: colors[Math.floor(Math.random() * colors.length)], s: Math.random() < 0.3 ? 2 : 1 });
    }
  };
  C.Fx.prototype.pop = function (text, x, y, color) {
    if (this.pops.length < 12) this.pops.push({ text: text, x: x, y: y, t: 0.8, c: color || '#ffb300' });
  };
  C.Fx.prototype.shake = function (amp) { this.amp = Math.max(this.amp, amp); };
  C.Fx.prototype.clear = function () { this.parts.length = 0; this.pops.length = 0; this.amp = 0; };
  C.Fx.prototype.update = function (dt) {
    for (var i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      p.t -= dt;
      if (p.t <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.vx *= 0.98;
    }
    for (var j = this.pops.length - 1; j >= 0; j--) {
      var q = this.pops[j];
      q.t -= dt; q.y -= 14 * dt;
      if (q.t <= 0) this.pops.splice(j, 1);
    }
    this.amp = Math.max(0, this.amp - 14 * dt);
  };
  C.Fx.prototype.begin = function (ctx) {
    ctx.save();
    if (this.amp > 0.2) ctx.translate(Math.round((Math.random() - 0.5) * this.amp * 2), Math.round((Math.random() - 0.5) * this.amp * 2));
  };
  C.Fx.prototype.end = function (ctx) { ctx.restore(); };
  C.Fx.prototype.draw = function (ctx) {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      ctx.globalAlpha = Math.min(1, p.t / (p.life * 0.5));
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < this.pops.length; j++) {
      var q = this.pops[j];
      C.text(ctx, q.text, Math.round(q.x), Math.round(q.y), 1, q.c, 'center');
    }
  };

  /* ---------- high scores ---------- */
  C.scores = function (id) {
    try { return JSON.parse(localStorage.getItem('cab.hi.' + id)) || []; } catch (e) { return []; }
  };
  C.isHigh = function (id, score) {
    var list = C.scores(id);
    return score > 0 && (list.length < 5 || score > list[list.length - 1].score);
  };
  C.addScore = function (id, initials, score) {
    var list = C.scores(id);
    list.push({ initials: initials, score: score });
    list.sort(function (a, b) { return b.score - a.score; });
    list = list.slice(0, 5);
    try {
      localStorage.setItem('cab.hi.' + id, JSON.stringify(list));
      localStorage.setItem('arcade.stat.' + id, 'Hi ' + list[0].score);
    } catch (e) {}
    return list;
  };
  C.lastInitials = function () {
    try { var v = localStorage.getItem('cab.initials'); return /^[A-Z]{3}$/.test(v) ? v : 'AAA'; } catch (e) { return 'AAA'; }
  };

  /* ---------- overlays ---------- */
  var overlay = null;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  C.closeOverlay = function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; };

  /* Attract / game-over card. opts: { title, lines:[], button, onButton, scores:id } */
  C.showOverlay = function (opts) {
    C.closeOverlay();
    overlay = el('div', 'cab-overlay');
    var card = el('div', 'cab-card');
    card.appendChild(el('div', 'cab-title', opts.title));
    (opts.lines || []).forEach(function (l) { card.appendChild(el('div', 'cab-line', l)); });
    if (opts.scores) {
      var list = C.scores(opts.scores);
      if (list.length) {
        var tbl = el('div', 'cab-scores');
        list.forEach(function (s, i) {
          var row = el('div', 'cab-row');
          row.appendChild(el('span', '', (i + 1) + '. ' + s.initials));
          row.appendChild(el('span', '', String(s.score)));
          tbl.appendChild(row);
        });
        card.appendChild(tbl);
      }
    }
    var buttons = opts.buttons || [{ text: opts.button || 'PRESS START', onClick: opts.onButton }];
    // opts.guard (ms): ignore taps this soon after the card appears, so a kid
    // still tapping the game doesn't instantly dismiss the game-over card.
    var shownAt = performance.now(), guard = opts.guard || 0;
    buttons.forEach(function (b) {
      var btn = el('button', 'cab-btn', b.text);
      btn.addEventListener('click', function () {
        if (performance.now() - shownAt < guard) return;
        C.unlockAudio(); C.closeOverlay(); b.onClick && b.onClick();
      });
      card.appendChild(btn);
    });
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  };

  /* Three-letter initials entry: tap a letter to bump it, hold for fast. */
  C.enterInitials = function (score, cb) {
    C.closeOverlay();
    var letters = C.lastInitials().split('');
    overlay = el('div', 'cab-overlay');
    var card = el('div', 'cab-card');
    card.appendChild(el('div', 'cab-title', 'HIGH SCORE!'));
    card.appendChild(el('div', 'cab-line', String(score)));
    card.appendChild(el('div', 'cab-line small', 'Tap a letter to change it'));
    var row = el('div', 'cab-initials');
    var boxes = letters.map(function (ch, i) {
      var col = el('div', 'cab-letter');
      var up = el('button', 'cab-arrow', '▲'), box = el('div', 'cab-box', ch), dn = el('button', 'cab-arrow', '▼');
      function bump(d) {
        var code = letters[i].charCodeAt(0) + d;
        if (code < 65) code = 90; if (code > 90) code = 65;
        letters[i] = String.fromCharCode(code); box.textContent = letters[i];
        C.beep(660 + (code - 65) * 12, 40, 'triangle', 0.1);
      }
      // Press to bump; hold to keep going. Pointer events only (no click), so no double bump.
      function hold(btn, d) {
        var t1 = null, t2 = null;
        function stop() { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; }
        btn.addEventListener('pointerdown', function (e) {
          e.preventDefault(); stop(); bump(d);
          t1 = setTimeout(function () { t2 = setInterval(function () { bump(d); }, 90); }, 380);
        });
        ['pointerup', 'pointercancel', 'pointerleave', 'contextmenu'].forEach(function (n) { btn.addEventListener(n, stop); });
      }
      hold(up, 1); hold(dn, -1);
      box.addEventListener('pointerdown', function (e) { e.preventDefault(); bump(1); });   // tapping the letter also advances it
      col.appendChild(up); col.appendChild(box); col.appendChild(dn);
      row.appendChild(col);
      return box;
    });
    card.appendChild(row);
    var ok = el('button', 'cab-btn', 'OK'), shownAt = performance.now();
    ok.addEventListener('click', function () {
      if (performance.now() - shownAt < 400) return;   // ignore stray game taps
      var ini = letters.join('');
      try { localStorage.setItem('cab.initials', ini); } catch (e) {}
      C.closeOverlay();
      cb(ini);
    });
    card.appendChild(ok);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  };

  /* Game over flow: records a high score (asking for initials) then shows the table. */
  C.gameOver = function (id, score, onRestart) {
    function table() {
      C.showOverlay({ title: 'GAME OVER', lines: ['Score ' + score], scores: id, button: 'PLAY AGAIN', onButton: onRestart, guard: 600 });
    }
    if (C.isHigh(id, score)) C.enterInitials(score, function (ini) { C.addScore(id, ini, score); table(); });
    else table();
  };

  /* Mute button wiring for the header. */
  C.wireMute = function (btn) {
    function paint() { btn.textContent = C.muted() ? '🔇' : '🔊'; }
    btn.addEventListener('click', function () { C.setMuted(!C.muted()); paint(); });
    paint();
  };

  return C;
})();
