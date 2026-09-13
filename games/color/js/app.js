(function () {
  var stage = $('#stage');
  var canvas = $('#canvas');
  var renderer = new Renderer(canvas, stage);
  bindInput(stage, renderer, onPaintCell);

  var current = null;     // active puzzle
  var flags = null;       // painted flags for it
  var remaining = [];     // cells left per colour
  var painted = 0;
  var saveTimer = null;

  /* ---------------- library ---------------- */

  function allPuzzles() {
    return BUILTIN_PUZZLES.map(puzzleFromArt).concat(listCustomPuzzles());
  }

  /* One line for the arcade menu tile, e.g. "3 finished". */
  function publishStat() {
    var list = allPuzzles(), finished = 0;
    list.forEach(function (p) { if (paintedCount(p, loadProgress(p)) === p.total) finished++; });
    store.set('arcade.stat.color', finished === 1 ? '1 finished' : finished + ' finished');
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
      // Show finished parts in colour and the rest as grey, like a preview.
      ctx.fillStyle = f[i] ? puzzle.palette[v] : '#e4e4e4';
      ctx.fillRect(i % puzzle.w, Math.floor(i / puzzle.w), 1, 1);
    }
    return c;
  }

  function renderLibrary() {
    var grid = $('#lib-grid');
    grid.innerHTML = '';
    publishStat();

    allPuzzles().forEach(function (p) {
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
      left.textContent = String(remaining[n]);
    }
  }

  function updateProgress() {
    $('#progress-bar').style.width = (painted / current.total * 100) + '%';
  }

  function onPaintCell(idx) {
    if (flags[idx] || current.cells[idx] !== renderer.active) return;
    var n = renderer.active;

    renderer.markPainted(idx);
    remaining[n]--;
    painted++;
    updateSwatch(n);
    updateProgress();
    queueSave();

    if (remaining[n] === 0) {
      if (painted >= current.total) finish();
      else setTimeout(function () { selectColor(firstUnfinished()); }, 260);
    }
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
    }, 420);
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
