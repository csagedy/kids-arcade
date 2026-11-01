/* Klondike rules, seeded deals and a solver. Plain script that also loads in
   Node (module.exports), so tools/gen-deals.js uses the very same code to
   pre-check deals offline.

   A card is an int 0..51: suit * 13 + (rank - 1), suits in Cards.SUITS order
   S H C D, so suit & 1 is the colour (1 = red). */
var Klondike = (function () {
  var K = {};
  K.suit = function (c) { return (c / 13) | 0; };
  K.rank = function (c) { return (c % 13) + 1; };
  K.red = function (c) { return ((c / 13) | 0) & 1; };
  K.card = function (s, r) { return s * 13 + r - 1; };

  /* mulberry32: small, fast, good enough for shuffling */
  K.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* A fresh game state from a seed. cols[i] bottom..top, down[i] = how many
     at the bottom are face down. stock: last = top (drawn next). waste:
     last = top. found[s] = how many of suit s are home. */
  K.deal = function (seed) {
    var rnd = K.rng(seed), d = [];
    for (var i = 0; i < 52; i++) d.push(i);
    for (i = 51; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t; }
    var cols = [[], [], [], [], [], [], []], down = [], n = 0;
    for (var row = 0; row < 7; row++) for (var c = row; c < 7; c++) cols[c].push(d[n++]);
    for (c = 0; c < 7; c++) down.push(c);
    return { cols: cols, down: down, stock: d.slice(n), waste: [], found: [0, 0, 0, 0] };
  };

  K.clone = function (s) {
    return { cols: s.cols.map(function (c) { return c.slice(); }), down: s.down.slice(), stock: s.stock.slice(), waste: s.waste.slice(), found: s.found.slice() };
  };

  /* ---------- rules ---------- */
  K.canFound = function (s, c) { return s.found[K.suit(c)] === K.rank(c) - 1; };
  /* can `c` (the bottom of a run) go onto column j? */
  K.canStack = function (s, c, j) {
    var col = s.cols[j];
    if (!col.length) return K.rank(c) === 13;
    var t = col[col.length - 1];
    return K.rank(t) === K.rank(c) + 1 && K.red(t) !== K.red(c);
  };
  /* is cols[i] from index h a movable run (face up, alternating, descending)? */
  K.isRun = function (s, i, h) {
    var col = s.cols[i];
    if (h < s.down[i] || h >= col.length) return false;
    for (var k = h + 1; k < col.length; k++) {
      if (K.rank(col[k - 1]) !== K.rank(col[k]) + 1 || K.red(col[k - 1]) === K.red(col[k])) return false;
    }
    return true;
  };
  K.won = function (s) { return s.found[0] + s.found[1] + s.found[2] + s.found[3] === 52; };
  K.allUp = function (s) { for (var i = 0; i < 7; i++) if (s.down[i]) return false; return true; };


  /* ---------- playing (the real game, with a real stock) ----------
     A place is { pile: 'col', i, h } | { pile: 'waste' } | { pile: 'found', i }.
     K.draw / K.move change s in place and return a little report for the
     screen, or null if the move isn't allowed. */
  K.draw = function (s, n) {
    if (!s.stock.length) {
      if (!s.waste.length) return null;
      s.stock = s.waste.reverse(); s.waste = [];
      return { recycled: true };
    }
    var took = [];
    for (var i = 0; i < n && s.stock.length; i++) { var c = s.stock.pop(); s.waste.push(c); took.push(c); }
    return { drew: took };
  };

  /* the cards a place would pick up */
  K.cardsAt = function (s, from) {
    if (from.pile === 'waste') return s.waste.length ? [s.waste[s.waste.length - 1]] : [];
    if (from.pile === 'found') return s.found[from.i] ? [K.card(from.i, s.found[from.i])] : [];
    if (!K.isRun(s, from.i, from.h)) return [];
    return s.cols[from.i].slice(from.h);
  };

  K.legal = function (s, from, to) {
    var cs = K.cardsAt(s, from);
    if (!cs.length) return false;
    if (to.pile === 'found') return cs.length === 1 && K.suit(cs[0]) === to.i && K.canFound(s, cs[0]) && from.pile !== 'found';
    if (to.pile === 'col') return !(from.pile === 'col' && from.i === to.i) && K.canStack(s, cs[0], to.i);
    return false;
  };

  K.move = function (s, from, to) {
    if (!K.legal(s, from, to)) return null;
    var cs, flipped = -1;
    if (from.pile === 'waste') cs = [s.waste.pop()];
    else if (from.pile === 'found') { cs = [K.card(from.i, s.found[from.i])]; s.found[from.i]--; }
    else {
      cs = s.cols[from.i].splice(from.h);
      var col = s.cols[from.i];
      if (col.length && s.down[from.i] >= col.length) { s.down[from.i] = col.length - 1; flipped = from.i; }
    }
    if (to.pile === 'found') s.found[to.i]++;
    else for (var k = 0; k < cs.length; k++) s.cols[to.i].push(cs[k]);
    return { cards: cs, flipped: flipped };
  };

  /* Where would a tap send the cards at `from`? Home first (a single card),
     then a column that already has cards, then an empty column for a king
     (unless it is already sitting at the bottom of an otherwise empty one). */
  K.bestTarget = function (s, from) {
    var cs = K.cardsAt(s, from);
    if (!cs.length) return null;
    var c = cs[0];
    if (cs.length === 1 && from.pile !== 'found' && K.canFound(s, c)) return { pile: 'found', i: K.suit(c) };
    var start = from.pile === 'col' ? from.i : -1, empty = null;
    for (var d = 1; d <= 7; d++) {
      var j = (Math.max(start, 0) + d) % 7;
      if (j === start || !K.canStack(s, c, j)) continue;
      if (s.cols[j].length) return { pile: 'col', i: j };
      if (!empty) empty = { pile: 'col', i: j };
    }
    if (empty && from.pile === 'col' && from.h === 0) return null;
    return empty;
  };

  /* Turn solver moves into real taps, including the draws they skip over. */
  K.expand = function (state, moves, draw) {
    var s = K.clone(state), out = [];
    for (var x = 0; x < moves.length; x++) {
      var m = moves[x], from, to;
      if (m.t === 'sf' || m.t === 'st') {
        var guard = 0;
        while (s.waste.length - 1 !== m.k) {
          if (++guard > 200) throw new Error('stock card unreachable');
          K.draw(s, draw); out.push({ op: 'draw' });
        }
        from = { pile: 'waste' };
        to = m.t === 'sf' ? { pile: 'found', i: K.suit(s.waste[s.waste.length - 1]) } : { pile: 'col', i: m.j };
      } else if (m.t === 'tf') {
        from = { pile: 'col', i: m.i, h: s.cols[m.i].length - 1 };
        to = { pile: 'found', i: K.suit(s.cols[m.i][s.cols[m.i].length - 1]) };
      } else { from = { pile: 'col', i: m.i, h: m.h }; to = { pile: 'col', i: m.j }; }
      if (!K.move(s, from, to)) throw new Error('illegal solver move ' + JSON.stringify(m));
      out.push({ op: 'move', from: from, to: to });
    }
    if (!K.won(s)) throw new Error('solution does not win');
    return out;
  };

  /* Can every remaining card simply go home now? (all face up, and the
     stock cards reachable in time). Returns the list of steps or null. */
  K.finishPlan = function (state, draw) {
    if (!K.allUp(state)) return null;
    var s = K.clone(state), steps = [], guard = 0;
    while (!K.won(s)) {
      if (++guard > 400) return null;
      var moved = false;
      for (var i = 0; i < 7 && !moved; i++) {
        var col = s.cols[i];
        if (col.length && K.canFound(s, col[col.length - 1])) {
          var f = { pile: 'col', i: i, h: col.length - 1 }, t = { pile: 'found', i: K.suit(col[col.length - 1]) };
          K.move(s, f, t); steps.push({ op: 'move', from: f, to: t }); moved = true;
        }
      }
      if (moved) continue;
      if (s.waste.length && K.canFound(s, s.waste[s.waste.length - 1])) {
        var t2 = { pile: 'found', i: K.suit(s.waste[s.waste.length - 1]) };
        K.move(s, { pile: 'waste' }, t2); steps.push({ op: 'move', from: { pile: 'waste' }, to: t2 }); continue;
      }
      if (!K.draw(s, draw)) return null;
      steps.push({ op: 'draw' });
    }
    return steps;
  };

  /* ---------- solver ----------
     Depth-first search over a compressed stock: the stock and waste become
     one list D in the order cards are reached, with p = cards in the waste.
     A "stock move" plays D[k-1] for any k reachable by drawing (unlimited
     redeals), so many draws collapse into one move. Columns are sorted for
     the transposition key since which column holds a pile doesn't matter.
     Returns { ok, moves, nodes, complete } where complete means the search
     ran out of moves rather than out of budget. moves are
       { t: 'tf', i }        column i top -> foundation
       { t: 'tt', i, h, j }  column i from h -> column j
       { t: 'sf', k }        stock card D[k] -> foundation
       { t: 'st', k, j }     stock card D[k] -> column j
     with k an index into the compressed list at that moment. */
  function toS(s) {
    return { cols: s.cols.map(function (c) { return c.slice(); }), down: s.down.slice(), found: s.found.slice(),
      D: s.waste.concat(s.stock.slice().reverse()), p: s.waste.length };
  }

  /* waste lengths reachable from p by drawing `draw` at a time, forever */
  function reach(n, p, draw) {
    var out = [], seen = {}, q = p, guard = 0;
    if (q > 0) out.push(q);
    seen[q] = 1;
    while (guard++ < 200) {
      if (q >= n) q = 0;
      q = Math.min(q + draw, n);
      if (seen[q]) break;
      seen[q] = 1;
      if (q > 0) out.push(q);
    }
    return out;
  }
  K.reach = reach;

  K.solve = function (state, opts) {
    opts = opts || {};
    var draw = opts.draw || 1, maxNodes = opts.maxNodes || 200000;
    var deadline = opts.maxMs ? Date.now() + opts.maxMs : 0;
    var S = toS(state), seen = new Set(), nodes = 0, out = false, path = [];
    var R = [], SU = [], RED = [];
    for (var c = 0; c < 52; c++) { R[c] = c % 13 + 1; SU[c] = (c / 13) | 0; RED[c] = SU[c] & 1; }

    function key() {
      var ks = [];
      for (var i = 0; i < 7; i++) ks.push(String.fromCharCode(65 + S.down[i]) + String.fromCharCode.apply(null, S.cols[i].map(function (x) { return x + 48; })));
      ks.sort();
      return ks.join('.') + '|' + String.fromCharCode.apply(null, S.D.map(function (x) { return x + 48; })) + (draw > 1 ? '|' + S.p : '');
    }
    function fits(c, j) {
      var col = S.cols[j];
      if (!col.length) return R[c] === 13;
      var t = col[col.length - 1];
      return R[t] === R[c] + 1 && RED[t] !== RED[c];
    }
    function safe(c) {
      var r = R[c];
      if (r <= 2) return true;
      var o = RED[c] ? [0, 2] : [1, 3];
      return S.found[o[0]] >= r - 1 && S.found[o[1]] >= r - 1;
    }
    // Apply / undo a move; returns an undo record.
    function apply(m) {
      var u = { m: m, flip: -1, p: S.p };
      var i, col, c;
      if (m.t === 'tf') {
        col = S.cols[m.i]; c = col.pop(); u.c = c; S.found[SU[c]]++;
        if (col.length && S.down[m.i] === col.length) { S.down[m.i]--; u.flip = m.i; }
      } else if (m.t === 'tt') {
        col = S.cols[m.i];
        var run = col.splice(m.h);
        for (i = 0; i < run.length; i++) S.cols[m.j].push(run[i]);
        u.n = run.length;
        if (col.length && S.down[m.i] === col.length) { S.down[m.i]--; u.flip = m.i; }
      } else {
        c = S.D.splice(m.k, 1)[0]; u.c = c; S.p = m.k;
        if (m.t === 'sf') S.found[SU[c]]++; else S.cols[m.j].push(c);
      }
      return u;
    }
    function undo(u) {
      var m = u.m, c;
      if (u.flip >= 0) S.down[u.flip]++;
      if (m.t === 'tf') {
        S.found[SU[u.c]]--; S.cols[m.i].push(u.c);
      } else if (m.t === 'tt') {
        var run = S.cols[m.j].splice(S.cols[m.j].length - u.n);
        for (var i = 0; i < run.length; i++) S.cols[m.i].push(run[i]);
      } else {
        if (m.t === 'sf') S.found[SU[u.c]]--; else S.cols[m.j].pop();
        S.D.splice(m.k, 0, u.c); S.p = u.p;
      }
    }

    function gen() {
      var mv = [], i, j, col, h, top, c, n = S.D.length;
      // stock cards reachable now
      var ks = draw === 1 ? null : reach(n, S.p, draw);
      var stockIdx = [];
      if (draw === 1) { for (i = n - 1; i >= 0; i--) stockIdx.push(i); }
      else ks.forEach(function (k) { stockIdx.push(k - 1); });
      // forced safe moves
      for (i = 0; i < 7; i++) {
        col = S.cols[i];
        if (col.length) { top = col[col.length - 1]; if (S.found[SU[top]] === R[top] - 1 && safe(top)) return [{ t: 'tf', i: i, c: top, forced: 1 }]; }
      }
      for (j = 0; j < stockIdx.length; j++) {
        c = S.D[stockIdx[j]];
        if (S.found[SU[c]] === R[c] - 1 && safe(c) && (draw === 1 || stockIdx[j] === S.p - 1)) return [{ t: 'sf', k: stockIdx[j], c: c, forced: 1 }];
      }
      var a = [], b = [], d = [], e = [];
      for (i = 0; i < 7; i++) {
        col = S.cols[i];
        if (!col.length) continue;
        top = col[col.length - 1];
        var dn = S.down[i];
        if (S.found[SU[top]] === R[top] - 1) {
          (col.length - 1 === dn && dn > 0 ? a : d).push({ t: 'tf', i: i, c: top, pr: dn });
        }
        // find the start of the face-up run
        for (h = dn; h < col.length; h++) {
          if (!K.isRunFast(col, h, R, RED)) continue;
          c = col[h];
          for (j = 0; j < 7; j++) {
            if (j === i || !fits(c, j)) continue;
            if (h === dn) {
              if (dn === 0 && !S.cols[j].length) continue;      // whole pile to an empty column: pointless
              (dn > 0 ? a : b).push({ t: 'tt', i: i, h: h, j: j, pr: dn + (S.cols[j].length ? 0 : -0.5) });
            } else {
              // partial run: only to free the card under it for the foundation
              var under = col[h - 1];
              if (S.found[SU[under]] === R[under] - 1) e.push({ t: 'tt', i: i, h: h, j: j, pr: 0 });
            }
            if (!S.cols[j].length) break;   // one empty column is as good as another
          }
          break;
        }
      }
      for (var x = 0; x < stockIdx.length; x++) {
        var k = stockIdx[x]; c = S.D[k];
        if (S.found[SU[c]] === R[c] - 1) d.push({ t: 'sf', k: k, c: c, pr: 0 });
        for (j = 0; j < 7; j++) {
          if (fits(c, j)) { b.push({ t: 'st', k: k, j: j, c: c, pr: -1 + (k === S.p - 1 ? 0.5 : 0) }); if (!S.cols[j].length) break; }
        }
      }
      a.sort(function (p, q) { return q.pr - p.pr; });
      b.sort(function (p, q) { return q.pr - p.pr; });
      return mv.concat(a, b, d, e);
    }

    function dfs() {
      if (out) return false;
      if (S.found[0] + S.found[1] + S.found[2] + S.found[3] === 52) return true;
      if (++nodes > maxNodes || (deadline && (nodes & 255) === 0 && Date.now() > deadline)) { out = true; return false; }
      var moves = gen();
      if (!(moves.length === 1 && moves[0].forced)) {
        var k = key();
        if (seen.has(k)) return false;
        seen.add(k);
      }
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i];
        var u = apply(m);
        path.push(m);
        if (dfs()) return true;
        path.pop();
        undo(u);
        if (out) return false;
      }
      return false;
    }
    var ok = dfs();
    return { ok: ok, moves: ok ? path.slice() : null, nodes: nodes, complete: !ok && !out };
  };

  K.isRunFast = function (col, h, R, RED) {
    for (var k = h + 1; k < col.length; k++) if (R[col[k - 1]] !== R[col[k]] + 1 || RED[col[k - 1]] === RED[col[k]]) return false;
    return true;
  };

  /* Translate a solver move into "what to tap" for a hint, given the real
     state: returns { kind: 'draw' } or { kind: 'move', from, h, to }. */
  K.hintFrom = function (s, m) {
    if (m.t === 'tf') return { kind: 'move', from: { pile: 'col', i: m.i, h: s.cols[m.i].length - 1 }, to: { pile: 'found', i: K.suit(s.cols[m.i][s.cols[m.i].length - 1]) } };
    if (m.t === 'tt') return { kind: 'move', from: { pile: 'col', i: m.i, h: m.h }, to: { pile: 'col', i: m.j } };
    if (m.k === s.waste.length - 1) {
      var c = s.waste[s.waste.length - 1];
      return { kind: 'move', from: { pile: 'waste' }, to: m.t === 'sf' ? { pile: 'found', i: K.suit(c) } : { pile: 'col', i: m.j } };
    }
    return { kind: 'draw' };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = K;
  return K;
})();
