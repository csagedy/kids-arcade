/* Doodle Pad screen, on the arcade kit.

   Layers, bottom to top, inside #page: the paper canvas (drawn at 1x: it is
   only a gradient), the ink canvas (the drawing, transparent where there is
   no ink, at the device's pixel ratio), and a guides canvas for the magic
   mirror lines. The ink canvas keeps one fixed pixel size per picture, so a
   rotation only re-fits it on screen and never redraws or loses anything.
   A page that is still empty takes the new shape instead.

   Strokes draw straight onto the ink canvas as the finger moves (one curve
   piece per pointer event, per mirror copy). Each finger has its own
   stroke. Everything drawn while at least one finger is down is one
   "gesture" = one undo step: when it starts, the ink is copied to a backup
   canvas; when the last finger lifts, the 128px tiles the gesture touched
   are cut from the backup and kept as the undo entry.

   Saving: after a gesture, a pause of ~1.2s (or the page being hidden)
   writes the ink as a PNG plus a small thumbnail to IndexedDB (js/store.js).
   An empty page is never kept. localStorage holds only draw.prefs and
   draw.current. */
(function () {
  'use strict';
  var D = Doodle, A = DrawArt;
  function $(id) { return document.getElementById(id); }

  var shell = document.querySelector('.k-shell'), stage = $('stage'), pageEl = $('page');
  var paperC = $('paper'), ink = $('ink'), guides = $('guides');
  var panel = $('panel'), barMid = $('bar-mid');
  var pctx = paperC.getContext('2d'), gctx = guides.getContext('2d');
  var backup = document.createElement('canvas'), bctx = backup.getContext('2d');
  var painter = new Brushes.Painter(ink), ictx = painter.ctx;

  var DPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  var MAX_AREA = 4.4e6;                 // ink canvas pixels (old iPads: keep memory sane)
  var T = D.TILE;

  var prefs = D.loadPrefs();
  var page = null;      // { id, t, paper, w, h, fresh, hasInk (true/false/null = unknown), dirty, stored }
  var pics = [];        // gallery records, newest first
  var storeOk = false;
  var undo = new D.Undo(48 * 1024 * 1024, 60);
  var strokes = {}, nActive = 0, gesture = null;
  var ready = false, rect = null, lastW = -1, lastH = -1;
  var rainbowHue = Math.random() * 360;

  /* ---------- ink canvas and undo tiles ---------- */
  var tilesX = 0, tilesY = 0, touched = null, touchedList = [];
  function setBacking(w, h) {
    ink.width = w; ink.height = h;
    backup.width = w; backup.height = h;
    tilesX = Math.ceil(w / T); tilesY = Math.ceil(h / T);
    touched = new Uint8Array(tilesX * tilesY);
    painter.setMirror(prefs.mirror);
  }
  function touch(x0, y0, x1, y1) {
    if (!gesture) return;
    var a = Math.max(0, Math.floor(x0 / T)), b = Math.min(tilesX - 1, Math.floor(x1 / T));
    var c = Math.max(0, Math.floor(y0 / T)), d = Math.min(tilesY - 1, Math.floor(y1 / T));
    for (var ty = c; ty <= d; ty++) {
      for (var tx = a; tx <= b; tx++) {
        var i = ty * tilesX + tx;
        if (!touched[i]) { touched[i] = 1; touchedList.push(i); }
      }
    }
  }
  painter.onTouch = touch;

  function beginGesture() {
    gesture = { ink: false, erase: false, cleared: false };
    bctx.clearRect(0, 0, backup.width, backup.height);
    bctx.drawImage(ink, 0, 0);
    touched.fill(0);
    touchedList = [];
    clearTimeout(saveTimer);
  }

  function endGesture() {
    var g = gesture;
    gesture = null;
    if (!g || !touchedList.length) return;
    var W = ink.width, H = ink.height, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    touchedList.forEach(function (i) {
      var tx = i % tilesX, ty = (i / tilesX) | 0;
      if (tx < x0) x0 = tx; if (tx > x1) x1 = tx; if (ty < y0) y0 = ty; if (ty > y1) y1 = ty;
    });
    var bx = x0 * T, by = y0 * T, bw = Math.min(W, (x1 + 1) * T) - bx, bh = Math.min(H, (y1 + 1) * T) - by;
    var src = bctx.getImageData(bx, by, bw, bh).data, tiles = [], bytes = 0;
    touchedList.forEach(function (i) {
      var x = (i % tilesX) * T, y = ((i / tilesX) | 0) * T, w = Math.min(T, W - x), h = Math.min(T, H - y);
      var data = new Uint8ClampedArray(w * h * 4);
      for (var r = 0; r < h; r++) {
        var s = ((y - by + r) * bw + (x - bx)) * 4;
        data.set(src.subarray(s, s + w * 4), r * w * 4);
      }
      if (D.isBlank(new Uint32Array(data.buffer))) data = null;   // blank paper costs nothing
      tiles.push({ x: x, y: y, w: w, h: h, data: data });
      bytes += data ? data.length : 32;
    });
    undo.push({ tiles: tiles, bytes: bytes });
    page.fresh = false;
    page.dirty = true;
    if (g.cleared) page.hasInk = false;
    else if (g.erase) page.hasInk = page.hasInk === false && !g.ink ? false : null;
    else if (g.ink) page.hasInk = true;
    refreshUndo();
    scheduleSave();
  }

  function doUndo() {
    if (!ready || nActive || Kit.overlayOpen()) return;
    var e = undo.pop();
    if (!e) return;
    e.tiles.forEach(function (t) {
      if (t.data) ictx.putImageData(new ImageData(t.data, t.w, t.h), t.x, t.y);
      else ictx.clearRect(t.x, t.y, t.w, t.h);
    });
    page.hasInk = null;
    page.dirty = true;
    refreshUndo();
    scheduleSave();
    Kit.sfx.tone(520, 0.1, 'sine', { vol: 0.07, to: 340 });
  }
  function refreshUndo() { $('undo-btn').disabled = !undo.size(); }

  /* ---------- fitting the page to the stage ---------- */
  function avail() {
    var cs = getComputedStyle(stage);
    return {
      w: stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      h: stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    };
  }
  /* Pixel size for a page shown at cw x ch CSS px: the device's pixel ratio
     (at least ~1100px on the long side, so a phone picture still looks fine
     opened on an iPad), capped in area for old iPads. */
  function backingFor(cw, ch) {
    var s = Math.min(3, Math.max(DPR, 1100 / Math.max(cw, ch)));
    if (cw * ch * s * s > MAX_AREA) s = Math.sqrt(MAX_AREA / (cw * ch));
    return { w: Math.max(1, Math.round(cw * s)), h: Math.max(1, Math.round(ch * s)) };
  }
  function layout() {
    if (!page) return;
    var a = avail();
    if (a.w < 40 || a.h < 40) return;
    if (page.fresh && !undo.size() && !nActive) {
      // an empty page takes the shape of the screen it is on
      var want = backingFor(a.w, a.h);
      if (Math.abs(want.w / want.h - page.w / page.h) > 0.02 || want.w > page.w * 1.05) {
        page.w = want.w; page.h = want.h;
        setBacking(want.w, want.h);
      }
    }
    var asp = page.w / page.h, w = Math.floor(Math.min(a.w, a.h * asp)), h = Math.floor(w / asp);
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    pageEl.style.width = w + 'px';
    pageEl.style.height = h + 'px';
    drawPaper();
    drawGuides();
  }

  /* ---------- paper and guides ---------- */
  function paintPaper(c, w, h, paper) {
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, paper.top);
    g.addColorStop(1, paper.bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (!paper.stars) return;
    var r = D.rng(2024), u = Math.max(w, h);
    c.fillStyle = '#fff';
    for (var i = 0; i < 120; i++) {
      var x = r() * w, y = r() * h, rad = (0.0011 + r() * 0.0022) * u;
      c.globalAlpha = 0.25 + r() * 0.6;
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 0.85;
    for (i = 0; i < 9; i++) {
      var sx = r() * w, sy = r() * h, s = (0.006 + r() * 0.006) * u;
      c.beginPath();
      c.moveTo(sx, sy - s); c.quadraticCurveTo(sx, sy, sx + s, sy); c.quadraticCurveTo(sx, sy, sx, sy + s);
      c.quadraticCurveTo(sx, sy, sx - s, sy); c.quadraticCurveTo(sx, sy, sx, sy - s);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  function drawPaper() {
    if (lastW < 1) return;
    paperC.width = lastW; paperC.height = lastH;
    paintPaper(pctx, lastW, lastH, D.PAPER[page.paper]);
    pageEl.classList.toggle('dp-dark', !!D.PAPER[page.paper].dark);
  }
  function drawGuides() {
    if (lastW < 1) return;
    var w = lastW, h = lastH;
    guides.width = Math.round(w * DPR); guides.height = Math.round(h * DPR);
    if (!prefs.mirror) return;
    var c = gctx, cx = w / 2, cy = h / 2, L = Math.max(w, h);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.lineWidth = 2;
    c.setLineDash([7, 8]);
    c.strokeStyle = D.PAPER[page.paper].dark ? 'rgba(255,255,255,0.38)' : 'rgba(60,70,170,0.28)';
    c.beginPath();
    c.moveTo(cx, 0); c.lineTo(cx, h);
    if (prefs.mirror === 2) {
      c.moveTo(0, cy); c.lineTo(w, cy);
      c.moveTo(cx - L, cy - L); c.lineTo(cx + L, cy + L);
      c.moveTo(cx - L, cy + L); c.lineTo(cx + L, cy - L);
    }
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = c.strokeStyle;
    c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fill();
  }

  /* ---------- drawing input ---------- */
  function toCanvas(e) {
    return { x: (e.clientX - rect.left) * ink.width / rect.width, y: (e.clientY - rect.top) * ink.height / rect.height };
  }

  pageEl.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!ready || Kit.overlayOpen()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (strokes[e.pointerId]) finishStroke(e.pointerId);
    if (!nActive) { rect = pageEl.getBoundingClientRect(); beginGesture(); }
    try { pageEl.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    var p = toCanvas(e), scale = ink.width / rect.width, tool = prefs.tool;
    nActive++;
    if (tool === 'fill') {
      strokes[e.pointerId] = { tool: 'fill' };
      if (painter.fill(p.x, p.y, prefs.color, scale)) { gesture.ink = true; sound.fill(); }
      else sound.nope();
      return;
    }
    var st = {
      tool: tool, color: prefs.color, scale: scale, w: D.TOOL[tool].sizes[prefs.size] * scale,
      hue: rainbowHue + (nActive - 1) * 70, stamp: D.STAMPS[prefs.stamp]
    };
    strokes[e.pointerId] = st;
    if (tool === 'eraser') gesture.erase = true; else gesture.ink = true;
    painter.begin(st, p.x, p.y);
    sound.start(st);
  });

  pageEl.addEventListener('pointermove', function (e) {
    var st = strokes[e.pointerId];
    if (!st || st.tool === 'fill') return;
    e.preventDefault();
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!list || !list.length) list = [e];
    for (var i = 0; i < list.length; i++) {
      var p = toCanvas(list[i]);
      painter.move(st, p.x, p.y);
    }
    sound.move(st);
  });

  function finishStroke(id) {
    var st = strokes[id];
    if (!st) return;
    delete strokes[id];
    nActive = Math.max(0, nActive - 1);
    if (st.tool !== 'fill') {
      painter.end(st);
      if (st.tool === 'rainbow') rainbowHue = st.hue;
    }
    if (!nActive) endGesture();
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) {
    pageEl.addEventListener(n, function (e) { finishStroke(e.pointerId); });
  });
  // no callout / magnifier / selection on a long press
  pageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  pageEl.addEventListener('touchstart', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });

  /* ---------- sounds (soft; Kit.sfx is silent when the arcade is muted) ---------- */
  var lastNote = 0;
  function note(i, dur, vol, type) { Kit.sfx.tone(D.PENTA[Math.max(0, Math.min(D.PENTA.length - 1, i))], dur, type || 'sine', { vol: vol }); }
  var sound = {
    start: function (st) {
      var tone = Kit.sfx.tone;
      switch (st.tool) {
        case 'marker': tone(620, 0.05, 'sine', { vol: 0.035 }); break;
        case 'crayon': tone(190, 0.06, 'triangle', { vol: 0.045 }); break;
        case 'paint': tone(300, 0.1, 'sine', { vol: 0.05, to: 220 }); break;
        case 'rainbow': note(Math.floor(((st.hue % 360) + 360) % 360 / 36), 0.14, 0.04); break;
        case 'glitter': tone(1568, 0.09, 'sine', { vol: 0.03 }); tone(2093, 0.12, 'sine', { vol: 0.02, when: 0.05 }); break;
        case 'eraser': tone(420, 0.08, 'triangle', { vol: 0.03, to: 300 }); break;
      }
    },
    move: function (st) {
      var now = Date.now();
      if (st.tool === 'glitter' && now - lastNote > 150) { lastNote = now; note(5 + Math.floor(Math.random() * 5), 0.1, 0.022); }
      else if (st.tool === 'rainbow' && now - lastNote > 230) { lastNote = now; note(Math.floor(((st.hue % 360) + 360) % 360 / 36), 0.16, 0.03); }
    },
    stamp: function () {
      var now = Date.now();
      if (now - lastNote < 80) return;
      lastNote = now;
      var f = D.PENTA[Math.floor(Math.random() * 6)];
      Kit.sfx.tone(f, 0.1, 'sine', { vol: 0.06, to: f * 1.5 });
    },
    fill: function () { Kit.sfx.tone(260, 0.28, 'sine', { vol: 0.08, to: 620 }); },
    nope: function () { Kit.sfx.tone(180, 0.08, 'triangle', { vol: 0.04 }); }
  };
  painter.onStamp = sound.stamp;

  /* ---------- saving ---------- */
  var saveTimer = 0, saving = null, saveAgain = false, warned = false;
  function scheduleSave(ms) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, ms || 1200); }
  function inkBlank() {
    return D.isBlank(new Uint32Array(ictx.getImageData(0, 0, ink.width, ink.height).data.buffer));
  }
  function makeThumb(pg) {
    var tw = 320, th = Math.round(tw * pg.h / pg.w);
    if (th > 320) { th = 320; tw = Math.round(320 * pg.w / pg.h); }
    var c = document.createElement('canvas');
    c.width = tw; c.height = th;
    var g = c.getContext('2d');
    paintPaper(g, tw, th, D.PAPER[pg.paper]);
    if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';
    g.drawImage(ink, 0, 0, tw, th);
    var url = c.toDataURL('image/jpeg', 0.84);
    c.width = c.height = 0;
    return url;
  }
  function pngOf(canvas) {
    return new Promise(function (resolve) {
      try {
        if (canvas.toBlob) { canvas.toBlob(function (b) { resolve(b); }, 'image/png'); return; }
        var s = canvas.toDataURL('image/png'), bin = atob(s.split(',')[1]), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        resolve(new Blob([u], { type: 'image/png' }));
      } catch (e) { resolve(null); }
    }).then(function (b) {
      if (!b) return null;
      if (b.arrayBuffer) return b.arrayBuffer();
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { resolve(null); };
        fr.readAsArrayBuffer(b);
      });
    });
  }
  function upsertPic(meta) {
    pics = pics.filter(function (p) { return p.id !== meta.id; });
    pics.push(meta);
    pics.sort(function (a, b) { return b.t - a.t; });
  }
  function updateStat() { if (storeOk) Kit.stat('draw', pics.length ? D.statText(pics.length) : ''); }

  /* Save the current page now if it changed. Resolves when written. */
  function saveNow() {
    clearTimeout(saveTimer);
    if (saving) { saveAgain = true; return saving; }
    if (!page || !page.dirty || !storeOk) return Promise.resolve();
    if (nActive) { scheduleSave(800); return Promise.resolve(); }
    var pg = page, job;
    pg.dirty = false;
    if (pg.hasInk === null) pg.hasInk = !inkBlank();
    if (!pg.hasInk) {
      // an empty page is never kept
      job = pg.stored ? DrawStore.remove(pg.id).then(function () {
        pg.stored = false;
        pics = pics.filter(function (p) { return p.id !== pg.id; });
      }) : Promise.resolve();
    } else {
      var meta = { id: pg.id, t: pg.t, u: Date.now(), paper: pg.paper, w: pg.w, h: pg.h, thumb: makeThumb(pg) };
      job = pngOf(ink).then(function (buf) {
        if (!buf) return false;
        return DrawStore.put(meta, { id: pg.id, type: 'image/png', data: buf });
      }).then(function (ok) {
        if (ok) { pg.stored = true; upsertPic(meta); return; }
        pg.dirty = true;
        if (!warned) { warned = true; Kit.toast('The gallery is full. Throw some pictures away.', { icon: 'heart', ms: 3200 }); }
      });
    }
    saving = job.catch(function () {}).then(function () {
      saving = null;
      updateStat();
      if (saveAgain) { saveAgain = false; return saveNow(); }
    });
    return saving;
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', function () { saveNow(); });

  /* ---------- pages ---------- */
  function freshPage() {
    var a = avail(), b = backingFor(Math.max(120, a.w), Math.max(120, a.h));
    page = { id: D.newId(), t: Date.now(), paper: prefs.paper, w: b.w, h: b.h, fresh: true, hasInk: false, dirty: false, stored: false };
    setBacking(b.w, b.h);
    undo.clear();
    refreshUndo();
    Kit.save(D.CURRENT_KEY, page.id);
    lastW = -1;
    layout();
    paintPanel();
  }
  function showPic(meta, img) {
    page = { id: meta.id, t: meta.t, paper: D.PAPER[meta.paper] ? meta.paper : 'white', w: meta.w, h: meta.h, fresh: false, hasInk: true, dirty: false, stored: true };
    setBacking(meta.w, meta.h);
    ictx.drawImage(img, 0, 0, meta.w, meta.h);
    undo.clear();
    refreshUndo();
    Kit.save(D.CURRENT_KEY, page.id);
    lastW = -1;
    layout();
    paintPanel();
  }
  function loadPic(meta) {
    return DrawStore.getInk(meta.id).then(function (rec) {
      if (!rec) return false;
      return new Promise(function (resolve) {
        var url;
        try { url = URL.createObjectURL(new Blob([rec.data], { type: rec.type || 'image/png' })); } catch (e) { resolve(false); return; }
        var img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); showPic(meta, img); resolve(true); };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(false); };
        img.src = url;
      });
    });
  }
  /* Swap pages with a little page-turn; input waits until it's done. */
  function turnPage(fn) {
    ready = false;
    function done() { ready = true; }
    if (Kit.reduced) { Promise.resolve(fn()).then(done, done); return; }
    pageEl.classList.add('dp-out');
    setTimeout(function () {
      Promise.resolve(fn()).then(null, function () {}).then(function () {
        pageEl.classList.remove('dp-out');
        Kit.anim(pageEl, 'dp-in');
        done();
      });
    }, 230);
  }
  function newPage() {
    if (!ready || nActive || Kit.overlayOpen()) return;
    Kit.sfx.open();
    if (page.hasInk === false || (page.hasInk === null && inkBlank())) {
      // already a clean page: just make it a fresh one
      page.hasInk = false;
      turnPage(function () { if (page.stored) { page.dirty = true; return saveNow().then(freshPage); } freshPage(); });
      return;
    }
    turnPage(function () { return saveNow().then(freshPage); });
  }
  function clearPage() {
    if (!ready || nActive || Kit.overlayOpen()) return;
    if (page.hasInk === false) { Kit.anim(pageEl, 'k-shake'); return; }
    Kit.confirm({ emoji: '🧽', title: 'Wipe the page clean?', text: 'Changed your mind? <b>Undo</b> brings it back.', yes: 'Wipe it', no: 'Keep it', danger: true })
      .then(function (yes) {
        if (!yes) return;
        rect = pageEl.getBoundingClientRect();
        beginGesture();
        touch(0, 0, ink.width, ink.height);
        ictx.clearRect(0, 0, ink.width, ink.height);
        gesture.cleared = true;
        endGesture();
        Kit.sfx.tone(900, 0.32, 'triangle', { vol: 0.05, to: 160 });
      });
  }

  /* ---------- the panel ---------- */
  function buildPanel() {
    var h = '';
    D.TOOLS.forEach(function (t) {
      h += '<button type="button" class="k-btn dp-btn dp-tool" data-tool="' + t.id + '" aria-label="' + t.label + '">' +
        (t.id === 'stamp' ? '<span class="dp-stampface" aria-hidden="true"></span>' : A[t.id]) + '</button>';
    });
    $('tools').innerHTML = h;
    h = '';
    ['Small', 'Medium', 'Big'].forEach(function (n, i) {
      h += '<button type="button" class="k-btn dp-btn dp-size" data-size="' + i + '" aria-label="' + n + '"><b></b></button>';
    });
    $('sizes').innerHTML = h;
    h = '';
    D.COLORS.forEach(function (c) {
      h += '<button type="button" class="dp-sw" data-color="' + c.hex + '" style="--c:' + c.hex + '" aria-label="' + c.name + '"><i></i></button>';
    });
    $('colors').innerHTML = h;
    $('paper-btn').innerHTML = A.paper;
    $('new-btn').innerHTML = A.newpage;
    $('clear-btn').innerHTML = A.clear;
    $('gallery-btn').innerHTML = A.gallery;
  }

  function paintPanel() {
    // on the shell, so buttons that move up into the bar keep their colours
    shell.style.setProperty('--dp-ink', prefs.color);
    if (page) shell.style.setProperty('--dp-paper', D.PAPER[page.paper].bottom);
    var i, els = panel.querySelectorAll('.dp-tool');
    for (i = 0; i < els.length; i++) {
      var on = els[i].getAttribute('data-tool') === prefs.tool;
      els[i].classList.toggle('k-on', on);
      els[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    panel.querySelector('.dp-stampface').textContent = D.STAMPS[prefs.stamp];
    els = panel.querySelectorAll('.dp-size');
    for (i = 0; i < els.length; i++) {
      els[i].classList.toggle('k-on', +els[i].getAttribute('data-size') === prefs.size);
      els[i].classList.toggle('dp-dim', prefs.tool === 'fill');
    }
    var colourOn = !!D.COLOUR_TOOLS[prefs.tool];
    els = panel.querySelectorAll('.dp-sw');
    for (i = 0; i < els.length; i++) {
      var sel = els[i].getAttribute('data-color') === prefs.color;
      els[i].classList.toggle('k-on', sel);
      els[i].classList.toggle('dp-soft', sel && !colourOn);
      els[i].setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
    var m = $('mirror-btn');
    m.innerHTML = A['mirror' + prefs.mirror];
    m.classList.toggle('k-on', prefs.mirror > 0);
    m.setAttribute('aria-label', D.MIRROR_NAMES[prefs.mirror]);
    m.setAttribute('aria-pressed', prefs.mirror ? 'true' : 'false');
  }

  function setPrefs(changes) {
    for (var k in changes) prefs[k] = changes[k];
    D.savePrefs(prefs);
    paintPanel();
  }

  panel.addEventListener('click', function (e) {
    if (Kit.overlayOpen()) return;
    var b = e.target.closest('button');
    if (!b) return;
    var tool = b.getAttribute('data-tool'), size = b.getAttribute('data-size'), color = b.getAttribute('data-color');
    if (tool) {
      var ch = { tool: tool };
      if (D.COLOUR_TOOLS[tool] && tool !== 'fill') ch.brush = tool;
      setPrefs(ch);
      Kit.sfx.tone(D.PENTA[D.TOOLS.indexOf(D.TOOL[tool])], 0.08, 'sine', { vol: 0.06 });
      if (tool === 'stamp') openStamps();
    } else if (size !== null) {
      setPrefs({ size: +size });
      Kit.sfx.tone([330, 262, 196][+size], 0.1, 'triangle', { vol: 0.07 });
    } else if (color) {
      var c2 = { color: color };
      if (!D.COLOUR_TOOLS[prefs.tool]) c2.tool = prefs.brush;   // colour means "draw with it"
      setPrefs(c2);
      var idx = 0;
      D.COLORS.forEach(function (c, i) { if (c.hex === color) idx = i; });
      Kit.sfx.tone(D.PENTA[idx % D.PENTA.length], 0.12, 'sine', { vol: 0.07 });
      Kit.anim(b, 'dp-boing');
    }
  });

  function toggleMirror() {
    if (Kit.overlayOpen()) return;
    setPrefs({ mirror: (prefs.mirror + 1) % 3 });
    painter.setMirror(prefs.mirror);
    drawGuides();
    if (prefs.mirror) {
      Kit.sfx.tone(784, 0.12, 'sine', { vol: 0.07 });
      Kit.sfx.tone(1175, 0.16, 'sine', { vol: 0.06, when: 0.08 });
      if (prefs.mirror === 2) Kit.sfx.tone(1568, 0.2, 'sine', { vol: 0.05, when: 0.16 });
    } else Kit.sfx.tone(500, 0.1, 'sine', { vol: 0.05, to: 330 });
    Kit.toast(D.MIRROR_NAMES[prefs.mirror], { top: true, ms: 1200 });
  }

  /* ---------- sheets: stamps, paper, gallery ---------- */
  function openStamps() {
    var h = '<div class="dp-stamps">';
    D.STAMPS.forEach(function (s, i) {
      h += '<button type="button" class="dp-stamp' + (i === prefs.stamp ? ' k-on' : '') + '" data-stamp="' + i + '" aria-label="Stamp">' + s + '</button>';
    });
    h += '</div>';
    Kit.sheet({
      title: 'Stamps', html: h,
      onOpen: function (card, close) {
        card.classList.add('dp-sheet');
        card.addEventListener('click', function (e) {
          var b = e.target.closest('[data-stamp]');
          if (!b) return;
          setPrefs({ stamp: +b.getAttribute('data-stamp'), tool: 'stamp' });
          sound.stamp();
          close(null);
        });
      }
    });
  }

  function openPaper() {
    if (!ready || Kit.overlayOpen()) return;
    var h = '<div class="dp-papers">';
    D.PAPERS.forEach(function (p) {
      h += '<button type="button" class="dp-paper' + (p.id === page.paper ? ' k-on' : '') + (p.stars ? ' dp-paper--stars' : '') + '" data-paper="' + p.id +
        '" aria-label="' + p.name + '" style="background-color:' + p.bottom + ';background-image:linear-gradient(' + p.top + ',' + p.bottom + ')"></button>';
    });
    h += '</div>';
    Kit.sfx.open();
    Kit.sheet({
      title: 'Paper', html: h,
      onOpen: function (card, close) {
        card.classList.add('dp-sheet');
        card.addEventListener('click', function (e) {
          var b = e.target.closest('[data-paper]');
          if (!b) return;
          var id = b.getAttribute('data-paper');
          page.paper = id;
          if (page.hasInk !== false) { page.dirty = true; scheduleSave(); }
          setPrefs({ paper: id });
          drawPaper();
          drawGuides();
          Kit.sfx.tone(660, 0.14, 'sine', { vol: 0.07, to: 990 });
          close(null);
        });
      }
    });
  }

  function trashIcon() { return '<svg class="k-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg>'; }

  function renderGallery(grid) {
    var h = '<button type="button" class="dp-gal__new" data-new="1" aria-label="New page">' + A.newpage + '</button>';
    pics.forEach(function (p) {
      var cur = page && p.id === page.id;
      h += '<div class="dp-gal__item' + (cur ? ' dp-cur' : '') + '">' +
        '<button type="button" class="dp-gal__pic" data-open="' + Kit.esc(p.id) + '" aria-label="Open picture"><img src="' + p.thumb + '" alt=""></button>' +
        '<button type="button" class="k-btn k-btn--icon k-btn--bad dp-gal__del" data-del="' + Kit.esc(p.id) + '" aria-label="Throw away">' + trashIcon() + '</button></div>';
    });
    grid.innerHTML = h;
    if (!storeOk) grid.insertAdjacentHTML('beforeend', '<p class="dp-gal__note">Pictures can\'t be kept on this device.</p>');
  }

  function openGallery() {
    if (!ready || nActive || Kit.overlayOpen()) return;
    Kit.sfx.open();
    saveNow().then(function () {
      if (Kit.overlayOpen()) return;
      Kit.sheet({
        title: 'My pictures', html: '<div class="dp-gal"></div>',
        buttons: [{ label: 'Done', value: null, icon: 'check' }],
        onOpen: function (card, close) {
          card.classList.add('dp-sheet', 'dp-sheet--gal');
          var grid = card.querySelector('.dp-gal');
          renderGallery(grid);
          grid.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-new')) { close(null); setTimeout(newPage, 60); return; }
            var id = b.getAttribute('data-open');
            if (id) {
              close(null);
              var meta = pics.filter(function (p) { return p.id === id; })[0];
              if (!meta || (page && meta.id === page.id)) return;
              Kit.sfx.tone(523, 0.12, 'sine', { vol: 0.07, to: 784 });
              turnPage(function () {
                return saveNow().then(function () { return loadPic(meta); }).then(function (ok) {
                  if (!ok) Kit.toast('That picture could not be opened.', { icon: 'heart' });
                });
              });
              return;
            }
            id = b.getAttribute('data-del');
            if (id) askDelete(id, grid);
          });
        }
      });
    });
  }

  function askDelete(id, grid) {
    var meta = pics.filter(function (p) { return p.id === id; })[0];
    if (!meta) return;
    Kit.confirm({
      title: 'Throw this one away?',
      text: '<img class="dp-confirm-pic" src="' + meta.thumb + '" alt="">',
      yes: 'Throw away', no: 'Keep it', danger: true
    }).then(function (yes) {
      if (!yes) return;
      DrawStore.remove(id).then(function () {
        pics = pics.filter(function (p) { return p.id !== id; });
        updateStat();
        if (page && page.id === id) { page.dirty = false; page.stored = false; freshPage(); }
        renderGallery(grid);
        Kit.sfx.tone(700, 0.2, 'triangle', { vol: 0.06, to: 200 });
      });
    });
  }

  /* ---------- phones on their side: the action buttons ride in the top bar ---------- */
  var mqSide = window.matchMedia('(orientation: landscape) and (min-width: 640px) and (max-height: 599px), (orientation: landscape) and (min-width: 640px) and (max-width: 699px)');
  function placeActs() {
    var acts = $('acts'), mirror = $('mirror-btn'), inBar = mqSide.matches;
    if (inBar) {
      if (acts.parentNode !== barMid) barMid.appendChild(acts);
      if (mirror.parentNode !== panel) panel.insertBefore(mirror, $('colors'));
    } else {
      if (mirror.parentNode !== acts) acts.insertBefore(mirror, acts.firstChild);
      if (acts.parentNode !== panel) panel.appendChild(acts);
    }
    shell.classList.toggle('dp-barmode', inBar);
  }
  if (mqSide.addEventListener) mqSide.addEventListener('change', placeActs); else if (mqSide.addListener) mqSide.addListener(placeActs);

  /* ---------- wiring ---------- */
  var HOW = [
    { emoji: '👆', text: 'Draw with a finger, or <b>lots</b> of fingers!' },
    { emoji: '🐄', text: '<b>Stamps</b>: tap, or slide for a trail.' },
    { emoji: '🦋', text: '<b>Magic mirror</b> copies your lines. Tap again: kaleidoscope!' },
    { emoji: '🖼️', text: 'Pictures keep themselves. The <b>frame</b> shows them all.' }
  ];
  var HOW_OPTS = { title: 'Doodle Pad', button: "Let's draw!" };

  buildPanel();
  placeActs();
  $('undo-btn').addEventListener('click', doUndo);
  $('gallery-btn').addEventListener('click', openGallery);
  $('mirror-btn').addEventListener('click', toggleMirror);
  $('paper-btn').addEventListener('click', openPaper);
  $('new-btn').addEventListener('click', newPage);
  $('clear-btn').addEventListener('click', clearPage);
  Kit.bindMute($('mute-btn'));
  Kit.bindHelp($('help-btn'), 'draw', HOW, HOW_OPTS);
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); doUndo(); }
  });

  // re-fit on the next frame (re-sizing inside the observer callback would loop)
  var layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () { layoutQueued = false; layout(); });
  }
  if (window.ResizeObserver) new ResizeObserver(queueLayout).observe(stage);
  window.addEventListener('resize', queueLayout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 250); });

  var savedId = Kit.load(D.CURRENT_KEY, null);
  freshPage();
  DrawStore.list().then(function (list) {
    storeOk = !!list;
    pics = list || [];
    var meta = pics.filter(function (p) { return p.id === savedId; })[0];
    return meta ? loadPic(meta) : false;
  }).then(null, function () {}).then(function () {
    ready = true;
    updateStat();
    if (!Kit.overlayOpen()) Kit.howTo('draw', HOW, HOW_OPTS);
  });

  /* Test hook: draw with synthetic pointer events, e.g.
     __draw.scribble([[x, y], ...] in 0..1 page units, pointerId). */
  window.__draw = {
    prefs: function () { return prefs; },
    page: function () { return page; },
    set: function (ch) { setPrefs(ch); painter.setMirror(prefs.mirror); drawGuides(); },
    scribble: function (pts, id) {
      var r = pageEl.getBoundingClientRect(), pid = id || 1;
      function ev(type, p) {
        pageEl.dispatchEvent(new PointerEvent(type, { pointerId: pid, bubbles: true, cancelable: true, isPrimary: pid === 1, pointerType: 'touch',
          clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }));
      }
      ev('pointerdown', pts[0]);
      for (var i = 1; i < pts.length; i++) ev('pointermove', pts[i]);
      ev('pointerup', pts[pts.length - 1]);
    },
    undo: doUndo, newPage: newPage, gallery: openGallery, paper: openPaper, stamps: openStamps, save: saveNow,
    undoCount: function () { return undo.size(); }, undoBytes: function () { return undo.bytes; }
  };
})();
