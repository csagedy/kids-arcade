/* Music Pad model: scales, instruments, drum list, the loop pattern and the
   save format. No DOM here (ui.js draws, synth.js makes the sound).

   Saves (all small, all through Kit.load / Kit.save):
     music.prefs  { m: mode, v: keys voice, lv: loop voice, s: 'p' | 'm' scale, t: tempo 0-2 }
     music.loop   { g: ["01000100", ...] one 8-char string per loop row (top row
                  first), d: [drum, drum] the sound of each drum row }
     music.tunes  [{ a: animal, e: "t,code;t,code" }] up to MAX_TUNES recordings,
                  t in centiseconds from the start, code 'k<voice><midi>' or 'd<drum>'
     music.n      running tune counter (picks the next tune's animal) */
var MusicModel = (function () {
  'use strict';
  var M = {};

  /* ---------- notes ---------- */
  M.MAJOR = [0, 2, 4, 5, 7, 9, 11];     // semitones of each major degree from C
  M.PENTA_DEG = [0, 1, 2, 4, 5];        // C D E G A: no F or B, so anything goes together
  M.BASE = 60;                          // C4, the lowest bar

  // one colour per note name, shared by the bars and the loop rows
  // (C red, D orange, E yellow, F green, G teal, A blue, B purple)
  M.NOTE_COLORS = [
    ['#ff5d73', '#c12c47'], ['#ff9f43', '#c86a12'], ['#ffd23f', '#d69a00'], ['#3ddc84', '#1f9a57'],
    ['#2ee6c9', '#129a86'], ['#4cc2ff', '#1a7fc0'], ['#a77bff', '#6c45c9']
  ];

  M.freq = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  /* Two octaves of the scale from C4, plus the top C. kind 'p' (pentatonic,
     11 bars) or 'm' (major, 15 bars). Low to high. */
  M.scaleNotes = function (kind) {
    var degs = kind === 'm' ? [0, 1, 2, 3, 4, 5, 6] : M.PENTA_DEG, out = [];
    for (var oct = 0; oct < 2; oct++) {
      degs.forEach(function (d) { out.push({ midi: M.BASE + oct * 12 + M.MAJOR[d], deg: d }); });
    }
    out.push({ midi: M.BASE + 24, deg: 0 });
    return out;
  };

  /* ---------- instruments ---------- */
  M.VOICES = [
    { id: 'xylo', name: 'Xylophone' },
    { id: 'piano', name: 'Piano' },
    { id: 'cloud', name: 'Soft synth' },
    { id: 'box', name: 'Music box' }
  ];

  /* ---------- drums and farm sounds ---------- */
  M.DRUMS = [
    { id: 'kick',    name: 'Big drum',  c: ['#ff5d73', '#c12c47'] },
    { id: 'snare',   name: 'Snare',     c: ['#ff9f43', '#c86a12'] },
    { id: 'hat',     name: 'Cymbal',    c: ['#ffd23f', '#d69a00'] },
    { id: 'tom',     name: 'Tom',       c: ['#3ddc84', '#1f9a57'] },
    { id: 'clap',    name: 'Clap',      c: ['#2ee6c9', '#129a86'] },
    { id: 'cowbell', name: 'Cowbell',   c: ['#4cc2ff', '#1a7fc0'] },
    { id: 'shaker',  name: 'Egg shaker', c: ['#a77bff', '#6c45c9'] },
    { id: 'moo',     name: 'Cow',       c: ['#ff7ac6', '#c4428c'] },
    { id: 'cluck',   name: 'Chicken',   c: ['#ff9f43', '#c86a12'] },
    { id: 'quack',   name: 'Duck',      c: ['#ffd23f', '#d69a00'] },
    { id: 'baa',     name: 'Sheep',     c: ['#4cc2ff', '#1a7fc0'] },
    { id: 'ribbit',  name: 'Frog',      c: ['#3ddc84', '#1f9a57'] }
  ];
  M.drumIndex = function (id) { for (var i = 0; i < M.DRUMS.length; i++) if (M.DRUMS[i].id === id) return i; return -1; };

  /* ---------- the loop ----------
     8 steps (one bar of eighth notes). Rows from the top: five pentatonic
     notes an octave up (A5 down to C5), then two drum rows. Tapping a drum
     row's picture changes its sound (any of the twelve, farm animals too);
     they start as snare and big drum. Seven rows keep every cell at least
     a finger wide even on a phone on its side. */
  M.STEPS = 8;
  M.ROWS = [
    { kind: 'note', midi: 81, deg: 5 },
    { kind: 'note', midi: 79, deg: 4 },
    { kind: 'note', midi: 76, deg: 2 },
    { kind: 'note', midi: 74, deg: 1 },
    { kind: 'note', midi: 72, deg: 0 },
    { kind: 'drum', slot: 0 },
    { kind: 'drum', slot: 1 }
  ];
  M.DEFAULT_LOOP_DRUMS = [1, 0];   // snare, big drum
  M.MELODY_ROWS = 5;
  M.TEMPOS = [{ id: 'slow', bpm: 84 }, { id: 'mid', bpm: 108 }, { id: 'fast', bpm: 138 }];
  /* seconds per step (eighth notes) */
  M.stepDur = function (tempo) { return 30 / M.TEMPOS[tempo].bpm; };

  M.emptyPattern = function () {
    var p = [];
    for (var r = 0; r < M.ROWS.length; r++) { p.push([]); for (var c = 0; c < M.STEPS; c++) p[r].push(false); }
    return p;
  };
  M.copyPattern = function (p) { return p.map(function (row) { return row.slice(); }); };
  M.countOn = function (p) {
    var n = 0;
    p.forEach(function (row) { row.forEach(function (v) { if (v) n++; }); });
    return n;
  };
  M.encodePattern = function (p) {
    return p.map(function (row) { return row.map(function (v) { return v ? '1' : '0'; }).join(''); });
  };
  M.decodePattern = function (a) {
    var p = M.emptyPattern();
    if (!a || !a.length) return p;
    for (var r = 0; r < M.ROWS.length && r < a.length; r++) {
      var s = String(a[r] || '');
      for (var c = 0; c < M.STEPS; c++) p[r][c] = s.charAt(c) === '1';
    }
    return p;
  };

  /* "Surprise me": a pleasant random loop. A steady beat (big drum on 1
     and 5, snare on 3 and 7) and a tune that mostly steps to
     a neighbouring note of the pentatonic scale, so it always sounds sung.
     The beat goes on the two drum rows, whatever sounds they are set to. */
  M.surprise = function (rnd) {
    rnd = rnd || Math.random;
    var p = M.emptyPattern(), S = M.STEPS;
    var snare = M.ROWS.length - 2, kick = M.ROWS.length - 1;
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    p[kick][0] = p[kick][4] = true;
    if (rnd() < 0.5) p[kick][pick([3, 6, 7])] = true;
    p[snare][2] = p[snare][6] = true;
    if (rnd() < 0.25) p[snare][7] = true;
    // melody: index 0 = C (bottom melody row) .. 4 = A
    var n = pick([0, 2, 2, 4 - 1]);
    for (var c = 0; c < S; c++) {
      var play = c === 0 || c === 4 ? true : rnd() < 0.62;
      if (c === S - 1 && rnd() < 0.5) play = false;   // a breath before it comes round again
      if (!play) continue;
      if (c > 0) {
        var step = pick([-1, -1, 1, 1, 0, -2, 2]);
        n = Math.max(0, Math.min(M.MELODY_ROWS - 1, n + step));
      }
      p[M.MELODY_ROWS - 1 - n][c] = true;
      // now and then a friendly second note on a strong beat
      if ((c === 0 || c === 4) && rnd() < 0.3 && n + 2 < M.MELODY_ROWS) p[M.MELODY_ROWS - 1 - (n + 2)][c] = true;
    }
    return p;
  };

  /* ---------- recorded tunes ---------- */
  M.MAX_TUNES = 4;
  M.MAX_EVENTS = 240;
  M.MAX_MS = 40000;
  M.ANIMALS = ['🐮', '🐷', '🐔', '🐑', '🐴', '🐶', '🐱', '🦆'];

  /* event: { t: ms from start, k: 'k' | 'd', v: voice, m: midi } or { t, k: 'd', d: drum index } */
  M.encodeEvents = function (ev) {
    return ev.map(function (e) {
      var t = Math.round(e.t / 10);
      return t + ',' + (e.k === 'k' ? 'k' + e.v + e.m : 'd' + e.d);
    }).join(';');
  };
  M.decodeEvents = function (s) {
    var out = [];
    String(s || '').split(';').forEach(function (part) {
      var bits = part.split(',');
      if (bits.length !== 2) return;
      var t = parseInt(bits[0], 10) * 10, c = bits[1];
      if (!(t >= 0)) return;
      if (c.charAt(0) === 'k' && c.length >= 3) {
        var v = parseInt(c.charAt(1), 10), m = parseInt(c.slice(2), 10);
        if (v >= 0 && v < M.VOICES.length && m > 20 && m < 110) out.push({ t: t, k: 'k', v: v, m: m });
      } else if (c.charAt(0) === 'd') {
        var d = parseInt(c.slice(1), 10);
        if (d >= 0 && d < M.DRUMS.length) out.push({ t: t, k: 'd', d: d });
      }
    });
    return out;
  };
  M.tuneLength = function (ev) { return ev.length ? ev[ev.length - 1].t : 0; };

  /* ---------- storage ---------- */
  M.loadPrefs = function () {
    var p = Kit.load('music.prefs', {}) || {};
    return {
      m: ['keys', 'drums', 'loop'].indexOf(p.m) >= 0 ? p.m : 'keys',
      v: p.v >= 0 && p.v < M.VOICES.length ? p.v | 0 : 0,
      lv: p.lv >= 0 && p.lv < M.VOICES.length ? p.lv | 0 : 0,
      s: p.s === 'm' ? 'm' : 'p',
      t: p.t >= 0 && p.t < M.TEMPOS.length ? p.t | 0 : 1
    };
  };
  M.savePrefs = function (p) { Kit.save('music.prefs', { m: p.m, v: p.v, lv: p.lv, s: p.s, t: p.t }); };
  /* -> { pattern, drums } */
  M.loadLoop = function () {
    var o = Kit.load('music.loop', null) || {};
    var d = Array.isArray(o.d) ? o.d.slice(0, 2) : [];
    var drums = M.DEFAULT_LOOP_DRUMS.map(function (def, i) {
      var v = d[i] | 0; return d[i] >= 0 && v < M.DRUMS.length ? v : def;
    });
    return { pattern: M.decodePattern(o.g), drums: drums };
  };
  M.saveLoop = function (p, drums) { Kit.save('music.loop', { g: M.encodePattern(p), d: drums.slice(0, 2) }); };
  M.loadTunes = function () {
    var a = Kit.load('music.tunes', []);
    if (!Array.isArray(a)) return [];
    return a.filter(function (t) { return t && typeof t.e === 'string'; }).slice(0, M.MAX_TUNES);
  };
  M.saveTunes = function (a) { Kit.save('music.tunes', a.slice(0, M.MAX_TUNES)); };
  M.nextAnimal = function () {
    var n = Kit.load('music.n', 0) | 0;
    Kit.save('music.n', n + 1);
    return n % M.ANIMALS.length;
  };

  /* the line under the menu tile */
  M.statLine = function (tunes, pattern) {
    if (tunes.length) return tunes.length === 1 ? '1 tune' : tunes.length + ' tunes';
    if (M.countOn(pattern)) return 'Loop saved';
    return '';
  };

  return M;
})();
