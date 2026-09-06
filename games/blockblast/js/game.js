/* 8x8 board. Three pieces at a time, drag them in, full rows and columns clear.
   No gravity and no falling — the whole game is fitting shapes into gaps. */

var SIZE = 8;

function BBGame() {
  this.board = new Uint8Array(SIZE * SIZE);   // 0 empty, else colour + 1
  this.score = 0;
  this.streak = 0;
  this.best = this.loadBest();
  this.tray = [null, null, null];
  this.deal();
}

BBGame.prototype.loadBest = function () {
  try { return parseInt(localStorage.getItem('bb.best'), 10) || 0; } catch (e) { return 0; }
};

BBGame.prototype.saveBest = function () {
  try { localStorage.setItem('bb.best', String(this.best)); } catch (e) {}
};

BBGame.prototype.at = function (r, c) { return this.board[r * SIZE + c]; };

BBGame.prototype.canPlace = function (piece, r0, c0) {
  for (var i = 0; i < piece.cells.length; i++) {
    var r = r0 + piece.cells[i][0], c = c0 + piece.cells[i][1];
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
    if (this.board[r * SIZE + c]) return false;
  }
  return true;
};

BBGame.prototype.fitsAnywhere = function (piece) {
  for (var r = 0; r <= SIZE - piece.rows; r++) {
    for (var c = 0; c <= SIZE - piece.cols; c++) {
      if (this.canPlace(piece, r, c)) return true;
    }
  }
  return false;
};

/* Deal three pieces, making sure at least one of them can actually be played.
   Being handed an impossible set feels like a bug even when it isn't. */
BBGame.prototype.deal = function () {
  for (var attempt = 0; attempt < 40; attempt++) {
    var next = [randomPiece(), randomPiece(), randomPiece()];
    for (var i = 0; i < 3; i++) {
      if (this.fitsAnywhere(next[i])) { this.tray = next; return; }
    }
  }
  // Fall back to single squares, which fit wherever any gap remains.
  this.tray = [makePiece(SHAPES[0], 0), makePiece(SHAPES[0], 1), makePiece(SHAPES[0], 2)];
};

BBGame.prototype.place = function (slot, r0, c0) {
  var piece = this.tray[slot];
  if (!piece || !this.canPlace(piece, r0, c0)) return null;

  for (var i = 0; i < piece.cells.length; i++) {
    var r = r0 + piece.cells[i][0], c = c0 + piece.cells[i][1];
    this.board[r * SIZE + c] = piece.color + 1;
  }
  this.score += piece.cells.length;
  this.tray[slot] = null;

  // Clear first: dealing and the game-over check must see the real board.
  var result = this.clearLines();
  if (this.tray.every(function (p) { return p === null; })) this.deal();

  if (this.score > this.best) { this.best = this.score; this.saveBest(); }
  return result;
};

BBGame.prototype.clearLines = function () {
  var rows = [], cols = [], r, c, full;

  for (r = 0; r < SIZE; r++) {
    full = true;
    for (c = 0; c < SIZE; c++) if (!this.at(r, c)) { full = false; break; }
    if (full) rows.push(r);
  }
  for (c = 0; c < SIZE; c++) {
    full = true;
    for (r = 0; r < SIZE; r++) if (!this.at(r, c)) { full = false; break; }
    if (full) cols.push(c);
  }

  var cleared = [];
  rows.forEach(function (rr) { for (var cc = 0; cc < SIZE; cc++) cleared.push(rr * SIZE + cc); });
  cols.forEach(function (cc) { for (var rr = 0; rr < SIZE; rr++) cleared.push(rr * SIZE + cc); });

  for (var k = 0; k < cleared.length; k++) this.board[cleared[k]] = 0;

  var lines = rows.length + cols.length;
  var gained = 0;
  if (lines > 0) {
    this.streak++;
    // Clearing several lines at once, or on consecutive moves, is worth more.
    gained = 10 * lines * lines * Math.min(this.streak, 5);
    this.score += gained;
  } else {
    this.streak = 0;
  }

  return { cells: cleared, rows: rows, cols: cols, lines: lines, gained: gained, streak: this.streak };
};

BBGame.prototype.isOver = function () {
  for (var i = 0; i < 3; i++) {
    if (this.tray[i] && this.fitsAnywhere(this.tray[i])) return false;
  }
  return true;
};
