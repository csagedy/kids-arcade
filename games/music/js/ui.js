/* Music Pad screen, on the arcade kit. Three toys on one page, switched by
   the picture tabs in the bar:
     keys   a rainbow xylophone (pentatonic by default, so any mash sounds
            nice); multi-touch, and sliding a finger glisses across the bars
     drums  twelve pads: drums, an egg shaker and farm animals
     loop   an 8-step sequencer; tap or drag across cells, play head sweeps
   Keys and drums can be recorded and played back (a few saved tunes).

   Every pointer is tracked by id, so ten fingers work at once. Loop timing
   is scheduled against the AudioContext clock with a short look-ahead (a
   25 ms timer only tops the schedule up), and the screen follows the audio
   clock in requestAnimationFrame, so the play head stays in step on an old
   iPad. Sound: js/synth.js. Model and saves: js/game.js. */
(function () {
  'use strict';
  var M = MusicModel, S = MPSynth;
  function $(id) { return document.getElementById(id); }
  var shell = $('shell'), stage = $('stage');
  var keysEl = $('keys'), drumsEl = $('drums'), gridEl = $('grid');
  var muteBtn = $('mute-btn');

  var prefs = M.loadPrefs();
  var saved = M.loadLoop();
  var pattern = saved.pattern, loopDrums = saved.drums;
  var tunes = M.loadTunes();

  /* ---------- pictures ---------- */
  var RAINBOW = ['#ff5d73', '#ff9f43', '#ffd23f', '#3ddc84', '#4cc2ff', '#a77bff'];
  function svg(vb, body, cls) { return '<svg class="' + (cls || 'art') + '" viewBox="' + vb + '" aria-hidden="true" focusable="false">' + body + '</svg>'; }
  var ART = {
    bars: function () {
      var s = '<path d="M4 12.5 44 16M4 27.5 44 24" stroke="#c98a4b" stroke-width="3" stroke-linecap="round"/>';
      for (var i = 0; i < 6; i++) {
        var h = 32 - i * 3, x = 4.2 + i * 6.9;
        s += '<rect x="' + x + '" y="' + (20 - h / 2) + '" width="5.4" height="' + h + '" rx="2.2" fill="' + RAINBOW[i] + '"/>';
      }
      return svg('0 0 48 40', s);
    },
    drum: function () {
      return svg('0 0 48 40',
        '<path d="M6 19v11a18 6 0 0 0 36 0V19" fill="#ff5d73"/>' +
        '<path d="M6 23l6 8 6-8 6 8 6-8 6 8 6-8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<ellipse cx="24" cy="19" rx="18" ry="6" fill="#eef0ff" stroke="#c12c47" stroke-width="2"/>' +
        '<path d="M9 3l13 13M39 3 26 16" stroke="#e8b36a" stroke-width="3.4" stroke-linecap="round"/>' +
        '<circle cx="22" cy="16" r="2.6" fill="#e8b36a"/><circle cx="26" cy="16" r="2.6" fill="#e8b36a"/>');
    },
    grid: function () {
      var on = { '0,0': 0, '1,1': 1, '2,2': 3, '1,3': 4, '0,2': 2 }, s = '';
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
        var k = on[r + ',' + c];
        s += '<rect x="' + (3 + c * 10.8) + '" y="' + (4 + r * 11) + '" width="9" height="9" rx="2.6" fill="' + (k === undefined ? 'rgba(255,255,255,0.28)' : RAINBOW[k]) + '"/>';
      }
      return svg('0 0 48 40', '<rect x="13.6" y="1.5" width="10.8" height="35" rx="3" fill="#fff" opacity="0.22"/>' + s);
    },
    mallet: function () {
      return svg('0 0 48 48', '<path d="M11 41 31 17" stroke="#e8b36a" stroke-width="4.5" stroke-linecap="round"/>' +
        '<circle cx="33.5" cy="14" r="9" fill="#ff5d73"/><circle cx="30.5" cy="11" r="2.8" fill="#fff" opacity="0.65"/>');
    },
    rec: function () { return svg('0 0 24 24', '<circle cx="12" cy="12" r="8" fill="#ff5d73" stroke="#fff" stroke-width="2.2"/>'); },
    stop: function () { return svg('0 0 24 24', '<rect x="6" y="6" width="12" height="12" rx="2.6" fill="currentColor"/>'); },
    note: function () {
      return svg('0 0 24 24', '<path d="M9 17.5V6.2l10-2.2v11.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<ellipse cx="6.4" cy="17.6" rx="3.1" ry="2.5" fill="currentColor"/><ellipse cx="16.4" cy="15.4" rx="3.1" ry="2.5" fill="currentColor"/>');
    },
    trash: function () {
      return svg('0 0 24 24', '<path d="M5 7h14M10 4.5h4M7 7l1 12.5h8L17 7" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>');
    },
    dots: function (n) {
      var s = '';
      for (var i = 0; i < n; i++) {
        var a = Math.PI * (1 - i / (n - 1)), x = 12 + 8.5 * Math.cos(a), y = 15 - 8.5 * Math.sin(a);
        s += '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="' + (n > 5 ? 2.1 : 2.6) + '" fill="' + M.NOTE_COLORS[n > 5 ? i : M.PENTA_DEG[i]][0] + '"/>';
      }
      return svg('0 0 24 22', s);
    },
    kick: function () {
      return svg('0 0 48 48', '<circle cx="24" cy="24" r="19" fill="#fffaf0" stroke="#7c2236" stroke-width="3.5"/>' +
        '<circle cx="24" cy="24" r="8.5" fill="#ff5d73"/>' +
        [0, 60, 120, 180, 240, 300].map(function (d) {
          var a = d * Math.PI / 180; return '<circle cx="' + (24 + 19 * Math.cos(a)).toFixed(1) + '" cy="' + (24 + 19 * Math.sin(a)).toFixed(1) + '" r="2.4" fill="#d9dbe8"/>';
        }).join(''));
    },
    snare: function () {
      return svg('0 0 48 48', '<path d="M7 18v14a17 5.5 0 0 0 34 0V18" fill="#eef0ff"/>' +
        '<path d="M7 21l5.7 9 5.6-9 5.7 9 5.7-9 5.6 9 5.7-9" fill="none" stroke="#c86a12" stroke-width="2" stroke-linejoin="round"/>' +
        '<ellipse cx="24" cy="18" rx="17" ry="5.5" fill="#fff" stroke="#9aa0cf" stroke-width="2"/>' +
        '<path d="M14 4l8 12M36 6l-9 10" stroke="#5a3a1a" stroke-width="2.8" stroke-linecap="round"/>');
    },
    hat: function () {
      return svg('0 0 48 48', '<path d="M24 16v28M16 44h16" stroke="#3b418f" stroke-width="3" stroke-linecap="round"/>' +
        '<ellipse cx="24" cy="21" rx="19" ry="4.2" fill="#ffe27a" stroke="#b88600" stroke-width="2"/>' +
        '<ellipse cx="24" cy="14" rx="19" ry="4.2" fill="#ffd23f" stroke="#b88600" stroke-width="2"/>' +
        '<ellipse cx="24" cy="11.5" rx="4" ry="2.4" fill="#d69a00"/>');
    },
    tom: function () {
      return svg('0 0 48 48', '<path d="M10 17v15a14 5 0 0 0 28 0V17" fill="#1f9a57"/>' +
        '<path d="M10 22h28" stroke="#fff" stroke-width="2" opacity="0.5"/>' +
        '<ellipse cx="24" cy="17" rx="14" ry="5" fill="#eef0ff" stroke="#145c35" stroke-width="2"/>' +
        '<path d="M16 37v7M32 37v7" stroke="#3b418f" stroke-width="3" stroke-linecap="round"/>');
    },
    cowbell: function () {
      return svg('0 0 48 48', '<path d="M20 11V6h8v5" fill="none" stroke="#5c6088" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M15 11h18l6 27H9z" fill="#d9dbe8" stroke="#5c6088" stroke-width="2.6" stroke-linejoin="round"/>' +
        '<path d="M17 15l-3.5 17" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>' +
        '<ellipse cx="24" cy="38" rx="15" ry="3.5" fill="#5c6088"/>');
    }
  };
  function em(ch) { return '<span class="em" aria-hidden="true">' + ch + '</span>'; }
  var VOICE_ART = [ART.mallet, function () { return em('🎹'); }, function () { return em('☁️'); }, function () { return em('✨'); }];
  var DRUM_ART = {
    kick: ART.kick, snare: ART.snare, hat: ART.hat, tom: ART.tom, cowbell: ART.cowbell,
    clap: function () { return em('👏'); }, shaker: function () { return em('🥚'); },
    moo: function () { return em('🐮'); }, cluck: function () { return em('🐔'); }, quack: function () { return em('🦆'); },
    baa: function () { return em('🐑'); }, ribbit: function () { return em('🐸'); }
  };
  var TEMPO_ART = ['🐌', '🐢', '🐇'];

  function tapPx() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k-tap')) || 48; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- the audio-clock queue ----------
     at(t, fn, tag): run fn when the AudioContext clock reaches t, so lights
     line up with what is heard. */
  var vq = [], rafId = 0;
  function at(t, fn, tag) {
    var i = vq.length;
    while (i > 0 && vq[i - 1].t > t) i--;
    vq.splice(i, 0, { t: t, fn: fn, tag: tag });
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function frame() {
    rafId = 0;
    var now = S.now();
    while (vq.length && vq[0].t <= now) { var e = vq.shift(); try { e.fn(); } catch (x) {} }
    if (vq.length) rafId = requestAnimationFrame(frame);
  }
  function dropQueue(tag) { vq = vq.filter(function (e) { return e.tag !== tag; }); }

  /* a quick shake of the sound button when someone plays while muted */
  var lastNudge = 0;
  function muteNudge(toast) {
    var now = Date.now();
    if (now - lastNudge < 1500) return;
    lastNudge = now;
    Kit.anim(muteBtn, 'k-shake');
    if (toast) Kit.toast('Sound is off', { icon: 'mute', top: true });
  }
  function ready() {
    S.unlock();
    if (Kit.muted()) { muteNudge(false); return false; }
    return true;
  }

  /* ---------- recording ---------- */
  var rec = null;
  var recBtn = $('rec-btn'), tunesBtn = $('tunes-btn');
  function record(e) {
    if (!rec) return;
    var now = performance.now();
    if (!rec.ev.length) rec.t0 = now;
    e.t = now - rec.t0;
    rec.ev.push(e);
    if (rec.ev.length >= M.MAX_EVENTS || e.t >= M.MAX_MS) finishRec();
  }
  function startRec() {
    stopTune();
    rec = { ev: [], t0: 0, timer: setTimeout(finishRec, M.MAX_MS + 20000) };
    paintRec();
  }
  function finishRec() {
    if (!rec) return;
    var r = rec; rec = null;
    clearTimeout(r.timer);
    paintRec();
    if (r.ev.length < 2) return;
    var a = M.nextAnimal();
    tunes.unshift({ a: a, e: M.encodeEvents(r.ev) });
    tunes = tunes.slice(0, M.MAX_TUNES);
    M.saveTunes(tunes);
    stat();
    paintTunes();
    Kit.anim(tunesBtn, 'mp-bounce');
    Kit.toast(M.ANIMALS[a] + ' Saved!', { top: true });
  }
  function paintRec() {
    recBtn.innerHTML = rec ? ART.stop() : ART.rec();
    recBtn.classList.toggle('mp-recording', !!rec);
    recBtn.setAttribute('aria-label', rec ? 'Stop recording' : 'Record');
    shell.classList.toggle('mp-is-rec', !!rec);
  }

  /* ---------- tune playback ---------- */
  var tune = null;   // { ev, i, t0, lane, timer, a }
  function playTune(k) {
    stopTune();
    if (rec) finishRec();
    var ev = M.decodeEvents(tunes[k] && tunes[k].e);
    if (!ev.length || !ready()) return;
    var lane = S.lane();
    if (!lane) return;
    tune = { ev: ev, i: 0, t0: S.now() + 0.15, lane: lane, a: tunes[k].a };
    tune.timer = setInterval(feedTune, 50);
    feedTune();
    paintTunes();
  }
  function feedTune() {
    if (!tune) return;
    var ahead = S.now() + 0.3;
    while (tune.i < tune.ev.length) {
      var e = tune.ev[tune.i], t = tune.t0 + e.t / 1000;
      if (t > ahead) break;
      tune.i++;
      if (e.k === 'k') {
        S.note(e.v, M.freq(e.m), t, tune.lane.mel, e.v === 2 ? 0.35 : 0);
        (function (m) { at(t, function () { flashKey(m); }, 'tune'); })(e.m);
      } else {
        S.drum(M.DRUMS[e.d].id, t, tune.lane.drum);
        (function (d) { at(t, function () { hitPad(d); }, 'tune'); })(e.d);
      }
    }
    if (tune.i >= tune.ev.length && S.now() > tune.t0 + M.tuneLength(tune.ev) / 1000 + 0.6) stopTune();
  }
  function stopTune() {
    if (!tune) return;
    clearInterval(tune.timer);
    tune.lane.stop();
    tune = null;
    dropQueue('tune');
    paintTunes();
  }
  function paintTunes() {
    tunesBtn.innerHTML = tune ? em(M.ANIMALS[tune.a] || '🎵') + '<span class="mp-mini-stop">' + ART.stop() + '</span>' : ART.note() +
      (tunes.length ? '<span class="mp-count">' + tunes.length + '</span>' : '');
    tunesBtn.classList.toggle('mp-playing', !!tune);
    tunesBtn.setAttribute('aria-label', tune ? 'Stop the tune' : 'My tunes');
  }
  function tunesHTML() {
    if (!tunes.length) {
      return '<div class="mp-empty"><span class="mp-empty__rec">' + ART.rec() + '</span>' + Kit.icon('next') +
        '<span class="mp-empty__art">' + em('🌈') + '</span>' + Kit.icon('next') + '<span class="mp-empty__note">' + ART.note() + '</span></div>' +
        '<p>Tap the red dot, play something, then tap it again to keep your tune.</p>';
    }
    return '<div class="mp-tunes">' + tunes.map(function (t, i) {
      var ev = M.decodeEvents(t.e), secs = Math.max(1, Math.round(M.tuneLength(ev) / 1000));
      return '<div class="mp-tune">' +
        '<button class="k-btn mp-tune__play" data-play="' + i + '" aria-label="Play tune ' + (i + 1) + '">' +
          em(M.ANIMALS[t.a] || '🎵') + Kit.icon('play') + '<span class="mp-tune__len">' + secs + 's</span></button>' +
        '<button class="k-btn k-btn--icon mp-tune__del" data-del="' + i + '" aria-label="Throw tune ' + (i + 1) + ' away">' + ART.trash() + '</button>' +
      '</div>';
    }).join('') + '</div>';
  }
  function openTunes() {
    if (tune) { stopTune(); return; }
    if (rec) finishRec();
    Kit.sfx.open();
    Kit.sheet({
      title: 'My tunes',
      html: '<div class="mp-sheet">' + tunesHTML() + '</div>',
      buttons: [{ label: 'Close', value: null }],
      onOpen: function (card, close) {
        var box = card.querySelector('.mp-sheet');
        box.addEventListener('click', function (e) {
          var p = e.target.closest('[data-play]'), d = e.target.closest('[data-del]');
          if (p) { close(null); playTune(+p.getAttribute('data-play')); }
          else if (d) {
            var i = +d.getAttribute('data-del'), t = tunes[i];
            if (!t) return;
            Kit.confirm({ emoji: M.ANIMALS[t.a] || '🎵', title: 'Throw this tune away?', yes: 'Throw away', no: 'Keep it', danger: true }).then(function (yes) {
              if (!yes) return;
              tunes.splice(i, 1);
              M.saveTunes(tunes);
              stat();
              paintTunes();
              box.innerHTML = tunesHTML();
            });
          }
        });
      }
    });
  }
  recBtn.addEventListener('click', function () {
    S.unlock();
    if (rec) finishRec(); else startRec();
  });
  tunesBtn.addEventListener('click', openTunes);

  /* ---------- keys (the xylophone) ---------- */
  var bars = [], tall = false, keyFingers = {};
  function buildKeys() {
    var r = keysEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var all = M.scaleNotes(prefs.s);
    tall = r.height > r.width * 1.05;
    var len = tall ? r.height : r.width;
    // as many bars as fit at a finger's width each (always all of the pentatonic)
    var n = clamp(Math.floor(len / tapPx()), Math.min(11, all.length), all.length);
    var notes = all.slice(0, n);
    var slot = len / n, gap = clamp(slot * 0.12, 4, 14);
    keysEl.className = 'mp-pane keys ' + (tall ? 'tall' : 'wide');
    keysEl.style.setProperty('--gap', gap + 'px');
    keysEl.style.setProperty('--peg', clamp(Math.min(slot * 0.16, 16), 5, 16) + 'px');
    // two wooden rails under the bars, converging as the bars get shorter
    var TAPER = 0.3, L0 = 1, L1 = 1 - TAPER, a0 = 0.5 / n * 100 - 2, a1 = 100 - 0.5 / n * 100 + 2;
    function rail(sign) {
      var o0 = 50 + sign * 30 * L0, o1 = 50 + sign * 30 * L1;
      return tall
        ? '<line x1="' + o0 + '" y1="' + (100 - a0) + '" x2="' + o1 + '" y2="' + (100 - a1) + '"/>'
        : '<line x1="' + a0 + '" y1="' + o0 + '" x2="' + a1 + '" y2="' + o1 + '"/>';
    }
    var html = '<svg class="rails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + rail(-1) + rail(1) + '</svg><div class="bars">';
    notes.forEach(function (nt, i) {
      var k = n > 1 ? i / (n - 1) : 0, c = M.NOTE_COLORS[nt.deg];
      html += '<div class="bar" data-i="' + i + '" style="--k:' + k.toFixed(3) + ';--c:' + c[0] + ';--e:' + c[1] + '"><div class="bar-in"></div></div>';
    });
    keysEl.innerHTML = html + '</div>';
    var els = keysEl.querySelectorAll('.bar');
    bars = notes.map(function (nt, i) { return { note: nt, el: els[i], down: 0 }; });
    keyFingers = {};
  }
  function keyAt(e) {
    var r = keysEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height || !bars.length) return -1;
    var p = tall ? 1 - y / r.height : x / r.width;
    return clamp(Math.floor(p * bars.length), 0, bars.length - 1);
  }
  var sparks = 0;
  function sparkle(b) {
    if (sparks > 14 || Kit.reduced) return;
    var r = b.el.getBoundingClientRect(), pr = keysEl.getBoundingClientRect();
    var s = document.createElement('span');
    s.className = 'spark';
    s.textContent = Math.random() < 0.5 ? '♪' : '♫';
    s.style.color = b.el.style.getPropertyValue('--c');
    var x = r.left - pr.left + r.width * (tall ? 0.15 + Math.random() * 0.7 : 0.5);
    var y = r.top - pr.top + (tall ? r.height * 0.5 : r.height * (0.1 + 0.6 * Math.random()));
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
    keysEl.appendChild(s);
    sparks++;
    setTimeout(function () { sparks--; if (s.parentNode) s.parentNode.removeChild(s); }, 900);
  }
  function hitBar(i) {
    var b = bars[i];
    if (!b) return;
    Kit.anim(b.el, 'hit');
    sparkle(b);
  }
  function flashKey(midi) {
    for (var i = 0; i < bars.length; i++) if (bars[i].note.midi === midi) { hitBar(i); return; }
  }
  function playKey(i, when) {
    var b = bars[i];
    var h = S.note(prefs.v, M.freq(b.note.midi), when);
    record({ k: 'k', v: prefs.v, m: b.note.midi });
    hitBar(i);
    return h;
  }
  function setDown(i, d) {
    var b = bars[i];
    if (!b) return;
    b.down = Math.max(0, b.down + d);
    b.el.classList.toggle('down', b.down > 0);
  }
  function moveKey(e) {
    var f = keyFingers[e.pointerId];
    if (!f) return;
    var i = keyAt(e);
    if (i === f.i) return;
    if (f.h) f.h.release();
    if (f.i >= 0) setDown(f.i, -1);
    f.h = null;
    if (i >= 0) {
      // a fast slide can skip bars between two moves: play them too (a glissando)
      if (f.i >= 0 && Math.abs(i - f.i) > 1 && prefs.v !== 2) {
        var dir = i > f.i ? 1 : -1, n = 0;
        for (var j = f.i + dir; j !== i && n < 5; j += dir, n++) playKey(j, S.now() + n * 0.012);
        f.h = playKey(i, S.now() + n * 0.012);
      } else f.h = playKey(i);
      setDown(i, 1);
    }
    f.i = i;
  }
  keysEl.addEventListener('pointerdown', function (e) {
    if (Kit.overlayOpen()) return;
    e.preventDefault();
    ready();
    try { keysEl.setPointerCapture(e.pointerId); } catch (x) {}
    keyFingers[e.pointerId] = { i: -1, h: null };
    moveKey(e);
  });
  keysEl.addEventListener('pointermove', function (e) { if (keyFingers[e.pointerId]) moveKey(e); });
  function keyUp(e) {
    var f = keyFingers[e.pointerId];
    if (!f) return;
    if (f.h) f.h.release();
    if (f.i >= 0) setDown(f.i, -1);
    delete keyFingers[e.pointerId];
  }
  keysEl.addEventListener('pointerup', keyUp);
  keysEl.addEventListener('pointercancel', keyUp);

  /* ---------- drums ---------- */
  var pads = [], drumFingers = {};
  function buildDrums() {
    drumsEl.innerHTML = '<div class="pads">' + M.DRUMS.map(function (d, i) {
      return '<button class="pad" data-pad="' + i + '" aria-label="' + d.name + '" style="--c:' + d.c[0] + ';--e:' + d.c[1] + '"><span class="pad-art">' + DRUM_ART[d.id]() + '</span></button>';
    }).join('') + '</div>';
    pads = Array.prototype.slice.call(drumsEl.querySelectorAll('.pad'));
  }
  function layoutDrums() {
    var r = drumsEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var n = pads.length, best = null, gap = clamp(Math.min(r.width, r.height) * 0.025, 8, 18);
    [2, 3, 4, 6].forEach(function (cols) {
      var rows = Math.ceil(n / cols);
      var w = (r.width - gap * (cols - 1)) / cols, h = (r.height - gap * (rows - 1)) / rows;
      var score = Math.min(w, h * 1.15);
      if (!best || score > best.score) best = { cols: cols, rows: rows, w: w, h: h, score: score };
    });
    var box = drumsEl.firstChild;
    box.style.gridTemplateColumns = 'repeat(' + best.cols + ', 1fr)';
    box.style.gridTemplateRows = 'repeat(' + best.rows + ', 1fr)';
    box.style.gap = gap + 'px';
    drumsEl.style.setProperty('--art', Math.min(best.w, best.h) * 0.5 + 'px');
  }
  function hitPad(i) { if (pads[i]) Kit.anim(pads[i], 'hit'); }
  function playPad(i) {
    S.drum(M.DRUMS[i].id);
    record({ k: 'd', d: i });
    hitPad(i);
  }
  function padAt(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var p = el && el.closest ? el.closest('.pad') : null;
    return p && drumsEl.contains(p) ? +p.getAttribute('data-pad') : -1;
  }
  drumsEl.addEventListener('pointerdown', function (e) {
    if (Kit.overlayOpen()) return;
    e.preventDefault();
    ready();
    try { drumsEl.setPointerCapture(e.pointerId); } catch (x) {}
    var i = padAt(e);
    drumFingers[e.pointerId] = i;
    if (i >= 0) { playPad(i); pads[i].classList.add('down'); }
  });
  drumsEl.addEventListener('pointermove', function (e) {
    if (!(e.pointerId in drumFingers)) return;
    var i = padAt(e), was = drumFingers[e.pointerId];
    if (i === was) return;
    if (was >= 0) pads[was].classList.remove('down');
    drumFingers[e.pointerId] = i;
    if (i >= 0) { playPad(i); pads[i].classList.add('down'); }
  });
  function padUp(e) {
    if (!(e.pointerId in drumFingers)) return;
    var was = drumFingers[e.pointerId];
    if (was >= 0) pads[was].classList.remove('down');
    delete drumFingers[e.pointerId];
  }
  drumsEl.addEventListener('pointerup', padUp);
  drumsEl.addEventListener('pointercancel', padUp);

  /* ---------- loop maker ---------- */
  var cells = [], labels = [], headEl = null, vert = false;
  var NR = M.ROWS.length, MEL = M.MELODY_ROWS;
  function rowColor(r) {
    var row = M.ROWS[r];
    return row.kind === 'note' ? M.NOTE_COLORS[row.deg] : M.DRUMS[loopDrums[row.slot]].c;
  }
  function rowArt(r) {
    var row = M.ROWS[r];
    if (row.kind === 'note') return '<span class="dot"></span>';
    return DRUM_ART[M.DRUMS[loopDrums[row.slot]].id]();
  }
  /* grid lines: one label track, a split, the steps in two groups of four;
     the sound rows in two groups (melody, drums) */
  function stepLine(c) { return c < 4 ? c + 3 : c + 4; }
  function soundLine(r) { return vert ? (r < MEL ? MEL - r : r + 2) : (r < MEL ? r + 1 : r + 2); }
  function place(el, r, c) {
    var a = r === null ? '1 / -1' : soundLine(r), b = c === null ? '1' : stepLine(c);
    if (c === 'all') b = '1 / -1';
    if (vert) { el.style.gridColumn = a; el.style.gridRow = b; } else { el.style.gridRow = a; el.style.gridColumn = b; }
  }
  function buildLoop() {
    var html = '<div class="head" aria-hidden="true"></div>';
    for (var r = 0; r < NR; r++) {
      html += '<button class="lab' + (M.ROWS[r].kind === 'drum' ? ' lab--drum' : '') + '" data-lab="' + r + '"></button>';
      for (var c = 0; c < M.STEPS; c++) html += '<div class="cell' + (c % 4 === 0 ? ' beat' : '') + '" data-r="' + r + '" data-c="' + c + '"><i></i></div>';
    }
    gridEl.innerHTML = html;
    headEl = gridEl.querySelector('.head');
    labels = []; cells = [];
    for (var rr = 0; rr < NR; rr++) {
      labels.push(gridEl.querySelector('[data-lab="' + rr + '"]'));
      cells.push(Array.prototype.slice.call(gridEl.querySelectorAll('.cell[data-r="' + rr + '"]')));
    }
    paintRows();
    paintCells();
  }
  function paintRows() {
    for (var r = 0; r < NR; r++) {
      var col = rowColor(r);
      labels[r].innerHTML = rowArt(r);
      labels[r].style.setProperty('--c', col[0]); labels[r].style.setProperty('--e', col[1]);
      labels[r].setAttribute('aria-label', M.ROWS[r].kind === 'note' ? 'Hear this note' : 'Change this drum: ' + M.DRUMS[loopDrums[M.ROWS[r].slot]].name);
      cells[r].forEach(function (el) { el.style.setProperty('--c', col[0]); el.style.setProperty('--e', col[1]); });
    }
  }
  function paintCells() {
    for (var r = 0; r < NR; r++) for (var c = 0; c < M.STEPS; c++) cells[r][c].classList.toggle('on', pattern[r][c]);
  }
  function layoutLoop() {
    var pane = $('loop'), r = pane.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var W = r.width, H = r.height, tap = tapPx(), split = clamp(Math.min(W, H) * 0.012, 6, 12), beat = split * 0.8;
    function fit(v) {
      // v false: steps across, sounds down. v true: steps down, sounds across.
      var steps = v ? H : W, sounds = v ? W : H;
      var lab = clamp((sounds - split) / NR * 0.85, 40, 84);
      var cs = (steps - lab - split - beat) / M.STEPS;     // along the steps
      var cn = (sounds - split) / NR;                       // along the sounds
      if (cs > cn * 1.7) cs = cn * 1.7;
      if (cn > cs * 1.5) cn = cs * 1.5;
      lab = Math.min(lab, Math.max(cs, 40));
      return { v: v, cs: cs, cn: cn, lab: lab, min: Math.min(cs, cn) };
    }
    var h = fit(false), vv = fit(true);
    var f = h.min < tap && vv.min > h.min ? vv : h;
    var changed = vert !== f.v;
    vert = f.v;
    var stepsTrack = f.lab + 'px ' + split + 'px repeat(4, ' + f.cs + 'px) ' + beat + 'px repeat(4, ' + f.cs + 'px)';
    var soundsTrack = 'repeat(' + MEL + ', ' + f.cn + 'px) ' + split + 'px repeat(' + (NR - MEL) + ', ' + f.cn + 'px)';
    gridEl.style.gridTemplateColumns = vert ? soundsTrack : stepsTrack;
    gridEl.style.gridTemplateRows = vert ? stepsTrack : soundsTrack;
    gridEl.classList.toggle('vert', vert);
    gridEl.style.setProperty('--cell', f.min + 'px');
    if (changed || !gridEl._placed) {
      gridEl._placed = true;
      for (var rr = 0; rr < NR; rr++) {
        place(labels[rr], rr, null);
        for (var c = 0; c < M.STEPS; c++) place(cells[rr][c], rr, c);
      }
      placeHead(seq.shown);
    }
  }
  function placeHead(c) {
    if (c === null || c === undefined || c < 0) { headEl.classList.remove('show'); return; }
    if (vert) { headEl.style.gridColumn = '1 / -1'; headEl.style.gridRow = stepLine(c); }
    else { headEl.style.gridRow = '1 / -1'; headEl.style.gridColumn = stepLine(c); }
    headEl.classList.add('show');
  }

  var saveTimer = 0;
  function saveLoop() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { M.saveLoop(pattern, loopDrums); stat(); }, 300);
  }
  function soundRow(r, when, lane) {
    var row = M.ROWS[r];
    if (row.kind === 'note') S.note(prefs.lv, M.freq(row.midi), when, lane && lane.mel, prefs.lv === 2 ? M.stepDur(prefs.t) * 1.6 : 0);
    else S.drum(M.DRUMS[loopDrums[row.slot]].id, when, lane && lane.drum);
  }
  function setCell(r, c, v, preview) {
    if (pattern[r][c] === v) return;
    pattern[r][c] = v;
    cells[r][c].classList.toggle('on', v);
    if (v) Kit.anim(cells[r][c], 'pop');
    if (v && preview) soundRow(r);
    setUndo(false);
    saveLoop();
  }
  var painters = {};
  function cellAt(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var c = el && el.closest ? el.closest('.cell') : null;
    return c && gridEl.contains(c) ? c : null;
  }
  gridEl.addEventListener('pointerdown', function (e) {
    if (Kit.overlayOpen()) return;
    e.preventDefault();
    ready();
    var lab = e.target.closest && e.target.closest('.lab');
    if (lab) { tapLabel(+lab.getAttribute('data-lab')); return; }
    var cell = cellAt(e);
    if (!cell) return;
    try { gridEl.setPointerCapture(e.pointerId); } catch (x) {}
    var r = +cell.getAttribute('data-r'), c = +cell.getAttribute('data-c');
    var v = !pattern[r][c];
    painters[e.pointerId] = { v: v, key: r + ',' + c, last: performance.now() };
    setCell(r, c, v, true);
  });
  gridEl.addEventListener('pointermove', function (e) {
    var p = painters[e.pointerId];
    if (!p) return;
    var cell = cellAt(e);
    if (!cell) return;
    var r = +cell.getAttribute('data-r'), c = +cell.getAttribute('data-c'), key = r + ',' + c;
    if (key === p.key) return;
    p.key = key;
    var now = performance.now(), pre = now - p.last > 70;   // don't machine-gun previews on a fast drag
    if (pre && p.v) p.last = now;
    setCell(r, c, p.v, pre);
  });
  function paintUp(e) { delete painters[e.pointerId]; }
  gridEl.addEventListener('pointerup', paintUp);
  gridEl.addEventListener('pointercancel', paintUp);

  function tapLabel(r) {
    var row = M.ROWS[r];
    if (row.kind === 'drum') {
      loopDrums[row.slot] = (loopDrums[row.slot] + 1) % M.DRUMS.length;
      paintRows();
      saveLoop();
    }
    soundRow(r);
    Kit.anim(labels[r], 'hit');
  }

  /* the sequencer: look-ahead scheduling on the audio clock */
  var seq = { playing: false, step: 0, next: 0, timer: 0, lane: null, shown: -1 };
  var LOOK = 0.12;
  function seqTick() {
    var now = S.now();
    if (seq.next < now - 0.05) seq.next = now + 0.03;   // woke up late (tab throttled): don't burst
    while (seq.next < now + LOOK) {
      scheduleStep(seq.step, seq.next);
      seq.next += M.stepDur(prefs.t);
      seq.step = (seq.step + 1) % M.STEPS;
    }
  }
  function scheduleStep(c, t) {
    for (var r = 0; r < NR; r++) if (pattern[r][c]) soundRow(r, t, seq.lane);
    at(t, function () { showStep(c); }, 'loop');
  }
  function showStep(c) {
    seq.shown = c;
    placeHead(c);
    for (var r = 0; r < NR; r++) {
      if (pattern[r][c]) { Kit.anim(cells[r][c], 'hit'); Kit.anim(labels[r], 'hit'); }
    }
    if (c % 4 === 0) Kit.anim(gridEl, c === 0 ? 'beat1' : 'beat');
  }
  function startLoop() {
    if (seq.playing) return;
    if (!ready()) { muteNudge(true); return; }
    seq.lane = S.lane();
    if (!seq.lane) return;
    seq.playing = true;
    seq.step = 0;
    seq.next = S.now() + 0.06;
    seq.timer = setInterval(seqTick, 25);
    seqTick();
    paintPlay();
  }
  function stopLoop() {
    if (!seq.playing) return;
    seq.playing = false;
    clearInterval(seq.timer);
    seq.lane.stop();
    seq.lane = null;
    dropQueue('loop');
    seq.shown = -1;
    placeHead(-1);
    paintPlay();
  }
  var playBtn = $('play-btn');
  function paintPlay() {
    playBtn.innerHTML = seq.playing ? ART.stop() : Kit.icon('play');
    playBtn.classList.toggle('k-btn--good', !seq.playing);
    playBtn.classList.toggle('k-btn--bad', seq.playing);
    playBtn.setAttribute('aria-label', seq.playing ? 'Stop the loop' : 'Play the loop');
    shell.classList.toggle('mp-looping', seq.playing);
  }
  playBtn.addEventListener('click', function () { if (seq.playing) stopLoop(); else startLoop(); });

  /* tempo: three animals, slow to fast */
  var tempoBox = $('tempos');
  tempoBox.innerHTML = M.TEMPOS.map(function (t, i) {
    return '<button class="k-btn k-btn--icon mp-btn mp-opt" data-t="' + i + '" aria-label="' + ['Slow', 'Medium', 'Fast'][i] + '">' + em(TEMPO_ART[i]) + '</button>';
  }).join('');
  function paintTempo() {
    Array.prototype.forEach.call(tempoBox.children, function (b, i) { b.classList.toggle('k-on', i === prefs.t); b.setAttribute('aria-pressed', i === prefs.t); });
  }
  tempoBox.addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]');
    if (!b) return;
    prefs.t = +b.getAttribute('data-t');
    M.savePrefs(prefs);
    paintTempo();
    Kit.anim(b, 'mp-bounce');
  });

  /* the loop's instrument: one button that steps through the four */
  var lvBtn = $('lvoice-btn');
  function paintLoopVoice() {
    lvBtn.innerHTML = VOICE_ART[prefs.lv]();
    lvBtn.setAttribute('aria-label', 'Loop instrument: ' + M.VOICES[prefs.lv].name);
  }
  lvBtn.addEventListener('click', function () {
    prefs.lv = (prefs.lv + 1) % M.VOICES.length;
    M.savePrefs(prefs);
    paintLoopVoice();
    Kit.anim(lvBtn, 'mp-bounce');
    if (!seq.playing && ready()) S.note(prefs.lv, M.freq(72));
  });

  /* dice and clear; after either, the clear button offers undo for a while */
  var clearBtn = $('clear-btn'), undoPattern = null, undoTimer = 0;
  function setUndo(p) {
    clearTimeout(undoTimer);
    undoPattern = p || null;
    clearBtn.innerHTML = undoPattern ? Kit.icon('undo') : em('🧹');
    clearBtn.classList.toggle('mp-undo', !!undoPattern);
    clearBtn.setAttribute('aria-label', undoPattern ? 'Bring it back' : 'Clear the loop');
    if (undoPattern) undoTimer = setTimeout(function () { setUndo(null); }, 6000);
  }
  function popIn() {
    for (var c = 0; c < M.STEPS; c++) for (var r = 0; r < NR; r++) {
      var el = cells[r][c];
      if (!pattern[r][c]) continue;
      el.style.animationDelay = (c * 45) + 'ms';
      Kit.anim(el, 'pop');
    }
    setTimeout(function () { cells.forEach(function (row) { row.forEach(function (el) { el.style.animationDelay = ''; }); }); }, 900);
  }
  $('dice-btn').innerHTML = em('🎲');
  $('dice-btn').addEventListener('click', function () {
    var before = M.countOn(pattern) ? M.copyPattern(pattern) : null;
    pattern = M.surprise();
    paintCells();
    popIn();
    saveLoop();
    setUndo(before);
    Kit.anim($('dice-btn'), 'mp-roll');
    if (!seq.playing) startLoop();
  });
  clearBtn.addEventListener('click', function () {
    if (undoPattern) {
      pattern = undoPattern;
      setUndo(null);
      paintCells();
      popIn();
      saveLoop();
      return;
    }
    if (!M.countOn(pattern)) { Kit.anim(gridEl, 'k-shake'); return; }
    var before = M.copyPattern(pattern);
    pattern = M.emptyPattern();
    paintCells();
    saveLoop();
    setUndo(before);
  });

  /* ---------- keys controls: voices and scale ---------- */
  var voiceBox = $('voices');
  voiceBox.innerHTML = M.VOICES.map(function (v, i) {
    return '<button class="k-btn k-btn--icon mp-btn mp-opt" data-v="' + i + '" aria-label="' + v.name + '">' + VOICE_ART[i]() + '</button>';
  }).join('');
  function paintVoices() {
    Array.prototype.forEach.call(voiceBox.children, function (b, i) { b.classList.toggle('k-on', i === prefs.v); b.setAttribute('aria-pressed', i === prefs.v); });
  }
  voiceBox.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]');
    if (!b) return;
    prefs.v = +b.getAttribute('data-v');
    M.savePrefs(prefs);
    paintVoices();
    Kit.anim(b, 'mp-bounce');
    if (ready()) {
      var h = S.note(prefs.v, M.freq(72));
      if (h) h.release(S.now() + 0.4);
    }
  });
  var scaleBtn = $('scale-btn');
  function paintScale() {
    scaleBtn.innerHTML = ART.dots(prefs.s === 'm' ? 7 : 5);
    scaleBtn.setAttribute('aria-label', prefs.s === 'm' ? 'Notes: all seven' : 'Notes: magic five');
  }
  scaleBtn.addEventListener('click', function () {
    prefs.s = prefs.s === 'm' ? 'p' : 'm';
    M.savePrefs(prefs);
    paintScale();
    buildKeys();
    Kit.anim(scaleBtn, 'mp-bounce');
    // a quick run up the new bars so the change is heard
    if (ready()) {
      var n = Math.min(prefs.s === 'm' ? 8 : 6, bars.length), t0 = S.now();
      for (var i = 0; i < n; i++) (function (i) {
        S.note(prefs.v, M.freq(bars[i].note.midi), t0 + i * 0.07, null, prefs.v === 2 ? 0.1 : 0);
        at(t0 + i * 0.07, function () { hitBar(i); }, 'ui');
      })(i);
    }
  });

  /* ---------- modes ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.mp-tab'));
  var TAB_ART = { keys: ART.bars, drums: ART.drum, loop: ART.grid };
  tabs.forEach(function (t) { t.innerHTML = TAB_ART[t.getAttribute('data-mode')](); });
  function setMode(m) {
    prefs.m = m;
    shell.setAttribute('data-mode', m);
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-mode') === m;
      t.classList.toggle('k-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // recording is for keys and drums; leaving them keeps what was played
    if (m === 'loop' && rec) finishRec();
    M.savePrefs(prefs);
    layout();
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var m = t.getAttribute('data-mode');
      if (m !== prefs.m) { setMode(m); Kit.anim(t, 'mp-bounce'); }
    });
  });

  var lastKeysSig = '';
  function layout() {
    if (prefs.m === 'keys') {
      var r = keysEl.getBoundingClientRect(), sig = Math.round(r.width) + 'x' + Math.round(r.height) + prefs.s;
      if (sig !== lastKeysSig) { lastKeysSig = sig; buildKeys(); }
    } else if (prefs.m === 'drums') layoutDrums();
    else layoutLoop();
  }
  var pend = 0;
  function relayout() { cancelAnimationFrame(pend); pend = requestAnimationFrame(layout); }
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(stage);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', function () { setTimeout(relayout, 250); });

  /* ---------- keyboard (desktop / iPad with a keyboard) ---------- */
  var KEYROW = 'asdfghjkl;\'';
  var keyDown = {};
  document.addEventListener('keydown', function (e) {
    if (Kit.overlayOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') { setMode(['keys', 'drums', 'loop'][+e.key - 1]); return; }
    if (prefs.m === 'loop' && e.key === ' ') { e.preventDefault(); if (seq.playing) stopLoop(); else startLoop(); return; }
    var k = KEYROW.indexOf(e.key.toLowerCase());
    if (k < 0 || e.repeat || keyDown[e.key]) return;
    if (prefs.m === 'keys' && k < bars.length) { ready(); keyDown[e.key] = playKey(k); setDown(k, 1); keyDown[e.key]._i = k; }
    else if (prefs.m === 'drums' && k < pads.length) { ready(); playPad(k); keyDown[e.key] = { release: function () {} }; }
  });
  document.addEventListener('keyup', function (e) {
    var h = keyDown[e.key];
    if (!h) return;
    h.release();
    if (h._i !== undefined) setDown(h._i, -1);
    delete keyDown[e.key];
  });

  /* ---------- mute, hidden page ---------- */
  Kit.bindMute(muteBtn);
  Kit.onMute(function (m) { if (m) { stopLoop(); stopTune(); } });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    stopLoop();
    stopTune();
    if (rec) finishRec();
    M.saveLoop(pattern, loopDrums);
  });
  window.addEventListener('pagehide', function () { stopLoop(); stopTune(); if (rec) finishRec(); M.saveLoop(pattern, loopDrums); });

  function stat() { Kit.stat('music', M.statLine(tunes, pattern)); }

  /* ---------- how to play ---------- */
  var HELP = [
    { emoji: '🌈', text: 'Tap the bars. <b>Slide</b> a finger for a whoosh!' },
    { emoji: '🐮', text: 'Tap the pads for drums and farm animals.' },
    { emoji: '🔁', text: 'Tap squares, press <b>play</b>. 🎲 makes a surprise!' },
    { emoji: '🔴', text: 'Record yourself, then play it back with 🎵.' }
  ];
  Kit.bindHelp($('help-btn'), 'music', HELP, { title: 'Music Pad', button: "Let's play!" });

  /* ---------- start ---------- */
  buildDrums();
  buildLoop();
  paintRec(); paintTunes(); paintPlay(); paintTempo(); paintLoopVoice(); paintVoices(); paintScale(); setUndo(null);
  setMode(prefs.m);
  Kit.howTo('music', HELP, { title: 'Music Pad', button: "Let's play!" });

  /* for screenshots and debugging */
  window.MusicPad = {
    setMode: setMode, start: startLoop, stop: stopLoop,
    surprise: function () { pattern = M.surprise(); paintCells(); saveLoop(); },
    showStep: function (c) { seq.shown = c; showStep(c); },
    tunes: openTunes,
    fakeTunes: function () {
      tunes = [{ a: 0, e: '0,k072;30,k074;60,k076;90,d0' }, { a: 3, e: '0,d7;80,d8;160,d10' }, { a: 5, e: '0,k164;250,k167' }];
      paintTunes();
    },
    rec: startRec
  };
})();
