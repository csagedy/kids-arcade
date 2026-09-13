/* Memory Match rules. Cards are a shuffled list of pair ids; the UI flips two,
   asks the game whether they match, and the game keeps the tally. The deck
   in play is saved so a half-finished board comes back after a relaunch. */

var MM_SIZES = [
  { id: 'easy',   name: 'Easy',   cols: 3, rows: 4 },   // 6 pairs
  { id: 'medium', name: 'Medium', cols: 4, rows: 4 },   // 8 pairs
  { id: 'hard',   name: 'Hard',   cols: 4, rows: 6 }    // 12 pairs
];

var MM_EMOJI = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
  '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝', '🦋', '🐢', '🐙', '🦀',
  '🍎', '🍌', '🍇', '🍓', '🍒', '🍕', '🍩', '🍪', '⚽', '🚗', '🚀', '⭐'
];

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function MMGame(sizeId, saved) {
  this.size = MM_SIZES.filter(function (s) { return s.id === sizeId; })[0] || MM_SIZES[0];
  if (saved && this.restore(saved)) return;
  var pairs = this.size.cols * this.size.rows / 2;
  var pool = shuffle(MM_EMOJI.slice()).slice(0, pairs);
  this.cards = shuffle(pool.concat(pool));   // emoji per position
  this.matched = this.cards.map(function () { return false; });
  this.moves = 0;
  this.open = [];   // indices currently face up (0..2)
}

MMGame.SAVE_KEY = 'mm.game';

MMGame.prototype.restore = function (s) {
  if (!s || !s.cards || s.cards.length !== this.size.cols * this.size.rows) return false;
  this.cards = s.cards; this.matched = s.matched; this.moves = s.moves | 0; this.open = [];
  return true;
};

MMGame.prototype.save = function () {
  try {
    localStorage.setItem(MMGame.SAVE_KEY, JSON.stringify({
      size: this.size.id, cards: this.cards, matched: this.matched, moves: this.moves
    }));
  } catch (e) {}
};

MMGame.loadSaved = function () {
  try { return JSON.parse(localStorage.getItem(MMGame.SAVE_KEY)); } catch (e) { return null; }
};

MMGame.clearSaved = function () { try { localStorage.removeItem(MMGame.SAVE_KEY); } catch (e) {} };

/* Flip card i. Returns 'ignore', 'first', 'match' or 'miss'. On a miss the UI
   shows both for a moment then calls hideOpen(). */
MMGame.prototype.flip = function (i) {
  if (this.matched[i] || this.open.indexOf(i) >= 0 || this.open.length >= 2) return 'ignore';
  this.open.push(i);
  if (this.open.length < 2) return 'first';
  this.moves++;
  var a = this.open[0], b = this.open[1];
  if (this.cards[a] === this.cards[b]) {
    this.matched[a] = this.matched[b] = true;
    this.open = [];
    this.save();
    return 'match';
  }
  this.save();
  return 'miss';
};

MMGame.prototype.hideOpen = function () { this.open = []; };

MMGame.prototype.isWon = function () {
  return this.matched.every(function (m) { return m; });
};

MMGame.bestKey = function (sizeId) { return 'mm.best.' + sizeId; };

MMGame.loadBest = function (sizeId) {
  try { return parseInt(localStorage.getItem(MMGame.bestKey(sizeId)), 10) || 0; } catch (e) { return 0; }
};

/* Fewest moves for this size; also bumps the games-won tally on the menu. */
MMGame.prototype.recordWin = function () {
  var best = MMGame.loadBest(this.size.id);
  var isBest = !best || this.moves < best;
  try {
    if (isBest) localStorage.setItem(MMGame.bestKey(this.size.id), String(this.moves));
    var wins = (parseInt(localStorage.getItem('mm.wins'), 10) || 0) + 1;
    localStorage.setItem('mm.wins', String(wins));
    localStorage.setItem('arcade.stat.memory', wins === 1 ? '1 win' : wins + ' wins');
  } catch (e) {}
  return isBest;
};
