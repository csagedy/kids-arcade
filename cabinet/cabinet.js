/* Shared "arcade cabinet" kit for the action games. Each game draws on a
   small logical canvas (say 240x320) that is scaled up with no smoothing, so
   everything is chunky on purpose. This file provides the frame, a bitmap
   font, beeps, a fixed-step game loop, high scores with initials, and the
   attract / game-over screens. Plain script, no build step. */

var Cabinet = (function () {
  var C = {};

  /* ---------- canvas ---------- */
  /* Size the canvas to the bezel and keep it sized. The logical width is
     fixed (240) and the logical height follows the phone's aspect between
     hMin and hMax, so the picture fills the screen instead of floating in a
     3:4 box. The height is decided once so a game's layout doesn't shift.
     Returns { ctx, w, h }. getContext returns the same object every time. */
  C.fit = function (canvas, w, hMin, hMax) {
    var bezel = canvas.closest('.cab-bezel') || canvas.parentNode;
    var ctx = canvas.getContext('2d');
    var pad = 2 * (parseFloat(getComputedStyle(bezel).paddingLeft) || 10);
    function avail() { return { w: bezel.clientWidth - pad, h: bezel.clientHeight - pad }; }
    var a = avail();
    // If the bezel hasn't laid out yet, estimate from the window: marquee and
    // deck are about 60 and 70px, plus safe areas and padding.
    var est = { w: window.innerWidth - 36, h: window.innerHeight - 180 };
    if (a.w < 40 || a.h < 40 || a.h < est.h * 0.6) a = est;
    var h = hMax === undefined ? hMin : Math.max(hMin, Math.min(hMax, Math.round(w * a.h / a.w)));
    canvas.width = w; canvas.height = h;
    function apply() {
      var s = avail();
      if (s.w < 40 || s.h < 40) return;
      // Never let a suspiciously short measurement shrink the screen below
      // full width; the bezel is always at least as tall as it is wide here.
      if (s.h < s.w) s.h = Math.max(s.h, window.innerHeight - 180);
      var raw = Math.min(s.w / w, s.h / h);
      var scale = raw < 1.5 ? raw : Math.floor(raw);   // integer scales keep pixels crisp
      canvas.style.width = Math.floor(w * scale) + 'px';
      canvas.style.height = Math.floor(h * scale) + 'px';
      ctx.imageSmoothingEnabled = false;
    }
    apply();
    if (!canvas.__fitted) {
      canvas.__fitted = true;
      if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(apply); }).observe(bezel);
      else window.addEventListener('resize', apply);
    }
    return { ctx: ctx, w: w, h: h };
  };

  /* Pointer position in logical pixels. */
  C.pointer = function (canvas, e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
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
  C.unlockAudio = function () { var a = ensureAudio(); if (a && a.state === 'suspended') a.resume(); };
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
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + ms / 1000 + 0.02);
    } catch (e) {}
  };
  C.noise = function (ms, vol) {
    if (C.muted()) return;
    var a = ensureAudio(); if (!a) return;
    try {
      var n = Math.floor(a.sampleRate * ms / 1000), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = a.createBufferSource(), g = a.createGain();
      src.buffer = buf; g.gain.value = vol || 0.2;
      src.connect(g); g.connect(a.destination); src.start();
    } catch (e) {}
  };

  /* ---------- loop ---------- */
  /* Fixed 60 Hz steps so physics is the same on a slow phone; render once per frame. */
  C.loop = function (update, render) {
    var last = 0, acc = 0, STEP = 1000 / 60, lastTick = performance.now();
    function tick(t) {
      if (!last) last = t;
      acc += Math.min(100, t - last); last = t;
      lastTick = t;
      while (acc >= STEP) { update(STEP / 1000); acc -= STEP; }
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
  C.lastInitials = function () { try { return localStorage.getItem('cab.initials') || 'AAA'; } catch (e) { return 'AAA'; } };

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
    var btn = el('button', 'cab-btn', opts.button || 'PRESS START');
    btn.addEventListener('click', function () { C.unlockAudio(); C.closeOverlay(); opts.onButton && opts.onButton(); });
    card.appendChild(btn);
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
    card.appendChild(el('div', 'cab-line small', 'Enter your initials'));
    var row = el('div', 'cab-initials');
    var boxes = letters.map(function (ch, i) {
      var col = el('div', 'cab-letter');
      var up = el('button', 'cab-arrow', '▲'), box = el('div', 'cab-box', ch), dn = el('button', 'cab-arrow', '▼');
      function bump(d) {
        var code = letters[i].charCodeAt(0) + d;
        if (code < 65) code = 90; if (code > 90) code = 65;
        letters[i] = String.fromCharCode(code); box.textContent = letters[i];
        C.beep(660, 40);
      }
      up.addEventListener('click', function () { bump(1); });
      dn.addEventListener('click', function () { bump(-1); });
      col.appendChild(up); col.appendChild(box); col.appendChild(dn);
      row.appendChild(col);
      return box;
    });
    card.appendChild(row);
    var ok = el('button', 'cab-btn', 'OK');
    ok.addEventListener('click', function () {
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
      C.showOverlay({ title: 'GAME OVER', lines: ['Score ' + score], scores: id, button: 'PLAY AGAIN', onButton: onRestart });
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
