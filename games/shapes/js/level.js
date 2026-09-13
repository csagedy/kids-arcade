/* Shape Fit levels. An outline is carved into polyomino pieces, so the level
   always has a solution: put every piece back where it was cut from. Pieces
   can rotate, which usually opens up other solutions too. Seeded by level
   number so level 7 is level 7 on every phone. */

var SHAPE_COLORS = [
  '#e5484d', '#ff8a3d', '#ffd645', '#3fb950', '#26c6c6',
  '#4fa3f7', '#a06cf0', '#f06ca8', '#c3d130', '#8b5a2b'
];

function shapesRandom(seed) {
  var s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* Grid size, how many cells the outline covers, and how big pieces are. */
function shapesSpec(n) {
  if (n <= 5)  return { grid: 5, cells: 12, min: 3, max: 4 };
  if (n <= 15) return { grid: 6, cells: 16 + (n % 3) * 2, min: 3, max: 4 };
  if (n <= 30) return { grid: 7, cells: 20 + (n % 4) * 2, min: 3, max: 5 };
  if (n <= 50) return { grid: 8, cells: 26 + (n % 5) * 2, min: 4, max: 5 };
  return { grid: 8, cells: 34 + (n % 4) * 2, min: 4, max: 6 };
}

/* Grow a blob of `count` connected cells from the middle of the grid. */
function growOutline(grid, count, rnd) {
  var N = grid * grid;
  var inside = new Uint8Array(N);
  var start = Math.floor(grid / 2) * grid + Math.floor(grid / 2);
  inside[start] = 1;
  var frontier = [start], n = 1;
  function nbrs(i) {
    var r = Math.floor(i / grid), c = i % grid, out = [];
    if (r > 0) out.push(i - grid);
    if (r < grid - 1) out.push(i + grid);
    if (c > 0) out.push(i - 1);
    if (c < grid - 1) out.push(i + 1);
    return out;
  }
  while (n < count && frontier.length) {
    var pick = frontier[Math.floor(rnd() * frontier.length)];
    var free = nbrs(pick).filter(function (j) { return !inside[j]; });
    if (!free.length) { frontier.splice(frontier.indexOf(pick), 1); continue; }
    var next = free[Math.floor(rnd() * free.length)];
    inside[next] = 1; n++;
    frontier.push(next);
  }
  return n === count ? inside : null;
}

/* Cut the outline into connected pieces of min..max cells. Null on failure. */
function cutPieces(grid, inside, min, max, rnd) {
  var N = grid * grid;
  var owner = new Int8Array(N).fill(-1);
  var pieces = [];
  function nbrs(i) {
    var r = Math.floor(i / grid), c = i % grid, out = [];
    if (r > 0) out.push(i - grid);
    if (r < grid - 1) out.push(i + grid);
    if (c > 0) out.push(i - 1);
    if (c < grid - 1) out.push(i + 1);
    return out.filter(function (j) { return inside[j] && owner[j] < 0; });
  }
  var remaining = [];
  for (var i = 0; i < N; i++) if (inside[i]) remaining.push(i);

  while (remaining.length) {
    var seed = remaining[Math.floor(rnd() * remaining.length)];
    var want = min + Math.floor(rnd() * (max - min + 1));
    var piece = [seed];
    owner[seed] = pieces.length;
    var guard = 0;
    while (piece.length < want && guard++ < 50) {
      var from = piece[Math.floor(rnd() * piece.length)];
      var free = nbrs(from);
      if (!free.length) continue;
      var next = free[Math.floor(rnd() * free.length)];
      owner[next] = pieces.length;
      piece.push(next);
    }
    if (piece.length < min) {
      // Too small: merge into a neighbouring piece if that keeps it under max.
      var merged = false;
      for (var k = 0; k < piece.length && !merged; k++) {
        var r = Math.floor(piece[k] / grid), c = piece[k] % grid;
        var around = [piece[k] - grid, piece[k] + grid, piece[k] - 1, piece[k] + 1];
        for (var a = 0; a < around.length; a++) {
          var j = around[a];
          if (j < 0 || j >= N) continue;
          if (Math.abs((j % grid) - c) + Math.abs(Math.floor(j / grid) - r) !== 1) continue;
          var o = owner[j];
          if (o >= 0 && o !== pieces.length && pieces[o].length + piece.length <= max + 1) {
            piece.forEach(function (cell) { owner[cell] = o; pieces[o].push(cell); });
            merged = true; break;
          }
        }
      }
      if (!merged) return null;
    } else {
      pieces.push(piece);
    }
    remaining = remaining.filter(function (cell) { return owner[cell] < 0; });
  }
  return pieces;
}

/* Normalise a piece to cells relative to its top-left, as [r, c] pairs. */
function normalizeCells(cells, grid) {
  var minR = Infinity, minC = Infinity;
  cells.forEach(function (i) {
    minR = Math.min(minR, Math.floor(i / grid)); minC = Math.min(minC, i % grid);
  });
  var out = cells.map(function (i) { return [Math.floor(i / grid) - minR, (i % grid) - minC]; });
  out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  return out;
}

function makeShapesLevel(n) {
  var spec = shapesSpec(n);
  var rnd = shapesRandom(n * 2246822519 + 777);
  for (var attempt = 0; attempt < 300; attempt++) {
    var inside = growOutline(spec.grid, spec.cells, rnd);
    if (!inside) continue;
    var pieces = cutPieces(spec.grid, inside, spec.min, spec.max, rnd);
    if (!pieces || pieces.length < 2) continue;
    // Shuffle piece order so the tray doesn't hint at the layout.
    for (var i = pieces.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = pieces[i]; pieces[i] = pieces[j]; pieces[j] = t;
    }
    return {
      number: n, grid: spec.grid,
      inside: Array.prototype.slice.call(inside),
      pieces: pieces.map(function (p, k) { return { cells: normalizeCells(p, spec.grid), color: k % SHAPE_COLORS.length }; })
    };
  }
  return null;
}
