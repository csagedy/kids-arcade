/* Arcade kit — shared behaviour for every puzzle and card game: icons,
   overlays (result, confirm, how-to-play, toast, confetti), sounds and
   haptics with one arcade-wide mute switch, safe storage, and a board
   sizing fallback. Plain script (no modules) so file:// works; exposes one
   global, `Kit`. README.md ("Shared kit") documents the API. */

var Kit = (function () {
  'use strict';
  var K = {};
  var doc = document;

  K.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- storage ----------
     localStorage throws in some private modes and when full; never let that
     stop play. Values are JSON. Plain numbers saved by older builds
     ("1234") parse fine as JSON too. */
  K.load = function (key, fallback) {
    try {
      var s = localStorage.getItem(key);
      if (s === null || s === undefined) return fallback;
      var v = JSON.parse(s);
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  };
  K.save = function (key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } };
  K.drop = function (key) { try { localStorage.removeItem(key); } catch (e) {} };
  K.raw = function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } };
  K.setRaw = function (key, s) { try { localStorage.setItem(key, String(s)); return true; } catch (e) { return false; } };
  /* The one contract with the arcade menu: a short line under the game's tile. */
  K.stat = function (id, text) { K.setRaw('arcade.stat.' + id, text); };

  /* ---------- icons ----------
     24x24 stroke icons drawn for the kit. Kit.icon(name) returns an <svg>
     string; any element with data-k-icon="name" gets its icon filled in
     automatically (Kit.icons() re-scans after adding markup). */
  var P = {
    back: '<path d="M14.5 5 7.5 12l7 7"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    undo: '<path d="M8.5 13.5 4 9l4.5-4.5"/><path d="M4.5 9h9.5a5.5 5.5 0 0 1 0 11H10"/>',
    redo: '<path d="M15.5 13.5 20 9l-4.5-4.5"/><path d="M19.5 9H10a5.5 5.5 0 0 0 0 11h4"/>',
    restart: '<path d="M4.6 13.2A7.6 7.6 0 1 0 6.8 6.4"/><path d="M5.2 3.2v4.4h4.4"/>',
    new: '<path d="M12 5v14M5 12h14"/>',
    sound: '<path d="M3.5 9.2h3.2L11.5 5v14l-4.8-4.2H3.5z" fill="currentColor"/><path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    mute: '<path d="M3.5 9.2h3.2L11.5 5v14l-4.8-4.2H3.5z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1.3" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.3" fill="currentColor"/>',
    play: '<path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.3-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6z" fill="currentColor"/>',
    help: '<path d="M8.8 9.1a3.3 3.3 0 1 1 4.6 3c-.9.4-1.4 1.1-1.4 2v.6"/><circle cx="12" cy="18.6" r="1.4" fill="currentColor" stroke="none"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="currentColor"/>',
    settings: '<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>',
    hint: '<path d="M9.2 17.5h5.6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1 1.3 1 2.2v.5h5.2V16c0-.9.4-1.6 1-2.2A6 6 0 0 0 12 3z"/>',
    home: '<path d="M4 11.5 12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    next: '<path d="M4.5 12h14M13 6l6 6-6 6"/>',
    trophy: '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3.5 3.5 0 0 0 3.6 4M16.5 6h3a3.5 3.5 0 0 1-3.6 4M12 14v3.5M8 20.5h8"/>',
    shuffle: '<path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.5 0 2.5-1.2 3.3-2.7M13.2 9.7C14 8.2 15 7 16.5 7H20"/><path d="M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
    menu: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>'
  };
  K.ICONS = Object.keys(P);
  K.icon = function (name, cls) {
    var body = P[name];
    if (!body) return '';
    return '<svg class="k-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  };
  /* Fill or replace the icon in every [data-k-icon] under root. */
  K.icons = function (root) {
    var els = (root || doc).querySelectorAll('[data-k-icon]');
    for (var i = 0; i < els.length; i++) K.setIcon(els[i], els[i].getAttribute('data-k-icon'));
  };
  K.setIcon = function (el, name) {
    el.setAttribute('data-k-icon', name);
    var old = el.querySelector(':scope > svg.k-icon');
    var tmp = doc.createElement('span');
    tmp.innerHTML = K.icon(name);
    var svg = tmp.firstChild;
    if (!svg) return;
    if (old) el.replaceChild(svg, old); else el.insertBefore(svg, el.firstChild);
  };

  /* ---------- sound ----------
     A tiny Web Audio synth. One mute switch for the whole arcade, stored as
     'arcade.mute' ('1' / '0'). Games written before the kit kept their own
     switches; the first read honours any of them, and every write updates
     them all so un-migrated games stay in step. */
  var MUTE_KEY = 'arcade.mute';
  var LEGACY_MUTE = ['cards.mute', 'cab.mute', 'bb.mute', 'ws.mute', 'simon.mute'];
  var muted = (function () {
    var v = K.raw(MUTE_KEY);
    if (v === '1' || v === '0') return v === '1';
    for (var i = 0; i < LEGACY_MUTE.length; i++) if (K.raw(LEGACY_MUTE[i]) === '1') return true;
    return false;
  })();
  var muteListeners = [];
  K.MUTE_KEY = MUTE_KEY;
  K.muted = function () { return muted; };
  K.setMuted = function (m) {
    muted = !!m;
    K.setRaw(MUTE_KEY, muted ? '1' : '0');
    LEGACY_MUTE.forEach(function (k) { K.setRaw(k, muted ? '1' : '0'); });
    muteListeners.forEach(function (fn) { try { fn(muted); } catch (e) {} });
  };
  K.onMute = function (fn) { muteListeners.push(fn); };
  /* Make a button the sound toggle: swaps its icon and label. */
  K.bindMute = function (btn) {
    function paint() {
      K.setIcon(btn, muted ? 'mute' : 'sound');
      btn.setAttribute('aria-label', muted ? 'Sound is off' : 'Sound is on');
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { K.setMuted(!muted); if (!muted) K.sfx.tap(); });
    K.onMute(paint);
    paint();
    return btn;
  };

  var actx = null, master = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = 0.9;
        // A gentle compressor keeps stacked sounds from clipping.
        var comp = actx.createDynamicsCompressor ? actx.createDynamicsCompressor() : null;
        if (comp) { master.connect(comp); comp.connect(actx.destination); } else master.connect(actx.destination);
      } catch (e) { actx = null; return null; }
    }
    if (actx.state !== 'running' && actx.resume) { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  // iOS unlocks audio on touchend / click, not always pointerdown.
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (n) {
    doc.addEventListener(n, audio, { passive: true, capture: true });
  });
  // Resume after the iPad wakes or the app comes back to the front.
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden && actx) audio(); });

  /* Kit.sfx.tone(freq, dur, type, opts): one note. opts: { vol, when (s from
     now), to (glide to this freq), attack }. Silent while muted. */
  function tone(freq, dur, type, opts) {
    opts = opts || {};
    if (muted || !actx || actx.state !== 'running') return;
    try {
      var t = actx.currentTime + (opts.when || 0);
      dur = dur || 0.12;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      var vol = opts.vol || 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  function seq(freqs, gap, dur, type, vol) {
    freqs.forEach(function (f, i) { tone(f, dur, type, { when: i * gap, vol: vol }); });
  }
  K.sfx = {
    tone: tone,
    tap: function () { tone(720, 0.05, 'sine', { vol: 0.07 }); },
    click: function () { tone(1200, 0.025, 'square', { vol: 0.03 }); },
    pop: function (pitch) { var f = pitch || 520; tone(f, 0.11, 'sine', { vol: 0.13, to: f * 1.6 }); },
    slide: function () { tone(260, 0.07, 'triangle', { vol: 0.06, to: 200 }); },
    place: function () { tone(330, 0.08, 'triangle', { vol: 0.12, to: 240 }); tone(990, 0.03, 'sine', { vol: 0.04 }); },
    good: function () { tone(660, 0.12, 'sine', { vol: 0.11 }); tone(990, 0.18, 'sine', { vol: 0.1, when: 0.08 }); },
    bad: function () { tone(200, 0.16, 'triangle', { vol: 0.12, to: 140 }); },
    star: function (n) { tone(880 * Math.pow(1.26, n || 0), 0.22, 'sine', { vol: 0.1 }); tone(1760 * Math.pow(1.26, n || 0), 0.12, 'sine', { vol: 0.03 }); },
    win: function () { seq([523, 659, 784, 1047, 1319], 0.1, 0.32, 'sine', 0.12); seq([262, 330, 392], 0.15, 0.4, 'triangle', 0.06); },
    lose: function () { seq([494, 440, 392, 330], 0.17, 0.3, 'triangle', 0.1); },
    open: function () { tone(440, 0.12, 'sine', { vol: 0.08, to: 880 }); },
    close: function () { tone(700, 0.1, 'sine', { vol: 0.06, to: 400 }); }
  };

  /* Haptics where the browser has them (Android; iOS Safari ignores it). */
  K.buzz = function (pattern) { try { if (navigator.vibrate && !muted) navigator.vibrate(pattern || 10); } catch (e) {} };

  /* ---------- small DOM helpers ---------- */
  function el(tag, cls, html) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  K.esc = esc;
  K.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  /* Restart a CSS animation class on an element (e.g. 'k-shake'). */
  K.anim = function (node, cls) {
    if (!node) return;
    node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
    clearTimeout(node['_k_' + cls]);
    node['_k_' + cls] = setTimeout(function () { node.classList.remove(cls); }, 1200);
  };

  /* ---------- overlays ----------
     All overlays stack in <body>. Kit.overlayOpen() tells input handlers to
     stand down while one is showing. */
  var open = [];
  K.overlayOpen = function () { return open.length > 0; };
  function art(o) {
    if (o.icon) return '<div class="k-card__art' + (o.wiggle ? ' k-wiggle' : '') + '">' + K.icon(o.icon) + '</div>';
    if (o.emoji) return '<div class="k-card__art' + (o.wiggle ? ' k-wiggle' : '') + '">' + esc(o.emoji) + '</div>';
    return '';
  }
  /* Builds an overlay with a card, wires its buttons, and resolves with the
     chosen button's value. buttons: [{ label, value, primary, cls, icon }] */
  function overlay(o, inner, buttons, cls) {
    var bg = el('div', 'k-overlay' + (cls ? ' ' + cls : ''));
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    var card = el('div', 'k-card' + (o.cardClass ? ' ' + o.cardClass : ''), inner);
    bg.appendChild(card);
    var row = el('div', 'k-row');
    (buttons || []).forEach(function (b) {
      var btn = el('button', 'k-btn k-btn--lg' + (b.primary ? ' k-btn--primary' : '') + (b.cls ? ' ' + b.cls : ''),
        (b.icon ? K.icon(b.icon) : '') + '<span>' + esc(b.label) + '</span>');
      btn.type = 'button';
      btn._kv = b.value;
      row.appendChild(btn);
    });
    if (buttons && buttons.length) card.appendChild(row);
    doc.body.appendChild(bg);
    open.push(bg);
    // Enter / Escape for keyboards (no auto-focus: Safari would draw a focus ring).
    bg._keys = function (e) {
      if (open[open.length - 1] !== bg) return;
      var b = e.key === 'Enter' ? (row.querySelector('.k-btn--primary') || row.querySelector('.k-btn')) : null;
      if (b) { e.preventDefault(); b.click(); }
      else if (e.key === 'Escape' && o.dismissValue !== undefined && bg._finish) bg._finish(o.dismissValue);
    };
    doc.addEventListener('keydown', bg._keys);
    return new Promise(function (resolve) {
      function finish(v) {
        if (bg._done) return;
        bg._done = true;
        K.closeOverlay(bg);
        resolve(v);
      }
      bg._finish = finish;
      row.addEventListener('click', function (e) {
        var b = e.target.closest('.k-btn');
        if (!b) return;
        K.sfx.tap();
        finish(b._kv);
      });
      if (o.dismiss !== false && o.dismissValue !== undefined) {
        bg.addEventListener('click', function (e) { if (e.target === bg) finish(o.dismissValue); });
      }
      if (o.onOpen) o.onOpen(card, finish);
    });
  }
  K.closeOverlay = function (bg) {
    if (bg._keys) doc.removeEventListener('keydown', bg._keys);
    var i = open.indexOf(bg);
    if (i >= 0) open.splice(i, 1);
    if (K.reduced) { if (bg.parentNode) bg.parentNode.removeChild(bg); return; }
    bg.classList.add('k-out');
    setTimeout(function () { if (bg.parentNode) bg.parentNode.removeChild(bg); }, 170);
  };
  /* Close every open overlay (e.g. when starting a new game). They resolve with undefined. */
  K.closeAll = function () { open.slice().forEach(function (bg) { if (bg._finish) bg._finish(undefined); else K.closeOverlay(bg); }); };

  /* Kit.result({ emoji | icon, title, text, stats: [{label, value, hi}],
       stars (0-3 of 3), badge ('New best!'), buttons: [{label, value, primary, icon}],
       confetti (bool), sound ('win' | 'lose' | 'good' | false), wiggle })
     -> Promise of the chosen button's value. text may contain <b>. */
  K.result = function (o) {
    o = o || {};
    var html = art(o);
    if (typeof o.stars === 'number') {
      html += '<div class="k-stars" aria-label="' + o.stars + ' of 3 stars">';
      for (var s = 0; s < 3; s++) html += '<span class="' + (s < o.stars ? 'k-on' : '') + '">' + K.icon('star') + '</span>';
      html += '</div>';
    }
    html += '<h2>' + esc(o.title || '') + '</h2>';
    if (o.text) html += '<p>' + String(o.text) + '</p>';
    if (o.badge) html += '<div class="k-badge">' + esc(o.badge) + '</div>';
    if (o.stats && o.stats.length) {
      html += '<div class="k-card__stats">';
      o.stats.forEach(function (st) {
        html += '<div class="k-card__stat' + (st.hi ? ' k-hi' : '') + '"><b>' + esc(st.value) + '</b><span>' + esc(st.label) + '</span></div>';
      });
      html += '</div>';
    }
    var buttons = o.buttons || [{ label: 'Play again', value: 'again', primary: true }];
    var p = overlay(o, html, buttons, 'k-result');
    var snd = o.sound === undefined ? (o.confetti ? 'win' : 'good') : o.sound;
    if (snd && K.sfx[snd]) K.sfx[snd]();
    if (typeof o.stars === 'number' && !K.reduced) {
      for (var n = 0; n < o.stars; n++) (function (n) { setTimeout(function () { K.sfx.star(n); }, 250 + n * 200); })(n);
    }
    if (o.confetti) K.confetti();
    return p;
  };

  /* Kit.confirm({ title, text, yes, no, danger, emoji|icon }) -> Promise<boolean>.
     Tapping outside counts as "no". */
  K.confirm = function (o) {
    if (typeof o === 'string') o = { title: o };
    var html = art(o) + '<h2>' + esc(o.title || 'Are you sure?') + '</h2>' + (o.text ? '<p>' + String(o.text) + '</p>' : '');
    K.sfx.open();
    return overlay({ dismissValue: false, onOpen: o.onOpen }, html, [
      { label: o.no || 'Cancel', value: false },
      { label: o.yes || 'OK', value: true, primary: !o.danger, cls: o.danger ? 'k-btn--bad' : '' }
    ], 'k-confirm');
  };

  /* Kit.sheet({ title, html, buttons, dismissValue }) — a bottom sheet with
     arbitrary content (settings, level pickers). onOpen(card, close) lets
     the caller wire its own controls. -> Promise of the button value. */
  K.sheet = function (o) {
    var html = (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + (o.html || '');
    return overlay({ dismissValue: o.dismissValue === undefined ? null : o.dismissValue, onOpen: o.onOpen }, html, o.buttons || [], 'k-overlay--sheet');
  };

  /* Kit.howTo(key, steps, opts) — the first-run "how to play" card. Shown
     once per game (remembered as 'arcade.howto.<key>'); pass { force: true }
     from a help button to show it again. steps: strings, or
     { emoji | icon, text }. opts: { title, button }. -> Promise (resolves when
     closed; immediately if already seen). */
  K.howTo = function (key, steps, opts) {
    opts = opts || {};
    var seenKey = 'arcade.howto.' + key;
    if (!opts.force && K.raw(seenKey)) return Promise.resolve(false);
    K.setRaw(seenKey, '1');
    var html = '<div class="k-card__art">' + K.icon('help') + '</div><h2>' + esc(opts.title || 'How to play') + '</h2><ol class="k-steps">';
    (steps || []).forEach(function (s, i) {
      if (typeof s === 'string') s = { text: s };
      var a = s.icon ? K.icon(s.icon) : esc(s.emoji || String(i + 1));
      html += '<li><span class="k-step__art">' + a + '</span><span>' + String(s.text) + '</span></li>';
    });
    html += '</ol>';
    return overlay({ dismissValue: true }, html, [{ label: opts.button || "Let's play!", value: true, primary: true }], 'k-howto');
  };
  /* Wire a help button to reopen the how-to card. */
  K.bindHelp = function (btn, key, steps, opts) {
    btn.addEventListener('click', function () {
      var o = {}; for (var k in (opts || {})) o[k] = opts[k];
      o.force = true;
      K.howTo(key, steps, o);
    });
  };

  /* Kit.toast(text, { icon, ms, top }) — a short message that floats up. */
  var lastToast = null;
  K.toast = function (text, o) {
    o = o || {};
    if (lastToast && lastToast.parentNode) lastToast.parentNode.removeChild(lastToast);
    var t = el('div', 'k-toast' + (o.top ? ' k-toast--top' : ''), (o.icon ? K.icon(o.icon) : '') + '<span>' + esc(text) + '</span>');
    t.setAttribute('role', 'status');
    doc.body.appendChild(t);
    lastToast = t;
    setTimeout(function () {
      t.classList.add('k-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, o.ms || 1800);
    return t;
  };

  /* Kit.floatText(text, x, y | element, color) — a "+8" that rises and fades. */
  K.floatText = function (text, x, y, color) {
    if (x && x.getBoundingClientRect) {
      var r = x.getBoundingClientRect();
      color = y; x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    var f = el('div', 'k-float');
    f.textContent = text;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    if (color) f.style.color = color;
    doc.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 850);
  };

  /* Kit.confetti({ x, y, count, colors }) — a burst from a point (default:
     upper middle of the screen). Skipped with reduced motion. */
  K.PALETTE = ['#ff5d73', '#ff9f43', '#ffd23f', '#3ddc84', '#2ee6c9', '#4cc2ff', '#a77bff', '#ff7ac6'];
  K.confetti = function (o) {
    o = o || {};
    if (K.reduced) return;
    var box = el('div', 'k-confetti');
    var W = window.innerWidth, H = window.innerHeight;
    var x = o.x === undefined ? W / 2 : o.x, y = o.y === undefined ? H * 0.35 : o.y;
    var n = o.count || Math.round(Math.min(120, 40 + W / 12));
    var colors = o.colors || K.PALETTE;
    var spread = Math.max(W, H) * 0.55;
    for (var k = 0; k < n; k++) {
      var p = el('i', Math.random() < 0.3 ? 'k-dot' : '');
      var a = Math.random() * Math.PI * 2, d = spread * (0.35 + Math.random() * 0.65);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.background = colors[k % colors.length];
      p.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(a) * d * 0.8 + H * 0.35) + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
      p.style.setProperty('--dur', (1.3 + Math.random() * 0.9).toFixed(2) + 's');
      p.style.animationDelay = (Math.random() * 0.2).toFixed(2) + 's';
      box.appendChild(p);
    }
    doc.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 2600);
  };

  /* ---------- sizing ----------
     CSS does the work: put the board in .k-stage, give it class .k-fit and
     --k-aspect (width / height). Kit.fit(el, aspect) is the fallback for
     browsers without container units, or for a board that needs exact px
     (a canvas). It keeps el the largest aspect box that fits its parent's
     content box, and calls opts.onResize(w, h) after each change.
     Returns { update, stop }. */
  K.cqSupported = !!(window.CSS && CSS.supports && CSS.supports('width', '1cqw'));
  K.fit = function (node, aspect, opts) {
    opts = opts || {};
    aspect = aspect || 1;
    var parent = opts.parent || node.parentNode;
    var lastW = -1, lastH = -1;
    function update() {
      var cs = getComputedStyle(parent);
      var W = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var H = parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (opts.max) { W = Math.min(W, opts.max); H = Math.min(H, opts.max / aspect); }
      var w = Math.max(0, Math.min(W, H * aspect)), h = w / aspect;
      w = Math.floor(w); h = Math.floor(h);
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      node.style.width = w + 'px'; node.style.height = h + 'px';
      if (opts.onResize) opts.onResize(w, h);
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(update); ro.observe(parent); }
    else window.addEventListener('resize', update);
    window.addEventListener('orientationchange', function () { setTimeout(update, 250); });
    update();
    return { update: update, stop: function () { if (ro) ro.disconnect(); else window.removeEventListener('resize', update); } };
  };
  /* Automatic fallback: if container units are missing, every .k-fit gets Kit.fit. */
  function autoFit() {
    if (K.cqSupported) return;
    var els = doc.querySelectorAll('.k-fit');
    for (var i = 0; i < els.length; i++) {
      if (els[i]._kfit) continue;
      var a = parseFloat(getComputedStyle(els[i]).getPropertyValue('--k-aspect')) || 1;
      els[i]._kfit = K.fit(els[i], a);
    }
  }

  /* ---------- swipes ----------
     Kit.swipe(target, fn, opts): calls fn(dir) with 0 left, 1 up, 2 right,
     3 down when a finger (or mouse) moves at least opts.min px (default 24).
     Ignores touches that start on buttons and links, and stands down while
     an overlay is open. Also maps arrow keys and WASD unless opts.keys === false. */
  K.swipe = function (target, fn, opts) {
    opts = opts || {};
    var min = opts.min || 24, start = null;
    target.addEventListener('pointerdown', function (e) {
      if (start || K.overlayOpen() || (e.target.closest && e.target.closest('button, a, input, .k-noswipe-zone'))) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
    });
    target.addEventListener('pointermove', function (e) {
      if (!start || e.pointerId !== start.id || start.fired) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min * 1.6) return;
      start.fired = true;   // fire mid-gesture once it's unambiguous: feels snappier
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1));
    });
    target.addEventListener('pointerup', function (e) {
      if (!start || e.pointerId !== start.id) return;
      var s = start; start = null;
      if (s.fired) return;
      var dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1));
    });
    target.addEventListener('pointercancel', function () { start = null; });
    if (opts.keys !== false) {
      doc.addEventListener('keydown', function (e) {
        if (K.overlayOpen()) return;
        var map = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, a: 0, w: 1, d: 2, s: 3 };
        var d = map[e.key];
        if (d !== undefined) { e.preventDefault(); fn(d); }
      });
    }
  };

  /* ---------- page setup ---------- */
  K.registerSW = function (path) {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(path || '../../sw.js').catch(function () {});
    });
  };
  function ready() {
    K.icons();
    autoFit();
    // iOS ignores user-scalable=no; stop pinch-zoom on game pages. (Double-tap
    // zoom is already off via touch-action: manipulation in kit.css.)
    if (doc.documentElement.classList.contains('k-app')) {
      doc.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready); else ready();

  return K;
})();
