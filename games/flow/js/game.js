/* Flow state: one path (list of cell indices) per colour, starting at one of
   that colour's dots. Drawing rules follow the classic game: a path grows one
   neighbour at a time, backing over itself shortens it, and crossing another
   colour's path cuts that path at the crossing. */

function FlowGame(level, saved) {
  this.level = level.number;
  this.size = level.size;
  this.pairs = level.pairs;
  this.N = this.size * this.size;
  this.dot = new Int8Array(this.N).fill(-1);      // colour of the dot on a cell
  for (var i = 0; i < this.pairs.length; i++) {
    this.dot[this.pairs[i].a] = i;
    this.dot[this.pairs[i].b] = i;
  }
  this.paths = this.pairs.map(function () { return []; });
  this.moves = 0;
  if (saved && saved.level === level.number && saved.paths && saved.paths.length === this.paths.length) {
    this.paths = saved.paths;
    this.moves = saved.moves | 0;
  }
}

FlowGame.SAVE_KEY = 'flow.game';

FlowGame.prototype.save = function () {
  try {
    localStorage.setItem(FlowGame.SAVE_KEY, JSON.stringify({ level: this.level, paths: this.paths, moves: this.moves }));
  } catch (e) {}
};

FlowGame.loadSaved = function () {
  try { return JSON.parse(localStorage.getItem(FlowGame.SAVE_KEY)); } catch (e) { return null; }
};

/* Which colour's path occupies a cell, or -1. */
FlowGame.prototype.ownerOf = function (cell) {
  for (var c = 0; c < this.paths.length; c++) {
    if (this.paths[c].indexOf(cell) >= 0) return c;
  }
  return -1;
};

FlowGame.prototype.adjacent = function (a, b) {
  var ra = Math.floor(a / this.size), ca = a % this.size;
  var rb = Math.floor(b / this.size), cb = b % this.size;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
};

FlowGame.prototype.isComplete = function (c) {
  var p = this.paths[c];
  if (p.length < 2) return false;
  var pr = this.pairs[c];
  var ends = [p[0], p[p.length - 1]];
  return ends.indexOf(pr.a) >= 0 && ends.indexOf(pr.b) >= 0;
};

/* Begin a stroke at `cell`. Returns the colour being drawn or -1.
   Starting on a dot restarts that colour from the dot; starting on a path
   truncates it there so the kid can redraw the tail. */
FlowGame.prototype.begin = function (cell) {
  var c = this.dot[cell];
  if (c >= 0) {
    this.paths[c] = [cell];
    return c;
  }
  c = this.ownerOf(cell);
  if (c < 0) return -1;
  var p = this.paths[c];
  p.length = p.indexOf(cell) + 1;
  return c;
};

/* Extend colour c's path into `cell`. Returns true if anything changed. */
FlowGame.prototype.extend = function (c, cell) {
  var p = this.paths[c];
  if (!p.length) return false;
  var head = p[p.length - 1];
  if (cell === head) return false;
  if (this.isComplete(c)) return false;          // finished: lift to redraw
  if (!this.adjacent(head, cell)) return false;

  // Backing up over own path shortens it.
  var at = p.indexOf(cell);
  if (at >= 0) { p.length = at + 1; return true; }

  // A dot of another colour is a wall.
  if (this.dot[cell] >= 0 && this.dot[cell] !== c) return false;

  // Crossing another path cuts it at that cell.
  var other = this.ownerOf(cell);
  if (other >= 0 && other !== c) {
    var op = this.paths[other];
    op.length = op.indexOf(cell);
    if (op.length === 0) this.paths[other] = [];
  }
  p.push(cell);
  return true;
};

FlowGame.prototype.allConnected = function () {
  for (var c = 0; c < this.paths.length; c++) if (!this.isComplete(c)) return false;
  return true;
};

FlowGame.prototype.filledCount = function () {
  var n = 0;
  for (var c = 0; c < this.paths.length; c++) n += this.paths[c].length;
  return n;
};

FlowGame.prototype.reset = function () {
  this.paths = this.pairs.map(function () { return []; });
  this.moves = 0;
};
