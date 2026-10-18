(function () {
  var stage = $('#stage');
  var canvas = $('#canvas');
  var renderer = new Renderer(canvas, stage);
  bindInput(stage, renderer, onPaintCell, onTapOther, endStroke);

  var current = null;     // active puzzle
  var flags = null;       // painted flags for it
  var remaining = [];     // cells left per colour
  var painted = 0;
  var saveTimer = null;
  var strokes = [];       // each finger-stroke's painted cells, for undo
  var stroke = null;      // the stroke in progress

  /* ---------------- library ---------------- */

  function allPuzzles() {
    var built = BUILTIN_PUZZLES.map(puzzleFromArt);
    built.sort(function (a, b) { return Math.max(a.w, a.h) - Math.max(b.w, b.h); });   // stable: file order within a size
    return built.concat(listCustomPuzzles());
  }

  /* One line for the arcade menu tile, e.g. "3 finished". */
  function publishStat() {
    var list = allPuzzles(), finished = 0;
    list.forEach(function (p) { if (paintedCount(p, loadProgress(p)) === p.total) finished++; });
    // Raw string, not store.set: that JSON-encodes, and the menu would show the quotes.
    try {
      if (finished) localStorage.setItem('arcade.stat.color', finished === 1 ? '1 finished' : finished + ' finished');
      else localStorage.removeItem('arcade.stat.color');
    } catch (e) {}
  }

  function fade(hex) {
    var rgb = hexToRgb(hex);
    return 'rgb(' + [0, 1, 2].map(function (c) { return Math.round(rgb[c] * 0.35 + 255 * 0.65); }).join(',') + ')';
  }

  function thumb(puzzle, size) {
    var c = document.createElement('canvas');
    c.width = puzzle.w; c.height = puzzle.h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, puzzle.w, puzzle.h);

    var f = loadProgress(puzzle);
    for (var i = 0; i < puzzle.cells.length; i++) {
      var v = puzzle.cells[i];
      if (v === 0) continue;
      // Finished parts in full colour; the rest as a faint wash so you can
      // still tell what the picture will be.
      ctx.fillStyle = f[i] ? puzzle.palette[v] : fade(puzzle.palette[v]);
      ctx.fillRect(i % puzzle.w, Math.floor(i / puzzle.w), 1, 1);
    }
    return c;
  }

  function tierOf(p) {
    if (p.id.indexOf('photo-') === 0) return 'My pictures';
    var n = Math.max(p.w, p.h);
    return n <= 16 ? 'Quick' : n <= 24 ? 'Medium' : n <= 32 ? 'Detailed' : 'Intricate';
  }

  function renderLibrary() {
    var grid = $('#lib-grid');
    grid.innerHTML = '';
    publishStat();

    // Group by how big the grid is, so there's an easy end and a long one.
    var lastTier = null;
    allPuzzles().forEach(function (p) {
      var tier = tierOf(p);
      if (tier !== lastTier) { grid.appendChild(el('div', 'lib-section', tier)); lastTier = tier; }
      var wrap = el('div', 'card-wrap');
      var card = el('button', 'card');
      card.appendChild(thumb(p));

      var done = paintedCount(p, loadProgress(p));
      var pct = Math.round(done / p.total * 100);

      var meta = el('div', 'card-meta');
      meta.appendChild(el('div', 'card-name', p.name));
      meta.appendChild(el('div', 'card-sub',
        pct === 100 ? 'Finished ✓' : pct > 0 ? pct + '% done' : p.w + '×' + p.h));
      card.appendChild(meta);
      card.addEventListener('click', function () { openPuzzle(p); });
      wrap.appendChild(card);

      if (p.id.indexOf('photo-') === 0) {
        var del = el('button', 'card-del', '×');
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          if (confirm('Delete "' + p.name + '"?')) { deleteCustomPuzzle(p.id); renderLibrary(); }
        });
        wrap.appendChild(del);
      }
      grid.appendChild(wrap);
    });
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

    $('#library').classList.add('hidden');
    $('#game').classList.remove('hidden');
    $('#done').classList.add('hidden');

    renderer.setPuzzle(p, flags);
    buildPalette();
    selectColor(firstUnfinished() || 1);
    updateProgress();
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
        var b = el('button', 'swatch', String(n));
        b.style.background = current.palette[n];
        b.style.color = contrastInk(current.palette[n]);
        b.dataset.n = n;
        var left = el('span', 'left', String(remaining[n]));
        b.appendChild(left);
        b.addEventListener('click', function () { selectColor(n); });
        pal.appendChild(b);
      })(i);
    }
  }

  function selectColor(n) {
    if (!n) return;
    renderer.setActive(n);
    var swatches = document.querySelectorAll('.swatch');
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].classList.toggle('active', +swatches[i].dataset.n === n);
    }
    scrollSwatchIntoView(n);
  }

  function scrollSwatchIntoView(n) {
    var b = document.querySelector('.swatch[data-n="' + n + '"]');
    if (b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function updateSwatch(n) {
    var b = document.querySelector('.swatch[data-n="' + n + '"]');
    if (!b) return;
    var left = b.querySelector('.left');
    if (remaining[n] <= 0) {
      b.classList.add('done');
      if (left) left.textContent = '✓';
    } else if (left) {
      b.classList.remove('done');
      left.textContent = String(remaining[n]);
    }
  }

  function updateProgress() {
    $('#progress-bar').style.width = (painted / current.total * 100) + '%';
  }

  /* Tapping a numbered cell of another colour just picks that colour. */
  function onTapOther(idx) {
    var v = current.cells[idx];
    if (!flags[idx] && v && v !== renderer.active) selectColor(v);
  }

  /* Returns true when the cell was actually painted. */
  function onPaintCell(idx) {
    if (flags[idx] || current.cells[idx] !== renderer.active) return false;
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

    if (remaining[n] === 0) {
      popSwatch(n);
      if (painted >= current.total) finish();
      else setTimeout(function () { selectColor(firstUnfinished()); }, 260);
    }
    return true;
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
    updateProgress();
    queueSave();
    $('#undo-btn').disabled = strokes.length === 0;
    if (color) selectColor(color);
  }

  function popSwatch(n) {
    var b = document.querySelector('.swatch[data-n="' + n + '"]');
    if (!b) return;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }

  function queueSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveProgress(current, flags);
    }, 500);
  }

  function flushSave() {
    if (!current) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveProgress(current, flags);
  }

  function finish() {
    flushSave();
    setTimeout(function () {
      var t = thumb(current);
      var dc = $('#done-thumb').getContext('2d');
      dc.imageSmoothingEnabled = false;
      dc.clearRect(0, 0, 240, 240);
      dc.drawImage(t, 0, 0, 240, 240);
      $('#done').classList.remove('hidden');
      confetti();
    }, 420);
  }

  /* A short burst of paper bits on a throwaway canvas; stops by itself. */
  function confetti() {
    var c = $('#confetti');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = current.palette.slice(1);
    var bits = [];
    for (var i = 0; i < 70; i++) {
      bits.push({
        x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.4,
        vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 3,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        s: 6 + Math.random() * 6, c: cols[i % cols.length]
      });
    }
    var t0 = performance.now();
    (function tick(now) {
      var age = now - t0;
      ctx.clearRect(0, 0, W, H);
      if (age > 2600 || $('#done').classList.contains('hidden')) return;
      bits.forEach(function (b) {
        b.vy += 0.32; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= 0.99;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (2600 - age) / 500);
        ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });
      requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------------- photo import ---------------- */

  $('#photo-btn').addEventListener('click', function () { $('#photo-input').click(); });

  $('#photo-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var p = puzzleFromImage(img, { size: 36, colors: 12, name: 'My Picture' });
        if (!saveCustomPuzzle(p)) {
          alert("Couldn't save that picture \u2014 storage is full.");
          return;
        }
        renderLibrary();
        openPuzzle(p);
      };
      img.onerror = function () { alert("Sorry, that image couldn't be opened."); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  /* ---------------- chrome ---------------- */

  $('#back-btn').addEventListener('click', function () {
    flushSave();
    renderLibrary();
    $('#game').classList.add('hidden');
    $('#library').classList.remove('hidden');
  });

  $('#undo-btn').addEventListener('click', undoStroke);

  $('#hint-btn').addEventListener('click', function () {
    for (var i = 0; i < current.cells.length; i++) {
      if (!flags[i] && current.cells[i] === renderer.active) {
        // Bring it on screen before pointing at it.
        var v = renderer.view;
        v.tx = renderer.cw / 2 - ((i % current.w) + 0.5) * v.s;
        v.ty = renderer.ch / 2 - (Math.floor(i / current.w) + 0.5) * v.s;
        renderer.clamp();
        renderer.showHint(i);
        return;
      }
    }
  });

  $('#done-again').addEventListener('click', function () {
    clearProgress(current);
    openPuzzle(current);
  });

  $('#done-back').addEventListener('click', function () {
    renderLibrary();
    $('#done').classList.add('hidden');
    $('#game').classList.add('hidden');
    $('#library').classList.remove('hidden');
  });

  window.addEventListener('resize', function () {
    if (!current) return;
    renderer.resize();
    renderer.fit();
  });

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
    state: function () {
      return current ? {
        id: current.id, w: current.w, h: current.h,
        painted: painted, total: current.total,
        active: renderer.active, remaining: remaining.slice()
      } : null;
    }
  };
})();
