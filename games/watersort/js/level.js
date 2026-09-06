/* Level generation. Deals are random, then checked with a solver — an
   unsolvable deal is the one thing that would make this game feel broken. */

var CAP = 4;   // units of liquid per tube

var COLORS = [
  '#e5484d', '#4fa3f7', '#3fb950', '#ffd645', '#a06cf0',
  '#ff8a3d', '#26c6c6', '#f06ca8', '#8b5a2b', '#c3d130'
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

/* Depth-first search with a visited set. Small state spaces, so this is
   comfortably fast; the node cap stops a pathological deal hanging the page. */
function isSolvable(state, nodeCap) {
  nodeCap = nodeCap || 120000;
  var seen = {};
  var stack = [state.map(function (t) { return t.slice(); })];
  var nodes = 0;

  while (stack.length) {
    var cur = stack.pop();
    if (isSolved(cur)) return true;
    if (++nodes > nodeCap) return false;

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
        stack.push(next);
      }
    }
  }
  return false;
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
  // Ramp up slowly: three colours at first, one more every couple of levels.
  var colorCount = Math.min(3 + Math.floor((n - 1) / 2), 9);
  var empties = 2;

  for (var attempt = 0; attempt < 60; attempt++) {
    var state = deal(colorCount, empties);
    if (isSolved(state)) continue;
    if (isSolvable(state)) return { number: n, colors: colorCount, state: state };
  }
  // Give the player an easier board rather than an unsolvable one.
  return { number: n, colors: colorCount, state: deal(Math.max(3, colorCount - 1), empties + 1) };
}
