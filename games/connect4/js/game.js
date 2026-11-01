/* Four in a Row: 7 columns x 6 rows. The board is a flat array of 42 cells
   (index r * 7 + c, row 0 at the top) holding 0 (empty), 1 (red) or 2 (yellow). */
var C4 = {
  COLS: 7, ROWS: 6,
  SAVE_KEY: 'connect4.game', WINS_KEY: 'connect4.wins'
};

C4.empty = function () { var b = []; for (var i = 0; i < 42; i++) b.push(0); return b; };

/* lowest free row in a column, or -1 when full */
C4.dropRow = function (b, col) {
  for (var r = 5; r >= 0; r--) if (!b[r * 7 + col]) return r;
  return -1;
};

C4.validMoves = function (b) {
  var m = [];
  for (var c = 0; c < 7; c++) if (!b[c]) m.push(c);
  return m;
};

var C4_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/* {player, cells:[4 indices]} for a four, else null */
C4.winner = function (b) {
  for (var r = 0; r < 6; r++) {
    for (var c = 0; c < 7; c++) {
      var p = b[r * 7 + c];
      if (!p) continue;
      for (var d = 0; d < 4; d++) {
        var dr = C4_DIRS[d][0], dc = C4_DIRS[d][1], cells = [r * 7 + c], k;
        for (k = 1; k < 4; k++) {
          var rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== p) break;
          cells.push(rr * 7 + cc);
        }
        if (cells.length === 4) return { player: p, cells: cells };
      }
    }
  }
  return null;
};

C4.isFull = function (b) { for (var c = 0; c < 7; c++) if (!b[c]) return false; return true; };

/* ---- computer player ---- */

var C4_ORDER = [3, 2, 4, 1, 5, 0, 6];

/* score a window of four cells for `me` */
function c4Window(a, b, c, d, me) {
  var mine = 0, theirs = 0, arr = [a, b, c, d];
  for (var i = 0; i < 4; i++) { if (arr[i] === me) mine++; else if (arr[i]) theirs++; }
  if (mine && theirs) return 0;
  if (mine === 3) return 5;
  if (mine === 2) return 2;
  if (theirs === 3) return -6;
  if (theirs === 2) return -2;
  return 0;
}

C4.evaluate = function (b, me) {
  var s = 0, r, c;
  for (r = 0; r < 6; r++) if (b[r * 7 + 3] === me) s += 3; else if (b[r * 7 + 3]) s -= 3;
  for (r = 0; r < 6; r++) for (c = 0; c < 7; c++) {
    if (c < 4) s += c4Window(b[r * 7 + c], b[r * 7 + c + 1], b[r * 7 + c + 2], b[r * 7 + c + 3], me);
    if (r < 3) {
      s += c4Window(b[r * 7 + c], b[(r + 1) * 7 + c], b[(r + 2) * 7 + c], b[(r + 3) * 7 + c], me);
      if (c < 4) s += c4Window(b[r * 7 + c], b[(r + 1) * 7 + c + 1], b[(r + 2) * 7 + c + 2], b[(r + 3) * 7 + c + 3], me);
      if (c > 2) s += c4Window(b[r * 7 + c], b[(r + 1) * 7 + c - 1], b[(r + 2) * 7 + c - 2], b[(r + 3) * 7 + c - 3], me);
    }
  }
  return s;
};

/* Minimax with alpha-beta; scores are from the point of view of `me`. */
C4.score = function (b, turn, me, depth, alpha, beta) {
  var w = C4.winner(b);
  if (w) return w.player === me ? 10000 + depth : -10000 - depth;
  if (C4.isFull(b)) return 0;
  if (depth === 0) return C4.evaluate(b, me);
  var maximizing = turn === me, best = maximizing ? -Infinity : Infinity;
  for (var i = 0; i < 7; i++) {
    var c = C4_ORDER[i], r = C4.dropRow(b, c);
    if (r < 0) continue;
    b[r * 7 + c] = turn;
    var v = C4.score(b, 3 - turn, me, depth - 1, alpha, beta);
    b[r * 7 + c] = 0;
    if (maximizing) { if (v > best) best = v; if (v > alpha) alpha = v; }
    else { if (v < best) best = v; if (v < beta) beta = v; }
    if (alpha >= beta) break;
  }
  return best;
};

/* Does playing `col` as `p` make a four right away? */
C4.winsAt = function (b, col, p) {
  var r = C4.dropRow(b, col);
  if (r < 0) return false;
  b[r * 7 + col] = p;
  var w = C4.winner(b);
  b[r * 7 + col] = 0;
  return !!(w && w.player === p);
};

/* level: 'easy' | 'medium' | 'hard'. Returns a legal column (board must not be full). */
C4.aiMove = function (board, me, level, rnd) {
  rnd = rnd || Math.random;
  var b = board.slice(), moves = C4.validMoves(b), i, c;
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  var win = -1, block = -1;
  for (i = 0; i < moves.length; i++) {
    if (C4.winsAt(b, moves[i], me)) win = moves[i];
    if (C4.winsAt(b, moves[i], 3 - me)) block = moves[i];
  }
  if (level === 'easy') {
    // friendly: often misses a win or a block, otherwise wanders
    if (win >= 0 && rnd() < 0.6) return win;
    if (block >= 0 && rnd() < 0.4) return block;
    return pick(moves);
  }
  if (win >= 0) return win;
  if (block >= 0 && (level === 'hard' || rnd() < 0.85)) return block;
  var depth = level === 'hard' ? 5 : 2;
  var best = -Infinity, bestMoves = [];
  for (i = 0; i < 7; i++) {
    c = C4_ORDER[i];
    var r = C4.dropRow(b, c);
    if (r < 0) continue;
    b[r * 7 + c] = me;
    var v = C4.score(b, 3 - me, me, depth - 1, -Infinity, Infinity);
    b[r * 7 + c] = 0;
    if (v > best) { best = v; bestMoves = [c]; } else if (v === best) bestMoves.push(c);
  }
  return level === 'hard' ? bestMoves[0] : pick(bestMoves);
};

/* ---- saving ---- */

C4.save = function (s) {
  try { localStorage.setItem(C4.SAVE_KEY, JSON.stringify(s)); } catch (e) {}
};
C4.clearSave = function () { try { localStorage.removeItem(C4.SAVE_KEY); } catch (e) {} };
C4.loadSaved = function () {
  try {
    var s = JSON.parse(localStorage.getItem(C4.SAVE_KEY));
    if (s && Array.isArray(s.board) && s.board.length === 42 && (s.turn === 1 || s.turn === 2) &&
        s.board.every(function (v) { return v === 0 || v === 1 || v === 2; })) return s;
  } catch (e) {}
  return null;
};
C4.loadWins = function () {
  try { return Math.max(0, parseInt(localStorage.getItem(C4.WINS_KEY), 10) || 0); } catch (e) { return 0; }
};
C4.addWin = function () {
  var n = C4.loadWins() + 1;
  try {
    localStorage.setItem(C4.WINS_KEY, String(n));
    localStorage.setItem('arcade.stat.connect4', 'Wins ' + n);
  } catch (e) {}
  return n;
};
