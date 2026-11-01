/* Crazy Eights rules. A game state is plain JSON so it can be saved after
   every move:
     players  [{ name, face, bot }]
     hands    one sorted array of cards per player
     deck     draw pile (last element is the top)
     pile     discard pile (last element is the top)
     suit     the suit to match (an eight changes it)
     turn     whose turn; dir 1 or -1
     drew     the current player has drawn this turn
     passes   turns in a row that ended without a play (stalemate check)
     party    party rules: 2 = next player draws two, Q = skip, A = reverse
     clever   computer players think ahead a little */
var C8 = { SAVE_KEY: 'crazy8.game', WINS_KEY: 'crazy8.wins', OPTS_KEY: 'crazy8.opts' };

C8.deal = function (players, opts) {
  var deck = Cards.shuffle(Cards.standardDeck());
  var size = players.length === 2 ? 7 : 5;
  var hands = players.map(function () { return Cards.sort(deck.splice(-size, size)); });
  // An eight can't start the pile; bury it and turn the next card.
  var start = deck.pop();
  while (start.r === 8) { deck.unshift(start); start = deck.pop(); }
  return {
    players: players, hands: hands, deck: deck, pile: [start], suit: start.s,
    turn: 0, dir: 1, drew: false, passes: 0, party: !!opts.party, clever: !!opts.clever
  };
};

C8.top = function (st) { return st.pile[st.pile.length - 1]; };

C8.canPlay = function (st, c) { return c.r === 8 || c.s === st.suit || c.r === C8.top(st).r; };

C8.playable = function (st, p) {
  var out = [];
  st.hands[p].forEach(function (c, i) { if (C8.canPlay(st, c)) out.push(i); });
  return out;
};

C8.next = function (st, from, steps) {
  var n = st.players.length;
  return (((from + st.dir * (steps || 1)) % n) + n) % n;
};

/* What a card does under party rules. */
C8.effect = function (st, c) {
  if (!st.party) return null;
  if (c.r === 2) return 'draw2';
  if (c.r === 12) return 'skip';
  if (c.r === 1) return st.players.length === 2 ? 'skip' : 'reverse';
  return null;
};

/* Move card i from player p's hand to the pile. `suit` is the choice for an
   eight. Returns the card's party effect (or null). */
C8.play = function (st, p, i, suit) {
  var c = st.hands[p].splice(i, 1)[0];
  st.pile.push(c);
  st.suit = c.r === 8 ? (suit || c.s) : c.s;
  st.passes = 0;
  return C8.effect(st, c);
};

/* Draw one card for player p, shuffling the discards back in when the deck
   runs out. Returns { card, shuffled } or null when there is nothing left. */
C8.drawOne = function (st, p) {
  var shuffled = false;
  if (!st.deck.length && st.pile.length > 1) {
    var top = st.pile.pop();
    st.deck = Cards.shuffle(st.pile);
    st.pile = [top];
    shuffled = true;
  }
  if (!st.deck.length) return null;
  var c = st.deck.pop();
  st.hands[p].push(c);
  Cards.sort(st.hands[p]);
  return { card: c, shuffled: shuffled };
};

/* End the current turn. `played` false counts towards a stalemate. */
C8.endTurn = function (st, effect, played) {
  if (!played) st.passes++;
  if (effect === 'reverse') st.dir = -st.dir;
  st.turn = C8.next(st, st.turn, effect === 'skip' || effect === 'draw2' ? 2 : 1);
  st.drew = false;
};

C8.winner = function (st) {
  for (var p = 0; p < st.hands.length; p++) if (!st.hands[p].length) return p;
  return -1;
};

/* Nobody can play and there's nothing left to draw: fewest cards wins. */
C8.stuck = function (st) {
  return st.passes >= st.players.length * 2 && !st.deck.length && st.pile.length <= 1;
};
C8.fewest = function (st) {
  var best = 0;
  for (var p = 1; p < st.hands.length; p++) if (st.hands[p].length < st.hands[best].length) best = p;
  return best;
};

/* ---- computer player ---- */

C8.bestSuit = function (hand) {
  var n = { S: 0, H: 0, C: 0, D: 0 }, best = null;
  hand.forEach(function (c) { if (c.r !== 8) n[c.s]++; });
  Cards.shuffle(Cards.SUITS.slice()).forEach(function (s) { if (!best || n[s] > n[best]) best = s; });
  return best;
};

/* { i, suit } to play, or null to draw. */
C8.botMove = function (st, p) {
  var hand = st.hands[p], options = C8.playable(st, p);
  if (!options.length) return null;
  var pick;
  if (!st.clever) {
    pick = options[Math.floor(Math.random() * options.length)];
  } else {
    var nextCount = st.hands[C8.next(st, p)].length;
    var bestScore = -1e9;
    options.forEach(function (i) {
      var c = hand[i], score;
      if (c.r === 8) {
        score = hand.length === 1 ? 100 : -50;   // save eights for when they're needed
      } else {
        // keep the suit we hold most of in play
        score = 0;
        hand.forEach(function (o, j) { if (j !== i && o.s === c.s && o.r !== 8) score += 2; });
        score += c.r / 20;
        var fx = C8.effect(st, c);
        if (fx && nextCount <= 2) score += 20;    // slow down someone about to win
        else if (fx) score += 1;
      }
      if (score > bestScore) { bestScore = score; pick = i; }
    });
  }
  var rest = hand.filter(function (c, j) { return j !== pick; });
  var suit = hand[pick].r === 8 ? (st.clever || Math.random() < 0.6 ? C8.bestSuit(rest) || hand[pick].s : Cards.SUITS[Math.floor(Math.random() * 4)]) : null;
  return { i: pick, suit: suit };
};

C8.loadWins = function () { var n = Cards.load(C8.WINS_KEY, 0); return typeof n === 'number' && n > 0 ? Math.floor(n) : 0; };

/* A saved game we can trust enough to resume (old or broken saves start fresh). */
C8.valid = function (st) {
  function cards(a) { return Array.isArray(a) && a.every(function (c) { return c && Cards.SUITS.indexOf(c.s) >= 0 && c.r >= 1 && c.r <= 13; }); }
  return !!(st && Array.isArray(st.players) && st.players.length >= 2 && st.players.length <= 4 &&
    Array.isArray(st.hands) && st.hands.length === st.players.length && st.hands.every(cards) &&
    cards(st.deck) && cards(st.pile) && st.pile.length && Cards.SUITS.indexOf(st.suit) >= 0 &&
    st.turn >= 0 && st.turn < st.players.length && (st.dir === 1 || st.dir === -1));
};
C8.addWin = function () {
  var n = C8.loadWins() + 1;
  Cards.save(C8.WINS_KEY, n);
  Cards.stat('crazy8', 'Wins ' + n);
  return n;
};
