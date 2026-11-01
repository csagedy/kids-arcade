/* 2048 rules. The grid is a flat array of exponents (0 empty, 1 = 2, 2 = 4 …)
   so saves stay tiny. A move slides every row toward one edge, merging equal
   neighbours once each; a move that changes nothing is not a move. */

var N = 4;

function G2048(saved) {
  this.grid = new Uint8Array(N * N);
  this.score = 0;
  this.best = G2048.loadBest();
  this.won = false;      // 2048 reached at least once; play continues
  this.keepGoing = false;
  this.prev = null;      // one-step undo snapshot (saved as an optional field)
  if (saved && this.restore(saved)) return;
  this.spawn(); this.spawn();
}

G2048.SAVE_KEY = 'g2048.game';

G2048.loadBest = function () { return Math.max(0, parseInt(Kit.load('g2048.best', 0), 10) || 0); };

G2048.prototype.saveBest = function () {
  Kit.save('g2048.best', this.best);
  Kit.stat('2048', 'Best ' + this.best);
};

G2048.prototype.save = function () {
  Kit.save(G2048.SAVE_KEY, {
    grid: Array.prototype.slice.call(this.grid), score: this.score,
    won: this.won, keepGoing: this.keepGoing,
    prev: this.prev ? {
      grid: Array.prototype.slice.call(this.prev.grid), score: this.prev.score,
      won: this.prev.won, keepGoing: this.prev.keepGoing
    } : null
  });
};

G2048.loadSaved = function () { return Kit.load(G2048.SAVE_KEY, null); };

G2048.prototype.restore = function (s) {
  if (!validGrid(s && s.grid)) return false;
  for (var i = 0; i < N * N; i++) this.grid[i] = s.grid[i];
  this.score = Math.max(0, s.score | 0);
  this.won = !!s.won;
  this.keepGoing = !!s.keepGoing;
  // Older saves have no `prev`; a malformed one is just dropped.
  var p = s.prev;
  if (p && validGrid(p.grid)) {
    var pg = new Uint8Array(N * N);
    for (var j = 0; j < N * N; j++) pg[j] = p.grid[j];
    this.prev = { grid: pg, score: p.score | 0, won: !!p.won, keepGoing: !!p.keepGoing };
  }
  return true;
};

/* A saved grid must be 16 whole exponents (0 empty .. 17 = 131072) with at
   least one tile; anything else (a damaged save) means a fresh game. */
function validGrid(g) {
  if (!g || typeof g !== 'object' || g.length !== N * N) return false;
  var tiles = 0;
  for (var i = 0; i < N * N; i++) {
    var v = g[i];
    if (typeof v !== 'number' || v !== Math.floor(v) || v < 0 || v > 17) return false;
    if (v) tiles++;
  }
  return tiles > 0;
}

G2048.prototype.empties = function () {
  var out = [];
  for (var i = 0; i < N * N; i++) if (!this.grid[i]) out.push(i);
  return out;
};

/* New tiles are a 2 most of the time, a 4 now and then. Returns the index. */
G2048.prototype.spawn = function () {
  var e = this.empties();
  if (!e.length) return -1;
  var i = e[Math.floor(Math.random() * e.length)];
  this.grid[i] = Math.random() < 0.9 ? 1 : 2;
  return i;
};

/* Slide one line (array of exponents) toward index 0. Returns the new line,
   the points gained and, for animation, where each original cell ended up. */
function slideLine(line) {
  var out = [], gained = 0, moves = [], merged = [];
  var last = -1;
  for (var i = 0; i < line.length; i++) {
    var v = line[i];
    if (!v) { moves.push(-1); continue; }
    if (last >= 0 && out[last] === v && !merged[last]) {
      out[last] = v + 1;
      merged[last] = true;
      gained += 1 << (v + 1);
      moves.push(last);
    } else {
      out.push(v);
      last = out.length - 1;
      moves.push(last);
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained: gained, moves: moves, merged: merged };
}

/* dir: 0 left, 1 up, 2 right, 3 down. Returns null if nothing moved, else
   { gained, spawned, merges:[index...], from:{ fromIndex: toIndex } }. */
G2048.prototype.move = function (dir) {
  var self = this, changed = false, gained = 0, merges = [], from = {};
  var snap = { grid: new Uint8Array(this.grid), score: this.score, won: this.won, keepGoing: this.keepGoing };

  for (var k = 0; k < N; k++) {
    // Collect the indices of this line in the sliding order.
    var idx = [];
    for (var j = 0; j < N; j++) {
      var jj = (dir === 2 || dir === 3) ? N - 1 - j : j;
      idx.push(dir === 0 || dir === 2 ? k * N + jj : jj * N + k);
    }
    var line = idx.map(function (i) { return self.grid[i]; });
    var r = slideLine(line);
    for (var j2 = 0; j2 < N; j2++) {
      if (r.line[j2] !== line[j2]) changed = true;
      if (r.moves[j2] >= 0) from[idx[j2]] = idx[r.moves[j2]];
      if (r.merged[j2]) merges.push(idx[j2]);
      this.grid[idx[j2]] = r.line[j2];
    }
    gained += r.gained;
  }
  if (!changed) return null;

  this.prev = snap;
  this.score += gained;
  if (this.score > this.best) { this.best = this.score; this.saveBest(); }
  var spawned = this.spawn();
  if (!this.won && this.maxTile() >= 11) this.won = true;
  this.save();
  return { gained: gained, spawned: spawned, merges: merges, from: from };
};

/* Take back the last move (only one step). Returns false if there is nothing to undo. */
G2048.prototype.undo = function () {
  if (!this.prev) return false;
  this.grid = this.prev.grid;
  this.score = this.prev.score;
  this.won = this.prev.won;
  this.keepGoing = this.prev.keepGoing;
  this.prev = null;
  this.save();
  return true;
};

G2048.prototype.maxTile = function () {
  var m = 0;
  for (var i = 0; i < N * N; i++) if (this.grid[i] > m) m = this.grid[i];
  return m;
};

G2048.prototype.canMove = function () {
  for (var r = 0; r < N; r++) {
    for (var c = 0; c < N; c++) {
      var v = this.grid[r * N + c];
      if (!v) return true;
      if (c + 1 < N && this.grid[r * N + c + 1] === v) return true;
      if (r + 1 < N && this.grid[(r + 1) * N + c] === v) return true;
    }
  }
  return false;
};
