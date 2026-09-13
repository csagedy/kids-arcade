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
  if (saved && this.restore(saved)) return;
  this.spawn(); this.spawn();
}

G2048.SAVE_KEY = 'g2048.game';

G2048.loadBest = function () {
  try { return parseInt(localStorage.getItem('g2048.best'), 10) || 0; } catch (e) { return 0; }
};

G2048.prototype.saveBest = function () {
  try {
    localStorage.setItem('g2048.best', String(this.best));
    localStorage.setItem('arcade.stat.2048', 'Best ' + this.best);
  } catch (e) {}
};

G2048.prototype.save = function () {
  try {
    localStorage.setItem(G2048.SAVE_KEY, JSON.stringify({
      grid: Array.prototype.slice.call(this.grid), score: this.score,
      won: this.won, keepGoing: this.keepGoing
    }));
  } catch (e) {}
};

G2048.loadSaved = function () {
  try { return JSON.parse(localStorage.getItem(G2048.SAVE_KEY)); } catch (e) { return null; }
};

G2048.prototype.restore = function (s) {
  if (!s || !s.grid || s.grid.length !== N * N) return false;
  for (var i = 0; i < N * N; i++) this.grid[i] = s.grid[i] | 0;
  this.score = s.score | 0;
  this.won = !!s.won;
  this.keepGoing = !!s.keepGoing;
  return true;
};

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

  this.score += gained;
  if (this.score > this.best) { this.best = this.score; this.saveBest(); }
  var spawned = this.spawn();
  if (!this.won && this.maxTile() >= 11) this.won = true;
  this.save();
  return { gained: gained, spawned: spawned, merges: merges, from: from };
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
