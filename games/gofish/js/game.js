/* Go Fish rules, for kids who can't read yet: every rank is a picture.
   A game state is plain JSON so it can be saved after every move:
     players  [{ name, face, bot }]   player 0 is the kid on this device
     hands    one array of cards per player, grouped by picture
     pond     the draw pile (last element is the top)
     books    one array of ranks per player (sets of four laid down)
     turn     whose turn it is
     mem      per player, the ranks they have asked for and may still hold
              (the computer friends "remember" a little, like real kids)
   Cards are the standard { s, r }; r (1-13) picks the picture. */
var GF = { SAVE_KEY: 'gofish.game', WINS_KEY: 'gofish.wins' };

/* The pictures, by rank. Tint/edge colour the card so the four of a kind
   match by colour as well as by picture. Emoji stay within Unicode 11 so
   older iPhones draw them all. */
GF.PICS = [null,
  { e: '🐳', name: 'whale',     tint: '#cfe7ff', edge: '#3a8ee6' },
  { e: '🐙', name: 'octopus',   tint: '#f3d9ff', edge: '#a64fd6' },
  { e: '🦀', name: 'crab',      tint: '#ffd9cf', edge: '#e5533a' },
  { e: '🐢', name: 'turtle',    tint: '#d6f5cf', edge: '#3aa655' },
  { e: '🐠', name: 'fish',      tint: '#fff0b3', edge: '#dba300' },
  { e: '🦈', name: 'shark',     tint: '#dee5ef', edge: '#6b7a90' },
  { e: '🐸', name: 'frog',      tint: '#e7ffc4', edge: '#62b51a' },
  { e: '🦆', name: 'duck',      tint: '#ffe6c4', edge: '#d9821c' },
  { e: '🐡', name: 'blowfish',  tint: '#f6e8cf', edge: '#ad8442' },
  { e: '🦋', name: 'butterfly', tint: '#d4f6ff', edge: '#1fa2c4' },
  { e: '🐌', name: 'snail',     tint: '#f1e0d2', edge: '#97663f' },
  { e: '🐞', name: 'ladybug',   tint: '#ffd6dd', edge: '#d63a55' },
  { e: '🦢', name: 'swan',      tint: '#e6eaff', edge: '#6d7bd6' }
];

/* Same pictures side by side, in a steady order. */
GF.sort = function (hand) {
  return hand.sort(function (a, b) { return (a.r - b.r) || (Cards.SUITS.indexOf(a.s) - Cards.SUITS.indexOf(b.s)); });
};

GF.deal = function (players) {
  var deck = Cards.shuffle(Cards.standardDeck());
  var size = players.length === 2 ? 7 : 5;
  var st = {
    players: players,
    hands: players.map(function () { return GF.sort(deck.splice(-size, size)); }),
    pond: deck, books: players.map(function () { return []; }),
    turn: 0, mem: players.map(function () { return []; })
  };
  return st;
};

GF.count = function (hand, r) { var n = 0; hand.forEach(function (c) { if (c.r === r) n++; }); return n; };
GF.has = function (st, p, r) { return GF.count(st.hands[p], r) > 0; };
GF.ranks = function (hand) {
  var out = [];
  hand.forEach(function (c) { if (out.indexOf(c.r) < 0) out.push(c.r); });
  return out;
};

function forget(st, p, r) { var i = st.mem[p].indexOf(r); if (i >= 0) st.mem[p].splice(i, 1); }

/* p asks q for rank r. Moves every card of that rank from q to p and
   returns them (empty when q has none: go fish). */
GF.ask = function (st, p, q, r) {
  forget(st, p, r);
  st.mem[p].push(r);   // everyone now knows p wants r
  var got = st.hands[q].filter(function (c) { return c.r === r; });
  if (got.length) {
    st.hands[q] = st.hands[q].filter(function (c) { return c.r !== r; });
    forget(st, q, r);
    st.hands[p] = GF.sort(st.hands[p].concat(got));
  }
  return got;
};

/* p takes the top card of the pond. Returns it, or null when it's empty. */
GF.fish = function (st, p) {
  if (!st.pond.length) return null;
  var c = st.pond.pop();
  st.hands[p].push(c);
  GF.sort(st.hands[p]);
  return c;
};

