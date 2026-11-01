/* Color by Number screens, on the arcade kit (kit/kit.js): the picture
   library, the painting screen and its palette, photo import, and the
   finish. Puzzle data and saves live in puzzle.js, drawing in render.js and
   gestures in input.js. */
(function () {
  var stage = $('#stage');
  var canvas = $('#canvas');
  var renderer = new Renderer(canvas, stage);
  bindInput(stage, renderer, onPaintCell, onTapOther, endStroke);
  // a finger on the picture stops any zoom glide in progress
  stage.addEventListener('pointerdown', function () { renderer.animId = (renderer.animId || 0) + 1; });

  var current = null;     // active puzzle
  var flags = null;       // painted flags for it
  var remaining = [];     // cells left per colour
  var painted = 0;
  var saveTimer = null;
  var strokes = [];       // each finger-stroke's painted cells, for undo
  var stroke = null;      // the stroke in progress
  var lastTick = 0, lastQuarter = 0;

  /* little stroke icons in the kit's style for the buttons the kit has no icon for */
  var ICO = {
    camera: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.6" r="3.4"/>',
    zoomin: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>',
    zoomout: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5"/>',
    fit: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-ico]'), function (s) {
    s.innerHTML = '<svg class="k-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[s.dataset.ico] + '</svg>';
  });

  function show(screen) {
    $('#library').classList.toggle('k-hidden', screen !== 'library');
    $('#game').classList.toggle('k-hidden', screen !== 'game');
  }

  /* ---------------- library ---------------- */

  var sortedBuiltins = null;
  function allPuzzles() {
    if (!sortedBuiltins) {
      sortedBuiltins = builtinPuzzles().slice();
      // stable: file order within a size
      sortedBuiltins.sort(function (a, b) { return Math.max(a.w, a.h) - Math.max(b.w, b.h); });
    }
    return sortedBuiltins.concat(listCustomPuzzles());
  }

  /* 0 = not started, 1-99 = started (at least 1 once anything is painted), 100 = finished. */
  function pctOf(p) {
    var n = paintedCount(p, loadProgress(p));
    return n >= p.total ? 100 : n > 0 ? Math.max(1, Math.floor(n / p.total * 100)) : 0;
  }

  /* One line for the arcade menu tile, e.g. "3 finished". */
  function publishStat() {
    var finished = 0;
    allPuzzles().forEach(function (p) { if (pctOf(p) === 100) finished++; });
    if (finished) Kit.stat('color', finished === 1 ? '1 finished' : finished + ' finished');
    else Kit.drop('arcade.stat.color');
  }

  /* Themed collections: the sticker book groups finished pictures by these. */
  var COLLECTIONS = [
    { id: 'pets', name: 'Pets & farm', emoji: '🐶' },
    { id: 'wild', name: 'Wild animals', emoji: '🦁' },
    { id: 'sea', name: 'Under the sea', emoji: '🐠' },
    { id: 'dinos', name: 'Dinos & dragons', emoji: '🦕' },
    { id: 'magic', name: 'Magic', emoji: '🦄' },
    { id: 'go', name: 'Things that go', emoji: '🚒' },
    { id: 'food', name: 'Yummy', emoji: '🍩' },
    { id: 'space', name: 'Space & robots', emoji: '🚀' },
    { id: 'outdoors', name: 'Outdoors', emoji: '🌻' },
    { id: 'shapes', name: 'Shapes & patterns', emoji: '⭐' }
  ];
  function collectionOf(p) {
    for (var i = 0; i < COLLECTIONS.length; i++) if (COLLECTIONS[i].id === p.theme) return COLLECTIONS[i];
    return null;
  }

  /* "New" badges: pictures this device hasn't opened yet from a newer
     picture pack. The first run remembers what's already there, so a brand
     new player gets a clean library and someone who has played before sees
     the newest pack marked. Opening a picture clears its badge. */
  var KNOWN_KEY = 'cbn.known', known = null;
  function knownSet() {
    if (known) return known;
    var list = store.get(KNOWN_KEY, null);
    if (!Array.isArray(list)) {
      var played = customList().length > 0 || builtinPuzzles().some(function (p) { return store.get(progressKey(p.id), null) != null; });
      list = builtinPuzzles().filter(function (p) { return !played || p.batch <= 1; }).map(function (p) { return p.id; });
      store.set(KNOWN_KEY, list);
    }
    known = {};
    list.forEach(function (id) { if (typeof id === 'string') known[id] = 1; });
    return known;
  }
  function markKnown(p) {
    var k = knownSet();
    if (k[p.id] || p.id.indexOf('photo-') === 0) return;
    k[p.id] = 1;
    store.set(KNOWN_KEY, Object.keys(k));
  }
  function isNew(p, pct) { return pct === 0 && p.id.indexOf('photo-') !== 0 && !knownSet()[p.id]; }

  /* Thumbnails are drawn once per save state into a w x h canvas (one pixel
     per square) and copied from there, so the library stays quick with lots
     of pictures. */
  var thumbCache = {};
  function thumbSource(p) {
    var saved = store.get(progressKey(p.id), '');
    var key = typeof saved === 'string' ? saved : '';
    var hit = thumbCache[p.id];
    if (hit && hit.key === key && hit.p === p) return hit.c;
    var f = loadProgress(p);
    var c = document.createElement('canvas');
    c.width = p.w; c.height = p.h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(p.w, p.h), d = img.data;
    var rgb = p.palette.map(function (h) { return h ? hexToRgb(h) : null; });
    for (var i = 0, o = 0; i < p.cells.length; i++, o += 4) {
      var v = p.cells[i];
      d[o + 3] = 255;
      if (v === 0) { d[o] = d[o + 1] = d[o + 2] = 255; continue; }
      var c3 = rgb[v];
      // Finished parts in full colour; the rest as a faint wash so you can
      // still tell what the picture will be.
      for (var k = 0; k < 3; k++) d[o + k] = f[i] ? c3[k] : Math.round(c3[k] * 0.35 + 255 * 0.65);
    }
    ctx.putImageData(img, 0, 0);
    thumbCache[p.id] = { key: key, p: p, c: c };
    return c;
  }
  function thumb(p) {
    var src = thumbSource(p), c = document.createElement('canvas');
    c.width = p.w; c.height = p.h;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  var TIERS = ['Keep going', 'Quick', 'Medium', 'Detailed', 'Intricate', 'My pictures'];
  var TIER_SUB = { Quick: '16 × 16', Medium: '24 × 24', Detailed: '32 × 32', Intricate: 'big ones', 'My pictures': 'from your photos' };
  function tierOf(p) {
    if (p.id.indexOf('photo-') === 0) return 'My pictures';
    var n = Math.max(p.w, p.h);
    return n <= 16 ? 'Quick' : n <= 24 ? 'Medium' : n <= 32 ? 'Detailed' : 'Intricate';
  }

  function card(p, pct) {
    var wrap = el('div', 'card-wrap');
    var fresh = isNew(p, pct);
    var c = el('button', 'card' + (pct === 100 ? ' finished' : '') + (p.id.indexOf('photo-') === 0 ? ' mine' : ''));
    c.type = 'button';
    var pic = el('div', 'card-pic');
    pic.appendChild(thumb(p));
    if (pct === 100) { var ck = el('span', 'card-check'); ck.innerHTML = Kit.icon('check'); pic.appendChild(ck); }
    if (fresh) pic.appendChild(el('span', 'card-new', 'New'));
    c.appendChild(pic);
    var meta = el('div', 'card-meta');
    meta.appendChild(el('div', 'card-name', p.name));
    var bar = el('div', 'card-bar'), fill = el('i');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    meta.appendChild(bar);
    meta.appendChild(el('div', 'card-sub', pct === 100 ? 'Finished!' : pct > 0 ? pct + '% done' : 'Ready to colour'));
    c.appendChild(meta);
    c.addEventListener('click', function () { Kit.sfx.tap(); openPuzzle(p); });
    wrap.appendChild(c);

    if (p.id.indexOf('photo-') === 0) {
      var del = el('button', 'k-btn k-btn--icon k-btn--sm card-del');
      del.innerHTML = Kit.icon('close');
      del.setAttribute('aria-label', 'Delete ' + p.name);
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        Kit.confirm({ title: 'Delete this picture?', text: '"' + Kit.esc(p.name) + '" will be gone for good.', yes: 'Delete', no: 'Keep it', danger: true, emoji: '🗑️' })
          .then(function (yes) { if (yes) { deleteCustomPuzzle(p.id); renderLibrary(); } });
      });
      wrap.appendChild(del);
    }
    return wrap;
  }

  function renderLibrary() {
    var grid = $('#lib-grid'), tabs = $('#lib-tabs');
    var scroll = grid.scrollTop;
    grid.innerHTML = ''; tabs.innerHTML = '';
    publishStat();

    var groups = {};
    TIERS.forEach(function (t) { groups[t] = []; });
    var got = 0, all = 0;
    allPuzzles().forEach(function (p) {
      var pct = pctOf(p);
      if (p.id.indexOf('photo-') !== 0) { all++; if (pct === 100) got++; }
      groups[tierOf(p)].push({ p: p, pct: pct });
      if (pct > 0 && pct < 100) groups['Keep going'].push({ p: p, pct: pct });
    });

    var book = el('button', 'tab-book');
    book.type = 'button';
    book.setAttribute('aria-label', 'Sticker book, ' + got + ' of ' + all);
    book.innerHTML = Kit.icon('star') + '<span>Stickers</span><b>' + got + ' / ' + all + '</b>';
    book.addEventListener('click', function () { Kit.sfx.open(); openStickers(); });
    tabs.appendChild(book);

    TIERS.forEach(function (t) {
      var list = groups[t];
      if (!list.length) return;
      var done = list.filter(function (x) { return x.pct === 100; }).length;
      var head = el('div', 'lib-section');
      head.id = 'sec-' + t.replace(/\s/g, '');
      head.innerHTML = '<span class="k-label">' + Kit.esc(t) + '</span><span class="sub">' +
        Kit.esc(t === 'Keep going' ? 'pick up where you left off' : TIER_SUB[t]) + '</span>' +
        (t !== 'Keep going' && done ? '<span class="k-badge">' + done + ' / ' + list.length + ' done</span>' : '');
      grid.appendChild(head);
      list.forEach(function (x) { grid.appendChild(card(x.p, x.pct)); });

      var tab = el('button');
      tab.type = 'button';
      tab.innerHTML = Kit.esc(t) + (t === 'Keep going' ? '<b>' + list.length + '</b>' : '');
      tab.addEventListener('click', function () {
        Kit.sfx.tap();
        grid.scrollTo ? grid.scrollTo({ top: head.offsetTop - grid.offsetTop - 4, behavior: Kit.reduced ? 'auto' : 'smooth' }) : (grid.scrollTop = head.offsetTop - grid.offsetTop);
      });
      tabs.appendChild(tab);
    });
    grid.scrollTop = scroll;
  }

  /* The sticker book: every built-in picture by collection. Finished ones
     are stickers in full colour; the rest wait as faded outlines. Tapping
     one opens it. */
  function openStickers() {
    if (Kit.overlayOpen()) return;
    var list = allPuzzles().filter(function (p) { return p.id.indexOf('photo-') !== 0; });
    var pct = {}, got = 0;
    list.forEach(function (p) { pct[p.id] = pctOf(p); if (pct[p.id] === 100) got++; });
    var html = '<p>' + (got ? 'You have <b>' + got + '</b> of ' + list.length + ' stickers.' : 'Finish a picture to get its sticker!') + '</p>';
    var groups = COLLECTIONS.concat([{ id: '', name: 'More', emoji: '🎨' }]);
    groups.forEach(function (col) {
      var items = list.filter(function (p) { return col.id ? p.theme === col.id : !collectionOf(p); });
      if (!items.length) return;
      var n = items.filter(function (p) { return pct[p.id] === 100; }).length;
      html += '<div class="sb-head"><span class="sb-emoji" aria-hidden="true">' + col.emoji + '</span><b>' + Kit.esc(col.name) + '</b>' +
        '<span class="k-badge' + (n === items.length ? ' sb-full' : '') + '">' + n + ' / ' + items.length + '</span></div><div class="sb-grid">' +
        items.map(function (p) {
          return '<button type="button" class="sb-sticker' + (pct[p.id] === 100 ? ' got' : pct[p.id] ? ' started' : '') + '" data-id="' + Kit.esc(p.id) + '" aria-label="' + Kit.esc(p.name) + '"></button>';
        }).join('') + '</div>';
    });
    Kit.sheet({
      title: 'Sticker book', html: html,
      buttons: [{ label: 'Done', value: null, primary: true }],
      onOpen: function (cardEl, close) {
        cardEl.classList.add('sb-card');
        var byId = {};
        list.forEach(function (p) { byId[p.id] = p; });
        Array.prototype.forEach.call(cardEl.querySelectorAll('.sb-sticker'), function (b, i) {
          b.appendChild(thumb(byId[b.dataset.id]));
          b.style.setProperty('--tilt', ((i * 7) % 5 - 2) + 'deg');
        });
        cardEl.addEventListener('click', function (e) {
          var b = e.target.closest('.sb-sticker');
          if (!b || !byId[b.dataset.id]) return;
          Kit.sfx.tap();
          close(null);
          openPuzzle(byId[b.dataset.id]);
        });
      }
    });
  }

  function toLibrary() {
    flushSave();
    current = null;
    renderLibrary();
    show('library');
  }

  /* ---------------- playing ---------------- */

  function openPuzzle(p) {
    current = p;
    strokes = []; stroke = null;
    $('#undo-btn').disabled = true;
    flags = loadProgress(p);
    painted = paintedCount(p, flags);

    remaining = p.counts.slice();
    remaining[0] = 0;
    for (var i = 0; i < flags.length; i++) {
      if (flags[i] && p.cells[i] !== 0) remaining[p.cells[i]]--;
    }

    Kit.closeAll();
    show('game');
    buildPalette();
    renderer.setPuzzle(p, flags);
    selectColor(firstUnfinished() || 1);
    lastQuarter = Math.floor(painted / p.total * 4);
    updateProgress();
    Kit.sfx.open();
    markKnown(p);
    if (painted >= p.total) {
      // Already done: show it off, and offer a fresh start.
      Kit.confirm({ emoji: '🎨', title: 'All finished!', text: 'Do you want to colour <b>' + Kit.esc(p.name) + '</b> again?', yes: 'Colour again', no: 'Just look' })
        .then(function (yes) { if (yes && current === p) { clearProgress(p); openPuzzle(p); } });
    } else {
      Kit.howTo('color', HOW);
    }
  }

  function firstUnfinished() {
    for (var i = 1; i < remaining.length; i++) if (remaining[i] > 0) return i;
    return 0;
  }

  function buildPalette() {
    var pal = $('#palette');
    pal.innerHTML = '';
    for (var i = 1; i < current.palette.length; i++) {
      (function (n) {
        var b = el('button', 'swatch');
        b.type = 'button';
        b.dataset.n = n;
        b.setAttribute('aria-label', 'Colour ' + n);
        var pot = el('span', 'pot');
        pot.appendChild(el('span', '', String(n)));
        b.appendChild(pot);
        b.style.setProperty('--c', current.palette[n]);
        b.style.setProperty('--ink', contrastInk(current.palette[n]));
        b.addEventListener('click', function () { if (n !== renderer.active) Kit.sfx.tap(); selectColor(n); });
        pal.appendChild(b);
        updateSwatch(n);
      })(i);
    }
  }

  function selectColor(n) {
    if (!n) return;
    renderer.setActive(n);
    var swatches = document.querySelectorAll('.swatch');
    for (var i = 0; i < swatches.length; i++) swatches[i].classList.toggle('active', +swatches[i].dataset.n === n);
    var b = document.querySelector('.swatch[data-n="' + n + '"]');
    if (b && b.scrollIntoView) b.scrollIntoView({ behavior: Kit.reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }

  function updateSwatch(n) {
    var b = document.querySelector('.swatch[data-n="' + n + '"]');
    if (!b) return;
    var total = current.counts[n] || 1;
    b.style.setProperty('--p', Math.round((1 - remaining[n] / total) * 100));
    b.classList.toggle('done', remaining[n] <= 0);
  }

  function updateProgress() {
    var pct = Math.floor(painted / current.total * 100);
    $('#progress-bar').style.width = (painted / current.total * 100) + '%';
    $('#progress-pct').textContent = pct + '%';
  }

  /* Tapping a numbered cell of another colour just picks that colour. */
  function onTapOther(idx) {
    var v = current.cells[idx];
    if (!flags[idx] && v && v !== renderer.active) { Kit.sfx.tap(); selectColor(v); }
  }

  /* Returns true when the cell was actually painted. */
  function onPaintCell(idx) {
    if (!current || flags[idx] || current.cells[idx] !== renderer.active) return false;
    var n = renderer.active;

    if (!stroke) { stroke = []; strokes.push(stroke); }
    stroke.push(idx);
    $('#undo-btn').disabled = false;
    renderer.markPainted(idx);
    remaining[n]--;
    painted++;
    updateSwatch(n);
    updateProgress();
    queueSave();
    tick(n);

    var q = Math.floor(painted / current.total * 4);
    if (q > lastQuarter && q < 4) { lastQuarter = q; Kit.anim($('#progress'), 'k-bump'); Kit.sfx.star(q - 1); }

    if (remaining[n] === 0) {
      colourDone(n);
      if (painted >= current.total) finish();
      else setTimeout(function () { selectColor(firstUnfinished()); }, 450);
    }
    return true;
  }

  /* A soft plink per square, rising as that colour fills up. */
  function tick(n) {
    var now = performance.now();
    if (now - lastTick < 55) return;
    lastTick = now;
    var f = 1 - remaining[n] / (current.counts[n] || 1);
    Kit.sfx.tone(420 + f * 520, 0.05, 'sine', { vol: 0.045 });
  }

  function colourDone(n) {
    var b = document.querySelector('.swatch[data-n="' + n + '"]');
    Kit.sfx.good();
    Kit.buzz(20);
    if (!b) return;
    Kit.anim(b, 'pop');
    var r = b.getBoundingClientRect();
    Kit.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 18, colors: [current.palette[n], '#ffffff', '#ffd23f'] });
  }

  function endStroke() {
    stroke = null;
    if (strokes.length > 30) strokes.shift();   // plenty of history, bounded memory
  }

  /* Take back the last stroke: unpaint its cells and hand the colour back. */
  function undoStroke() {
    endStroke();
    var s = strokes.pop();
    if (!s || !current) return;
    var color = 0;
    s.forEach(function (idx) {
      var n = current.cells[idx];
      renderer.unmarkPainted(idx);
      remaining[n]++;
      painted--;
      updateSwatch(n);
      color = n;
    });
    renderer.rebuildOverlay();
    renderer.dirty = true;
    lastQuarter = Math.floor(painted / current.total * 4);
    updateProgress();
    queueSave();
    Kit.sfx.tone(520, 0.1, 'sine', { vol: 0.08, to: 340 });
    $('#undo-btn').disabled = strokes.length === 0;
    if (color) selectColor(color);
  }

  function queueSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      if (current) saveProgress(current, flags);
    }, 500);
  }

  function flushSave() {
    if (!current) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveProgress(current, flags);
  }

  /* The last square: glide back to the whole picture, let it shimmer, then cheer. */
  function finish() {
    flushSave();
    publishStat();
    var p = current, shineMs = Kit.reduced ? 0 : 1300;
    renderer.animateTo(renderer.fitView(), 600);
    setTimeout(function () {
      if (current !== p) return;
      if (shineMs) {
        renderer.shine(shineMs);
        [1319, 1568, 1760, 2093, 2637].forEach(function (f, i) { Kit.sfx.tone(f, 0.16, 'sine', { vol: 0.05, when: 0.1 + i * 0.14 }); });
      }
      setTimeout(function () { if (current === p) showResult(p); }, shineMs ? shineMs + 100 : 200);
    }, Kit.reduced ? 0 : 650);
  }

  /* A gentle "what next": the next picture along in the library that isn't
     finished, in the same section if there is one. */
  function suggestNext(p) {
    var list = allPuzzles().filter(function (q) { return q.id.indexOf('photo-') !== 0; });
    var at = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === p.id) at = i;
    var tier = tierOf(p), sameTier = null, other = null;
    for (var k = 1; k <= list.length; k++) {
      var q = list[(at + k + list.length) % list.length];
      if (q.id === p.id || pctOf(q) === 100) continue;
      if (tierOf(q) === tier) { sameTier = q; break; }
      if (!other) other = q;
    }
    return sameTier || other;
  }

  function bigPicture(p, size) {
    var t = thumb(p), big = document.createElement('canvas');
    var k = Math.max(1, Math.round(size / Math.max(p.w, p.h)));
    big.width = p.w * k; big.height = p.h * k;
    var bc = big.getContext('2d');
    bc.imageSmoothingEnabled = false;
    bc.drawImage(t, 0, 0, big.width, big.height);
    try { return big.toDataURL('image/png'); } catch (e) { return ''; }
  }

  function showResult(p) {
    var url = bigPicture(p, 240), next = suggestNext(p), col = collectionOf(p);
    var text = (url ? '<img class="done-pic" alt="" src="' + url + '">' : '') + 'You coloured <b>' + Kit.esc(p.name) + '</b>.';
    var badge;
    if (col && p.id.indexOf('photo-') !== 0) {
      var mates = allPuzzles().filter(function (q) { return q.theme === p.theme && q.id.indexOf('photo-') !== 0; });
      var n = mates.filter(function (q) { return pctOf(q) === 100; }).length;
      text += '<span class="res-col">' + col.emoji + ' Sticker ' + n + ' of ' + mates.length + ' in ' + Kit.esc(col.name) + '</span>';
      if (n === mates.length) badge = 'You got every ' + col.name + ' sticker!';
    }
    var nextUrl = next ? bigPicture(next, 60) : '';
    if (next) text += '<span class="res-next">' + (nextUrl ? '<img alt="" src="' + nextUrl + '">' : '') + 'Up next: <b>' + Kit.esc(next.name) + '</b></span>';
    var buttons = [{ label: 'Again', value: 'again', icon: 'restart' }, { label: 'Pictures', value: 'more', icon: 'menu', primary: !next }];
    if (next) buttons.push({ label: 'Next', value: 'next', primary: true, icon: 'next' });
    Kit.result({
      title: 'Beautiful! You finished it!',
      text: text, badge: badge,
      stats: [{ label: 'Squares', value: p.total, hi: true }, { label: 'Colours', value: p.palette.length - 1 }],
      buttons: buttons,
      confetti: true
    }).then(function (v) {
      if (v === 'again') { clearProgress(p); openPuzzle(p); }
      else if (v === 'next' && next) openPuzzle(next);
      else if (v !== undefined) toLibrary();
    });
    Kit.buzz([30, 40, 30]);
  }

  /* ---------------- photo import ---------------- */

  var PHOTO_SIZES = [
    { id: 's', label: 'Small', grid: 3, size: 24, colors: 8, sub: 'quick to do' },
    { id: 'm', label: 'Medium', grid: 4, size: 36, colors: 12, sub: 'just right' },
    { id: 'l', label: 'Big', grid: 6, size: 48, colors: 14, sub: 'lots of detail' }
  ];
  var photoOpts = PHOTO_SIZES[1];
  // a tiny mosaic: more squares for a bigger picture
  function dots(n) {
    var h = '<span class="dots" style="--n:' + n + '" aria-hidden="true">';
    for (var i = 0; i < n * n; i++) h += '<i style="--c:' + Kit.PALETTE[(i * 3 + Math.floor(i / n)) % Kit.PALETTE.length] + '"></i>';
    return h + '</span>';
  }

  // The size is picked first, and the file picker opens straight from that
  // tap (iOS only opens it from a real touch).
  $('#photo-btn').addEventListener('click', function () {
    if (Kit.overlayOpen()) return;
    var html = '<p>Pick a photo and it becomes a picture to colour. It stays on this device.</p><div class="sizes-pick">' +
      PHOTO_SIZES.map(function (s, i) {
        return '<button class="k-btn' + (i === 1 ? ' k-btn--primary' : '') + '" data-s="' + s.id + '">' + dots(s.grid) + s.label + '<small>' + s.sub + '</small></button>';
      }).join('') + '</div>';
    Kit.sfx.open();
    Kit.sheet({
      title: 'Colour a photo', html: html,
      onOpen: function (cardEl, close) {
        cardEl.querySelector('.sizes-pick').addEventListener('click', function (e) {
          var b = e.target.closest('[data-s]');
          if (!b) return;
          photoOpts = PHOTO_SIZES.filter(function (s) { return s.id === b.dataset.s; })[0];
          $('#photo-input').click();
          close(null);
        });
      }
    });
  });

  $('#photo-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var n = listCustomPuzzles().length + 1;
        var p = puzzleFromImage(img, { size: photoOpts.size, colors: photoOpts.colors, name: n > 1 ? 'My Picture ' + n : 'My Picture' });
        if (!saveCustomPuzzle(p)) {
          Kit.toast('No room to save it. Delete an old photo first.', { icon: 'close', ms: 3200 });
          return;
        }
        renderLibrary();
        openPuzzle(p);
      };
      img.onerror = function () { Kit.toast('Sorry, that picture couldn’t be opened.', { icon: 'close', ms: 3000 }); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  /* ---------------- buttons ---------------- */

  $('#back-btn').addEventListener('click', function () { Kit.sfx.close(); toLibrary(); });
  $('#undo-btn').addEventListener('click', undoStroke);

  /* Hint: the nearest square of the chosen colour to the middle of the view,
     zoomed in close enough to see, with a pulsing ring. */
  $('#hint-btn').addEventListener('click', function () {
    if (!current) return;
    if (!remaining[renderer.active]) selectColor(firstUnfinished());
    var v = renderer.view, cx = (renderer.cw / 2 - v.tx) / v.s, cy = (renderer.ch / 2 - v.ty) / v.s;
    var best = -1, bd = Infinity;
    for (var i = 0; i < current.cells.length; i++) {
      if (flags[i] || current.cells[i] !== renderer.active) continue;
      var d = Math.pow((i % current.w) + 0.5 - cx, 2) + Math.pow(Math.floor(i / current.w) + 0.5 - cy, 2);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    var s = Math.max(v.s, Math.min(44, renderer.fitScale * 3));
    renderer.animateTo({
      s: s,
      tx: renderer.cw / 2 - ((best % current.w) + 0.5) * s,
      ty: renderer.ch / 2 - (Math.floor(best / current.w) + 0.5) * s
    }, 380);
    renderer.showHint(best);
    renderer.hintUntil = performance.now() + 2800;
    Kit.sfx.tone(880, 0.12, 'sine', { vol: 0.07, to: 1320 });
  });

  $('#zoom-in').addEventListener('click', function () { if (current) { Kit.sfx.tap(); renderer.animateTo(renderer.zoomView(1.6)); } });
  $('#zoom-out').addEventListener('click', function () { if (current) { Kit.sfx.tap(); renderer.animateTo(renderer.zoomView(1 / 1.6)); } });
  $('#zoom-fit').addEventListener('click', function () { if (current) { Kit.sfx.tap(); renderer.animateTo(renderer.fitView()); } });

  var HOW = [
    { emoji: '🎨', text: 'Pick a colour at the bottom. Its squares light up.' },
    { emoji: '👆', text: 'Tap or rub the squares with that <b>number</b> to colour them.' },
    { emoji: '🤏', text: 'Pinch with two fingers to zoom in, or use the zoom buttons.' },
    { icon: 'hint', text: 'Can’t find one? The <b>light bulb</b> shows you.' }
  ];
  Kit.bindMute($('#mute-btn'));
  Kit.bindHelp($('#help-btn'), 'color', HOW);

  function relayout() {
    if (!current) return;
    renderer.resize();
    renderer.fit();
  }
  // Re-layout on the next frame: doing it inside the observer callback makes
  // WebKit report a "ResizeObserver loop" error when the iPad rotates.
  var relayoutRaf = 0;
  if (window.ResizeObserver) new ResizeObserver(function () {
    cancelAnimationFrame(relayoutRaf);
    relayoutRaf = requestAnimationFrame(relayout);
  }).observe(stage);
  else window.addEventListener('resize', relayout);

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushSave();
  });

  renderLibrary();

  /* Small testing seam: lets a script drive and inspect a game in progress. */
  window.__cbn = {
    renderer: renderer,
    open: openPuzzle,
    all: allPuzzles,
    paint: onPaintCell,
    select: selectColor,
    library: renderLibrary,
    stickers: openStickers,
    state: function () {
      return current ? {
        id: current.id, w: current.w, h: current.h,
        painted: painted, total: current.total,
        active: renderer.active, remaining: remaining.slice()
      } : null;
    }
  };
})();
