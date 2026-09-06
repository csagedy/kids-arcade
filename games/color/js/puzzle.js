/* A puzzle is: a palette (1-based; 0 means "blank paper") and one colour index per cell. */

function makePuzzle(id, name, w, h, palette, cells) {
  var counts = new Array(palette.length).fill(0);
  for (var i = 0; i < cells.length; i++) counts[cells[i]]++;
  return {
    id: id, name: name, w: w, h: h,
    palette: palette,          // palette[0] is null, colours live at 1..N
    cells: cells,              // Uint8Array, length w*h
    counts: counts,            // cells per colour, so we can show what's left
    total: cells.length - counts[0]
  };
}

function puzzleFromArt(def) {
  var chars = Object.keys(def.legend);
  var palette = [null].concat(chars.map(function (c) { return def.legend[c]; }));
  var index = {};
  chars.forEach(function (c, i) { index[c] = i + 1; });

  var h = def.art.length, w = def.art[0].length;
  var cells = new Uint8Array(w * h);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var ch = def.art[y][x];
      cells[y * w + x] = ch === '.' ? 0 : index[ch];
    }
  }
  return makePuzzle(def.id, def.name, w, h, palette, cells);
}

/* ---------- photo import ---------- */

/* Downscale to a grid, reduce to `colors` colours, and hand back a puzzle.
   Everything happens on this device; the image is never uploaded. */
function puzzleFromImage(img, opts) {
  opts = opts || {};
  var size = opts.size || 44;
  var colors = opts.colors || 14;

  var ratio = img.width / img.height;
  var w = ratio >= 1 ? size : Math.max(8, Math.round(size * ratio));
  var h = ratio >= 1 ? Math.max(8, Math.round(size / ratio)) : size;

  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var ctx = c.getContext('2d');
  // Two-step downscale keeps detail that a single huge jump would alias away.
  ctx.drawImage(img, 0, 0, w, h);
  var data = ctx.getImageData(0, 0, w, h).data;

  var pixels = [];
  for (var i = 0; i < w * h; i++) {
    pixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }

  var result = quantize(pixels, colors);
  var palette = [null].concat(result.palette.map(function (p) { return rgbToHex(p[0], p[1], p[2]); }));
  var cells = new Uint8Array(w * h);
  for (var j = 0; j < cells.length; j++) cells[j] = result.indices[j] + 1;

  var id = 'photo-' + Date.now().toString(36);
  return makePuzzle(id, opts.name || 'My Picture', w, h, palette, cells);
}

/* ---------- persistence ---------- */

function progressKey(id) { return 'cbn.progress.' + id; }

function loadProgress(puzzle) {
  var saved = store.get(progressKey(puzzle.id), null);
  var flags = saved ? unpackBits(saved, puzzle.cells.length) : new Uint8Array(puzzle.cells.length);
  // Blank cells count as already done so progress maths stays simple.
  for (var i = 0; i < puzzle.cells.length; i++) if (puzzle.cells[i] === 0) flags[i] = 1;
  return flags;
}

function saveProgress(puzzle, flags) { store.set(progressKey(puzzle.id), packBits(flags)); }
function clearProgress(puzzle) { store.del(progressKey(puzzle.id)); }

/* How many of this puzzle's paintable cells are filled in. */
function paintedCount(puzzle, flags) {
  var n = 0;
  for (var i = 0; i < flags.length; i++) if (flags[i] && puzzle.cells[i] !== 0) n++;
  return n;
}

/* Custom (photo) puzzles are stored whole; built-ins only store progress. */
var CUSTOM_KEY = 'cbn.custom';

function listCustomPuzzles() {
  var raw = store.get(CUSTOM_KEY, []);
  return raw.map(function (r) {
    return makePuzzle(r.id, r.name, r.w, r.h, r.palette, rleDecode(r.cells, r.w * r.h));
  });
}

function saveCustomPuzzle(p) {
  var raw = store.get(CUSTOM_KEY, []);
  raw.unshift({
    id: p.id, name: p.name, w: p.w, h: p.h,
    palette: p.palette, cells: rleEncode(p.cells)
  });
  return store.set(CUSTOM_KEY, raw);
}

function deleteCustomPuzzle(id) {
  var raw = store.get(CUSTOM_KEY, []).filter(function (r) { return r.id !== id; });
  store.set(CUSTOM_KEY, raw);
  store.del(progressKey(id));
}
