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
    return { cells: p.cells, color: p.color, at: p.at, rot: 0, pos: null };
  });
  if (saved && saved.level === level.number && Array.isArray(saved.pieces) && saved.pieces.length === this.pieces.length) {
    for (var i = 0; i < this.pieces.length; i++) {
      var sp = saved.pieces[i] || {}, pos = sp.pos;
      this.pieces[i].rot = ((sp.rot | 0) % 4 + 4) % 4;
      // only trust a saved spot that is two whole numbers and still fits
      if (Array.isArray(pos) && pos.length === 2 && pos[0] === (pos[0] | 0) && pos[1] === (pos[1] | 0) &&
          this.canPlace(i, pos[0], pos[1])) this.pieces[i].pos = [pos[0], pos[1]];
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

/* Turn a placed piece a quarter turn where it sits. Tries the same top-left
   corner first, then corners that keep the piece's middle roughly still.
   Returns true if it turned; false leaves the piece untouched. */
ShapesGame.prototype.rotateInPlace = function (i) {
  var p = this.pieces[i];
  if (!p.pos) return false;
  var next = (p.rot + 1) % 4;
  var old = rotateCells(p.cells, p.rot), nw = rotateCells(p.cells, next);
  function dims(s) {
    return [Math.max.apply(null, s.map(function (c) { return c[0]; })) + 1,
            Math.max.apply(null, s.map(function (c) { return c[1]; })) + 1];
  }
  var o = dims(old), n = dims(nw);
  var dr = (o[0] - n[0]) / 2, dc = (o[1] - n[1]) / 2;
  var tries = [[0, 0], [Math.floor(dr), Math.floor(dc)], [Math.ceil(dr), Math.ceil(dc)],
               [Math.floor(dr), Math.ceil(dc)], [Math.ceil(dr), Math.floor(dc)]];
  for (var k = 0; k < tries.length; k++) {
    var r = p.pos[0] + tries[k][0], c = p.pos[1] + tries[k][1];
    if (this.canPlace(i, r, c, next)) {
      p.rot = next; p.pos = [r, c];
      this.save();
      return true;
    }
  }
  return false;
};

ShapesGame.prototype.isSolved = function () {
  for (var i = 0; i < this.pieces.length; i++) if (!this.pieces[i].pos) return false;
  return true;   // every piece placed means the outline is exactly covered
};

/* Hint: put one piece where it was cut from, moving out of the way any
   piece sitting on those cells. Prefers a piece still in the tray. Returns
   the piece index or -1. */
ShapesGame.prototype.hint = function () {
  var pick = -1, i;
  for (i = 0; i < this.pieces.length && pick < 0; i++) if (!this.pieces[i].pos) pick = i;
  if (pick < 0) return -1;
  var p = this.pieces[pick];
  p.rot = 0;
  var cells = rotateCells(p.cells, 0), hit = {};
  for (i = 0; i < cells.length; i++) hit[(p.at[0] + cells[i][0]) * this.grid + p.at[1] + cells[i][1]] = 1;
  var occ = this.occupancy();
  for (var k in hit) if (occ[k] >= 0 && occ[k] !== pick) this.pieces[occ[k]].pos = null;
  p.pos = [p.at[0], p.at[1]];
  this.save();
  return pick;
};

ShapesGame.prototype.reset = function () {
  this.pieces.forEach(function (p) { p.pos = null; p.rot = 0; });
  this.save();
};
