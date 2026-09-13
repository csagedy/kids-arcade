/* Nonogram model. A puzzle is a picture; the player sees only the run
   lengths per row and column. Cells are 0 unknown, 1 filled, 2 crossed.
   Progress is saved per puzzle so a kid can hop between pictures. */

function runsOf(line) {
  var out = [], run = 0;
  for (var i = 0; i < line.length; i++) {
    if (line[i] === 1) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

function NonoGame(def) {
  this.id = def.id;
  this.name = def.name;
  this.color = def.color || '#f2f4f8';
  this.h = def.art.length;
  this.w = def.art[0].length;
  this.solution = new Uint8Array(this.w * this.h);
  for (var y = 0; y < this.h; y++) {
    for (var x = 0; x < this.w; x++) this.solution[y * this.w + x] = def.art[y][x] === '#' ? 1 : 0;
  }
  this.rowClues = [];
  this.colClues = [];
  for (var r = 0; r < this.h; r++) this.rowClues.push(runsOf(this.row(this.solution, r)));
  for (var c = 0; c < this.w; c++) this.colClues.push(runsOf(this.col(this.solution, c)));

  this.cells = new Uint8Array(this.w * this.h);
  this.load();
}

NonoGame.prototype.row = function (arr, r) {
  return Array.prototype.slice.call(arr, r * this.w, r * this.w + this.w);
};
NonoGame.prototype.col = function (arr, c) {
  var out = [];
  for (var r = 0; r < this.h; r++) out.push(arr[r * this.w + c]);
  return out;
};

NonoGame.prototype.key = function () { return 'nono.p.' + this.id; };

NonoGame.prototype.save = function () {
  try { localStorage.setItem(this.key(), Array.prototype.join.call(this.cells, '')); } catch (e) {}
};

NonoGame.prototype.load = function () {
  try {
    var s = localStorage.getItem(this.key());
    if (s && s.length === this.cells.length) {
      for (var i = 0; i < s.length; i++) this.cells[i] = +s[i];
    }
  } catch (e) {}
};

NonoGame.prototype.clear = function () {
  this.cells = new Uint8Array(this.w * this.h);
  try { localStorage.removeItem(this.key()); } catch (e) {}
};

NonoGame.prototype.set = function (i, v) {
  if (this.cells[i] === v) return false;
  this.cells[i] = v;
  return true;
};

/* A line is "done" when its filled runs match the clue; crosses don't matter. */
NonoGame.prototype.rowDone = function (r) {
  return runsOf(this.row(this.cells, r)).join(',') === this.rowClues[r].join(',');
};
NonoGame.prototype.colDone = function (c) {
  return runsOf(this.col(this.cells, c)).join(',') === this.colClues[c].join(',');
};

NonoGame.prototype.isSolved = function () {
  for (var i = 0; i < this.cells.length; i++) {
    if ((this.cells[i] === 1) !== (this.solution[i] === 1)) return false;
  }
  return true;
};

/* Solved pictures are remembered separately from in-progress grids. */
NonoGame.solvedSet = function () {
  try { return JSON.parse(localStorage.getItem('nono.solved')) || {}; } catch (e) { return {}; }
};

NonoGame.prototype.markSolved = function () {
  var set = NonoGame.solvedSet();
  set[this.id] = 1;
  try {
    localStorage.setItem('nono.solved', JSON.stringify(set));
    var n = Object.keys(set).length;
    localStorage.setItem('arcade.stat.nonogram', n + ' of ' + NONO_PUZZLES.length + ' solved');
  } catch (e) {}
};
