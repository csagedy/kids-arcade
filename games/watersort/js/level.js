/* Level generation. Deals are random, then checked with a solver — an
   unsolvable deal is the one thing that would make this game feel broken. */

var CAP = 4;   // units of liquid per tube

// the kit's candy palette, then two extras that stay apart from it
var COLORS = [
  '#ff5d73', '#4cc2ff', '#3ddc84', '#ffd23f', '#a77bff',
  '#ff9f43', '#2ee6c9', '#ff7ac6', '#a8693a', '#f2f4ff'
];

function topRun(tube) {
  if (!tube.length) return null;
  var color = tube[tube.length - 1], n = 1;
  while (n < tube.length && tube[tube.length - 1 - n] === color) n++;
  return { color: color, count: n };
}

function canPour(state, from, to) {
  if (from === to) return false;
  var a = state[from], b = state[to];
  if (!a.length || b.length >= CAP) return false;
  return b.length === 0 || b[b.length - 1] === a[a.length - 1];
}

function pourCount(state, from, to) {
  var run = topRun(state[from]);
  return Math.min(run.count, CAP - state[to].length);
}

function isSolved(state) {
  for (var i = 0; i < state.length; i++) {
    var t = state[i];
    if (t.length === 0) continue;
    if (t.length !== CAP) return false;
    for (var j = 1; j < t.length; j++) if (t[j] !== t[0]) return false;
  }
  return true;
}

function keyOf(state) {
  // Tubes are interchangeable, so sort them to collapse equivalent states.
  return state.map(function (t) { return t.join(','); }).sort().join('|');
}

/* How far a position is from finished: the number of separate single-colour
   runs across all tubes. Done is one run per colour, so lower is closer. */
function runCount(state) {
  var runs = 0;
  for (var i = 0; i < state.length; i++) {
    for (var j = 0; j < state[i].length; j++) {
      if (j === 0 || state[i][j] !== state[i][j - 1]) runs++;
    }
  }
  return runs;
}

/* Best-first search with a visited set: positions with fewer runs are tried
   first, which finds short solutions (so hints don't wander). It is still a
   complete search, and small enough that this is comfortably fast; the node
   cap stops a pathological deal hanging the page.
   Returns { moves: [[from,to], ...] or null, exhausted: bool } — `exhausted`
   means the whole space was searched, so a null `moves` is a proven dead end
   rather than just "ran out of patience". */
function solve(state, nodeCap) {
  nodeCap = nodeCap || 120000;
  var seen = {};
  var buckets = [];          // buckets[h] is a LIFO list of positions with h runs
  var low = 0, pending = 0, nodes = 0;

  function add(s, path) {
    var h = runCount(s);
    (buckets[h] = buckets[h] || []).push({ s: s, path: path });
    if (h < low) low = h;
    pending++;
  }
  var start = state.map(function (t) { return t.slice(); });
  low = runCount(start);
  add(start, null);

  while (pending) {
    while (!buckets[low] || !buckets[low].length) low++;
    var item = buckets[low].pop(), cur = item.s;
    pending--;
    if (isSolved(cur)) return { moves: flattenPath(item.path), exhausted: false };
    if (++nodes > nodeCap) return { moves: null, exhausted: false };

    var k = keyOf(cur);
    if (seen[k]) continue;
    seen[k] = 1;

    for (var from = 0; from < cur.length; from++) {
      if (!cur[from].length) continue;
      for (var to = 0; to < cur.length; to++) {
        if (!canPour(cur, from, to)) continue;
        // Shuffling a full single-colour tube into an empty one is never progress.
        if (cur[to].length === 0 && cur[from].length === topRun(cur[from]).count) continue;
        var next = cur.map(function (t) { return t.slice(); });
        var n = pourCount(cur, from, to);
        for (var i = 0; i < n; i++) next[to].push(next[from].pop());
        add(next, { m: [from, to], prev: item.path });
      }
    }
  }
  return { moves: null, exhausted: true };
}

function flattenPath(path) {
  var out = [];
  for (; path; path = path.prev) out.unshift(path.m);
  return out;
}

function isSolvable(state, nodeCap) {
  return !!solve(state, nodeCap).moves;
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function deal(colorCount, emptyTubes) {
  var pool = [];
  for (var c = 0; c < colorCount; c++) {
    for (var i = 0; i < CAP; i++) pool.push(c);
  }
  var state = [];
  shuffle(pool);
  for (var t = 0; t < colorCount; t++) state.push(pool.slice(t * CAP, t * CAP + CAP));
  for (var e = 0; e < emptyTubes; e++) state.push([]);
  return state;
}

function makeLevel(n) {
  // Ramp up slowly: three colours at first, one more every couple of levels
  // (so ten colours only arrive around level 15).
  var colorCount = Math.min(3 + Math.floor((n - 1) / 2), 10);
  var empties = 2;

  for (var attempt = 0; attempt < 60; attempt++) {
    var state = deal(colorCount, empties);
    if (isSolved(state)) continue;
    if (isSolvable(state)) return { number: n, colors: colorCount, state: state };
  }
  // Give the player an easier board rather than an unsolvable one: fewer
  // colours and a spare tube, checked the same way.
  for (var c = colorCount - 1; c >= 3; c--) {
    for (var again = 0; again < 20; again++) {
      var easier = deal(c, empties + 1);
      if (!isSolved(easier) && isSolvable(easier)) return { number: n, colors: c, state: easier };
    }
  }
  return { number: n, colors: 3, state: deal(3, 3) };
}
