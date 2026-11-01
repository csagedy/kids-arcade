/* Klondike screen. Rules and the solver live in js/rules.js (Klondike.*);
   every deal comes from js/deals.js, seeds the solver has already won.

   All 52 cards are persistent elements absolutely placed on the board, so
   any change (a tap, a drag, an undo) is just "work out where every card
   goes" and the CSS transitions on left/top fly them there. */
(function () {
  var KL = Klondike;
  var SAVE = 'klondike.game', STATS = 'klondike.stats', NEXT = 'klondike.next';
  var SUIT_CHAR = Cards.SUIT_CHAR, RANKS = Cards.RANK;
  var FACE = Cards.FACE_ART;   // emoji for the court cards on the win cascade

  var board = document.getElementById('board');
  var movesEl = document.getElementById('moves'), timeEl = document.getElementById('time');
  var undoBtn = document.getElementById('undo-btn'), hintBtn = document.getElementById('hint-btn');

  var game = null;        // { seed, draw, s, hist, moves, time, won }
  var els = [], loc = [], G = null;
  var stockSlot, foundSlots = [], colSlots = [];
  var busy = false;       // auto-finish / win running
  var stuckShown = '';
  var plan = null;        // hint plan: [{ key, step }]

  /* ---------- building ---------- */
  function slot(cls, extra) {
    var d = document.createElement('div');
    d.className = 'kl-slot ' + cls;
    if (extra) for (var k in extra) d.setAttribute(k, extra[k]);
    board.appendChild(d);
    return d;
  }
  function build() {
    stockSlot = slot('kl-slot--stock', { role: 'button', 'aria-label': 'Deck' });
    stockSlot.innerHTML = Kit.icon('restart');
    for (var i = 0; i < 4; i++) foundSlots.push(slot('kl-slot--found', { 'data-suit': SUIT_CHAR[Cards.SUITS[i]] }));
    for (i = 0; i < 7; i++) colSlots.push(slot('kl-slot--col'));
    for (var c = 0; c < 52; c++) {
      var r = KL.rank(c), su = Cards.SUITS[KL.suit(c)];
      var e = Cards.el({ s: su, r: r }, false);
      e.setAttribute('data-id', c);
      board.appendChild(e);
      els.push(e);
    }
  }

  /* ---------- geometry ----------
     Portrait-ish boards: the classic layout, deck + waste + four homes in a
     row over seven columns. Wide boards (iPad landscape, phones on their
     side): deck and waste in a left rail, homes in a right rail, so the
     columns get the full height. */
  function measure() {
    var W = board.clientWidth, H = board.clientHeight;
    if (!W || !H) return null;
    var g = { W: W, H: H, wide: W > H * 1.15 };
    var cw;
    if (g.wide) {
      cw = Math.min(W / 9.8, H / 5.75);
      var gap = Math.min((W - 9 * cw) / 10, cw * 0.3);
      var left = (W - (9 * cw + 10 * gap)) / 2;
      g.colX = []; for (var i = 0; i < 7; i++) g.colX.push(left + (cw + gap) * (i + 1) + gap);
      g.stock = { x: left, y: 0 };
      g.waste = { x: left, y: cw * 1.4 + Math.max(gap, cw * 0.18) };
      var fg = Math.min(gap * 1.5, (H - 4 * cw * 1.4) / 3);
      g.found = []; for (i = 0; i < 4; i++) g.found.push({ x: left + (cw + gap) * 8 + 2 * gap, y: i * (cw * 1.4 + fg) });
      g.colY = 0;
      g.fanDir = 'down';
    } else {
      cw = Math.min(W / 7.5, H / 4.3);
      var gp = Math.min((W - 7 * cw) / 6, cw * 0.22);
      var lf = (W - (7 * cw + 6 * gp)) / 2;
      g.colX = []; for (var j = 0; j < 7; j++) g.colX.push(lf + (cw + gp) * j);
      g.stock = { x: g.colX[0], y: 0 };
      g.waste = { x: g.colX[1], y: 0 };
      g.found = []; for (j = 0; j < 4; j++) g.found.push({ x: g.colX[3 + j], y: 0 });
      g.colY = cw * 1.4 + Math.max(gp * 1.2, cw * 0.2);
      g.fanDir = 'right';
    }
    g.cw = cw; g.ch = cw * 1.4;
    return g;
  }

  /* vertical steps for one column so it always fits the board */
  function steps(nDown, nUp) {
    var ch = G.ch, avail = G.H - G.colY - ch;
    var fd = ch * 0.13, fu = ch * 0.33;
    if (nDown * fd + Math.max(0, nUp - 1) * fu <= avail) return [fd, fu];
    fd = ch * 0.07;
    var up = Math.max(1, nUp - 1);
    fu = Math.max(ch * 0.26, Math.min(ch * 0.33, (avail - nDown * fd) / up));
    if (nDown * fd + (nUp - 1) * fu <= avail) return [fd, fu];
    // still too tall: squeeze both evenly
    var k = avail / (nDown * fd + (nUp - 1) * fu);
    return [fd * k, fu * k];
  }

  function place(el, x, y, z) {
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el._z = z;
  }

  /* ---------- drawing ---------- */
  var lift = 0;
  function render(quick) {
    G = measure();
    if (!G) return;
    board.style.setProperty('--cw', G.cw + 'px');
    var s = game.s, i, k, c;
    var before = els.map(function (e) { return e.style.left + ',' + e.style.top; });

    place(stockSlot, G.stock.x, G.stock.y);
    stockSlot.classList.toggle('kl-done', !s.stock.length && !s.waste.length);
    stockSlot.style.visibility = s.stock.length ? 'hidden' : '';
    for (i = 0; i < 4; i++) place(foundSlots[i], G.found[i].x, G.found[i].y);
    for (i = 0; i < 7; i++) place(colSlots[i], G.colX[i], G.colY);

    // deck
    for (k = 0; k < s.stock.length; k++) {
      c = s.stock[k];
      var d = Math.min(3, Math.floor(k / 8)) * G.cw * 0.015;
      place(els[c], G.stock.x - d, G.stock.y - d, 10 + k);
      setUp(c, false); loc[c] = { pile: 'stock' };
    }
    // waste: draw 3 shows the last three fanned
    var nw = s.waste.length, fanN = game.draw === 3 ? Math.min(3, nw) : Math.min(1, nw);
    for (k = 0; k < nw; k++) {
      c = s.waste[k];
      var f = Math.max(0, k - (nw - fanN));
      var off = f * (G.fanDir === 'right' ? G.cw * 0.36 : G.ch * 0.26);
      place(els[c], G.waste.x + (G.fanDir === 'right' ? off : 0), G.waste.y + (G.fanDir === 'down' ? off : 0), 100 + k);
      setUp(c, true); loc[c] = { pile: 'waste', top: k === nw - 1 };
    }
    // homes
    for (i = 0; i < 4; i++) {
      for (var r = 1; r <= 13; r++) {
        c = KL.card(i, r);
        if (r > s.found[i]) continue;
        place(els[c], G.found[i].x, G.found[i].y, 200 + r);
        setUp(c, true); loc[c] = { pile: 'found', i: i, top: r === s.found[i] };
      }
    }
    // columns
    for (i = 0; i < 7; i++) {
      var col = s.cols[i], dn = s.down[i], st = steps(dn, col.length - dn), y = G.colY;
      for (k = 0; k < col.length; k++) {
        c = col[k];
        place(els[c], G.colX[i], y, 300 + k);
        setUp(c, k >= dn); loc[c] = { pile: 'col', i: i, h: k };
        y += k < dn ? st[0] : st[1];
      }
    }
    // Cards that move ride above everything until they land.
    var token = ++lift;
    els.forEach(function (e, idx) {
      var moved = before[idx] !== e.style.left + ',' + e.style.top;
      e.style.zIndex = (moved && !quick ? 1000 : 0) + e._z;
    });
    setTimeout(function () { if (token === lift) els.forEach(function (e) { e.style.zIndex = e._z; }); }, 280);
    paintStats();
  }

  function setUp(c, up) {
    var e = els[c];
    if (e.classList.contains('faceup') !== up) e.classList.toggle('faceup', up);
  }

  function fmt(ms) {
    var t = Math.floor(ms / 1000), m = Math.floor(t / 60), sec = t % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function paintStats() {
    movesEl.textContent = game.moves;
    timeEl.textContent = fmt(game.time);
    undoBtn.disabled = !game.hist.length || busy;
    hintBtn.disabled = busy || game.won;
    document.getElementById('mode-name').textContent = 'Draw ' + game.draw;
    var st = stats();
    document.getElementById('wins-line').textContent = st.wins ? 'Won ' + st.wins + (st.wins === 1 ? ' game' : ' games') : 'Every deal can be won!';
  }

  /* ---------- state changes ---------- */
  function snapshot() { return { s: KL.clone(game.s), moves: game.moves }; }
  function save() { Kit.save(SAVE, game); }

  function doDraw() {
    var s = game.s;
    if (!s.stock.length && !s.waste.length) { Kit.sfx.bad(); return; }
    game.hist.push(snapshot());
    var res = KL.draw(s, game.draw);
    game.moves++;
    if (res.recycled) Kit.sfx.tone(300, 0.18, 'triangle', { vol: 0.08, to: 520 });
    else Kit.sfx.slide();
    render();
    after();
  }

  function doMove(from, to, opts) {
    var snap = snapshot();
    var res = KL.move(game.s, from, to);
    if (!res) return false;
    game.hist.push(snap);
    game.moves++;
    clearHint();
    render(opts && opts.quick);
    if (to.pile === 'found') {
      var c = res.cards[0], e = els[c];
      Kit.sfx.pop(300 * Math.pow(1.06, KL.rank(c)));
      setTimeout(function () { Kit.anim(e, 'kl-home'); }, 200);
      if (KL.rank(c) === 13 && !(opts && opts.auto)) {
        setTimeout(function () { Kit.toast(Cards.SUIT_NAME[Cards.SUITS[KL.suit(c)]] + ' all home!', { icon: 'star' }); Kit.sfx.good(); }, 250);
      }
    } else Kit.sfx.place();
    if (res.flipped >= 0) setTimeout(function () { Kit.sfx.tone(880, 0.06, 'sine', { vol: 0.05, to: 1180 }); }, 180);
    if (!(opts && opts.auto)) after();
    return true;
  }

  function undo() {
    if (busy || !game.hist.length || Kit.overlayOpen()) return;
    var h = game.hist.pop();
    game.s = h.s; game.moves = h.moves;
    clearHint();
    Kit.sfx.tone(520, 0.1, 'sine', { vol: 0.08, to: 340 });
    render();
    save();
  }

  /* after every action: save, maybe finish by itself, maybe stuck */
  function after() {
    save();
    if (KL.won(game.s)) { win(); return; }
    var fin = KL.finishPlan(game.s, game.draw);
    if (fin) { autoFinish(fin); return; }
    var key = JSON.stringify(game.s);
    if (!anyMove(game.s) && stuckShown !== key) {
      stuckShown = key;
      setTimeout(stuck, 450);
    }
  }

  /* ---------- tap and drag ---------- */
  var drag = null;

  function placeOf(c) {
    var l = loc[c];
    if (!l) return null;
    if (l.pile === 'stock') return { pile: 'stock' };
    if (!els[c].classList.contains('faceup')) return null;
    if (l.pile === 'waste') return l.top ? { pile: 'waste' } : null;
    if (l.pile === 'found') return l.top ? { pile: 'found', i: l.i } : null;
    return KL.isRun(game.s, l.i, l.h) ? { pile: 'col', i: l.i, h: l.h } : null;
  }
  function elsOf(from) {
    return KL.cardsAt(game.s, from).map(function (c) { return els[c]; });
  }

  board.addEventListener('pointerdown', function (e) {
    if (busy || Kit.overlayOpen() || drag || !game) return;
    var cardEl = e.target.closest('.card'), from = null;
    if (cardEl) from = placeOf(+cardEl.getAttribute('data-id'));
    else if (e.target.closest('.kl-slot--stock')) from = { pile: 'stock' };
    if (!from) {
      // a tap on an empty column or home slot does nothing; a tap on the
      // waste under the fan picks up its top card
      if (cardEl && loc[+cardEl.getAttribute('data-id')].pile === 'waste') from = { pile: 'waste' };
      else return;
    }
    if (from.pile === 'stock') { clearHint(); doDraw(); return; }
    var moving = elsOf(from);
    if (!moving.length) return;
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    drag = { id: e.pointerId, from: from, els: moving, x0: e.clientX, y0: e.clientY, on: false,
      start: moving.map(function (m) { return [parseFloat(m.style.left), parseFloat(m.style.top)]; }) };
    moving.forEach(function (m) { m.classList.add('kl-lift'); });
  });

  board.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on && dx * dx + dy * dy < 64) return;
    if (!drag.on) {
      drag.on = true;
      clearHint();
      drag.els.forEach(function (m, k) { m.classList.add('kl-drag'); m.style.zIndex = 2000 + k; });
      Kit.sfx.click();
    }
    drag.els.forEach(function (m, k) {
      m.style.left = (drag.start[k][0] + dx) + 'px';
      m.style.top = (drag.start[k][1] + dy) + 'px';
    });
    var t = dropTarget(drag);
    markTarget(t);
  });

  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    d.els.forEach(function (m) { m.classList.remove('kl-drag', 'kl-lift'); });
    markTarget(null);
    if (cancel) { render(); return; }
    if (!d.on) { tap(d.from); return; }
    var t = dropTarget(d);
    if (t && doMove(d.from, t, { quick: false })) return;
    render();
    if (Math.abs(e.clientY - d.y0) + Math.abs(e.clientX - d.x0) > G.cw * 0.6) { Kit.sfx.bad(); }
  }
  board.addEventListener('pointerup', function (e) { endDrag(e, false); });
  board.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  function tap(from) {
    var to = KL.bestTarget(game.s, from);
    if (to && doMove(from, to)) return;
    // nowhere to go: a little "no" wiggle
    Kit.sfx.bad();
    elsOf(from).forEach(function (m) { Kit.anim(m, 'kl-no'); });
  }

  /* The landing spot nearest the dragged card wins, as long as it's legal
     and within about a card's width: big, forgiving drop zones. */
  function landing(t) {
    if (t.pile === 'found') return { x: G.found[t.i].x, y: G.found[t.i].y };
    var col = game.s.cols[t.i];
    if (!col.length) return { x: G.colX[t.i], y: G.colY };
    var top = els[col[col.length - 1]];
    return { x: G.colX[t.i], y: parseFloat(top.style.top) + G.ch * 0.3 };
  }
  function dropTarget(d) {
    var x = parseFloat(d.els[0].style.left), y = parseFloat(d.els[0].style.top);
    var best = null, bd = Infinity, cands = [];
    for (var i = 0; i < 7; i++) cands.push({ pile: 'col', i: i });
    if (d.els.length === 1) for (i = 0; i < 4; i++) cands.push({ pile: 'found', i: i });
    cands.forEach(function (t) {
      if (!KL.legal(game.s, d.from, t)) return;
      var p = landing(t);
      // columns are tall: measure vertical distance only below the top card
      var dy = t.pile === 'col' ? Math.max(0, p.y - G.ch * 0.6 - y) : Math.abs(p.y - y);
      var dist = Math.hypot(p.x - x, dy);
      if (dist < bd) { bd = dist; best = t; }
    });
    return bd < G.cw * 1.25 ? best : null;
  }
  var marked = null;
  function markTarget(t) {
    if (marked) { marked.forEach(function (m) { m.classList.remove('kl-target'); }); marked = null; }
    if (!t) return;
    var m = t.pile === 'found' ? foundSlots[t.i] : colSlots[t.i];
    if (t.pile === 'col' && game.s.cols[t.i].length) return;   // the run already shows it fits
    m.classList.add('kl-target');
    marked = [m];
  }

  /* ---------- hints ---------- */
  var hinted = [];
  function clearHint() {
    hinted.forEach(function (m) { m.classList.remove('kl-hint', 'kl-target'); });
    hinted = [];
  }
  function showHint(step) {
    clearHint();
    if (step.op === 'draw') {
      var top = game.s.stock.length ? els[game.s.stock[game.s.stock.length - 1]] : stockSlot;
      if (top === stockSlot) { stockSlot.classList.add('kl-target'); hinted.push(stockSlot); }
      else { top.classList.add('kl-hint'); hinted.push(top); }
      Kit.toast(game.s.stock.length ? 'Tap the deck for a new card' : 'Tap to turn the deck over', { ms: 1600 });
    } else {
      elsOf(step.from).forEach(function (m) { Kit.anim(m, 'kl-hint'); hinted.push(m); });
      var t = step.to, col = t.pile === 'col' ? game.s.cols[t.i] : null;
      var tgt = t.pile === 'found' ? (game.s.found[t.i] ? els[KL.card(t.i, game.s.found[t.i])] : foundSlots[t.i])
        : (col.length ? els[col[col.length - 1]] : colSlots[t.i]);
      if (tgt.classList.contains('kl-slot')) tgt.classList.add('kl-target'); else Kit.anim(tgt, 'kl-hint');
      hinted.push(tgt);
    }
    Kit.sfx.tone(988, 0.12, 'sine', { vol: 0.07, to: 1319 });
    setTimeout(clearHint, 2300);
  }

  /* Ask the solver for a winning line (with a time limit so an old phone
     never hangs), and keep it so the next hints along the same line are free. */
  function hint() {
    if (busy || Kit.overlayOpen() || game.won) return;
    var key = JSON.stringify(game.s);
    var hit = plan && plan.filter(function (p) { return p.key === key; })[0];
    if (!hit) {
      var r = KL.solve(game.s, { draw: game.draw, maxMs: 260, maxNodes: 120000 });
      plan = null;
      if (r.ok && r.moves.length) {
        try {
          var stepsList = KL.expand(game.s, r.moves, game.draw), s = KL.clone(game.s);
          plan = stepsList.map(function (st) {
            var k = JSON.stringify(s);
            if (st.op === 'draw') KL.draw(s, game.draw); else KL.move(s, st.from, st.to);
            return { key: k, step: st };
          });
          hit = plan[0];
        } catch (e) { plan = null; }
      }
    }
    if (hit) { showHint(hit.step); return; }
    var h = simpleHint(game.s);
    if (h) { showHint(h); return; }
    Kit.toast('No moves here. Try Undo!', { icon: 'undo' });
    Kit.sfx.bad();
  }

  /* A sensible move without the solver: home first, then uncover a hidden
     card, then play from the waste, then draw. */
  function simpleHint(s) {
    var i, from, to;
    for (i = 0; i < 7; i++) if (s.cols[i].length) {
      from = { pile: 'col', i: i, h: s.cols[i].length - 1 };
      if (KL.canFound(s, s.cols[i][from.h])) return { op: 'move', from: from, to: { pile: 'found', i: KL.suit(s.cols[i][from.h]) } };
    }
    for (i = 0; i < 7; i++) if (s.cols[i].length && s.down[i]) {
      from = { pile: 'col', i: i, h: s.down[i] };
      to = KL.bestTarget(s, from);
      if (to) return { op: 'move', from: from, to: to };
    }
    if (s.waste.length) { to = KL.bestTarget(s, { pile: 'waste' }); if (to) return { op: 'move', from: { pile: 'waste' }, to: to }; }
    if (s.stock.length || s.waste.length > 1) return anyStockPlay(s) ? { op: 'draw' } : null;
    return null;
  }
  function stockCards(s) {
    var D = s.waste.concat(s.stock.slice().reverse());
    if (game.draw === 1) return D;
    return KL.reach(D.length, s.waste.length, game.draw).map(function (k) { return D[k - 1]; });
  }
  function anyStockPlay(s) {
    return stockCards(s).some(function (c) {
      if (KL.canFound(s, c)) return true;
      for (var j = 0; j < 7; j++) if (KL.canStack(s, c, j)) return true;
      return false;
    });
  }
  /* is there anything worth doing at all? */
  function anyMove(s) {
    for (var i = 0; i < 7; i++) {
      var col = s.cols[i];
      if (!col.length) continue;
      if (KL.canFound(s, col[col.length - 1])) return true;
      for (var h = s.down[i]; h < col.length; h++) {
        for (var j = 0; j < 7; j++) {
          if (j === i || !KL.canStack(s, col[h], j)) continue;
          if (h === s.down[i] && (h > 0 || s.cols[j].length)) return true;
          if (h > s.down[i] && KL.canFound(s, col[h - 1])) return true;
        }
      }
    }
    return anyStockPlay(s);
  }

  /* ---------- the end ---------- */
  function autoFinish(steps) {
    busy = true; paintStats();
    Kit.toast('All cards are showing. Finishing up!', { icon: 'star', top: true, ms: 1400 });
    var i = 0, gap = Kit.reduced ? 30 : 95;
    (function next() {
      if (i >= steps.length) { busy = false; save(); win(); return; }
      var st = steps[i++];
      if (st.op === 'draw') { KL.draw(game.s, game.draw); game.moves++; render(); }
      else doMove(st.from, st.to, { auto: true });
      setTimeout(next, gap);
    })();
  }

  function stats() {
    var st = Kit.load(STATS, null), out = {};
    ['wins', 'wins1', 'wins3', 'best1', 'best3'].forEach(function (k) { out[k] = st && typeof st[k] === 'number' && st[k] > 0 ? st[k] : 0; });
    return out;
  }

  function win() {
    if (game.won) return;
    game.won = true;
    busy = true;
    var st = stats(), secs = Math.max(1, Math.round(game.time / 1000));
    st.wins++; st['wins' + game.draw] = (st['wins' + game.draw] || 0) + 1;
    var bk = 'best' + game.draw, fast = !st[bk] || secs < st[bk];
    if (fast) st[bk] = secs;
    Kit.save(STATS, st);
    Kit.stat('klondike', 'Won ' + st.wins);
    save();
    paintStats();
    Kit.buzz([30, 40, 30]);
    cascade().then(function () {
      busy = false;
      paintStats();
      Kit.result({
        emoji: '🏆', wiggle: true, confetti: true,
        title: 'You won!',
        text: st.wins === 1 ? 'Your very first solitaire win!' : 'Every card is home. Brilliant!',
        badge: fast && st.wins > 1 ? 'Your fastest Draw ' + game.draw + ' win!' : '',
        stats: [{ label: 'Moves', value: game.moves }, { label: 'Time', value: fmt(game.time), hi: fast }, { label: 'Wins', value: st.wins }],
        buttons: [{ label: 'New deal', value: 'new', primary: true, icon: 'next' }]
      }).then(function () { newGame(game.draw); });
    });
  }

  /* Cards bounce out of the homes and leave trails across the screen. */
  function cascade() {
    if (Kit.reduced) return Promise.resolve();
    var cv = document.getElementById('cascade'), dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.classList.remove('kl-fade'); cv.classList.add('kl-on');
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    var cw = G.cw, ch = G.ch, imgs = {};
    function img(c) {
      if (imgs[c]) return imgs[c];
      var o = document.createElement('canvas'); o.width = Math.ceil(cw * dpr); o.height = Math.ceil(ch * dpr);
      var x = o.getContext('2d'); x.scale(dpr, dpr);
      var red = KL.red(c), su = SUIT_CHAR[Cards.SUITS[KL.suit(c)]].charAt(0), r = KL.rank(c);
      x.fillStyle = '#fffdf7'; x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1;
      roundRect(x, 0.5, 0.5, cw - 1, ch - 1, cw * 0.11); x.fill(); x.stroke();
      x.fillStyle = red ? '#e5374a' : '#1d1f33';
      x.font = '900 ' + Math.round(cw * 0.36) + 'px ui-rounded, -apple-system, system-ui, sans-serif';
      x.textBaseline = 'top'; x.textAlign = 'left'; x.fillText(RANKS[r], cw * 0.07, cw * 0.05);
      x.textAlign = 'right'; x.fillText(su, cw * 0.93, cw * 0.05);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = Math.round(cw * (r > 10 ? 0.6 : 0.72)) + 'px -apple-system, system-ui, sans-serif';
      x.fillText(FACE[r] || su, cw / 2, ch * 0.62);
      return (imgs[c] = o);
    }
    var queue = [];
    for (var r = 13; r >= 1; r--) for (var s = 0; s < 4; s++) queue.push(KL.card(s, r));
    var flying = [], last = 0, t0 = 0, done = false;
    return new Promise(function (resolve) {
      function finish() {
        if (done) return;
        done = true;
        cv.removeEventListener('pointerdown', finish);
        cv.classList.add('kl-fade');
        setTimeout(function () { cv.classList.remove('kl-on', 'kl-fade'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }, 520);
        resolve();
      }
      cv.addEventListener('pointerdown', finish);
      var floor = H - 4;
      function frame(t) {
        if (done) return;
        if (!t0) t0 = t;
        if (queue.length && t - last > 150) {
          last = t;
          var c = queue.shift(), rc = els[c].getBoundingClientRect();
          els[c].style.visibility = 'hidden';
          var dir = Math.random() < 0.5 ? -1 : 1;
          if (rc.left < W * 0.25) dir = 1; else if (rc.right > W * 0.75) dir = -1;
          flying.push({ c: c, x: rc.left, y: rc.top, vx: dir * (2 + Math.random() * 4.5) * (W / 800 + 0.5), vy: -Math.random() * 8 });
          Kit.sfx.tone(392 * Math.pow(1.06, KL.rank(c)), 0.07, 'triangle', { vol: 0.05 });
        }
        flying = flying.filter(function (f) {
          f.vy += 0.55; f.x += f.vx; f.y += f.vy;
          if (f.y + ch > floor) { f.y = floor - ch; f.vy = -f.vy * 0.78; if (Math.abs(f.vy) < 2) f.vy = -6; }
          ctx.drawImage(img(f.c), f.x, f.y, cw, ch);
          return f.x > -cw && f.x < W;
        });
        if ((!queue.length && !flying.length) || t - t0 > 9000) { finish(); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }
  function roundRect(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }

  function stuck() {
    if (Kit.overlayOpen() || busy || game.won) return;
    Kit.result({
      emoji: '🤔', title: 'No more moves',
      text: 'Undo a few moves and try another way. <b>This deal can be won!</b>',
      sound: 'bad' in Kit.sfx ? 'bad' : false,
      buttons: [{ label: 'New deal', value: 'new' }, { label: 'Undo', value: 'undo', primary: true, icon: 'undo' }]
    }).then(function (v) {
      if (v === 'undo') undo();
      else if (v === 'new') newGame(game.draw);
    });
  }

  /* ---------- games ---------- */
  function nextSeed(draw) {
    var list = (window.KLONDIKE_DEALS || {})[draw] || [];
    var n = Kit.load(NEXT, null);
    if (!n || typeof n !== 'object') n = { 1: 0, 3: 0 };
    var idx = n[draw] > 0 ? n[draw] | 0 : 0;
    n[draw] = idx + 1;
    Kit.save(NEXT, n);
    // Walk the list with a stride so consecutive deals feel unrelated.
    return list.length ? list[(idx * 37) % list.length] : (Math.random() * 1e9) | 0;
  }

  function newGame(draw, seed) {
    Kit.closeAll();
    busy = false; plan = null; stuckShown = ''; clearHint();
    draw = draw === 3 ? 3 : 1;
    seed = seed === undefined ? nextSeed(draw) : seed;
    game = { seed: seed, draw: draw, s: KL.deal(seed), hist: [], moves: 0, time: 0, won: false };
    Kit.save('klondike.draw', draw);
    els.forEach(function (e) { e.style.visibility = ''; });
    // gather everything into the deck, then deal out with a flourish
    var dealt = KL.clone(game.s);
    game.s = { cols: [[], [], [], [], [], [], []], down: [0, 0, 0, 0, 0, 0, 0], waste: [], found: [0, 0, 0, 0], stock: dealt.stock.concat(flatten(dealt)) };
    render(true);
    game.s = dealt;
    save();
    if (Kit.reduced) { render(true); return; }
    Kit.sfx.open();
    // reveal column cards one by one
    var order = [];
    for (var row = 0; row < 7; row++) for (var c = row; c < 7; c++) order.push(dealt.cols[c][row]);
    busy = true;
    var cards = order.slice();
    setTimeout(function step() {
      render();
      cards.forEach(function (c, k) {
        var e = els[c];
        e.style.transitionDelay = (k * 28) + 'ms';
        e.firstChild.style.transitionDelay = (k * 28 + 120) + 'ms';
      });
      setTimeout(function () {
        cards.forEach(function (c) { els[c].style.transitionDelay = ''; els[c].firstChild.style.transitionDelay = ''; });
        busy = false; paintStats();
      }, cards.length * 28 + 420);
      for (var k = 0; k < 7; k++) setTimeout(function () { Kit.sfx.tone(700 + Math.random() * 200, 0.04, 'triangle', { vol: 0.04 }); }, k * 110);
    }, 60);
  }
  function flatten(s) {
    var out = [];
    for (var row = 6; row >= 0; row--) for (var c = 6; c >= row; c--) out.push(s.cols[c][row]);
    return out;
  }

  function askNew() {
    if (busy || Kit.overlayOpen()) return;
    var cur = game.draw;
    Kit.sfx.open();
    function opt(v, title, sub, icon, primary) {
      return '<button class="k-btn k-btn--block k-btn--lg kl-opt' + (primary ? ' k-btn--primary' : '') + '" data-v="' + v + '">' +
        Kit.icon(icon) + '<span class="kl-opt__t"><b>' + title + '</b><small>' + sub + '</small></span></button>';
    }
    Kit.sheet({
      title: 'New deal',
      html: '<p>Every deal can be won!</p><div class="kl-opts">' +
        opt(1, 'Draw 1', 'Easier: one card at a time', 'play', cur === 1) +
        opt(3, 'Draw 3', 'Tricky: three at a time', 'star', cur === 3) +
        (game.moves ? opt('replay', 'Start this deal again', 'Same cards, fresh start', 'restart', false) : '') + '</div>',
      buttons: [{ label: 'Keep playing', value: null }],
      onOpen: function (card, close) {
        [].forEach.call(card.querySelectorAll('.kl-opt'), function (b) {
          b.addEventListener('click', function () { Kit.sfx.tap(); var v = b.getAttribute('data-v'); close(v === 'replay' ? v : +v); });
        });
      }
    }).then(function (v) {
      if (v === 1 || v === 3) newGame(v);
      else if (v === 'replay') newGame(game.draw, game.seed);
    });
  }

  /* the clock runs only while you're playing and looking */
  var lastTick = Date.now();
  setInterval(function () {
    var now = Date.now(), dt = now - lastTick;
    lastTick = now;
    if (!game || game.won || !game.moves || document.hidden || Kit.overlayOpen() || dt > 5000) return;
    game.time += dt;
    timeEl.textContent = fmt(game.time);
    if ((game.time / 1000 | 0) % 10 === 0) save();
  }, 1000);
  document.addEventListener('visibilitychange', function () { lastTick = Date.now(); if (document.hidden && game) save(); });

  var HOW = [
    { emoji: '🏠', text: 'Build the four <b>home</b> piles at the top, one per suit: Ace, 2, 3… up to King.' },
    { emoji: '🔴', text: 'In the rows, put a card on one that is <b>one higher</b> and the <b>other colour</b>: a red 6 on a black 7.' },
    { emoji: '👆', text: '<b>Tap</b> a card and it jumps to the best spot, or <b>drag</b> it where you like.' },
    { emoji: '🃏', text: 'Tap the <b>deck</b> for more cards. Only a <b>King</b> fits in an empty row.' },
    { icon: 'hint', text: 'Stuck? <b>Hint</b> shows a good move and <b>Undo</b> takes moves back. Every deal can be won!' }
  ];

  /* ---------- start ---------- */
  build();
  undoBtn.addEventListener('click', undo);
  hintBtn.addEventListener('click', hint);
  document.getElementById('new-btn').addEventListener('click', askNew);
  Kit.bindMute(document.getElementById('mute-btn'));
  Kit.bindHelp(document.getElementById('help-btn'), 'klondike', HOW);
  Kit.icons();

  /* a save we can trust: all 52 cards exactly once (old or broken saves start fresh) */
  function validState(s) {
    if (!s || !Array.isArray(s.cols) || s.cols.length !== 7 || !Array.isArray(s.down) || s.down.length !== 7 ||
        !Array.isArray(s.waste) || !Array.isArray(s.stock) || !Array.isArray(s.found) || s.found.length !== 4) return false;
    var seen = {}, n = 0;
    function add(c) { if (typeof c !== 'number' || c < 0 || c > 51 || seen[c]) return false; seen[c] = 1; n++; return true; }
    for (var i = 0; i < 7; i++) {
      if (!Array.isArray(s.cols[i]) || !(s.down[i] >= 0 && s.down[i] <= s.cols[i].length) || (s.cols[i].length && s.down[i] === s.cols[i].length)) return false;
      if (!s.cols[i].every(add)) return false;
    }
    if (!s.waste.every(add) || !s.stock.every(add)) return false;
    for (i = 0; i < 4; i++) {
      if (!(s.found[i] >= 0 && s.found[i] <= 13)) return false;
      for (var r = 1; r <= s.found[i]; r++) if (!add(KL.card(i, r))) return false;
    }
    return n === 52;
  }
  var saved = Kit.load(SAVE, null);
  if (saved && validState(saved.s) && !saved.won) {
    game = saved;
    game.draw = game.draw === 3 ? 3 : 1;
    game.moves = +game.moves || 0; game.time = +game.time || 0;
    game.hist = Array.isArray(game.hist) ? game.hist.filter(function (h) { return h && validState(h.s); }) : [];
    render(true);
  } else newGame(Kit.load('klondike.draw', 1));

  var rt = 0;
  function onResize() { clearTimeout(rt); rt = setTimeout(function () { if (game && !drag) { board.classList.add('kl-still'); render(true); board.offsetWidth; board.classList.remove('kl-still'); } }, 60); }
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(board);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  if (!Kit.overlayOpen()) Kit.howTo('klondike', HOW);

  // for tests: window.__kl.game(), .place(c), .solve()
  window.__kl = {
    game: function () { return game; },
    loc: function (c) { return loc[c]; },
    el: function (c) { return els[c]; },
    newGame: newGame, anyMove: function () { return anyMove(game.s); },
    solve: function () { var r = KL.solve(game.s, { draw: game.draw, maxNodes: 400000 }); return r.ok ? KL.expand(game.s, r.moves, game.draw) : null; }
  };
})();
