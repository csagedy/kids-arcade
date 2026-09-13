/* Flow level generation. A level is built backwards: the grid is carved into
   non-overlapping paths that together cover every cell, and the ends of each
   path become the coloured dots. So the puzzle always has at least one
   solution, and it fills the board. The RNG is seeded from the level number
   so level 12 is the same puzzle on every phone, every time. */

var FLOW_COLORS = [
  '#e5484d', '#4fa3f7', '#3fb950', '#ffd645', '#ff8a3d',
  '#a06cf0', '#26c6c6', '#f06ca8', '#c3d130', '#8b5a2b', '#eceff4', '#7a4bd0'
];

function seededRandom(seed) {
  var s = seed >>> 0 || 1;
  return function () {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* How big and how many colours a level is. Ramps gently. */
function flowLevelSpec(n) {
  if (n <= 8)  return { size: 5, paths: 4 + (n > 4 ? 1 : 0) };
  if (n <= 20) return { size: 6, paths: 5 + (n > 14 ? 1 : 0) };
  if (n <= 40) return { size: 7, paths: 6 + (n > 30 ? 1 : 0) };
  if (n <= 70) return { size: 8, paths: 7 + (n > 55 ? 1 : 0) };
  return { size: 9, paths: 8 + (n % 3) };
}

/* Try to carve `paths` non-crossing paths covering the whole size x size
   grid. Returns array of paths (each an array of cell indices) or null. */
function carve(size, paths, rnd) {
  var N = size * size;
  var owner = new Int8Array(N).fill(-1);
  var list = [];

  function nbrs(i) {
    var r = Math.floor(i / size), c = i % size, out = [];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  }
  function freeNbrs(i) { return nbrs(i).filter(function (j) { return owner[j] < 0; }); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  // Seed each path with a random free cell.
  for (var p = 0; p < paths; p++) {
    var free = [];
    for (var i = 0; i < N; i++) if (owner[i] < 0) free.push(i);
    if (!free.length) return null;
    var s = pick(free);
    owner[s] = p;
    list.push([s]);
  }

  // Grow paths from either end until nothing can grow. Prefer the path that
  // is shortest so lengths stay comparable and nothing ends up as a dot pair.
  var grew = true;
  while (grew) {
    grew = false;
    var order = list.map(function (_, i) { return i; }).sort(function (a, b) {
      return list[a].length - list[b].length + (rnd() - 0.5);
    });
    for (var k = 0; k < order.length; k++) {
      var path = list[order[k]];
      var ends = rnd() < 0.5 ? [path[0], path[path.length - 1]] : [path[path.length - 1], path[0]];
      for (var e = 0; e < 2; e++) {
        var fn = freeNbrs(ends[e]);
        if (!fn.length) continue;
        var next = pick(fn);
        owner[next] = order[k];
        if (ends[e] === path[0]) path.unshift(next); else path.push(next);
        grew = true;
        break;
      }
    }
  }

  // Every cell must be covered and every path must be at least 3 long.
  for (var j = 0; j < N; j++) if (owner[j] < 0) return null;
  for (var q = 0; q < list.length; q++) if (list[q].length < 3) return null;
  return list;
}

function makeFlowLevel(n) {
  var spec = flowLevelSpec(n);
  var rnd = seededRandom(n * 2654435761 + 12345);
  for (var attempt = 0; attempt < 400; attempt++) {
    var paths = carve(spec.size, spec.paths, rnd);
    if (paths) {
      return {
        number: n, size: spec.size,
        pairs: paths.map(function (p, i) { return { color: i, a: p[0], b: p[p.length - 1] }; }),
        solution: paths
      };
    }
  }
  // Fewer colours is always easier to carve; degrade rather than fail.
  spec.paths--;
  for (var again = 0; again < 400; again++) {
    var alt = carve(spec.size, Math.max(2, spec.paths), rnd);
    if (alt) {
      return {
        number: n, size: spec.size,
        pairs: alt.map(function (p, i) { return { color: i, a: p[0], b: p[p.length - 1] }; }),
        solution: alt
      };
    }
  }
  return null;
}
