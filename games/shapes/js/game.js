/* Shape Fit state. Each piece is either in the tray (pos null) or on the
   board at a top-left cell, with a rotation 0..3. The level's `inside` mask
   is the outline; a piece may only sit fully inside it on empty cells. */

function rotateCells(cells, times) {
  var out = cells.map(function (c) { return [c[0], c[1]]; });
  for (var t = 0; t < (times % 4 + 4) % 4; t++) {
    // (r, c) -> (c, maxR - r)
    var maxR = Math.max.apply(null, out.map(function (c) { return c[0]; }));
    out = out.map(function (c) { return [c[1], maxR - c[0]]; });
  }
  var minR = Math.min.apply(null, out.map(function (c) { return c[0]; }));
  var minC = Math.min.apply(null, out.map(function (c) { return c[1]; }));
  out = out.map(function (c) { return [c[0] - minR, c[1] - minC]; });
  out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  return out;
}

function ShapesGame(level, saved) {
  this.level = level.number;
  this.grid = level.grid;
  this.inside = level.inside;
  this.pieces = level.pieces.map(function (p) {
    return { cells: p.cells, color: p.color, rot: 0, pos: null };
  });
  if (saved && saved.level === level.number && saved.pieces && saved.pieces.length === this.pieces.length) {
    for (var i = 0; i < this.pieces.length; i++) {
      this.pieces[i].rot = saved.pieces[i].rot | 0;
      this.pieces[i].pos = saved.pieces[i].pos;
    }
  }
}

ShapesGame.SAVE_KEY = 'shapes.game';

ShapesGame.prototype.save = function () {
  try {
    localStorage.setItem(ShapesGame.SAVE_KEY, JSON.stringify({
      level: this.level,
      pieces: this.pieces.map(function (p) { return { rot: p.rot, pos: p.pos }; })
    }));
  } catch (e) {}
};

ShapesGame.loadSaved = function () {
  try { return JSON.parse(localStorage.getItem(ShapesGame.SAVE_KEY)); } catch (e) { return null; }
};

ShapesGame.prototype.shape = function (i) { return rotateCells(this.pieces[i].cells, this.pieces[i].rot); };

/* Board occupancy: piece index per cell, or -1. */
ShapesGame.prototype.occupancy = function () {
  var occ = new Int8Array(this.grid * this.grid).fill(-1);
  for (var i = 0; i < this.pieces.length; i++) {
    var p = this.pieces[i];
    if (!p.pos) continue;
    var cells = this.shape(i);
    for (var k = 0; k < cells.length; k++) {
      occ[(p.pos[0] + cells[k][0]) * this.grid + p.pos[1] + cells[k][1]] = i;
    }
  }
  return occ;
};

ShapesGame.prototype.canPlace = function (i, r0, c0, rot) {
  var cells = rotateCells(this.pieces[i].cells, rot === undefined ? this.pieces[i].rot : rot);
  var occ = this.occupancy();
  for (var k = 0; k < cells.length; k++) {
    var r = r0 + cells[k][0], c = c0 + cells[k][1];
    if (r < 0 || c < 0 || r >= this.grid || c >= this.grid) return false;
    var idx = r * this.grid + c;
    if (!this.inside[idx]) return false;
    if (occ[idx] >= 0 && occ[idx] !== i) return false;
  }
  return true;
};

ShapesGame.prototype.place = function (i, r0, c0) {
  if (!this.canPlace(i, r0, c0)) return false;
  this.pieces[i].pos = [r0, c0];
  this.save();
  return true;
};

ShapesGame.prototype.lift = function (i) {
  this.pieces[i].pos = null;
  this.save();
};

ShapesGame.prototype.rotate = function (i) {
  var p = this.pieces[i];
  var next = (p.rot + 1) % 4;
  if (p.pos && !this.canPlace(i, p.pos[0], p.pos[1], next)) {
    p.pos = null;   // can't turn in place: back to the tray, turned
  }
  p.rot = next;
  this.save();
};

ShapesGame.prototype.isSolved = function () {
  for (var i = 0; i < this.pieces.length; i++) if (!this.pieces[i].pos) return false;
  return true;   // every piece placed means the outline is exactly covered
};

ShapesGame.prototype.reset = function () {
  this.pieces.forEach(function (p) { p.pos = null; p.rot = 0; });
  this.save();
};
