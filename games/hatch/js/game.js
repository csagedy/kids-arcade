/* Hatch Match — rules, deck, computer friends. No DOM in this file.

   DESIGN NOTE
   Theme: a nest of eggs. Four critters, each with its own colour: red
   Dragon, yellow Duck, green Dino, blue Turtle. Every critter card is one of
   three stages, shown as a picture rather than a number: Egg (1 dot),
   Hatching (2 dots: the head popping out of a cracked shell) and Grown
   (3 dots).

   Deck (68 cards):
     48 critters  4 colours x 3 stages x 4 copies
      8 Munch +2  2 per colour
      4 Storm     1 per colour
      4 Nap       1 per colour
      4 Chameleon wild
   Deal 7 each; 2-4 players; turns always go to the left (next seat).

   Play a card that matches the top card's COLOUR or its STAGE (egg on egg,
   grown on grown); a special also matches the same special. No match? Tap
   the deck for one card; if it fits you may play it. First to empty their
   hand wins.

   The twist — GROW: after you play a critter, if you also hold the same
   critter's next stage (egg -> hatching -> grown), you may play that too,
   in the same turn. A full egg-hatch-grown run sheds three cards at once.

   Specials:
     Munch +2   the next friend takes 2 cards ... unless they play a Munch of
                their own, which passes the hungry pile on (+4, +6 ...).
     Storm      whoosh! Every hand blows to the next friend at once.
     Nap        the next friend falls asleep and misses a turn.
     Chameleon  wild: play it on anything and pick the new colour.

   Why it's fun for 5-10 year olds: pictures not numbers (egg / hatching /
   grown reads at a glance and doubles as a tiny life-cycle lesson); the Grow
   run gives a big "three cards at once!" moment; Munch stacking and Storm
   make sudden, laughing turnarounds where nobody is safely ahead; only four
   specials, each a single picture. A round lasts 3-6 minutes.

   How it differs from existing games: no numbers, no reverse, no "call it
   when you have one card"; matching is by colour or life stage, and the Grow
   run (playing a same-critter sequence in one turn) is its own mechanic.
   Storm passes every hand along at once; Munch is the only stacking card.
   Names, deck, art and specials are original.
*/
var HM = (function () {
  'use strict';
  var H = {};

  H.COLORS = ['red', 'yellow', 'green', 'blue'];
  H.CRITTER = ['Dragon', 'Duck', 'Dino', 'Turtle'];
  H.STAGE = ['', 'Egg', 'Hatching', 'Grown'];
  H.HAND = 7;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  H.shuffle = shuffle;

  /* A card: { id, t: 'c' critter | 'munch' | 'storm' | 'nap' | 'wild', c: colour 0-3 (-1 wild), s: stage 1-3 } */
  H.deck = function () {
    var d = [], id = 0;
    for (var c = 0; c < 4; c++) {
      for (var s = 1; s <= 3; s++) for (var k = 0; k < 4; k++) d.push({ id: id++, t: 'c', c: c, s: s });
      d.push({ id: id++, t: 'munch', c: c }, { id: id++, t: 'munch', c: c });
      d.push({ id: id++, t: 'storm', c: c });
      d.push({ id: id++, t: 'nap', c: c });
      d.push({ id: id++, t: 'wild', c: -1 });
    }
    return d;
  };

  /* players: [{ name, face, bot }] ; level 'easy' | 'clever' */
  H.newGame = function (players, level) {
    var deck = shuffle(H.deck());
    var st = {
      v: 1, level: level || 'easy',
      players: players.map(function (p) { return { name: p.name, face: p.face, bot: !!p.bot, hand: [] }; }),
      deck: deck, pile: [], color: 0, turn: 0, munch: 0,
      phase: 'play', chain: null, drawn: null, winner: -1, moves: 0
    };
    for (var r = 0; r < H.HAND; r++) st.players.forEach(function (p) { p.hand.push(st.deck.pop()); });
    // Start on a plain critter so the first turn is never a surprise.
    var i = st.deck.length - 1;
    while (st.deck[i].t !== 'c') i--;
    var first = st.deck.splice(i, 1)[0];
    st.pile.push(first);
    st.color = first.c;
    st.turn = Math.floor(Math.random() * st.players.length);
    if (!players[st.turn].bot && players.some(function (p) { return p.bot; })) st.turn = 0;
    return st;
  };

  H.top = function (st) { return st.pile[st.pile.length - 1]; };
  H.next = function (st, i, k) { var n = st.players.length; return (((i === undefined ? st.turn : i) + (k || 1)) % n + n) % n; };
  H.prev = function (st, i) { return H.next(st, i, -1); };
  H.find = function (hand, id) { for (var i = 0; i < hand.length; i++) if (hand[i].id === id) return i; return -1; };

  /* Can this card go on the pile right now? */
  H.canPlay = function (st, card) {
    if (st.phase === 'over') return false;
    if (st.phase === 'chain') return card.t === 'c' && card.c === st.chain.c && card.s === st.chain.s + 1;
    if (st.phase === 'drawn' && card.id !== st.drawn) return false;
    if (st.munch > 0) return card.t === 'munch';
    if (card.t === 'wild') return true;
    if (card.c === st.color) return true;
    var top = H.top(st);
    if (card.t === 'c') return top.t === 'c' && top.s === card.s;
    return card.t === top.t;
  };
  H.playable = function (st, pi) {
    return st.players[pi === undefined ? st.turn : pi].hand.filter(function (c) { return H.canPlay(st, c); });
  };

  /* Draw n cards for player pi; reshuffles the pile under the top card into
     the deck when it runs out. Returns { cards, reshuffled }. */
  H.draw = function (st, pi, n) {
    var got = [], re = false;
    for (var k = 0; k < n; k++) {
      if (!st.deck.length) {
        if (st.pile.length <= 1) break;
        var top = st.pile.pop();
        st.pile.forEach(function (c) { delete c.pick; });
        st.deck = shuffle(st.pile);
        st.pile = [top];
        re = true;
      }
      var c = st.deck.pop();
      st.players[pi].hand.push(c);
      got.push(c);
    }
    return { cards: got, reshuffled: re };
  };

  /* The current player plays card id. color: chosen colour for a chameleon.
     Applies everything and returns what happened for the screen:
       { card, win, grow: bool (may play the next stage), stage (1-3 in a run) }
     After it, the screen calls H.endTurn unless grow is offered. */
  H.play = function (st, id, color) {
    var p = st.players[st.turn], i = H.find(p.hand, id);
    if (i < 0) return null;
    var card = p.hand[i];
    if (!H.canPlay(st, card)) return null;
    p.hand.splice(i, 1);
    st.pile.push(card);
    st.moves++;
    var wasChain = st.phase === 'chain';
    st.drawn = null;
    st.color = card.t === 'wild' ? (color >= 0 ? color : 0) : card.c;
    if (card.t === 'wild') card.pick = st.color;   // remembered on the pile for drawing
    var out = { card: card, win: false, grow: false, run: wasChain ? st.chain.run + 1 : 1 };
    if (!p.hand.length) {
      st.phase = 'over'; st.winner = st.turn; st.chain = null;
      out.win = true;
      return out;
    }
    st.phase = 'play'; st.chain = null;
    if (card.t === 'munch') st.munch += 2;
    if (card.t === 'c' && card.s < 3) {
      var more = p.hand.some(function (h) { return h.t === 'c' && h.c === card.c && h.s === card.s + 1; });
      if (more) {
        st.phase = 'chain';
        st.chain = { c: card.c, s: card.s, run: out.run };
        out.grow = true;
      }
    }
    return out;
  };

  /* Storm: every hand moves to the next seat. */
  H.storm = function (st) {
    var hands = st.players.map(function (p) { return p.hand; });
    st.players.forEach(function (p, i) { p.hand = hands[H.prev(st, i)]; });
  };

  /* Ends the current turn; played: the turn ended on a card the player put
     down (so its effect happens), not on a draw.
     Returns { skipped: index or -1, storm: bool }. */
  H.endTurn = function (st, played) {
    var top = H.top(st), res = { skipped: -1, storm: false };
    st.phase = 'play'; st.chain = null; st.drawn = null;
    if (played && top.t === 'storm') { H.storm(st); res.storm = true; }
    var nx = H.next(st);
    if (played && top.t === 'nap') { res.skipped = nx; nx = H.next(st, nx); }
    st.turn = nx;
    return res;
  };
  /* Draw for the turn: with a Munch pending take them all and the turn ends;
     otherwise one card, which may be played straight away if it fits. */
  H.drawTurn = function (st) {
    var pi = st.turn;
    if (st.munch > 0) {
      var n = st.munch;
      st.munch = 0;
      var r = H.draw(st, pi, n);
      r.munched = n;
      r.canPlay = false;
      return r;
    }
    var d = H.draw(st, pi, 1);
    d.canPlay = false;
    if (d.cards.length) {
      st.phase = 'drawn'; st.drawn = d.cards[0].id;
      d.canPlay = H.canPlay(st, d.cards[0]);
      if (!d.canPlay) { st.phase = 'play'; st.drawn = null; }
    }
    return d;
  };

  /* ---------- computer friends ---------- */
  function countColors(hand) {
    var n = [0, 0, 0, 0];
    hand.forEach(function (c) { if (c.c >= 0) n[c.c]++; });
    return n;
  }
  H.bestColor = function (hand, level) {
    if (level === 'easy') return Math.floor(Math.random() * 4);
    var n = countColors(hand), best = 0;
    for (var i = 1; i < 4; i++) if (n[i] > n[best]) best = i;
    return best;
  };
  function runLength(hand, card) {
    var len = 0, s = card.s;
    while (hand.some(function (h) { return h.t === 'c' && h.c === card.c && h.s === s + 1; })) { len++; s++; }
    return len;
  }

  /* What should the computer do? -> { play: id, color } or { draw: true } */
  H.botMove = function (st) {
    var pi = st.turn, me = st.players[pi], legal = H.playable(st, pi);
    if (!legal.length) return { draw: true };
    var pick;
    if (st.level === 'easy') {
      if (st.phase === 'chain' && Math.random() < 0.4) return { stop: true };
      if (st.munch > 0 && Math.random() < 0.3) return { draw: true };
      pick = legal[Math.floor(Math.random() * legal.length)];
      return { play: pick.id, color: H.bestColor(me.hand, 'easy') };
    }
    if (st.phase === 'chain' || st.phase === 'drawn' || st.munch > 0) {
      pick = legal[0];
      return { play: pick.id, color: H.bestColor(me.hand.filter(function (c) { return c.id !== pick.id; }), 'clever') };
    }
    var nx = st.players[H.next(st, pi)].hand.length;
    var pv = st.players[H.prev(st, pi)].hand.length;
    var colors = countColors(me.hand), best = null, bestScore = -1e9;
    legal.forEach(function (c) {
      var sc = 0;
      if (c.t === 'c') sc = 10 + runLength(me.hand, c) * 9 + colors[c.c] * 1.5 + (c.s === 1 ? 1 : 0);
      else if (c.t === 'munch') sc = 12 + (nx <= 2 ? 16 : 0) + colors[c.c];
      else if (c.t === 'nap') sc = 11 + (nx <= 2 ? 16 : 0) + colors[c.c];
      else if (c.t === 'storm') {
        var after = me.hand.length - 1;   // what I hand on vs what I get
        sc = after > pv ? 14 + (after - pv) * 5 : -40;
      } else if (c.t === 'wild') sc = me.hand.length <= 2 ? 40 : 2;
      sc += Math.random() * 2;
      if (sc > bestScore) { bestScore = sc; best = c; }
    });
    if (bestScore < 0) return { draw: true };
    var rest = me.hand.filter(function (c) { return c.id !== best.id; });
    return { play: best.id, color: H.bestColor(rest, 'clever') };
  };

  /* Saved games from a future/older shape are dropped rather than crashing. */
  H.valid = function (st) {
    function cards(a) { return Array.isArray(a) && a.every(function (c) { return c && typeof c.id === 'number' && typeof c.t === 'string'; }); }
    return !!(st && st.v === 1 && Array.isArray(st.players) && st.players.length >= 2 && st.players.length <= 4 &&
      st.players.every(function (p) { return p && cards(p.hand); }) && cards(st.pile) && st.pile.length && cards(st.deck) &&
      st.turn >= 0 && st.turn < st.players.length && ['play', 'chain', 'drawn'].indexOf(st.phase) >= 0 &&
      (st.phase !== 'chain' || !!st.chain));
  };

  return H;
})();
if (typeof module !== 'undefined') module.exports = HM;
