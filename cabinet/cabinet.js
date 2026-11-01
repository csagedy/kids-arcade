/* Shared "arcade cabinet" kit for the action games. Each game draws on a
   small logical canvas (about 240 px on its short side) that is scaled up by a
   whole number of device pixels with no smoothing, so every pixel is the same
   size and razor sharp. The playfield's shape follows the screen: tall on a
   phone, nearly square on an iPad in portrait, wide in landscape (each game
   says how far it may stretch).

   The page around it is the arcade kit (kit/kit.js + kit/kit.css): kit top
   bar, icon buttons, score chips, cards and the one shared mute switch. In
   landscape the bar becomes a side panel with the scores, the high-score
   table and help. This file adds the cabinet pieces: screen sizing, a 3x5
   bitmap font, square-wave beeps, a fixed-step loop, effects, high scores
   with three-letter initials, and the attract / pause / game-over cards.
   Plain script, no build step. Needs kit.js loaded first. */

var Cabinet = (function () {
  var C = {};
  var hasKit = typeof Kit !== 'undefined';
  C.reduced = hasKit ? Kit.reduced : false;

  /* Palette: the menu's neon on a black CRT. */
  C.COL = {
    bg: '#05060f', ink: '#f6f5ff', dim: '#3a4170', faint: '#1a1f3d',
    red: '#ff4d6d', orange: '#ff9f43', yellow: '#ffd23f', green: '#3ddc84',
    lime: '#b6ff6a', cyan: '#7cf2ff', blue: '#4c8dff', purple: '#a77bff', pink: '#ff7ac6', white: '#ffffff'
  };

  /* ---------- screen ---------- */
  /* Cabinet.screen(canvas, opts) sizes the playfield for the space it has.
     opts: { minAspect, maxAspect (width / height), minShort (logical px on
     the short side, default 224), turn (bool: the game is laid out in
     portrait; in landscape the picture is turned a quarter so its long side
     runs across the screen) }.
     Returns { ctx, w, h, turned }. w and h are the game's logical size (in
     the game's own frame: for a turned screen the canvas is h wide, w tall).
     Call it whenever a new game is built. A mid-round rotation rebuilds the
     playfield too when the game registered Cabinet.keep (see "keeping a
     round" below); otherwise the same picture is just rescaled. */
  var scr = null;   // { canvas, opts, lw, lh, turned }
  function avail(canvas) {
    var stage = canvas.closest('.k-stage') || canvas.parentNode;
    var bezel = canvas.closest('.cab-bezel');
    // Measure with the canvas shrunk out of the way: right after a turn the
    // old picture can still be stretching the stage (put back below, in the
    // same task, so nothing flickers).
    var ow = canvas.style.width, oh = canvas.style.height;
    canvas.style.width = canvas.style.height = '1px';
    var cs = getComputedStyle(stage);
    var w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    canvas.style.width = ow; canvas.style.height = oh;
    if (bezel) {
      var bs = getComputedStyle(bezel);
      w -= parseFloat(bs.paddingLeft) + parseFloat(bs.paddingRight);
      h -= parseFloat(bs.paddingTop) + parseFloat(bs.paddingBottom);
    }
    if (!(w > 60) || !(h > 60)) { w = window.innerWidth - 40; h = window.innerHeight - 140; }
    return { w: Math.max(60, w), h: Math.max(60, h) };
  }
  function cssSize(canvas, cw, ch) {
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    var crt = canvas.parentNode;
    if (crt) crt.style.setProperty('--cab-px', (cw / canvas.width) + 'px');
  }
  /* What C.screen would build for the space there is now. */
  function measure(canvas, o) {
    var a = avail(canvas), dpr = window.devicePixelRatio || 1;
    var land = a.w > a.h * 1.05, turned = !!o.turn && land;
    var minA = o.minAspect || 0.5, maxA = o.maxAspect || 2;
    // aspect of the picture on screen (width / height)
    var lo = turned ? 1 / maxA : minA, hi = turned ? 1 / minA : maxA;
    var asp = Math.max(lo, Math.min(hi, a.w / a.h));
    var bw = Math.min(a.w, a.h * asp), bh = bw / asp;
    var BW = Math.floor(bw * dpr), BH = Math.floor(bh * dpr);
    // Whole device pixels per logical pixel, picked so the short side lands
    // near minShort (never under 92% of it). A plain floor() left a 2x phone
    // at 1 CSS px per game pixel: everything a third the size it is on an iPad.
    var minShort = o.minShort || 224;
    var k = Math.max(1, Math.floor(Math.min(BW, BH) / (minShort * 0.92)));
    var lw = Math.max(1, Math.floor(BW / k)), lh = Math.max(1, Math.floor(BH / k));
    return { lw: lw, lh: lh, cw: lw * k / dpr, ch: lh * k / dpr, turned: turned };
  }
  C.screen = function (canvas, o) {
    o = o || {};
    var m = measure(canvas, o), lw = m.lw, lh = m.lh, turned = m.turned;
    canvas.width = lw; canvas.height = lh;
    cssSize(canvas, m.cw, m.ch);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    scr = { canvas: canvas, opts: o, lw: lw, lh: lh, turned: turned };
    return { ctx: ctx, w: turned ? lh : lw, h: turned ? lw : lh, turned: turned };
  };
  /* Keep the current picture but rescale it to the space now available. */
  C.refit = function () {
    if (!scr) return;
    var a = avail(scr.canvas), asp = scr.lw / scr.lh;
    var bw = Math.min(a.w, a.h * asp);
    cssSize(scr.canvas, Math.floor(bw), Math.floor(bw / asp));
  };
  /* Would C.screen now give a differently shaped playfield (the device
     turned, or the space changed shape by more than a little)? Small changes,
     like a toolbar coming and going, only need a refit. */
  C.shapeChanged = function () {
    if (!scr) return false;
    var m = measure(scr.canvas, scr.opts);
    if (m.turned !== scr.turned) return true;
    var was = scr.lw / scr.lh, now = m.lw / m.lh;
    return Math.abs(now - was) / was > 0.12 || Math.abs(m.lw - scr.lw) / scr.lw > 0.12;
  };
  /* Cabinet.onLayout(fn): fn() runs (debounced) when the window changes size
     or turns. A game rebuilds its screen there when no round is in play and
     calls Cabinet.refit() otherwise. The default is refit. While a round is
     in play in a game that registered Cabinet.keep, a real change of shape
     goes to C.reshape instead (the round is rebuilt for the new shape). */
  var layoutFn = null, layoutTimer = 0;
  C.onLayout = function (fn) { layoutFn = fn; };
  function relayout() {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () {
      if (keeper && playingFn() && C.shapeChanged()) C.reshape();
      else if (layoutFn) layoutFn();
      else C.refit();
    }, 120);
  }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', function () { setTimeout(relayout, 200); });

  /* Pointer position in logical pixels (in the game's frame). */
  C.pointer = function (canvas, e) {
    var r = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) * canvas.width / r.width, y = (e.clientY - r.top) * canvas.height / r.height;
    if (scr && scr.turned && scr.canvas === canvas) return { x: y, y: canvas.width - x };
    return { x: x, y: y };
  };
  /* For a turned screen: set the transform that draws the game's frame. */
  C.frame = function (ctx) {
    if (scr && scr.turned) ctx.setTransform(0, 1, -1, 0, scr.lw, 0);
    else ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  /* Scale of one logical pixel in CSS px, for gains that should feel the same everywhere. */
  C.cssPerPx = function () {
    if (!scr) return 1;
    var r = scr.canvas.getBoundingClientRect();
    return r.width / scr.canvas.width || 1;
  };

  /* Text size for the screen: on small screens (a logical pixel under ~2 CSS
     px) text gets one size bigger so it stays readable. */
  C.fs = function (base) { return C.cssPerPx() < 2.2 ? base + 1 : base; };

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
    '<': '001010100010001', '+': '000010111010000', "'": '010010000000000', ',': '000000000010100',
    '*': '000101010101000', '=': '000111000111000', '(': '010100100100010', ')': '010001001001010'
  };
  function glyphs(ctx, str, x, y, s) {
    for (var i = 0; i < str.length; i++) {
      var g = GLYPHS[str[i]] || GLYPHS['?'];
      for (var k = 0; k < 15; k++) {
        if (g[k] === '1') ctx.fillRect(x + i * 4 * s + (k % 3) * s, y + Math.floor(k / 3) * s, s, s);
      }
    }
  }
  /* Draw text at (x, y) with pixel size s. align: 'left' | 'center' | 'right'.
     shadow: a colour for a one-pixel drop shadow (keeps text readable over play). */
  C.text = function (ctx, str, x, y, s, color, align, shadow) {
    str = String(str).toUpperCase();
    s = s || 1;
    var w = str.length * 4 * s - s;
    x = Math.round(x); y = Math.round(y);
    if (align === 'center') x -= Math.floor(w / 2);
    else if (align === 'right') x -= w;
    if (shadow) { ctx.fillStyle = shadow; glyphs(ctx, str, x + s, y + s, s); }
    ctx.fillStyle = color || '#fff';
    glyphs(ctx, str, x, y, s);
    return w;
  };
  C.textWidth = function (str, s) { return String(str).length * 4 * (s || 1) - (s || 1); };

  /* Pixel art from strings: each character is a palette key, '.' is clear. */
  C.sprite = function (ctx, rows, x, y, pal, flipX) {
    x = Math.round(x); y = Math.round(y);
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], n = row.length;
      for (var c = 0; c < n; c++) {
        var ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        // run-length along the row: fewer fillRects
        var run = 1;
        while (c + run < n && row[c + run] === ch) run++;
        ctx.fillRect(flipX ? x + n - c - run : x + c, y + r, run, 1);
        c += run - 1;
      }
    }
  };
  /* A repeatable pseudo-random number in [0, 1) for seed n (scenery that
     must look scattered but stay put). */
  C.hash = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /* A filled pixel disc (no anti-aliasing). */
  C.disc = function (ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    cx = Math.round(cx); cy = Math.round(cy);
    for (var dy = -r; dy <= r; dy++) {
      var dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
      ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  };

  /* ---------- sound ---------- */
  var audio = null;
  function ensureAudio() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { audio = new AC(); } catch (e) { audio = null; } }
    return audio;
  }
  C.unlockAudio = function () {
    var a = ensureAudio();
    // iOS reports 'interrupted' after a call or Siri; resume() brings it back.
    if (a && a.state !== 'running') { try { a.resume(); } catch (e) {} }
  };
  // iOS only lets audio start inside a real gesture, so unlock on the first touches.
  (function () {
    var evs = ['touchend', 'pointerdown', 'click', 'keydown'];
    function unlock() { C.unlockAudio(); }
    evs.forEach(function (n) { document.addEventListener(n, unlock, true); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && audio) C.unlockAudio(); });
  })();
  /* One arcade-wide mute (Kit's 'arcade.mute'; Kit keeps the old 'cab.mute' in step). */
  C.muted = function () {
    if (hasKit) return Kit.muted();
    try { return localStorage.getItem('cab.mute') === '1'; } catch (e) { return false; }
  };
  C.setMuted = function (m) { if (hasKit) Kit.setMuted(m); };
  C.vibrate = function (ms) { if (C.muted()) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  /* A square-wave blip. slide: optional end frequency for zaps and drops.
     when: seconds from now (for little tunes). */
  C.beep = function (freq, ms, type, vol, slide, when) {
    if (C.muted()) return;
    var a = ensureAudio(); if (!a || a.state !== 'running') return;
    try {
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (when || 0), d = Math.max(0.01, ms / 1000);
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      var v = (vol || 0.12) * 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.004);   // 4 ms attack: no click
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + d + 0.03);
    } catch (e) {}
  };
  /* A little tune: notes [freq...] played gap ms apart. */
  C.jingle = function (notes, gap, ms, type, vol) {
    for (var i = 0; i < notes.length; i++) if (notes[i]) C.beep(notes[i], ms || gap, type || 'square', vol || 0.09, 0, i * gap / 1000);
  };
  var noiseBuf = null;
  C.noise = function (ms, vol, lowpass) {
    if (C.muted()) return;
    var a = ensureAudio(); if (!a || a.state !== 'running') return;
    try {
      if (!noiseBuf) {
        var n = a.sampleRate;   // one second of white noise, reused
        noiseBuf = a.createBuffer(1, n, a.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      var src = a.createBufferSource(), g = a.createGain(), t = a.currentTime, dur = Math.max(0.02, ms / 1000);
      src.buffer = noiseBuf;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((vol || 0.2) * 0.8, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = src;
      if (lowpass && a.createBiquadFilter) {
        var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
        src.connect(f); node = f;
      }
      node.connect(g); g.connect(a.destination);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    } catch (e) {}
  };
  /* Common tunes */
  C.sfx = {
    levelUp: function () { C.jingle([523, 659, 784, 1047, 0, 784, 1047], 75, 90, 'square', 0.08); },
    start: function () { C.jingle([392, 523, 659, 784], 70, 80, 'square', 0.07); },
    lose: function () { C.beep(330, 160, 'square', 0.1, 220); C.beep(220, 360, 'square', 0.1, 70, 0.17); },
    over: function () { C.jingle([392, 330, 262, 196], 180, 200, 'triangle', 0.14); },
    power: function () { C.jingle([523, 784, 1047, 1568], 50, 60, 'square', 0.07); },
    coin: function () { C.beep(988, 60, 'square', 0.08); C.beep(1319, 140, 'square', 0.08, 0, 0.06); }
  };

  /* ---------- loop ---------- */
  /* Fixed 60 Hz steps so physics is the same on a slow phone; render once per
     frame. At most 6 steps are run per frame (acc is clamped), so a slow frame
     or a tab waking from sleep can never snowball into a spiral of death. */
  var paused = false, hold = false, clockReset = false;
  C.time = 0;   // seconds of unpaused play, for animations
  C.loop = function (update, render) {
    var last = 0, acc = 0, STEP = 1000 / 60, lastTick = performance.now();
    function tick(t) {
      if (!last || clockReset) { last = t; clockReset = false; acc = 0; }
      var dt = t - last; last = t;
      acc += Math.max(0, Math.min(100, dt));
      lastTick = t;
      if (paused || hold) acc = 0;
      else { var n = 0; while (acc >= STEP && n++ < 6) { C.time += STEP / 1000; update(STEP / 1000); acc -= STEP; } if (acc > STEP) acc = 0; }
      render();
    }
    function frame(t) { tick(t); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    // Some browsers throttle rAF for a page they think is hidden while it's
    // actually visible (in-app browsers, split views). Keep time moving anyway.
    setInterval(function () {
      var now = performance.now();
      if (now - lastTick > 120) tick(now);
    }, 50);
    document.addEventListener('visibilitychange', function () { last = 0; acc = 0; });
  };

  /* ---------- pause ---------- */
  /* Pausing only stops update(); render keeps running. The pause card offers
     Resume and Start over (Cabinet.onRestart sets what that does). */
  var restartFn = null, playingFn = function () { return false; }, countNext = false;
  C.onRestart = function (fn) { restartFn = fn; };
  /* True while the game is frozen: the pause card, or the 3-2-1 count. */
  C.paused = function () { return paused || hold; };
  /* opts (optional): { title, text, play } for a pause the game didn't ask
     for (the screen turned). */
  C.pause = function (o) {
    if (paused) return;
    o = o || {};
    paused = true;
    var buttons = [{ label: o.play || 'Play', value: 'resume', primary: true, icon: 'play' }];
    if (restartFn) buttons.unshift({ label: 'Start over', value: 'restart', icon: 'restart' });
    card({ title: o.title || 'Paused', text: o.text || 'Take a break!', icon: 'pause', buttons: buttons, dismissValue: 'resume', help: true }).then(function (v) {
      paused = false; clockReset = true;
      if (v === 'restart' && restartFn) { C.stopCount(); restartFn(); }
      else if (countNext) C.countdown();
    });
  };
  C.resume = function () {
    if (!paused) return;
    paused = false; clockReset = true;
    if (hasKit) Kit.closeAll();
  };
  /* Pause automatically when the page is hidden or the app is backgrounded.
     isPlaying() says whether a round is in progress (so menus aren't paused). */
  C.autoPause = function (isPlaying) {
    playingFn = isPlaying;
    function hide() { if (isPlaying() && !paused) C.pause(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) hide(); });
    window.addEventListener('pagehide', hide);
  };
  /* Wire the bar's pause button (#pause-btn). isPlaying() gates it. */
  C.addPauseButton = function (isPlaying) {
    playingFn = isPlaying;
    var btn = document.getElementById('pause-btn');
    if (!btn) return null;
    btn.addEventListener('click', function () { if (isPlaying() && !overlayUp()) C.pause(); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlaying() && !overlayUp()) { e.preventDefault(); C.pause(); }
    });
    function paint() { btn.classList.toggle('k-disabled', !isPlaying()); }
    setInterval(paint, 300); paint();
    return btn;
  };
  function overlayUp() { return hasKit ? Kit.overlayOpen() : !!document.querySelector('.k-overlay'); }
  C.overlayOpen = overlayUp;

  /* A 3-2-1 count over the screen before play goes on, so nothing can hit the
     kid the moment a round comes back (after Continue, or a turn of the
     screen). Updates are held meanwhile; the picture keeps drawing. */
  var countEl = null, countTimer = 0;
  C.countdown = function (done) {
    countNext = false;
    clearInterval(countTimer);
    var crt = scr && scr.canvas.parentNode;
    if (!countEl && crt) { countEl = document.createElement('div'); countEl.className = 'cab-count'; countEl.setAttribute('aria-hidden', 'true'); }
    if (countEl && crt && countEl.parentNode !== crt) crt.appendChild(countEl);
    var n = 3;
    hold = true;
    function show() {
      if (countEl) { countEl.textContent = String(n); countEl.classList.remove('cab-count--on'); void countEl.offsetWidth; countEl.classList.add('cab-count--on'); }
      C.beep(n === 1 ? 784 : 523, 70, 'square', 0.06);
    }
    show();
    countTimer = setInterval(function () {
      if (paused) return;   // paused mid-count: wait, then carry on
      if (--n > 0) { show(); return; }
      clearInterval(countTimer);
      if (countEl) { countEl.textContent = ''; countEl.classList.remove('cab-count--on'); }
      hold = false; clockReset = true;
      C.beep(1047, 90, 'square', 0.06);
      if (done) done();
    }, 600);
  };
  /* Stop a count early (a new round started). */
  C.stopCount = function () {
    clearInterval(countTimer); hold = false; countNext = false;
    if (countEl) { countEl.textContent = ''; countEl.classList.remove('cab-count--on'); }
  };

  /* ---------- keeping a round ---------- */
  /* iOS throws away a tab that has been in the background a while (a car
     trip is full of those), and a reload used to lose the round. A game
     registers once:
       Cabinet.keep({ id, save: fn() -> data | null, restore: fn(data, live) })
     save() returns the round as plain JSON in a form that doesn't depend on
     the screen size (grid cells, fractions of the width...), or null when
     there is nothing fair to keep. restore(data, live) lays the screen out
     for the space there is now (the game's own layout()) and rebuilds the
     round from data, throwing on anything that doesn't add up (C.int and
     friends below make that short). live is true for a turn of the screen
     (keep things where they are, in flight), false for a reload (the game may
     go back to a fair checkpoint, like the start of the current life).
     Cabinet saves the round to localStorage ('cab.save.<id>') when the page
     is hidden or closed, every few seconds of play, and after a turn; it
     never saves outside a round. C.dropSave() forgets it (game over does this
     for you). On load the game asks C.loadSave() and, if there is one,
     offers Continue on the attract card (C.attract({ resume: 'summary' })). */
  var keeper = null, SAVE_DAYS = 14;
  C.keep = function (o) {
    keeper = o;
    function now() { C.saveNow(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) now(); });
    window.addEventListener('pagehide', now);
    setInterval(function () { if (!document.hidden && !paused && !hold) now(); }, 3000);
  };
  C.saveNow = function () {
    if (!keeper || !playingFn()) return;
    var d = null;
    try { d = keeper.save(); } catch (e) { d = null; }
    try {
      if (d) localStorage.setItem('cab.save.' + keeper.id, JSON.stringify({ v: 1, at: Date.now(), d: d }));
      else localStorage.removeItem('cab.save.' + keeper.id);
    } catch (e) {}
  };
  C.dropSave = function () {
    if (!keeper) return;
    try { localStorage.removeItem('cab.save.' + keeper.id); } catch (e) {}
  };
  /* The saved round's data, or null (none, too old, or not ours). */
  C.loadSave = function () {
    if (!keeper) return null;
    var s = null, raw = null;
    try { raw = localStorage.getItem('cab.save.' + keeper.id); s = JSON.parse(raw); } catch (e) { s = null; }
    var ok = s && typeof s === 'object' && s.v === 1 && typeof s.at === 'number' &&
      Date.now() - s.at < SAVE_DAYS * 864e5 && s.d && typeof s.d === 'object';
    if (!ok) { if (raw !== null) C.dropSave(); return null; }
    return s.d;
  };
  /* Rebuild a round with keeper.restore; false (and the save is dropped)
     if the data didn't add up. */
  C.tryRestore = function (d, live) {
    try { keeper.restore(d, !!live); return true; } catch (e) { C.dropSave(); return false; }
  };
  /* The screen turned mid-round: capture the round, lay the screen out for
     the new shape, rebuild the round in it, and hold it paused until the kid
     says go (then 3-2-1). Nothing is reset, refilled or lost on the way. */
  C.reshape = function () {
    var d = null;
    try { d = keeper.save(); } catch (e) { d = null; }
    if (!d || !C.tryRestore(d, true)) { C.refit(); return; }
    C.saveNow();
    countNext = true;
    if (!paused) C.pause({ title: 'Turned around!', text: 'The screen changed shape. Ready?', play: 'Keep playing' });
  };
  /* Checks for restore(): each returns the value or throws. */
  function bad() { throw new Error('bad save'); }
  C.check = function (ok) { if (!ok) bad(); };
  C.num = function (v, lo, hi) { if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) bad(); return v; };
  C.int = function (v, lo, hi) { C.num(v, lo, hi); if (Math.floor(v) !== v) bad(); return v; };
  C.list = function (v, max) { if (!Array.isArray(v) || v.length > max) bad(); return v; };
  C.bool = function (v) { if (typeof v !== 'boolean') bad(); return v; };

  /* ---------- effects: particles, rings, flashes, floating text, shake ---------- */
  /* var fx = new Cabinet.Fx(); then fx.burst(x, y, 12, ['#fff', '#ff0']),
     fx.ring(x, y, color), fx.flash(color), fx.pop('+25', x, y), fx.shake(4).
     Each frame: fx.update(dt) from the game's update(), and in render:
     fx.begin(ctx) ... draw the world ... fx.draw(ctx) ... fx.end(ctx, w, h). */
  C.Fx = function () { this.parts = []; this.pops = []; this.rings = []; this.amp = 0; this.fl = null; };
  C.Fx.prototype.burst = function (x, y, n, colors, speed, life, o) {
    o = o || {};
    colors = colors || ['#fff']; speed = speed || 60; life = life || 0.5;
    var grav = o.gravity === undefined ? 90 : o.gravity;
    for (var i = 0; i < n && this.parts.length < 260; i++) {
      var a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2;
      var v = speed * (0.35 + Math.random() * 0.65);
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.6 + Math.random() * 0.4), life: life,
        c: colors[Math.floor(Math.random() * colors.length)], s: o.size || (Math.random() < 0.35 ? 2 : 1), g: grav });
    }
  };
  C.Fx.prototype.ring = function (x, y, color, r, life) {
    if (this.rings.length < 24) this.rings.push({ x: x, y: y, c: color || '#fff', r: r || 14, t: life || 0.35, life: life || 0.35 });
  };
  C.Fx.prototype.flash = function (color, strength) {
    this.fl = { c: color || '#fff', a: (strength || 0.35) * (C.reduced ? 0.4 : 1) };
  };
  C.Fx.prototype.pop = function (text, x, y, color, size) {
    if (this.pops.length < 14) this.pops.push({ text: text, x: x, y: y, t: 0.9, c: color || C.COL.yellow, s: size || C.fs(1) });
  };
  C.Fx.prototype.shake = function (amp) { if (!C.reduced) this.amp = Math.max(this.amp, amp); };
  C.Fx.prototype.clear = function () { this.parts.length = 0; this.pops.length = 0; this.rings.length = 0; this.amp = 0; this.fl = null; };
  C.Fx.prototype.update = function (dt) {
    for (var i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      p.t -= dt;
      if (p.t <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.985;
    }
    for (var j = this.pops.length - 1; j >= 0; j--) {
      var q = this.pops[j];
      q.t -= dt; q.y -= 16 * dt * Math.min(1, q.t * 2);
      if (q.t <= 0) this.pops.splice(j, 1);
    }
    for (var k = this.rings.length - 1; k >= 0; k--) { this.rings[k].t -= dt; if (this.rings[k].t <= 0) this.rings.splice(k, 1); }
    if (this.fl) { this.fl.a -= dt * 2.2; if (this.fl.a <= 0) this.fl = null; }
    this.amp = Math.max(0, this.amp - 16 * dt);
  };
  C.Fx.prototype.begin = function (ctx) {
    ctx.save();
    if (this.amp > 0.3) ctx.translate(Math.round((Math.random() - 0.5) * this.amp * 2), Math.round((Math.random() - 0.5) * this.amp * 2));
  };
  C.Fx.prototype.draw = function (ctx) {
    for (var k = 0; k < this.rings.length; k++) {
      var g = this.rings[k], f = 1 - g.t / g.life, r = Math.max(1, Math.round(g.r * (0.25 + 0.75 * f)));
      ctx.globalAlpha = Math.max(0, 1 - f);
      ctx.strokeStyle = g.c; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(Math.round(g.x) + 0.5, Math.round(g.y) + 0.5, r, 0, Math.PI * 2); ctx.stroke();
    }
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      ctx.globalAlpha = Math.min(1, p.t / (p.life * 0.5));
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < this.pops.length; j++) {
      var q = this.pops[j];
      if (q.t < 0.25 && Math.floor(q.t * 30) % 2) continue;   // blink out
      C.text(ctx, q.text, q.x, q.y, q.s, q.c, 'center', '#000');
    }
  };
  /* end(ctx, w, h): undo the shake and lay the flash over everything. */
  C.Fx.prototype.end = function (ctx, w, h) {
    ctx.restore();
    if (this.fl && w) {
      ctx.globalAlpha = Math.max(0, Math.min(1, this.fl.a));
      ctx.fillStyle = this.fl.c; ctx.fillRect(-4, -4, w + 8, h + 8);
      ctx.globalAlpha = 1;
    }
  };

  /* ---------- HUD: kit score chips in the bar ---------- */
  /* Cabinet.hud([{ id, label, accent, hearts, more }]) builds the chips in
     #cab-stats. hearts: the value is drawn as that many hearts. more: only on
     screens with room (hidden on phones in portrait). Cabinet.setHud(id, v). */
  var hudEls = {}, hudVals = {}, hudBump = {};
  C.hud = function (defs) {
    var box = document.getElementById('cab-stats');
    if (!box) return;
    box.innerHTML = '';
    hudEls = {}; hudVals = {};
    defs.forEach(function (d) {
      var chip = document.createElement('div');
      chip.className = 'k-stat' + (d.accent ? ' k-stat--accent' : '') + (d.more ? ' cab-more' : '') + (d.hearts ? ' cab-lives' : '');
      chip.innerHTML = '<span class="k-stat__label"></span><b class="k-stat__val"></b>';
      chip.firstChild.textContent = d.label;
      box.appendChild(chip);
      hudEls[d.id] = { chip: chip, val: chip.lastChild, hearts: d.hearts };
    });
  };
  C.setHud = function (id, v) {
    var h = hudEls[id];
    if (!h || hudVals[id] === v) return;
    var old = hudVals[id];
    hudVals[id] = v;
    if (h.hearts) {
      var n = Math.max(0, v | 0), s = '';
      if (n > 5) s = (hasKit ? Kit.icon('heart') : '') + '<span>x' + n + '</span>';
      else for (var i = 0; i < n; i++) s += hasKit ? Kit.icon('heart') : '*';
      h.val.innerHTML = s || '<span>0</span>';
      h.chip.setAttribute('aria-label', n + ' lives');
    } else h.val.textContent = String(v);
    if (old !== undefined && hasKit) {
      var now = performance.now();
      if (!hudBump[id] || now - hudBump[id] > 180) { hudBump[id] = now; Kit.anim(h.chip, 'k-bump'); }
      if (h.hearts && v < old) Kit.anim(h.chip, 'cab-hurt');
    }
  };

  /* ---------- high scores ---------- */
  C.scores = function (id) {
    var l = null;
    try { l = JSON.parse(localStorage.getItem('cab.hi.' + id)); } catch (e) {}
    if (!Array.isArray(l)) return [];
    // drop anything an old version (or a curious kid) left that isn't a real entry
    return l.filter(function (s) {
      return s && typeof s === 'object' && typeof s.score === 'number' && isFinite(s.score) && s.score >= 0;
    }).map(function (s) {
      return { initials: /^[A-Z]{1,3}$/.test(s.initials) ? s.initials : '???', score: Math.floor(s.score) };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
  };
  C.best = function (id) { var l = C.scores(id); return l.length ? l[0].score : 0; };
  C.isHigh = function (id, score) {
    var list = C.scores(id);
    return score > 0 && (list.length < 5 || score > list[list.length - 1].score);
  };
  C.addScore = function (id, initials, score) {
    var list = C.scores(id);
    var entry = { initials: initials, score: score };
    list.push(entry);
    list.sort(function (a, b) { return b.score - a.score; });
    list = list.slice(0, 5);
    try {
      localStorage.setItem('cab.hi.' + id, JSON.stringify(list));
      localStorage.setItem('arcade.stat.' + id, 'Hi ' + list[0].score);
    } catch (e) {}
    C.sideScores(id, list.indexOf(entry));
    return list;
  };
  C.lastInitials = function () {
    try { var v = localStorage.getItem('cab.initials'); return /^[A-Z]{3}$/.test(v) ? v : 'AAA'; } catch (e) { return 'AAA'; }
  };
  function tableHtml(list, mark) {
    if (!list.length) return '<div class="cab-table cab-table--empty">No high scores yet.<br>Be the first!</div>';
    var h = '<ol class="cab-table">';
    list.forEach(function (s, i) {
      h += '<li' + (i === mark ? ' class="cab-new"' : '') + '><span class="cab-rank">' + (i + 1) + '</span><span class="cab-ini">' +
        esc(s.initials) + '</span><span class="cab-pts">' + esc(s.score) + '</span></li>';
    });
    return h + '</ol>';
  }
  C.tableHtml = function (id, mark) { return tableHtml(C.scores(id), mark); };
  /* The high-score table in the landscape side panel (#cab-hi). */
  var sideId = null;
  C.sideScores = function (id, mark) {
    if (id) sideId = id;
    var box = document.getElementById('cab-hi');
    if (!box || !sideId) return;
    box.innerHTML = '<div class="cab-hi-title">High scores</div>' + tableHtml(C.scores(sideId), mark);
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- cards (kit overlays with a CRT touch) ---------- */
  /* card({ title, text, icon, marquee, scores: id, mark, html, buttons, guard,
     dismissValue, sound, confetti, stats, badge, onOpen }) -> Promise(value) */
  function card(o) {
    if (!hasKit) return Promise.resolve(o.buttons && o.buttons[0] && o.buttons[0].value);
    return Kit.result({
      icon: o.marquee ? undefined : o.icon,
      title: o.marquee ? '' : o.title,
      text: o.text ? esc(o.text) : '',
      stats: o.stats, badge: o.badge,
      buttons: o.buttons, sound: o.sound === undefined ? false : o.sound, confetti: o.confetti,
      cardClass: 'cab-card' + (o.marquee ? ' cab-card--attract' : '') + (o.html ? ' cab-card--extra' : '') + (o.cls ? ' ' + o.cls : ''),
      dismissValue: o.dismissValue,
      onOpen: function (cardEl, finish) {
        if (o.marquee) {
          var h2 = cardEl.querySelector('h2');
          var m = document.createElement('div');
          m.className = 'cab-title';
          m.textContent = o.title;
          if (h2) h2.parentNode.replaceChild(m, h2); else cardEl.insertBefore(m, cardEl.firstChild);
        }
        var row = cardEl.querySelector('.k-row');
        if (o.html) {
          var extra = document.createElement('div');
          extra.className = 'cab-extra';
          extra.innerHTML = o.html;
          cardEl.insertBefore(extra, row);
        }
        if (o.scores) {
          var t = document.createElement('div');
          t.className = 'cab-card-scores';
          t.innerHTML = tableHtml(C.scores(o.scores), o.mark);
          cardEl.insertBefore(t, row);
        }
        // "How to play" on the attract and pause cards: in portrait the side
        // panel (with its help button) is hidden, so this is the way back to it
        if (o.help && helpSteps) {
          var hb = document.createElement('button');
          hb.type = 'button';
          hb.setAttribute('aria-label', 'How to play');
          hb.addEventListener('click', function (e) {
            e.stopPropagation();   // not a card choice: the help card opens on top
            if (hasKit) Kit.sfx.tap();
            C.showHelp();
          });
          if (o.help === 'row' && row && row.children.length < 2) {
            // an icon button beside Play: costs no height on a short screen
            hb.className = 'k-btn k-btn--lg k-btn--icon cab-card-help cab-card-help--icon';
            hb.innerHTML = hasKit ? Kit.icon('help') : '?';
            row.insertBefore(hb, row.firstChild);
          } else {
            hb.className = 'k-btn k-btn--ghost k-btn--sm cab-card-help';
            hb.innerHTML = (hasKit ? Kit.icon('help') : '') + '<span>How to play</span>';
            if (row) row.parentNode.insertBefore(hb, row.nextSibling); else cardEl.appendChild(hb);
          }
        }
        // a short guard so a kid still tapping the game can't dismiss the card by accident
        if (o.guard && row) {
          var btns = row.querySelectorAll('button');
          for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
          setTimeout(function () { for (var i = 0; i < btns.length; i++) btns[i].disabled = false; }, o.guard);
        }
        if (o.onOpen) o.onOpen(cardEl, finish);
      }
    });
  }
  C.card = card;

  /* Attract card: the game's name in lights, a line or two, the high-score
     table and a big Play button. opts: { title, lines:[], scores: id,
     buttons: [{ label, value, primary }], html, onOpen } -> Promise(value).
     opts.resume: a saved round's summary ('Level 3 · 1,240 points'): the
     card offers Continue (value 'continue') and New game ('play', which
     forgets the save) instead, without the options html. */
  C.attract = function (o) {
    if (o.resume) {
      return card({ marquee: true, title: o.title, text: 'Your game is waiting: ' + o.resume + '.', scores: o.scores, help: 'row', cls: 'cab-card--resume',
        buttons: [{ label: 'New game', value: 'play', icon: 'new' }, { label: 'Continue', value: 'continue', primary: true, icon: 'play' }] })
        .then(function (v) { if (v !== 'continue') C.dropSave(); return v === 'continue' ? v : 'play'; });
    }
    return card({ marquee: true, title: o.title, text: (o.lines || []).join(' '), scores: o.scores, html: o.html, onOpen: o.onOpen, help: 'row',
      buttons: o.buttons || [{ label: 'Play', value: 'play', primary: true, icon: 'play' }] });
  };

  /* Help: the kit how-to card. Cabinet.help(id, steps) remembers the steps,
     wires #help-btn, and Cabinet.firstHelp() shows them once per game. */
  var helpKey = null, helpSteps = null, helpTitle = null;
  C.help = function (id, steps, title) {
    helpKey = 'cab-' + id; helpSteps = steps; helpTitle = title;
    var btns = document.querySelectorAll('.cab-help-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        if (playingFn() && !paused) { paused = true; C.showHelp().then(function () { paused = false; clockReset = true; }); }
        else if (!playingFn()) C.showHelp();
      });
    }
  };
  C.showHelp = function () {
    if (!hasKit || !helpSteps) return Promise.resolve();
    return Kit.howTo(helpKey, helpSteps, { force: true, title: helpTitle || 'How to play' });
  };
  C.firstHelp = function () {
    if (!hasKit || !helpSteps) return Promise.resolve();
    return Kit.howTo(helpKey, helpSteps, { title: helpTitle || 'How to play' });
  };

  /* Three-letter initials: tap the arrows (hold to run) or the letter itself. */
  C.enterInitials = function (score, cb) {
    var letters = C.lastInitials().split('');
    var html = '<div class="cab-initials">';
    for (var i = 0; i < 3; i++) {
      html += '<div class="cab-letter" data-i="' + i + '">' +
        '<button type="button" class="k-btn k-btn--icon cab-arrow cab-up" aria-label="Next letter">' + (hasKit ? Kit.icon('next') : '+') + '</button>' +
        '<div class="cab-box" role="button" aria-label="Letter">' + letters[i] + '</div>' +
        '<button type="button" class="k-btn k-btn--icon cab-arrow cab-dn" aria-label="Previous letter">' + (hasKit ? Kit.icon('next') : '-') + '</button></div>';
    }
    html += '</div>';
    card({
      title: 'High score!', text: 'Put your initials on the board', icon: 'trophy', sound: 'win', confetti: true,
      stats: [{ label: 'Score', value: score, hi: true }], html: html, guard: 500, cls: 'cab-card--ini',
      buttons: [{ label: 'Done', value: 'ok', primary: true, icon: 'check' }],
      onOpen: function (cardEl) {
        var cols = cardEl.querySelectorAll('.cab-letter');
        Array.prototype.forEach.call(cols, function (col) {
          var i = +col.getAttribute('data-i'), box = col.querySelector('.cab-box');
          function bump(d) {
            var code = letters[i].charCodeAt(0) + d;
            if (code < 65) code = 90; if (code > 90) code = 65;
            letters[i] = String.fromCharCode(code); box.textContent = letters[i];
            C.beep(660 + (code - 65) * 12, 40, 'triangle', 0.1);
            if (hasKit) Kit.anim(box, 'cab-flip');
          }
          // Press to bump; hold to keep going. Pointer events only, so no double bump.
          function hold(btn, d) {
            var t1 = null, t2 = null;
            function stop() { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; }
            btn.addEventListener('pointerdown', function (e) {
              e.preventDefault(); stop(); bump(d);
              t1 = setTimeout(function () { t2 = setInterval(function () { bump(d); }, 90); }, 380);
            });
            ['pointerup', 'pointercancel', 'pointerleave', 'contextmenu'].forEach(function (n) { btn.addEventListener(n, stop); });
          }
          hold(col.querySelector('.cab-up'), 1); hold(col.querySelector('.cab-dn'), -1);
          box.addEventListener('pointerdown', function (e) { e.preventDefault(); bump(1); });
        });
      }
    }).then(function () {
      var ini = letters.join('');
      try { localStorage.setItem('cab.initials', ini); } catch (e) {}
      cb(ini);
    });
  };

  /* Game over flow: records a high score (asking for initials) then shows the
     score card with the table. onRestart runs on Play again; onMenu (optional)
     on the other button. */
  C.gameOver = function (id, score, onRestart, opts) {
    opts = opts || {};
    C.dropSave();   // the round is over: nothing to continue
    function table(mark) {
      var top = mark === 0;
      card({
        title: opts.title || 'Game over', icon: top ? 'trophy' : (opts.icon || 'star'),
        text: opts.text || (top ? 'The best score on this cabinet!' : mark >= 0 ? 'You made the high-score table!' : 'Nice try! Have another go.'),
        stats: [{ label: 'Score', value: score, hi: mark >= 0 }].concat(opts.stats || []),
        scores: id, mark: mark, guard: 700,
        buttons: [{ label: 'Play again', value: 'again', primary: true, icon: 'restart' }]
      }).then(function () { onRestart(); });
    }
    if (C.isHigh(id, score)) C.enterInitials(score, function (ini) {
      var list = C.addScore(id, ini, score), mark = -1;
      for (var i = 0; i < list.length; i++) if (list[i].initials === ini && list[i].score === score) { mark = i; break; }
      table(mark);
    });
    else table(-1);
  };

  /* Mute button: the kit's shared switch. */
  C.wireMute = function (btn) {
    if (!btn) return;
    if (hasKit) Kit.bindMute(btn);
  };

  /* Everything a cabinet page needs, in one call:
     Cabinet.setup({ id, help: steps, isPlaying }) wires mute, pause, help,
     auto-pause and the side-panel score table. */
  C.setup = function (o) {
    C.wireMute(document.getElementById('mute-btn'));
    C.addPauseButton(o.isPlaying);
    C.autoPause(o.isPlaying);
    if (o.help) C.help(o.id, o.help, o.helpTitle);
    if (o.scores !== false) C.sideScores(o.scoresId || o.id);
  };

  return C;
})();
