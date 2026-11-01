/* Jigsaw screens: the picture library, the size picker and the puzzle.

   Performance on an old iPad: every piece is drawn once into its own canvas
   (picture, bevel and shadow baked in) whenever the layout changes, and is
   then only ever moved with a transform. A piece that locks into the board
   is painted onto the board's "placed" canvas and its element removed, so
   the number of moving layers only goes down. Input is one pointer listener
   on the play area doing its own hit test, so two kids can drag two pieces
   at once (one piece or joined group per finger). */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* a few icons the kit doesn't have, drawn the same way */
  var ICO = {
    camera: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.6" r="3.4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    ghost: '<path d="M5.5 20V10.5a6.5 6.5 0 0 1 13 0V20l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6z"/><circle cx="9.6" cy="10.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="10.8" r="1.1" fill="currentColor" stroke="none"/>',
    piece: '<path d="M5 6h4a2.2 2.2 0 1 1 4 0h4v4a2.2 2.2 0 1 1 0 4v4h-4a2.2 2.2 0 1 0-4 0H5v-4a2.2 2.2 0 1 0 0-4z"/>'
  };
  function ico(name) {
    return '<svg class="k-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICO[name] + '</svg>';
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-ico]'), function (s) { s.innerHTML = ico(s.getAttribute('data-ico')); });

  var M = Shapes.MARGIN;
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  function small() { return Math.min(window.innerWidth, window.innerHeight) < 500; }
  function levels() { return Jig.LEVELS.filter(function (k) { return !small() || k <= 6; }); }

  /* =====================================================================
     Library
     ===================================================================== */
  var libEl = $('#library'), gameEl = $('#game');

  function allPics() { return Photos.list().concat(Pics.builtin); }

  function publishStat() {
    var d = Jig.doneMap(), n = 0;
    Object.keys(d).forEach(function (id) { if (Pics.get(id) || id.indexOf('photo-') === 0) n++; });
    if (n) Kit.stat('jigsaw', n === 1 ? '1 picture done' : n + ' pictures done');
    else Kit.drop('arcade.stat.jigsaw');
  }

  function highestBit(mask) { for (var k = 7; k >= 2; k--) if (mask & (1 << k)) return k; return 0; }

  function card(p, inGoing) {
    var saved = Jig.peek(p.id), mask = Jig.doneMap()[p.id] || 0;
    var wrap = el('div', 'card-wrap');
    var c = el('button', 'card' + (mask ? ' finished' : '') + (p.kind === 'photo' ? ' mine' : ''));
    c.type = 'button';
    var pic = el('div', 'card-pic');
    pic.appendChild(Pics.thumb(p, p.kind === 'photo' ? 240 : 0));
    // the jigsaw lines over the thumbnail, for the size in progress / done
    var kShow = saved ? saved.k : highestBit(mask);
    if (kShow) pic.appendChild(gridIcon(p, kShow, 'card-cut', saved ? saved.raw : null));
    if (mask) { var ck = el('span', 'card-check'); ck.innerHTML = Kit.icon('check'); pic.appendChild(ck); }
    c.appendChild(pic);
    var meta = el('div', 'card-meta');
    meta.appendChild(el('div', 'card-name', Kit.esc(p.name)));
    var pct = saved ? Math.round(saved.placed / saved.n * 100) : mask ? 100 : 0;
    var bar = el('div', 'card-bar'), fill = el('i');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    meta.appendChild(bar);
    var sub = saved ? saved.placed + ' of ' + saved.n + ' pieces' : mask ? 'Done! ' + Math.pow(highestBit(mask), 2) + ' pieces' : 'Ready';
    meta.appendChild(el('div', 'card-sub', sub));
    c.appendChild(meta);
    if (saved) c.classList.add('going');
    c.setAttribute('data-id', p.id);
    c.addEventListener('click', function () { Kit.sfx.tap(); openPicker(p); });
    wrap.appendChild(c);
    if (p.kind === 'photo' && !inGoing) {
      var del = el('button', 'k-btn k-btn--icon k-btn--sm card-del');
      del.innerHTML = Kit.icon('close');
      del.setAttribute('aria-label', 'Delete ' + p.name);
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        Kit.confirm({ title: 'Delete this photo?', text: 'The puzzle from "' + Kit.esc(p.name) + '" will be gone.', yes: 'Delete', no: 'Keep it', danger: true, emoji: '🗑️' })
          .then(function (yes) {
            if (!yes) return;
            Jig.forgetPicture(p.id);
            Photos.remove(p.id).then(renderLibrary);
            renderLibrary();
          });
      });
      wrap.appendChild(del);
    }
    return wrap;
  }

  function addPhotoCard() {
    var c = el('button', 'card add-card');
    c.type = 'button';
    c.innerHTML = '<div class="card-pic add-pic"><span>' + ico('camera') + '</span></div><div class="card-meta"><div class="card-name">Use a photo</div><div class="card-sub">from your pictures</div></div>';
    c.addEventListener('click', pickPhoto);
    var wrap = el('div', 'card-wrap');
    wrap.appendChild(c);
    return wrap;
  }

  function renderLibrary() {
    var grid = $('#lib-grid'), tabs = $('#lib-tabs');
    var scroll = grid.scrollTop;
    grid.innerHTML = ''; tabs.innerHTML = '';
    publishStat();
    var d = Jig.doneMap();

    var sections = [];
    var going = allPics().filter(function (p) { return Jig.peek(p.id); });
    if (going.length) sections.push({ id: 'going', name: 'Keep going', sub: 'pick up where you left off', list: going });
    sections.push({ id: 'photos', name: 'My photos', sub: 'your own pictures', list: Photos.list(), add: true });
    Pics.THEMES.forEach(function (t) {
      var list = Pics.builtin.filter(function (p) { return p.theme === t.id; });
      if (list.length) sections.push({ id: t.id, name: t.name, emoji: t.emoji, list: list });
    });

    sections.forEach(function (s) {
      var done = s.list.filter(function (p) { return d[p.id]; }).length;
      var head = el('div', 'lib-section');
      head.innerHTML = (s.emoji ? '<span class="emo" aria-hidden="true">' + s.emoji + '</span>' : '') +
        '<span class="k-label">' + Kit.esc(s.name) + '</span>' + (s.sub ? '<span class="sub">' + Kit.esc(s.sub) + '</span>' : '') +
        (s.id !== 'going' && s.id !== 'photos' && done ? '<span class="k-badge">' + done + ' / ' + s.list.length + ' done</span>' : '');
      grid.appendChild(head);
      if (s.add) grid.appendChild(addPhotoCard());
      s.list.forEach(function (p) { grid.appendChild(card(p, s.id === 'going')); });

      var tab = el('button');
      tab.type = 'button';
      tab.innerHTML = (s.emoji ? '<span aria-hidden="true">' + s.emoji + '</span> ' : '') + Kit.esc(s.name) +
        (s.id === 'going' ? '<b>' + s.list.length + '</b>' : '');
      if (s.id === 'going') tab.className = 'tab-going';
      tab.addEventListener('click', function () {
        Kit.sfx.tap();
        var top = head.offsetTop - grid.offsetTop - 4;
        if (grid.scrollTo) grid.scrollTo({ top: top, behavior: Kit.reduced ? 'auto' : 'smooth' }); else grid.scrollTop = top;
      });
      tabs.appendChild(tab);
    });
    grid.scrollTop = scroll;
  }

  /* A picture with its jigsaw cut drawn over it: the "how many pieces"
     icon in the size picker and on library cards. */
  function gridIcon(p, k, cls, progress) {
    var g = Shapes.grid(k, p.w / p.h), c = el('canvas', cls);
    var W = 120, H = Math.round(120 * p.h / p.w);
    if (H > 120) { H = 120; W = Math.round(120 * p.w / p.h); }
    c.width = W * 2; c.height = H * 2;
    var ctx = c.getContext('2d');
    var cut = Shapes.cut(g.cols, g.rows, Shapes.hash(p.id + ':' + g.cols + 'x' + g.rows));
    if (cls !== 'card-cut') Pics.draw(ctx, p, 0, 0, c.width, c.height);
    else if (progress && Array.isArray(progress.p) && progress.p.length === g.cols * g.rows) {
      // a puzzle in progress: a pale picture, with the pieces already in place in full colour
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = 0.28;
      Pics.draw(ctx, p, 0, 0, c.width, c.height);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.scale(c.width / g.cols, c.height / g.rows);
      ctx.beginPath();
      progress.p.forEach(function (e, q) { if (Array.isArray(e) && e[0] === 2) Shapes.piecePath(ctx, cut, q % g.cols, Math.floor(q / g.cols)); });
      ctx.restore();
      ctx.save();
      ctx.clip();
      Pics.draw(ctx, p, 0, 0, c.width, c.height);
      ctx.restore();
    }
    ctx.save();
    ctx.scale(c.width / g.cols, c.height / g.rows);
    ctx.beginPath();
    for (var j = 0; j < g.rows; j++) for (var i = 0; i < g.cols; i++) Shapes.piecePath(ctx, cut, i, j);
    ctx.restore();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20, 22, 60, 0.55)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke();
    return c;
  }

  /* ---------- picking a size ---------- */
  function openPicker(p) {
    if (Kit.overlayOpen()) return;
    var saved = Jig.peek(p.id), mask = Jig.doneMap()[p.id] || 0;
    var last = Kit.load('jig.level', 3);
    var lv = levels();
    if (lv.indexOf(last) < 0) last = 3;
    var html = '<p class="pick-text">' + (saved ? 'You’re in the middle of this one!' : 'How many pieces?') + '</p><div class="sizes"></div>';
    var buttons = [];
    if (saved) buttons.push({ label: 'Keep going · ' + saved.placed + '/' + saved.n, value: 'resume', primary: true, icon: 'play' });
    Kit.sfx.open();
    Kit.sheet({
      title: p.name, html: html, buttons: buttons,
      onOpen: function (cardEl, close) {
        cardEl.classList.add('picker');
        var box = cardEl.querySelector('.sizes');
        lv.forEach(function (k) {
          var g = Shapes.grid(k, p.w / p.h);
          var b = el('button', 'size' + (k === (saved ? saved.k : last) ? ' on' : '') + (mask & (1 << k) ? ' done' : ''));
          b.type = 'button';
          b.appendChild(gridIcon(p, k, 'size-pic'));
          b.appendChild(el('span', 'size-n', '<b>' + g.cols * g.rows + '</b> pieces'));
          if (mask & (1 << k)) { var st = el('span', 'size-star'); st.innerHTML = Kit.icon('star'); b.appendChild(st); }
          b.setAttribute('aria-label', g.cols * g.rows + ' pieces');
          b.addEventListener('click', function () { Kit.sfx.tap(); close({ k: k }); });
          box.appendChild(b);
        });
      }
    }).then(function (v) {
      if (v === 'resume' && saved) { openPuzzle(p, saved.k, saved.raw); return; }
      if (!v || !v.k) return;
      if (saved && saved.placed > 0 && saved.k !== v.k) {
        Kit.confirm({ title: 'Start again?', text: 'The puzzle you were doing (' + saved.placed + ' of ' + saved.n + ' pieces) will be put away.', yes: 'New puzzle', no: 'Keep it', emoji: '🧩' })
          .then(function (yes) { if (yes) openPuzzle(p, v.k, null); else openPuzzle(p, saved.k, saved.raw); });
        return;
      }
      openPuzzle(p, v.k, saved && saved.k === v.k ? saved.raw : null);
    });
  }

  /* ---------- photos ---------- */
  function pickPhoto() {
    if (Kit.overlayOpen()) return;
    Kit.sfx.tap();
    $('#photo-input').click();     // straight from the tap: iOS only opens the picker from a real touch
  }
  $('#photo-btn').addEventListener('click', pickPhoto);
  $('#photo-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    Kit.toast('Making your puzzle…', { icon: 'star', ms: 1200 });
    Photos.add(file).then(function (pic) {
      if (!pic || pic.error) {
        Kit.toast(pic && pic.error === 'full' ? 'That’s a lot of photos! Delete one first.' : 'Sorry, that picture couldn’t be opened.', { icon: 'close', ms: 3000 });
        return;
      }
      if (pic.temp) Kit.toast('This photo can’t be kept after you close the game.', { icon: 'close', ms: 3200 });
      Kit.sfx.good();
      renderLibrary();
      openPicker(pic);
    });
  });

  /* =====================================================================
     Puzzle
     ===================================================================== */
  var playEl = $('#play'), boardEl = $('#board'), trayEl = $('#tray'), piecesEl = $('#pieces');
  var matCv = $('#mat'), placedCv = $('#placed'), peekCv = $('#peek'), glowCv = $('#glow');
  var puzzle = null, L = null, art = null;
  var els = {};            // piece idx -> { el, cv }
  var drags = {};          // pointerId -> drag
  var zTop = 1, finishing = false, hintCount = 0, peekTimer = 0, peekShownAt = 0;

  function showScreen(name) {
    libEl.classList.toggle('k-hidden', name !== 'library');
    gameEl.classList.toggle('k-hidden', name !== 'game');
  }

  function openPuzzle(p, k, raw) {
    Kit.closeAll();
    Kit.save('jig.level', k);
    puzzle = new Jig.Puzzle(p, k, raw);
    finishing = false; hintCount = 0; drags = {};
    boardEl.classList.remove('finished', 'shine');
    showScreen('game');
    layout(true);
    if (!puzzle.restored) { puzzle.scatter(L.trayAspect); positionAll(); }
    updateGhostBtn();
    updateProgress();
    drawLid();
    Kit.sfx.open();
    Kit.howTo('jigsaw', HOW);
  }

  function toLibrary() {
    endAllDrags();
    if (puzzle && !finishing && (puzzle.touched || puzzle.restored)) puzzle.save();
    var was = puzzle && puzzle.pic.id;
    puzzle = null;
    clearPieces();
    showScreen('library');
    renderLibrary();
    // bring the picture just played into view (its own section, not Keep going)
    var cards = document.querySelectorAll('.card[data-id="' + was + '"]');
    var target = cards[cards.length - 1];
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
  }

  /* ---------- layout ---------- */
  function computeLayout() {
    var W = playEl.clientWidth, H = playEl.clientHeight;
    var tab = Math.min(W, H) >= 600 && Math.max(W, H) >= 700;
    var pad = tab ? 22 : 12, gap = tab ? 18 : 10;
    var land = W > H * 1.05;
    var a = puzzle.pic.w / puzzle.pic.h;
    var bx, by, bw, bh, tray;
    if (land) {
      var trayW = Math.max(W * 0.3, 240);
      var aw = W - trayW - pad * 2 - gap, ah = H - pad * 2;
      bw = Math.min(aw, ah * a); bh = bw / a;
      bx = pad; by = pad + (ah - bh) / 2;
      var tx = bx + bw + gap;
      tray = { x: tx, y: pad, w: W - pad - tx, h: H - pad * 2 };
    } else {
      var trayH = Math.max(H * 0.3, 180);
      var aw2 = W - pad * 2, ah2 = H - trayH - pad * 2 - gap;
      bw = Math.min(aw2, ah2 * a); bh = bw / a;
      bx = (W - bw) / 2; by = pad;
      var ty = by + bh + gap;
      tray = { x: pad, y: ty, w: W - pad * 2, h: H - pad - ty };
    }
    bx = Math.round(bx); by = Math.round(by); bw = Math.round(bw); bh = Math.round(bh);
    var sx = bw / puzzle.cols, sy = bh / puzzle.rows;
    var head = tab ? 66 : 54;
    var inner = { x: tray.x + 6, y: tray.y + head, w: tray.w - 12, h: tray.h - head - 6 };
    // tray scale: every piece of the puzzle gets a slot at the start
    var n = puzzle.n, asp = inner.w / Math.max(1, inner.h), best = 0;
    for (var cc = 1; cc <= n; cc++) {
      var rr = Math.ceil(n / cc), s = Math.min(inner.w / cc, inner.h / rr);
      if (s > best) best = s;
    }
    var k = Math.min(1, best / (Math.max(sx, sy) * 1.5));
    var pw = sx * (1 + 2 * M), ph = sy * (1 + 2 * M);
    // a piece let go in the tray keeps its centre this far inside it
    var mu = Math.min(0.45, sx * k * 0.6 / inner.w), mv = Math.min(0.45, sy * k * 0.6 / inner.h);
    var place = { x: inner.x, y: inner.y, w: inner.w, h: inner.h, mu: mu, mv: mv };
    return { W: W, H: H, land: land, board: { x: bx, y: by, w: bw, h: bh }, sx: sx, sy: sy, pw: pw, ph: ph,
      tray: tray, inner: inner, place: place, k: k, trayAspect: asp, tab: tab };
  }

  function sizeCanvas(cv, w, h) {
    cv.width = Math.max(1, Math.round(w * DPR)); cv.height = Math.max(1, Math.round(h * DPR));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
  }

  function layout(force) {
    if (!puzzle) return;
    var nl = computeLayout();
    if (!force && L && nl.W === L.W && nl.H === L.H) return;
    endAllDrags();
    var turned = L && L.land !== nl.land;
    L = nl;
    if (turned) puzzle.scatter(L.trayAspect, true);   // the tray changed shape: deal its pieces out again
    var b = L.board;
    boardEl.style.left = b.x + 'px'; boardEl.style.top = b.y + 'px';
    boardEl.style.width = b.w + 'px'; boardEl.style.height = b.h + 'px';
    trayEl.style.left = L.tray.x + 'px'; trayEl.style.top = L.tray.y + 'px';
    trayEl.style.width = L.tray.w + 'px'; trayEl.style.height = L.tray.h + 'px';
    trayEl.classList.toggle('side', L.land);
    [matCv, placedCv, peekCv, glowCv].forEach(function (cv) { sizeCanvas(cv, b.w, b.h); });
    // the whole picture at board size, drawn once; pieces are cut from it
    art = document.createElement('canvas');
    art.width = matCv.width; art.height = matCv.height;
    Pics.draw(art.getContext('2d'), puzzle.pic, 0, 0, art.width, art.height);
    var pctx = peekCv.getContext('2d');
    pctx.drawImage(art, 0, 0);
    drawMat();
    buildPieces();
    drawPlaced();
    clampAll();
    positionAll();
  }

  function cellTransform(ctx, ox, oy) {
    // cell units -> canvas pixels, with (ox, oy) cells at the canvas origin
    var a = L.sx * DPR, d = L.sy * DPR;
    ctx.setTransform(a, 0, 0, d, -ox * a, -oy * d);
  }

  function drawMat() {
    var ctx = matCv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, matCv.width, matCv.height);
    if (puzzle.ghost) {
      // a faded copy of the picture: lifted toward the tray colour so it reads as "just a hint"
      ctx.fillStyle = '#4a4f96';
      ctx.fillRect(0, 0, matCv.width, matCv.height);
      ctx.globalAlpha = 0.42;
      ctx.drawImage(art, 0, 0);
      ctx.globalAlpha = 1;
    }
    cellTransform(ctx, 0, 0);
    ctx.beginPath();
    for (var j = 0; j < puzzle.rows; j++) for (var i = 0; i < puzzle.cols; i++) Shapes.piecePath(ctx, puzzle.cut, i, j);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = puzzle.ghost ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = Math.max(1.5, 2 * DPR);
    ctx.stroke();
  }

  /* One piece's bitmap: shadow, picture, bevel. */
  function pieceBitmap(p) {
    var cv = document.createElement('canvas');
    cv.width = Math.round(L.pw * DPR); cv.height = Math.round(L.ph * DPR);
    var ctx = cv.getContext('2d'), ox = p.i - M, oy = p.j - M;
    var unit = Math.min(L.sx, L.sy) * DPR;
    function path(dx, dy) {
      cellTransform(ctx, ox - (dx || 0), oy - (dy || 0));
      ctx.beginPath();
      Shapes.piecePath(ctx, puzzle.cut, p.i, p.j);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // drop shadow
    ctx.save();
    path();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = unit * 0.07;
    ctx.shadowOffsetY = unit * 0.035;
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    // picture
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(art, -ox * L.sx * DPR, -oy * L.sy * DPR);
    // bevel: light along the top-left, shade along the bottom-right
    // (each stroke is as wide as twice its offset, so it only shows on one side)
    var off = Math.max(1.2, unit * 0.022) / unit;
    ctx.lineJoin = 'round';
    ctx.lineWidth = off * unit * 2;
    path(off, off);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.stroke();
    path(-off, -off);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.stroke();
    ctx.restore();
    // crisp outline
    path();
    ctx.lineWidth = Math.max(1, DPR * 0.8);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.stroke();
    return cv;
  }

  function clearPieces() { piecesEl.innerHTML = ''; els = {}; }

  function buildPieces() {
    clearPieces();
    var frag = document.createDocumentFragment();
    puzzle.pieces.forEach(function (p) {
      p.bmp = pieceBitmap(p);
      if (p.st === Jig.PLACED) return;
      var e = el('div', 'piece'), cv = p.bmp;
      cv.style.width = L.pw + 'px'; cv.style.height = L.ph + 'px';
      e.style.width = L.pw + 'px'; e.style.height = L.ph + 'px';
      e.appendChild(cv);
      if (!p.z) p.z = ++zTop;
      e.style.zIndex = p.z;
      els[p.idx] = { el: e, cv: cv };
      frag.appendChild(e);
    });
    piecesEl.appendChild(frag);
  }

  function drawPlaced() {
    var ctx = placedCv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, placedCv.width, placedCv.height);
    puzzle.pieces.forEach(function (p) { if (p.st === Jig.PLACED) bake(p, ctx); });
  }
  function bake(p, ctx) {
    ctx = ctx || placedCv.getContext('2d');
    ctx.drawImage(p.bmp, Math.round((p.i - M) * L.sx * DPR), Math.round((p.j - M) * L.sy * DPR));
  }

  /* where a piece's element goes: top-left of its full-size box, and scale */
  function homeOf(p) {
    if (p.st === Jig.TRAY) {
      var cx = L.place.x + p.u * L.place.w, cy = L.place.y + p.v * L.place.h;
      return { x: cx - L.pw / 2, y: cy - L.ph / 2, k: L.k };
    }
    var dx = p.st === Jig.TABLE ? p.dx : 0, dy = p.st === Jig.TABLE ? p.dy : 0;
    return { x: L.board.x + (p.i + dx - M) * L.sx, y: L.board.y + (p.j + dy - M) * L.sy, k: 1 };
  }

  function setPos(p, x, y, k, origin) {
    var e = els[p.idx];
    if (!e) return;
    p.px = x; p.py = y;
    e.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    if (origin) e.cv.style.transformOrigin = origin;
    e.cv.style.transform = k === 1 ? '' : 'scale(' + k + ')';
  }

  function positionAll() {
    puzzle.pieces.forEach(function (p) {
      if (p.st === Jig.PLACED || p.dragging) return;
      var h = homeOf(p);
      setPos(p, h.x, h.y, h.k, '50% 50%');
    });
  }

  /* Keep every table group (mostly) on screen, e.g. after turning the iPad. */
  function clampGroup(members) {
    var lo = -Infinity, hi = Infinity, loY = -Infinity, hiY = Infinity, b = L.board;
    members.forEach(function (p) {
      lo = Math.max(lo, (L.sx * 0.3 - b.x) / L.sx - p.i - 0.5);
      hi = Math.min(hi, (L.W - L.sx * 0.3 - b.x) / L.sx - p.i - 0.5);
      loY = Math.max(loY, (L.sy * 0.3 - b.y) / L.sy - p.j - 0.5);
      hiY = Math.min(hiY, (L.H - L.sy * 0.3 - b.y) / L.sy - p.j - 0.5);
    });
    var p0 = members[0];
    var dx = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, p0.dx));
    var dy = loY > hiY ? (loY + hiY) / 2 : Math.min(hiY, Math.max(loY, p0.dy));
    members.forEach(function (p) { p.dx = dx; p.dy = dy; });
  }
  function clampAll() {
    puzzle.regroup();
    Object.keys(puzzle.groups).forEach(function (g) { clampGroup(puzzle.members(+g)); });
  }

  /* ---------- input ---------- */
  function local(e) {
    var r = playEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitTest(x, y) {
    var best = null, bestZ = -1, near = null, nearD = Infinity;
    puzzle.pieces.forEach(function (p) {
      if (p.st === Jig.PLACED || p.dragging) return;
      var h = homeOf(p), k = h.k;
      var cx = h.x + L.pw / 2, cy = h.y + L.ph / 2;     // centre of the cell (the box is symmetric)
      var hx = L.sx * k * 0.5, hy = L.sy * k * 0.5, e = 0.22;
      var ddx = Math.abs(x - cx), ddy = Math.abs(y - cy);
      if (ddx <= hx * (1 + 2 * e) && ddy <= hy * (1 + 2 * e) && p.z > bestZ) { best = p; bestZ = p.z; }
      var d = Math.hypot(ddx / (L.sx * k), ddy / (L.sy * k));
      if (d < nearD) { nearD = d; near = p; }
    });
    if (best) return best;
    return nearD < 0.9 ? near : null;
  }

  function busyPiece(p) {
    for (var id in drags) if (drags[id].members.indexOf(p) >= 0) return true;
    return false;
  }

  playEl.addEventListener('pointerdown', function (e) {
    if (!puzzle || finishing || Kit.overlayOpen()) return;
    if (e.target.closest('button')) return;
    var pt = local(e);
    var p = hitTest(pt.x, pt.y);
    if (!p || busyPiece(p)) return;
    e.preventDefault();
    var members = p.st === Jig.TABLE ? puzzle.members(p.g) : [p];
    if (members.some(busyPiece)) return;
    var h = homeOf(p);
    var d = { id: e.pointerId, lead: p, members: members, offs: [], x: pt.x, y: pt.y, fromTray: p.st === Jig.TRAY, moved: false };
    if (p.st === Jig.TRAY) {
      // grow around the finger: the same spot of the piece stays under it
      var cx = h.x + L.pw / 2, cy = h.y + L.ph / 2;
      var vx = (pt.x - cx) / h.k, vy = (pt.y - cy) / h.k;
      var ox = vx + L.pw / 2, oy = vy + L.ph / 2;
      setPos(p, pt.x - ox, pt.y - oy, h.k, ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px');
      d.offs.push({ x: -ox, y: -oy });
    } else {
      members.forEach(function (m) {
        var hm = homeOf(m);
        setPos(m, hm.x, hm.y, 1, (pt.x - hm.x).toFixed(1) + 'px ' + (pt.y - hm.y).toFixed(1) + 'px');
        d.offs.push({ x: hm.x - pt.x, y: hm.y - pt.y });
      });
    }
    members.forEach(function (m) {
      m.dragging = true;
      m.z = ++zTop;
      var en = els[m.idx];
      if (en) { en.el.style.zIndex = 9000 + m.z; en.el.classList.remove('settle', 'hinted'); en.el.classList.add('lift'); }
    });
    // let the grow / lift transition start from where the piece was
    void piecesEl.offsetWidth;
    members.forEach(function (m) { var en = els[m.idx]; if (en) en.cv.style.transform = 'scale(1.06)'; });
    drags[e.pointerId] = d;
    try { playEl.setPointerCapture(e.pointerId); } catch (err) {}
    Kit.sfx.tone(520 + Math.random() * 60, 0.05, 'sine', { vol: 0.06, to: 700 });
  });

  var raf = 0;
  function frame() {
    raf = 0;
    Object.keys(drags).forEach(function (id) {
      var d = drags[id];
      d.members.forEach(function (m, q) {
        var e = els[m.idx];
        if (!e) return;
        m.px = d.x + d.offs[q].x; m.py = d.y + d.offs[q].y;
        e.el.style.transform = 'translate3d(' + m.px.toFixed(1) + 'px,' + m.py.toFixed(1) + 'px,0)';
      });
    });
  }
  playEl.addEventListener('pointermove', function (e) {
    var d = drags[e.pointerId];
    if (!d) return;
    e.preventDefault();
    var pt = local(e);
    if (Math.abs(pt.x - d.x) + Math.abs(pt.y - d.y) > 2) d.moved = true;
    d.x = pt.x; d.y = pt.y;
    if (!raf) raf = requestAnimationFrame(frame);
  });
  function up(e) {
    var d = drags[e.pointerId];
    if (!d) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel') { var pt = local(e); if (e.clientX || e.clientY) { d.x = pt.x; d.y = pt.y; } }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    frame();
    void piecesEl.offsetWidth;    // the glide to the final spot starts from where the finger let go
    delete drags[e.pointerId];
    drop(d);
  }
  playEl.addEventListener('pointerup', up);
  playEl.addEventListener('pointercancel', up);
  playEl.addEventListener('lostpointercapture', up);

  function endAllDrags() {
    Object.keys(drags).forEach(function (id) {
      var d = drags[id];
      delete drags[id];
      d.members.forEach(function (m) { m.dragging = false; var en = els[m.idx]; if (en) en.el.classList.remove('lift'); });
    });
  }

  function snapThreshold() { return puzzle.n <= 9 ? 0.55 : puzzle.n <= 25 ? 0.42 : 0.34; }

  function drop(d) {
    if (!puzzle) return;
    var lead = d.lead, members = d.members;
    members.forEach(function (m) { m.dragging = false; });
    // offset of the dropped piece from its true spot, in cells
    var dx = (lead.px - L.board.x) / L.sx + M - lead.i;
    var dy = (lead.py - L.board.y) / L.sy + M - lead.j;
    if (Math.hypot(dx, dy) < snapThreshold()) { place(members); return; }

    var g = lead.st === Jig.TABLE ? lead.g : lead.idx;
    members.forEach(function (m) { m.st = Jig.TABLE; m.g = g; m.dx = dx; m.dy = dy; });

    // join loose neighbours that line up
    var joined = false;
    for (var guard = 0; guard < 8; guard++) {
      var hit = null;
      puzzle.members(g).forEach(function (m) {
        if (hit) return;
        neighbours(m).forEach(function (nb) {
          if (hit || nb.st !== Jig.TABLE || nb.g === g || nb.dragging) return;
          if (Math.abs(nb.dx - m.dx) < 0.32 && Math.abs(nb.dy - m.dy) < 0.32) hit = nb;
        });
      });
      if (!hit) break;
      var into = hit.g, ndx = hit.dx, ndy = hit.dy;
      puzzle.pieces.forEach(function (m) { if (m.st === Jig.TABLE && m.g === g) { m.g = into; m.dx = ndx; m.dy = ndy; } });
      g = into;
      joined = true;
    }
    var group = puzzle.members(g);

    if (!joined && group.length === 1) {
      // a single piece let go over the tray goes back into it
      var cx = lead.px + L.pw / 2, cy = lead.py + L.ph / 2, t = L.tray;
      if (cx > t.x && cx < t.x + t.w && cy > t.y && cy < t.y + t.h) {
        lead.st = Jig.TRAY; lead.g = lead.idx;
        lead.u = Math.min(1 - L.place.mu, Math.max(L.place.mu, (cx - L.place.x) / L.place.w));
        lead.v = Math.min(1 - L.place.mv, Math.max(L.place.mv, (cy - L.place.y) / L.place.h));
        settle([lead]);
        Kit.sfx.tone(300, 0.06, 'triangle', { vol: 0.06, to: 240 });
        afterMove();
        return;
      }
    }
    clampGroup(group);
    settle(group);
    if (joined) {
      Kit.sfx.pop(640 + group.length * 20);
      Kit.buzz(8);
      // a joined group that lands near its spot: place it as well
      if (Math.hypot(group[0].dx, group[0].dy) < snapThreshold()) { place(group); return; }
      burstAt(group, false);
    } else {
      Kit.sfx.tone(330, 0.05, 'triangle', { vol: 0.05 });
    }
    afterMove();
  }

  function neighbours(p) {
    var out = [], c = puzzle.cols, r = puzzle.rows;
    if (p.i > 0) out.push(puzzle.pieces[p.idx - 1]);
    if (p.i < c - 1) out.push(puzzle.pieces[p.idx + 1]);
    if (p.j > 0) out.push(puzzle.pieces[p.idx - c]);
    if (p.j < r - 1) out.push(puzzle.pieces[p.idx + c]);
    return out;
  }

  /* glide pieces to where the model says they are */
  function settle(list) {
    list.forEach(function (p) {
      var en = els[p.idx];
      if (!en) return;
      en.el.classList.remove('lift');
      en.el.classList.add('settle');
      var h = homeOf(p);
      if (p.st === Jig.TRAY) setPos(p, h.x, h.y, h.k, '50% 50%');
      else setPos(p, h.x, h.y, 1);
      en.el.style.zIndex = p.z;
      setTimeout(function () { if (en.el) en.el.classList.remove('settle'); }, 220);
    });
  }

  function place(list) {
    list.forEach(function (p) { p.st = Jig.PLACED; p.dragging = false; });
    settle(list);
    var placed = puzzle.placed(), n = puzzle.n;
    Kit.sfx.place();
    Kit.sfx.pop(440 * Math.pow(2, placed / n));
    Kit.buzz(12);
    burstAt(list, true);
    setTimeout(function () {
      list.forEach(function (p) {
        var en = els[p.idx];
        if (en && en.el.parentNode) en.el.parentNode.removeChild(en.el);
        delete els[p.idx];
        if (puzzle && p.bmp && L) bake(p);
      });
    }, Kit.reduced ? 0 : 170);
    glowOff();
    afterMove();
    if (puzzle.isDone()) finish();
  }

  function burstAt(list, big) {
    if (Kit.reduced) return;
    var x = 0, y = 0;
    list.forEach(function (p) { var h = homeOf(p); x += h.x + L.pw / 2; y += h.y + L.ph / 2; });
    x /= list.length; y /= list.length;
    var b = el('div', 'burst' + (big ? ' big' : ''));
    var sz = Math.max(L.sx, L.sy) * 1.3;
    b.style.left = (x - sz / 2) + 'px'; b.style.top = (y - sz / 2) + 'px';
    b.style.width = b.style.height = sz + 'px';
    piecesEl.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 650);
  }

  var saveTimer = 0;
  function afterMove() {
    puzzle.touched = true;
    updateProgress();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (puzzle && !finishing) puzzle.save(); }, 120);
  }

  function updateProgress() {
    var placed = puzzle.placed(), n = puzzle.n;
    $('#progress-bar').style.width = (placed / n * 100) + '%';
    var num = $('#progress-num');
    var txt = placed + '/' + n;
    if (num.textContent !== txt) { num.textContent = txt; if (placed) Kit.anim($('#progress'), 'k-bump'); }
  }

  /* ---------- finishing ---------- */
  function finish() {
    finishing = true;
    clearTimeout(saveTimer);
    endAllDrags();
    var p = puzzle.pic, k = puzzle.k;
    puzzle.forget();
    Jig.markDone(p.id, k);
    publishStat();
    setTimeout(function () {
      boardEl.classList.add('finished');
      if (!Kit.reduced) boardEl.classList.add('shine');
      Kit.sfx.star(0); setTimeout(function () { Kit.sfx.star(1); }, 160); setTimeout(function () { Kit.sfx.star(2); }, 320);
      var r = boardEl.getBoundingClientRect();
      Kit.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 90 });
    }, 260);
    setTimeout(function () {
      if (!puzzle || puzzle.pic !== p) return;
      var next = upNext(p, k);
      var buttons = [{ label: 'Pictures', value: 'lib', icon: 'menu' }];
      var lv = levels();
      if (lv.indexOf(k + 1) >= 0) buttons.push({ label: 'More pieces', value: 'harder' });
      if (next) buttons.push({ label: 'Next', value: 'next', primary: true, icon: 'next' });
      Kit.result({
        emoji: '🧩', wiggle: true, confetti: true,
        title: 'You did it!',
        text: '<b>' + Kit.esc(p.name) + '</b> is all put together.' + (next ? '<br>Up next: <b>' + Kit.esc(next.name) + '</b>' : ''),
        stats: [{ label: 'Pieces', value: puzzle.n, hi: true }, { label: 'Pictures done', value: Object.keys(Jig.doneMap()).length }],
        buttons: buttons
      }).then(function (v) {
        if (v === 'next' && next) openPuzzle(next, k, null);
        else if (v === 'harder') openPuzzle(p, k + 1, null);
        else toLibrary();
      });
      Kit.buzz([30, 40, 30]);
    }, Kit.reduced ? 500 : 1500);
  }

  /* The next picture: the next one in the same theme not done yet, else
     any not done yet, else simply the next one. */
  function upNext(p, k) {
    var d = Jig.doneMap();
    var list = p.kind === 'photo' ? Photos.list().concat(Pics.builtin) : Pics.builtin;
    var same = list.filter(function (q) { return q.theme === p.theme; });
    var at = same.indexOf(p);
    var order = same.slice(at + 1).concat(list.slice(list.indexOf(p) + 1), list.slice(0, list.indexOf(p)));
    var pick = null;
    order.some(function (q) { if (q !== p && !d[q.id] && !Jig.peek(q.id)) { pick = q; return true; } return false; });
    void k;
    return pick || order.filter(function (q) { return q !== p; })[0] || null;
  }

  /* ---------- buttons ---------- */
  function drawLid() {
    var lc = $('#lid-canvas'), p = puzzle.pic, h = 44, w = Math.round(h * p.w / p.h);
    lc.width = w * 2; lc.height = h * 2;
    lc.style.width = w + 'px'; lc.style.height = h + 'px';
    Pics.draw(lc.getContext('2d'), p, 0, 0, lc.width, lc.height);
  }

  function showPeek() {
    if (!puzzle || finishing) return;
    clearTimeout(peekTimer);
    peekShownAt = Date.now();
    boardEl.classList.add('peeking');
  }
  function hidePeek(now) {
    clearTimeout(peekTimer);
    var wait = now ? 0 : Math.max(0, 1400 - (Date.now() - peekShownAt));
    peekTimer = setTimeout(function () { boardEl.classList.remove('peeking'); }, wait);
  }
  [$('#peek-btn'), $('#lid')].forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); if (Kit.overlayOpen()) return; showPeek(); Kit.sfx.tone(660, 0.08, 'sine', { vol: 0.06, to: 880 }); });
    b.addEventListener('pointerup', function () { hidePeek(); });
    b.addEventListener('pointercancel', function () { hidePeek(); });
    b.addEventListener('pointerleave', function () { hidePeek(); });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { showPeek(); hidePeek(); } });
  });

  function updateGhostBtn() {
    var b = $('#ghost-btn');
    b.setAttribute('aria-pressed', puzzle && puzzle.ghost ? 'true' : 'false');
    b.classList.toggle('k-btn--primary', !!(puzzle && puzzle.ghost));
  }
  $('#ghost-btn').addEventListener('click', function () {
    if (!puzzle || finishing) return;
    puzzle.ghost = !puzzle.ghost;
    Kit.sfx.tap();
    drawMat();
    updateGhostBtn();
    puzzle.save();
    Kit.toast(puzzle.ghost ? 'Faint picture on' : 'Faint picture off', { icon: 'star', ms: 1000 });
  });

  $('#tidy-btn').addEventListener('click', function () {
    if (!puzzle || finishing) return;
    endAllDrags();
    puzzle.scatter(L.trayAspect);
    Kit.sfx.slide();
    puzzle.pieces.forEach(function (p) {
      var en = els[p.idx];
      if (!en || p.st !== Jig.TRAY) return;
      en.el.classList.add('tidy');
      en.el.style.zIndex = p.z = ++zTop;
      setTimeout(function () { en.el.classList.remove('tidy'); }, 420);
    });
    positionAll();
    afterMove();
  });

  /* Hint: point at one loose piece and light up its spot. Edge pieces go
     first while there are any (they have a straight side). */
  function glowOff() {
    var ctx = glowCv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, glowCv.width, glowCv.height);
    boardEl.classList.remove('glowing');
  }
  $('#hint-btn').addEventListener('click', function () {
    if (!puzzle || finishing || Kit.overlayOpen()) return;
    var loose = puzzle.pieces.filter(function (p) { return p.st !== Jig.PLACED && !p.dragging; });
    if (!loose.length) return;
    var edges = loose.filter(function (p) { return p.edge; });
    var pool = edges.length && puzzle.n > 4 ? edges : loose;
    if (edges.length && puzzle.n > 4 && hintCount === 0) Kit.toast('Edge pieces first! They have a straight side.', { icon: 'hint', ms: 2600, top: true });
    hintCount++;
    // prefer a piece that touches the picture already there
    var touching = pool.filter(function (p) { return neighbours(p).some(function (q) { return q.st === Jig.PLACED; }); });
    var list = touching.length ? touching : pool;
    var p = list[Math.floor(Math.random() * list.length)];
    // glow its spot
    glowOff();
    var ctx = glowCv.getContext('2d');
    cellTransform(ctx, 0, 0);
    ctx.beginPath();
    Shapes.piecePath(ctx, puzzle.cut, p.i, p.j);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.35)'; ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4 * DPR; ctx.stroke();
    boardEl.classList.add('glowing');
    // wiggle the piece (and its group)
    var group = p.st === Jig.TABLE ? puzzle.members(p.g) : [p];
    group.forEach(function (q) {
      var en = els[q.idx];
      if (!en) return;
      en.el.style.zIndex = q.z = ++zTop;
      en.el.classList.remove('hinted'); void en.el.offsetWidth; en.el.classList.add('hinted');
    });
    if (puzzle.n > 4 && edges.length) edges.forEach(function (q) {
      var en = els[q.idx];
      if (en && group.indexOf(q) < 0) { en.el.classList.remove('edgey'); void en.el.offsetWidth; en.el.classList.add('edgey'); }
    });
    Kit.sfx.tone(880, 0.12, 'sine', { vol: 0.07, to: 1320 });
    clearTimeout(glowCv._t);
    glowCv._t = setTimeout(glowOff, 3200);
  });

  $('#back-btn').addEventListener('click', function () { Kit.sfx.close(); toLibrary(); });
  Kit.bindMute($('#mute-btn'));

  var HOW = [
    { icon: 'menu', text: 'Pick a picture, then how many pieces.' },
    { emoji: '👆', text: 'Drag pieces onto the board. Close is good enough: they <b>click</b> into place!' },
    { emoji: '🧩', text: 'Pieces that fit together join up, and move together.' },
    { icon: 'hint', text: 'Stuck? The bulb shows where a piece goes. Hold the eye to peek at the picture.' }
  ];
  Kit.bindHelp($('#help-btn'), 'jigsaw', HOW);

  var resizeT = 0;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (puzzle && !gameEl.classList.contains('k-hidden')) layout(false); }, 120);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  function saveNow() { if (puzzle && !finishing && (puzzle.touched || puzzle.restored)) puzzle.save(); }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });

  /* ---------- start ---------- */
  renderLibrary();
  Photos.init().then(function () { if (!puzzle) renderLibrary(); });

  window.__jig = {
    puzzle: function () { return puzzle; },
    layout: function () { return L; },
    open: function (id, k) { var p = Pics.get(id); if (p) openPuzzle(p, k, Jig.peek(id) && Jig.peek(id).k === k ? Jig.peek(id).raw : null); },
    toLibrary: toLibrary,
    // where piece idx should be dropped (page coordinates of the finger), given where it was grabbed
    target: function (idx) {
      var p = puzzle.pieces[idx], r = playEl.getBoundingClientRect();
      return { x: r.left + L.board.x + (p.i + 0.5) * L.sx, y: r.top + L.board.y + (p.j + 0.5) * L.sy };
    },
    where: function (idx) {
      var p = puzzle.pieces[idx], h = homeOf(p), r = playEl.getBoundingClientRect();
      return { x: r.left + h.x + L.pw / 2, y: r.top + h.y + L.ph / 2, st: p.st };
    }
  };
})();
