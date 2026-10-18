/* Maze: a perfect maze (recursive backtracker, seeded so a level is always the
   same) plus the path the child has traced. Cells are indexed r * n + c and
   each holds a bitmask of open sides: N=1 E=2 S=4 W=8. */
function MazeGame(level, path) {
  this.level = level;
  this.n = MazeGame.sizeFor(level);
  this.cells = MazeGame.generate(this.n, MazeGame.seedFor(level));
  var last = this.n * this.n - 1;
  // flip the layout on some levels so start and goal are not always the same corners
  this.flip = level % 4 === 0 || level % 4 === 3;
  this.start = this.flip ? this.n - 1 : 0;
  this.goal = this.flip ? last - (this.n - 1) : last;
  this.path = [this.start];
  if (path && path.length && path[0] === this.start) {
    var ok = true;
    for (var i = 1; i < path.length; i++) if (!this.canStep(path[i - 1], path[i])) { ok = false; break; }
    if (ok) this.path = path.slice();
  }
}
MazeGame.SAVE_KEY = 'maze.game';
MazeGame.LEVEL_KEY = 'maze.level';
MazeGame.N = 1; MazeGame.E = 2; MazeGame.S = 4; MazeGame.W = 8;

MazeGame.sizeFor = function (level) { return Math.min(15, 5 + Math.floor((level - 1) / 2)); };
MazeGame.seedFor = function (level) { return (level * 7919 + 104729) >>> 0; };

MazeGame.rng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

MazeGame.generate = function (n, seed) {
  var rnd = MazeGame.rng(seed), cells = [], seen = [], i;
  for (i = 0; i < n * n; i++) { cells.push(0); seen.push(false); }
  var stack = [0]; seen[0] = true;
  var dr = [-1, 0, 1, 0], dc = [0, 1, 0, -1], bit = [1, 2, 4, 8], opp = [4, 8, 1, 2];
  while (stack.length) {
    var cur = stack[stack.length - 1], r = Math.floor(cur / n), c = cur % n, opts = [];
    for (var d = 0; d < 4; d++) {
      var nr = r + dr[d], nc = c + dc[d];
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr * n + nc]) opts.push(d);
    }
    if (!opts.length) { stack.pop(); continue; }
    var k = opts[Math.floor(rnd() * opts.length)], nxt = (r + dr[k]) * n + c + dc[k];
    cells[cur] |= bit[k]; cells[nxt] |= opp[k]; seen[nxt] = true; stack.push(nxt);
  }
  return cells;
};

/* true when b is a neighbour of a with no wall between */
MazeGame.prototype.canStep = function (a, b) {
  var n = this.n, d = b - a;
  if (d === -n) return (this.cells[a] & 1) !== 0;
  if (d === 1) return (a % n !== n - 1) && (this.cells[a] & 2) !== 0;
  if (d === n) return (this.cells[a] & 4) !== 0;
  if (d === -1) return (a % n !== 0) && (this.cells[a] & 8) !== 0;
  return false;
};

MazeGame.prototype.head = function () { return this.path[this.path.length - 1]; };
MazeGame.prototype.won = function () { return this.head() === this.goal; };

/* Move the head toward cell `to` one legal step at a time. Returns true when the path changed. */
MazeGame.prototype.moveTo = function (to) {
  if (this.won()) return false;
  var idx = this.path.lastIndexOf(to);
  if (idx >= 0) {                       // back on our own trail: erase everything after it
    if (idx === this.path.length - 1) return false;
    this.path.length = idx + 1;
    return true;
  }
  if (this.canStep(this.head(), to)) { this.path.push(to); return true; }
  return false;
};

MazeGame.prototype.save = function () {
  try { localStorage.setItem(MazeGame.SAVE_KEY, JSON.stringify({ level: this.level, path: this.path })); } catch (e) {}
};
MazeGame.loadSaved = function () {
  try { return JSON.parse(localStorage.getItem(MazeGame.SAVE_KEY)); } catch (e) { return null; }
};
MazeGame.loadLevel = function () {
  try { return Math.max(1, parseInt(localStorage.getItem(MazeGame.LEVEL_KEY), 10) || 1); } catch (e) { return 1; }
};
MazeGame.saveLevel = function (n) {
  try {
    localStorage.setItem(MazeGame.LEVEL_KEY, String(n));
    localStorage.setItem('arcade.stat.maze', 'Level ' + n);
  } catch (e) {}
};
