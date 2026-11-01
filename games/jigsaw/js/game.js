/* Jigsaw model: which pieces are where, and saving it.

   A piece is in one of three places:
     TRAY   loose in the tray, at (u, v) = its centre as a fraction of the tray
     TABLE  loose but full size, somewhere over the board or beside it. Table
            pieces belong to a group (pieces that were joined together); a
            group sits at an offset (dx, dy) in cells from its correct spot,
            so pieces of one group always line up with each other and
            (0, 0) means "in place"
     PLACED locked into the board

   Storage: jig.p.<picture id> holds the puzzle in progress for that picture
   (one per picture), jig.done maps picture id -> a bit mask of the sizes finished (bit k for
   k x k), and jig.level is the last size picked (k). */
var Jig = (function () {
  var TRAY = 0, TABLE = 1, PLACED = 2;
  var LEVELS = [2, 3, 4, 5, 6, 7];          // 4, 9, 16, 25, 36, 49 pieces

  function key(id) { return 'jig.p.' + id; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function Puzzle(pic, k, saved) {
    this.pic = pic;
    this.k = k;
    var g = Shapes.grid(k, pic.w / pic.h);
    this.cols = g.cols; this.rows = g.rows;
    this.n = g.cols * g.rows;
    this.cut = Shapes.cut(g.cols, g.rows, Shapes.hash(pic.id + ':' + g.cols + 'x' + g.rows));
    this.ghost = k <= 3;
    this.pieces = [];
    this.groups = {};
    for (var j = 0; j < this.rows; j++) {
      for (var i = 0; i < this.cols; i++) {
        var idx = j * this.cols + i;
        this.pieces.push({ idx: idx, i: i, j: j, st: TRAY, u: 0.5, v: 0.5, g: idx, edge: Shapes.isEdge(this.cut, i, j) });
      }
    }
    this.restored = !!(saved && this.restore(saved));
    if (!this.restored) this.scatter();
  }

  /* Deals every loose single piece into tray slots, in a random order
     (fresh puzzle, or the Tidy button). Groups on the table stay put.
     trayOnly: just re-deal what's in the tray (the tray changed shape). */
  Puzzle.prototype.scatter = function (aspect, trayOnly) {
    var loose = this.pieces.filter(function (p) { return p.st === TRAY; });
    var self = this;
    if (!trayOnly) this.pieces.forEach(function (p) {
      if (p.st === TABLE && self.members(p.g).length === 1) { p.st = TRAY; loose.push(p); }
    });
    for (var a = loose.length - 1; a > 0; a--) {
      var b = Math.floor(Math.random() * (a + 1)), t = loose[a]; loose[a] = loose[b]; loose[b] = t;
    }
    var sl = this.slots(loose.length, aspect || 1);
    loose.forEach(function (p, n) { p.u = sl[n][0]; p.v = sl[n][1]; p.st = TRAY; p.g = p.idx; });
    this.regroup();
  };

  /* n slot centres spread evenly over a tray of aspect a (w / h), with a
     little wobble so it looks like a pile of pieces, not a grid. */
  Puzzle.prototype.slots = function (n, a) {
    var best = 1, bestS = 0;
    for (var cc = 1; cc <= n; cc++) {
      var rr = Math.ceil(n / cc), s = Math.min(a / cc, 1 / rr);
      if (s > bestS) { bestS = s; best = cc; }
    }
    var cols = best, rows = Math.ceil(n / cols), out = [];
    for (var q = 0; q < n; q++) {
      var c = q % cols, r = Math.floor(q / cols);
      var inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
      var off = (cols - inRow) / 2;
      var wob = function () { return (Math.random() - 0.5) * 0.12; };
      out.push([clamp((c + off + 0.5 + wob()) / cols, 0, 1), clamp((r + 0.5 + wob()) / rows, 0, 1)]);
    }
    return out;
  };

  Puzzle.prototype.members = function (g) {
    return this.pieces.filter(function (p) { return p.st === TABLE && p.g === g; });
  };

  /* Rebuild the group table from the pieces. */
  Puzzle.prototype.regroup = function () {
    var gs = {};
    this.pieces.forEach(function (p) {
      if (p.st !== TABLE) return;
      var grp = gs[p.g] || (gs[p.g] = { id: p.g, dx: p.dx, dy: p.dy });
      p.dx = grp.dx; p.dy = grp.dy;
    });
    this.groups = gs;
  };

  Puzzle.prototype.placed = function () {
    var n = 0;
    this.pieces.forEach(function (p) { if (p.st === PLACED) n++; });
    return n;
  };
  Puzzle.prototype.isDone = function () { return this.placed() === this.n; };

  Puzzle.prototype.toJSON = function () {
    return {
      v: 1, k: this.k, c: this.cols, r: this.rows, ghost: !!this.ghost,
      p: this.pieces.map(function (p) {
        if (p.st === TRAY) return [0, Math.round(p.u * 1000) / 1000, Math.round(p.v * 1000) / 1000];
        if (p.st === TABLE) return [1, Math.round(p.dx * 1000) / 1000, Math.round(p.dy * 1000) / 1000, p.g];
        return [2];
      })
    };
  };

  /* Takes a save if it fits this picture and size exactly; anything odd
     (old format, junk, another cut) returns false and the puzzle starts
     fresh. */
  Puzzle.prototype.restore = function (s) {
    if (!s || typeof s !== 'object' || s.v !== 1 || s.c !== this.cols || s.r !== this.rows || !Array.isArray(s.p) || s.p.length !== this.n) return false;
    var out = [], firstOf = {};
    for (var q = 0; q < this.n; q++) {
      var e = s.p[q];
      if (!Array.isArray(e)) return false;
      if (e[0] === 0 && num(e[1]) && num(e[2])) out.push({ st: TRAY, u: clamp(e[1], 0, 1), v: clamp(e[2], 0, 1) });
      else if (e[0] === 1 && num(e[1]) && num(e[2]) && Math.abs(e[1]) < 60 && Math.abs(e[2]) < 60 && typeof e[3] === 'number' && e[3] >= 0 && e[3] < this.n && (e[3] | 0) === e[3]) {
        var f = firstOf[e[3]] || (firstOf[e[3]] = { dx: e[1], dy: e[2] });
        out.push({ st: TABLE, dx: f.dx, dy: f.dy, g: e[3] });
      } else if (e[0] === 2) out.push({ st: PLACED });
      else return false;
    }
    this.pieces.forEach(function (p, q) {
      var o = out[q];
      p.st = o.st;
      if (o.st === TRAY) { p.u = o.u; p.v = o.v; p.g = p.idx; }
      if (o.st === TABLE) { p.dx = o.dx; p.dy = o.dy; p.g = o.g; }
    });
    this.ghost = !!s.ghost;
    this.regroup();
    return true;
  };

  Puzzle.prototype.save = function () {
    if (this.isDone()) { Kit.drop(key(this.pic.id)); return; }
    Kit.save(key(this.pic.id), this.toJSON());
  };
  Puzzle.prototype.forget = function () { Kit.drop(key(this.pic.id)); };

  /* What's saved for a picture, without building it: { k, placed, n } or null. */
  function peek(id) {
    var s = Kit.load(key(id), null);
    if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.p) || LEVELS.indexOf(s.k) < 0) return null;
    var pic = Pics.get(id);
    if (!pic) return null;
    var g = Shapes.grid(s.k, pic.w / pic.h);
    if (s.c !== g.cols || s.r !== g.rows || s.p.length !== g.cols * g.rows) return null;
    var placed = 0;
    for (var q = 0; q < s.p.length; q++) {
      if (!Array.isArray(s.p[q])) return null;
      if (s.p[q][0] === 2) placed++;
    }
    return { k: s.k, placed: placed, n: s.p.length, raw: s };
  }

  function doneMap() {
    var d = Kit.load('jig.done', {});
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
    var out = {};
    Object.keys(d).forEach(function (id) { if (num(d[id]) && d[id] > 0) out[id] = d[id]; });
    return out;
  }
  // jig.done[id] is a bit mask of the sizes finished: bit k for k x k
  function markDone(id, k) {
    var d = doneMap();
    d[id] = (d[id] || 0) | (1 << k);
    Kit.save('jig.done', d);
  }
  function forgetPicture(id) {
    Kit.drop(key(id));
    var d = doneMap();
    if (d[id]) { delete d[id]; Kit.save('jig.done', d); }
  }

  return {
    TRAY: TRAY, TABLE: TABLE, PLACED: PLACED, LEVELS: LEVELS,
    Puzzle: Puzzle, peek: peek, doneMap: doneMap, markDone: markDone, forgetPicture: forgetPicture
  };
})();