/* Lays down every set of four p holds. Returns the ranks laid down. */
GF.takeBooks = function (st, p) {
  var made = [];
  GF.ranks(st.hands[p]).forEach(function (r) {
    if (GF.count(st.hands[p], r) === 4) made.push(r);
  });
  made.forEach(function (r) {
    st.hands[p] = st.hands[p].filter(function (c) { return c.r !== r; });
    st.books[p].push(r);
    for (var k = 0; k < st.mem.length; k++) forget(st, k, r);
  });
  return made;
};

GF.totalBooks = function (st) { return st.books.reduce(function (n, b) { return n + b.length; }, 0); };
GF.over = function (st) {
  if (GF.totalBooks(st) >= 13) return true;
  if (st.pond.length) return false;
  // nothing to fish and nobody left to ask
  return st.hands.filter(function (h) { return h.length; }).length <= 1;
};
/* A player can take a turn if they hold cards or can fish one. */
GF.canPlay = function (st, p) { return st.hands[p].length > 0 || st.pond.length > 0; };
GF.nextTurn = function (st) {
  var n = st.players.length;
  for (var k = 1; k <= n; k++) {
    var p = (st.turn + k) % n;
    if (GF.canPlay(st, p)) { st.turn = p; return p; }
  }
  return -1;
};
/* Who can p ask? Anyone else still holding cards. */
GF.targets = function (st, p) {
  var out = [];
  for (var q = 0; q < st.players.length; q++) if (q !== p && st.hands[q].length) out.push(q);
  return out;
};

/* Winners: everyone tied on the most books. */
GF.winners = function (st) {
  var best = Math.max.apply(null, st.books.map(function (b) { return b.length; }));
  var out = [];
  st.books.forEach(function (b, p) { if (b.length === best) out.push(p); });
  return out;
};

/* ---- computer friends ----
   Friendly, not sharp: they only know what was said out loud, remember it
   most of the time, and otherwise ask for something they hold several of
   (or anything). They never peek. Returns { rank, target }. */
GF.botMove = function (st, p) {
  var hand = st.hands[p], targets = GF.targets(st, p);
  if (!hand.length || !targets.length) return null;
  var mine = GF.ranks(hand);
  // 1. someone asked for a picture I hold: they probably still have it
  var hunches = [];
  targets.forEach(function (q) {
    st.mem[q].forEach(function (r) { if (mine.indexOf(r) >= 0) hunches.push({ rank: r, target: q }); });
  });
  if (hunches.length && Math.random() < 0.5) return hunches[Math.floor(Math.random() * hunches.length)];
  // 2. otherwise the picture I hold most of (half the time), or any of mine
  var rank;
  if (Math.random() < 0.5) {
    var best = -1;
    Cards.shuffle(mine.slice()).forEach(function (r) { var n = GF.count(hand, r); if (n > best) { best = n; rank = r; } });
  } else {
    rank = mine[Math.floor(Math.random() * mine.length)];
  }
  return { rank: rank, target: targets[Math.floor(Math.random() * targets.length)] };
};

GF.loadWins = function () { var n = Kit.load(GF.WINS_KEY, 0); return typeof n === 'number' && n > 0 ? Math.floor(n) : 0; };

/* A saved game we can trust enough to resume (old or broken saves start fresh). */
GF.valid = function (st) {
  function cards(a) { return Array.isArray(a) && a.every(function (c) { return c && c.r >= 1 && c.r <= 13; }); }
  function list(a) { return Array.isArray(a) && a.length === st.players.length && a.every(Array.isArray); }
  return !!(st && Array.isArray(st.players) && st.players.length >= 2 && st.players.length <= 4 &&
    list(st.hands) && st.hands.every(cards) && cards(st.pond) && list(st.books) && list(st.mem) &&
    st.turn >= 0 && st.turn < st.players.length);
};
GF.addWin = function () {
  var n = GF.loadWins() + 1;
  Kit.save(GF.WINS_KEY, n);
  Kit.stat('gofish', 'Wins ' + n);
  return n;
};
