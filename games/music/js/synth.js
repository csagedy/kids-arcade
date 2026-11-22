/* Music Pad voices: every sound is synthesised with Web Audio (no files).

   The kit keeps its AudioContext private, so Music Pad has its own one,
   unlocked the same way (on the first touch / click / key) and bound to the
   same arcade-wide mute: while Kit.muted() nothing new starts and the master
   gain is held at zero. The page going hidden suspends the context.

   Signal chain (gain staging):
     voice -> melodic bus (0.7) --+--> comp (-14 dB, 3:1) -> lowpass 9 kHz -> master (0.75) -> limiter (-3 dB, 20:1) -> out
     drum  -> drum bus    (0.8) --+
     both buses also send to a short generated room reverb (wet 0.22 / 0.08)
   Each voice peaks around 0.2-0.5 before the bus, high notes are tapered
   (they read louder), and the compressor + limiter keep ten fingers at
   once from clipping.

   Envelopes: every note starts from 0 with a short linear attack (2-40 ms)
   and decays with setTargetAtTime, and oscillators stop only once the
   envelope is 60 dB down, so nothing clicks. Releases go through a second
   gain node, so no cancelScheduledValues / cancelAndHoldAtTime is needed
   (Safari 16 safe). No AudioWorklet. */
var MPSynth = (function () {
  'use strict';
  var S = {};
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, melBus = null, drumBus = null, noiseBuf = null, unlocked = false;
  var MASTER = 0.75;
  S.supported = !!AC;

  function build() {
    ctx = new AC();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    var soft = ctx.createBiquadFilter();
    soft.type = 'lowpass'; soft.frequency.value = 9000; soft.Q.value = 0.5;
    master = ctx.createGain();
    master.gain.value = Kit.muted() ? 0 : MASTER;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.1;
    comp.connect(soft); soft.connect(master); master.connect(lim); lim.connect(ctx.destination);

    // a small room: a second of decaying, slightly darkened noise
    var rev = null;
    try {
      rev = ctx.createConvolver();
      var len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch), last = 0;
        for (var i = 0; i < len; i++) {
          var x = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
          last = last * 0.55 + x * 0.45;          // one-pole lowpass: a warmer tail
          d[i] = last;
        }
      }
      rev.buffer = ir;
      var wet = ctx.createGain(); wet.gain.value = 1;
      rev.connect(wet); wet.connect(comp);
    } catch (e) { rev = null; }

    function bus(level, send) {
      var g = ctx.createGain();
      g.gain.value = level;
      g.connect(comp);
      if (rev) { var s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(rev); }
      return g;
    }
    melBus = bus(0.7, 0.22);
    drumBus = bus(0.8, 0.08);

    // one second of white noise, shared by every drum
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  }

  /* Create / resume the context. Called from every first touch, and by the
     UI right before it plays something. */
  S.unlock = function () {
    if (!AC || document.hidden) return;
    if (!ctx) { try { build(); } catch (e) { ctx = null; return; } }
    if (ctx.state !== 'running' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    if (!unlocked) {
      // old iOS needs a sound started inside the gesture: one silent sample
      try {
        var b = ctx.createBufferSource();
        b.buffer = ctx.createBuffer(1, 1, 22050);
        b.connect(ctx.destination); b.start(0);
        unlocked = true;
      } catch (e) {}
    }
  };
  ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(function (n) {
    document.addEventListener(n, S.unlock, { passive: true, capture: true });
  });

  S.now = function () { return ctx ? ctx.currentTime : 0; };
  S.running = function () { return !!ctx && ctx.state === 'running'; };
  S.canPlay = function () { return !!ctx && !Kit.muted(); };

  /* Mute: hold the master at zero (new notes are refused as well). */
  Kit.onMute(function (m) {
    if (!ctx) return;
    master.gain.setTargetAtTime(m ? 0 : MASTER, ctx.currentTime, 0.015);
  });
  /* Hidden page: stop making sound altogether. */
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    try {
      if (document.hidden) { if (ctx.suspend) ctx.suspend(); }
      else if (ctx.resume) ctx.resume();
    } catch (e) {}
  });
  window.addEventListener('pagehide', function () { try { if (ctx && ctx.suspend) ctx.suspend(); } catch (e) {} });

  /* A lane: a pair of gains in front of the buses for one sequence (the
     loop, a tune playing back). stop() fades it out, so notes already
     scheduled ahead are silenced too. */
  S.lane = function () {
    if (!ctx) return null;
    var m = ctx.createGain(), d = ctx.createGain();
    m.connect(melBus); d.connect(drumBus);
    return {
      mel: m, drum: d,
      stop: function () {
        var t = ctx.currentTime;
        m.gain.setTargetAtTime(0, t, 0.02); d.gain.setTargetAtTime(0, t, 0.02);
        setTimeout(function () { try { m.disconnect(); d.disconnect(); } catch (e) {} }, 600);
      }
    };
  };

  /* ---------- building blocks ---------- */
  function osc(type, f, t) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function gain(v) { var g = ctx.createGain(); g.gain.value = v === undefined ? 1 : v; return g; }
  function filt(type, f, q) {
    var b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q;
    return b;
  }
  /* percussive envelope: 0 -> peak (linear, `a` s) -> exponential-ish decay (time constant tau) */
  function hit(g, t, peak, a, tau) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0, t + a, tau);
    return t + a + tau * 7;               // ~60 dB down: safe to stop
  }
  function run(src, t, end) { src.start(t); src.stop(end); }
  function noise(t) {
    var n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    return n;
  }
  /* high notes sound louder and sharper: ease them back */
  function taper(f) { return Math.min(1.1, Math.pow(330 / f, 0.38)); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- melodic voices ----------
     each returns { release(t) } (percussive ones ignore it) */
  var NOOP = { release: function () {} };
  var VOICES = {};

  /* Xylophone (warm, marimba-ish): sine + 4th partial that dies fast + a
     soft mallet tick of filtered noise. */
  VOICES.xylo = function (f, t, out) {
    var g = gain(0.5 * taper(f)); g.connect(out);
    var tau = clamp(0.32 * Math.sqrt(262 / f), 0.1, 0.4);
    var o1 = osc('sine', f, t), g1 = gain(0);
    var end = hit(g1, t, 0.55, 0.002, tau);
    o1.connect(g1); g1.connect(g); run(o1, t, end);
    var o2 = osc('sine', f * 4, t), g2 = gain(0);
    var end2 = hit(g2, t, 0.14, 0.002, 0.035);
    o2.connect(g2); g2.connect(g); run(o2, t, end2);
    var n = noise(t), bp = filt('bandpass', Math.min(f * 3, 5000), 1.2), gn = gain(0);
    var end3 = hit(gn, t, 0.12, 0.001, 0.006);
    n.connect(bp); bp.connect(gn); gn.connect(g); run(n, t, end3);
    return NOOP;
  };

  /* Piano-ish: two slightly detuned triangles + an octave sine through a
     lowpass that closes as the note fades (bright strike, mellow tail). */
  VOICES.piano = function (f, t, out) {
    var g = gain(0.42 * taper(f)); g.connect(out);
    var lp = filt('lowpass', Math.min(f * 7, 9000), 0.6);
    lp.frequency.setValueAtTime(Math.min(f * 7, 9000), t);
    lp.frequency.setTargetAtTime(Math.min(f * 2.2, 5000), t + 0.01, 0.25);
    var env = gain(0);
    var tail = clamp(0.8 * Math.sqrt(262 / f), 0.3, 1.0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.6, t + 0.004);
    env.gain.setTargetAtTime(0.28, t + 0.004, 0.09);
    env.gain.setTargetAtTime(0, t + 0.25, tail);
    var end = t + 0.25 + tail * 7;
    lp.connect(env); env.connect(g);
    [[f, 'triangle', 0.5], [f * 1.0015, 'triangle', 0.4], [f * 2, 'sine', 0.22]].forEach(function (p) {
      var o = osc(p[1], p[0], t), og = gain(p[2]);
      o.connect(og); og.connect(lp); run(o, t, end);
    });
    return NOOP;
  };

  /* Soft synth ("cloud"): two detuned saws + a sub sine through a gentle
     lowpass, slow-ish attack and a little vibrato. Sustains while the
     finger is down (at most 3 s), then fades. */
  VOICES.cloud = function (f, t, out, hold) {
    var g = gain(0.55 * taper(f)); g.connect(out);
    var rel = gain(1); rel.connect(g);
    var env = gain(0); env.connect(rel);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.035);
    env.gain.setTargetAtTime(0.32, t + 0.035, 0.25);
    var lp = filt('lowpass', Math.min(f * 1.5, 2400), 0.7);
    lp.frequency.setValueAtTime(Math.min(f * 1.5, 2400), t);
    lp.frequency.linearRampToValueAtTime(Math.min(f * 3, 3200), t + 0.2);
    lp.connect(env);
    var maxEnd = t + 3;
    rel.gain.setTargetAtTime(0, maxEnd, 0.3);
    var stopAt = maxEnd + 2.2;
    var lfo = osc('sine', 5, t), lg = gain(0);
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.004, t + 0.6);
    lfo.connect(lg);
    var srcs = [lfo];
    [[f * 0.996, 'sawtooth', 0.3], [f * 1.004, 'sawtooth', 0.3], [f / 2, 'sine', 0.35]].forEach(function (p) {
      var o = osc(p[1], p[0], t), og = gain(p[2]);
      if (p[1] === 'sawtooth') lg.connect(o.frequency);
      o.connect(og); og.connect(lp); srcs.push(o);
    });
    srcs.forEach(function (s) { s.start(t); s.stop(stopAt); });
    var released = false;
    function release(at) {
      if (released) return;
      released = true;
      at = Math.max(at || ctx.currentTime, t + 0.06);
      if (at >= maxEnd) return;
      rel.gain.setTargetAtTime(0, at, 0.12);
      srcs.forEach(function (s) { try { s.stop(at + 1); } catch (e) {} });
    }
    if (hold) release(t + hold);
    return { release: release };
  };

  /* Music box: an octave up, a pure sine with a quick bright tine partial. */
  VOICES.box = function (f, t, out) {
    var F = f * 2;
    var g = gain(0.42 * taper(F) * 1.25); g.connect(out);
    var tau = clamp(0.5 * Math.pow(523 / F, 0.4), 0.18, 0.6);
    var o1 = osc('sine', F, t), g1 = gain(0);
    var end = hit(g1, t, 0.55, 0.002, tau);
    o1.connect(g1); g1.connect(g); run(o1, t, end);
    var o2 = osc('sine', F * 3, t), g2 = gain(0);
    var e2 = hit(g2, t, 0.08, 0.002, 0.07);
    o2.connect(g2); g2.connect(g); run(o2, t, e2);
    if (F * 4.2 < 12000) {
      var o3 = osc('sine', F * 4.2, t), g3 = gain(0);
      var e3 = hit(g3, t, 0.035, 0.001, 0.02);
      o3.connect(g3); g3.connect(g); run(o3, t, e3);
    }
    return NOOP;
  };

  S.VOICE_IDS = ['xylo', 'piano', 'cloud', 'box'];

  /* S.note(voiceIndex, freq, when?, dest?, hold?) -> { release(t) } */
  S.note = function (v, f, when, dest, hold) {
    if (!S.canPlay()) return NOOP;
    try {
      var t = Math.max(when || 0, ctx.currentTime);
      return VOICES[S.VOICE_IDS[v] || 'xylo'](f, t, dest || melBus, hold);
    } catch (e) { return NOOP; }
  };

  /* ---------- drums and farm sounds ---------- */
  var DR = {};
  DR.kick = function (t, out) {
    var o = osc('sine', 150, t), g = gain(0);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
    var end = hit(g, t, 0.55, 0.002, 0.12);
    o.connect(g); g.connect(out); run(o, t, end);
  };
  DR.snare = function (t, out) {
    var o = osc('triangle', 210, t), g = gain(0);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
    var e1 = hit(g, t, 0.32, 0.002, 0.045);
    o.connect(g); g.connect(out); run(o, t, e1);
    var n = noise(t), hp = filt('highpass', 1000), lp = filt('lowpass', 6500), gn = gain(0);
    var e2 = hit(gn, t, 0.34, 0.002, 0.055);
    n.connect(hp); hp.connect(lp); lp.connect(gn); gn.connect(out); run(n, t, e2);
  };
  DR.hat = function (t, out) {
    var n = noise(t), hp = filt('highpass', 7000), lp = filt('lowpass', 12000), g = gain(0);
    var end = hit(g, t, 0.22, 0.001, 0.028);
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); run(n, t, end);
  };
  DR.tom = function (t, out) {
    var o = osc('sine', 190, t), g = gain(0);
    o.frequency.exponentialRampToValueAtTime(105, t + 0.3);
    var end = hit(g, t, 0.45, 0.002, 0.16);
    o.connect(g); g.connect(out); run(o, t, end);
    var n = noise(t), lp = filt('lowpass', 1800), gn = gain(0);
    var e2 = hit(gn, t, 0.1, 0.001, 0.015);
    n.connect(lp); lp.connect(gn); gn.connect(out); run(n, t, e2);
  };
  DR.clap = function (t, out) {
    var bp = filt('bandpass', 1150, 0.9); bp.connect(out);
    [0, 0.011, 0.022].forEach(function (dt) {
      var n = noise(t), g = gain(0);
      var e = hit(g, t + dt, 0.7, 0.001, 0.005);
      n.connect(g); g.connect(bp); run(n, t + dt, e);
    });
    var n2 = noise(t), g2 = gain(0);
    var e2 = hit(g2, t + 0.03, 0.65, 0.001, 0.055);
    n2.connect(g2); g2.connect(bp); run(n2, t + 0.03, e2);
  };
  DR.cowbell = function (t, out) {
    var lp = filt('lowpass', 2200, 0.7), bp = filt('bandpass', 900, 1.2), g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.002);
    g.gain.setTargetAtTime(0.05, t + 0.002, 0.03);
    g.gain.setTargetAtTime(0, t + 0.06, 0.12);
    var end = t + 0.06 + 0.12 * 7;
    lp.connect(bp); bp.connect(g); g.connect(out);
    [562, 845].forEach(function (f) { var o = osc('square', f, t); o.connect(lp); run(o, t, end); });
  };
  DR.shaker = function (t, out) {
    var n = noise(t), hp = filt('highpass', 4500), lp = filt('lowpass', 10000), g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.035);
    g.gain.setTargetAtTime(0, t + 0.035, 0.035);
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); run(n, t, t + 0.035 + 0.25);
  };
  /* Cow: a low buzzy saw whose pitch rises then sags, through a resonant
     lowpass that opens "mmm" -> "ooo" and closes again. */
  DR.moo = function (t, out) {
    var o = osc('sawtooth', 100, t);
    o.frequency.linearRampToValueAtTime(128, t + 0.35);
    o.frequency.linearRampToValueAtTime(90, t + 1.0);
    var vib = osc('sine', 5.5, t), vg = gain(2.5); vib.connect(vg); vg.connect(o.frequency);
    var lp = filt('lowpass', 250, 5);
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.linearRampToValueAtTime(900, t + 0.3);
    lp.frequency.linearRampToValueAtTime(450, t + 1.0);
    var g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.12);
    g.gain.linearRampToValueAtTime(0.22, t + 0.75);
    g.gain.setTargetAtTime(0, t + 0.75, 0.1);
    var end = t + 0.75 + 0.7;
    o.connect(lp); lp.connect(g); g.connect(out);
    run(o, t, end); run(vib, t, end);
  };
  /* Chicken: "buk, buk, ba-GAWK" - three nasal chirps. */
  DR.cluck = function (t, out) {
    var bp = filt('bandpass', 1400, 2), lp = filt('lowpass', 3200);
    bp.connect(lp); lp.connect(out);
    function chirp(t0, path, dur, vol) {
      var o = osc('sawtooth', path[0], t0), g = gain(0);
      for (var i = 1; i < path.length; i++) o.frequency.linearRampToValueAtTime(path[i], t0 + dur * i / (path.length - 1));
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
      g.gain.setTargetAtTime(0, t0 + dur * 0.6, dur * 0.22);
      o.connect(g); g.connect(bp); run(o, t0, t0 + dur * 0.6 + dur * 0.22 * 7);
    }
    chirp(t, [560, 400], 0.06, 0.5);
    chirp(t + 0.12, [560, 400], 0.06, 0.5);
    chirp(t + 0.26, [520, 980, 640], 0.22, 0.55);
  };
  /* Duck: a short nasal saw with two formants sweeping down. */
  DR.quack = function (t, out) {
    var o = osc('sawtooth', 270, t);
    o.frequency.linearRampToValueAtTime(205, t + 0.2);
    var b1 = filt('bandpass', 1400, 5), b2 = filt('bandpass', 2500, 6), g = gain(0);
    b1.frequency.setValueAtTime(1500, t); b1.frequency.linearRampToValueAtTime(900, t + 0.2);
    o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.0, t + 0.012);
    g.gain.linearRampToValueAtTime(0.8, t + 0.15);
    g.gain.setTargetAtTime(0, t + 0.15, 0.03);
    run(o, t, t + 0.15 + 0.25);
  };
  /* Sheep: "baa-aa-aa", a saw with a fast wobble in pitch and loudness. */
  DR.baa = function (t, out) {
    var o = osc('sawtooth', 300, t);
    o.frequency.linearRampToValueAtTime(270, t + 0.7);
    var lfo = osc('sine', 7, t), lf = gain(14), la = gain(0.3);
    lfo.connect(lf); lf.connect(o.frequency);
    var trem = gain(0.7);
    lfo.connect(la); la.connect(trem.gain);
    var bp = filt('bandpass', 950, 1.6), lp = filt('lowpass', 2600), g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.04);
    g.gain.linearRampToValueAtTime(0.45, t + 0.6);
    g.gain.setTargetAtTime(0, t + 0.6, 0.07);
    o.connect(bp); bp.connect(lp); lp.connect(trem); trem.connect(g); g.connect(out);
    var end = t + 0.6 + 0.5;
    run(o, t, end); run(lfo, t, end);
  };
  /* Frog: "rib-bit", two croaks made of fast pulses. */
  DR.ribbit = function (t, out) {
    var bp = filt('bandpass', 750, 2.5); bp.connect(out);
    function croak(t0, f, dur) {
      var o = osc('sawtooth', f, t0);
      o.frequency.linearRampToValueAtTime(f * 0.85, t0 + dur);
      var am = gain(0), lfo = osc('triangle', 30, t0), lg = gain(0.5);
      am.gain.setValueAtTime(0.5, t0);
      lfo.connect(lg); lg.connect(am.gain);     // gain swings 0..1 at 30 Hz, smoothly
      var g = gain(0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.9, t0 + 0.01);
      g.gain.setTargetAtTime(0, t0 + dur, 0.02);
      o.connect(am); am.connect(g); g.connect(bp);
      var end = t0 + dur + 0.16;
      run(o, t0, end); run(lfo, t0, end);
    }
    croak(t, 150, 0.1);
    croak(t + 0.16, 185, 0.12);
  };

  /* S.drum(id, when?, dest?) */
  S.drum = function (id, when, dest) {
    if (!S.canPlay() || !DR[id]) return;
    try { DR[id](Math.max(when || 0, ctx.currentTime), dest || drumBus); } catch (e) {}
  };

  return S;
})();
