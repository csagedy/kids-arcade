/* Jigsaw piece shapes.

   A puzzle is cols x rows cells. Every inside edge gets a tab that bulges
   one way or the other, with a little jitter so no two pieces look the same.
   The cut is seeded, so the same picture at the same size always cuts the
   same way (a saved puzzle comes back with the same pieces).

   Coordinates are in cells: piece (i, j) covers [i, i+1] x [j, j+1] and its
   tabs reach out up to MARGIN cells beyond that. Callers scale the canvas
   by the cell size before tracing. The tab curve is the well-known
   three-Bezier jigsaw edge (Draradech's generator). */
var Shapes = (function () {
  var TAB = 0.1, JIT = 0.04;
  var MARGIN = 3 * TAB + JIT + 0.04;    // how far a tab can reach out, plus room for the shadow

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Pieces per side for a "k x k" level and a picture of aspect w / h:
     close-to-square pictures get exactly k x k; wide or tall ones get more
     columns or rows so each piece stays roughly square. */
  function grid(k, aspect) {
    if (aspect > 0.84 && aspect < 1.19) return { cols: k, rows: k };
    var r = Math.sqrt(aspect);
    return { cols: Math.max(2, Math.round(k * r)), rows: Math.max(2, Math.round(k / r)) };
  }

  function edge(rand) {
    function j() { return (rand() * 2 - 1) * JIT; }
    return { s: rand() < 0.5 ? 1 : -1, a: j(), b: j(), c: j(), d: j(), e: j() };
  }

  /* The cut for one puzzle: h[j][i] is the edge along the top of row j
     (j = 1 .. rows-1), v[j][i] the edge along the left of column i
     (i = 1 .. cols-1). */
  function cut(cols, rows, seed) {
    var rand = rng(seed), h = [], v = [];
    for (var j = 0; j < rows; j++) {
      h[j] = []; v[j] = [];
      for (var i = 0; i < cols; i++) {
        h[j][i] = j > 0 ? edge(rand) : null;
        v[j][i] = i > 0 ? edge(rand) : null;
      }
    }
    return { cols: cols, rows: rows, h: h, v: v };
  }

  /* Ten points along an edge in (along, across) form; across is signed. */
  function pts(e) {
    var t = TAB, s = e.s;
    return [
      [0, 0],
      [0.2, e.a * s],
      [0.5 + e.b + e.d, (-t + e.c) * s],
      [0.5 - t + e.b, (t + e.c) * s],
      [0.5 - 2 * t + e.b - e.d, (3 * t + e.c) * s],
      [0.5 + 2 * t + e.b - e.d, (3 * t + e.c) * s],
      [0.5 + t + e.b, (t + e.c) * s],
      [0.5 + e.b + e.d, (-t + e.c) * s],
      [0.8, e.e * s],
      [1, 0]
    ];
  }

  // Trace an edge from its start (forward) or from its end (reverse).
  // map(along, across) -> [x, y]
  function trace(ctx, e, map, reverse) {
    var p = pts(e).map(function (q) { return map(q[0], q[1]); });
    if (!reverse) {
      ctx.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
      ctx.bezierCurveTo(p[4][0], p[4][1], p[5][0], p[5][1], p[6][0], p[6][1]);
      ctx.bezierCurveTo(p[7][0], p[7][1], p[8][0], p[8][1], p[9][0], p[9][1]);
    } else {
      ctx.bezierCurveTo(p[8][0], p[8][1], p[7][0], p[7][1], p[6][0], p[6][1]);
      ctx.bezierCurveTo(p[5][0], p[5][1], p[4][0], p[4][1], p[3][0], p[3][1]);
      ctx.bezierCurveTo(p[2][0], p[2][1], p[1][0], p[1][1], p[0][0], p[0][1]);
    }
  }

  /* Adds piece (i, j)'s outline to ctx's current path, in cell units. */
  function piecePath(ctx, c, i, j) {
    ctx.moveTo(i, j);
    // top, left to right (a + across bulges down into this piece's row)
    if (j === 0) ctx.lineTo(i + 1, j);
    else trace(ctx, c.h[j][i], function (l, w) { return [i + l, j + w]; }, false);
    // right, top to bottom
    if (i === c.cols - 1) ctx.lineTo(i + 1, j + 1);
    else trace(ctx, c.v[j][i + 1], function (l, w) { return [i + 1 + w, j + l]; }, false);
    // bottom, right to left
    if (j === c.rows - 1) ctx.lineTo(i, j + 1);
    else trace(ctx, c.h[j + 1][i], function (l, w) { return [i + l, j + 1 + w]; }, true);
    // left, bottom to top
    if (i === 0) ctx.lineTo(i, j);
    else trace(ctx, c.v[j][i], function (l, w) { return [i + w, j + l]; }, true);
    ctx.closePath();
  }

  function isEdge(c, i, j) { return i === 0 || j === 0 || i === c.cols - 1 || j === c.rows - 1; }

  return { MARGIN: MARGIN, hash: hash, rng: rng, grid: grid, cut: cut, piecePath: piecePath, isEdge: isEdge };
})();
