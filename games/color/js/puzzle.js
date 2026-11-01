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
  var p = makePuzzle(def.id, def.name, w, h, palette, cells);
  p.theme = def.theme || '';
  p.rev = def.rev || 1;          // bumped when a picture is redrawn, so old saves are let go
  p.batch = def.batch || 1;      // which picture pack it came in (for the "New" badge)
  return p;
}

/* Built-in pictures are parsed once and kept. */
var builtinCache = null;
function builtinPuzzles() {
  if (!builtinCache) {
    builtinCache = [];
    BUILTIN_PUZZLES.forEach(function (def) {
      try { builtinCache.push(puzzleFromArt(def)); } catch (e) {}
    });
  }
  return builtinCache;
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
  // Transparent pixels read as black once flattened, so lay down white paper first.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
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

/* A save is the painted flags as a base64 bitset. A redrawn picture
   (rev 2+) prefixes its rev, "r2:<bits>"; plain bits are rev 1. A save made
   for another drawing, or of the wrong length, is let go: a finished one
   stays finished, anything else starts clean. */
function loadProgress(puzzle) {
  var n = puzzle.cells.length;
  var flags = new Uint8Array(n);
  var saved = store.get(progressKey(puzzle.id), null);
  if (typeof saved === 'string' && saved) {
    var m = /^r(\d+):(.*)$/.exec(saved), rev = m ? +m[1] : 1, bits = m ? m[2] : saved;
    var raw = null;
    try { raw = atob(bits); } catch (e) {}
    if (raw !== null && rev === (puzzle.rev || 1) && raw.length === Math.ceil(n / 8)) {
      flags = unpackBits(bits, n);
    } else if (raw !== null && raw.length && allOnes(raw)) {
      flags.fill(1);
    }
  }
  // Blank cells count as already done so progress maths stays simple.
  for (var i = 0; i < n; i++) if (puzzle.cells[i] === 0) flags[i] = 1;
  return flags;
}

/* Every bit set (a finished picture, whatever its old size). */
function allOnes(raw) {
  for (var i = 0; i < raw.length - 1; i++) if (raw.charCodeAt(i) !== 255) return false;
  var last = raw.charCodeAt(raw.length - 1);
  return last !== 0 && (last & (last + 1)) === 0;   // 1, 3, 7, ... 255
}

function saveProgress(puzzle, flags) {
  var bits = packBits(flags);
  store.set(progressKey(puzzle.id), (puzzle.rev || 1) > 1 ? 'r' + puzzle.rev + ':' + bits : bits);
}
function clearProgress(puzzle) { store.del(progressKey(puzzle.id)); }

/* How many of this puzzle's paintable cells are filled in. */
function paintedCount(puzzle, flags) {
  var n = 0;
  for (var i = 0; i < flags.length; i++) if (flags[i] && puzzle.cells[i] !== 0) n++;
  return n;
}

/* Custom (photo) puzzles are stored whole; built-ins only store progress. */
var CUSTOM_KEY = 'cbn.custom';

function customList() {
  var raw = store.get(CUSTOM_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

/* A damaged or hand-edited save must never blank the library: skip records
   that don't make sense and treat unknown colour numbers as blank paper. */
function listCustomPuzzles() {
  var out = [];
  customList().forEach(function (r) {
    try {
      if (!r || typeof r.id !== 'string' || typeof r.cells !== 'string' || !Array.isArray(r.palette)) return;
      var w = r.w | 0, h = r.h | 0;
      if (w < 1 || h < 1 || w > 200 || h > 200) return;
      var palette = r.palette.map(function (c, i) {
        return i === 0 ? null : (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '#cccccc');
      });
      var cells = rleDecode(r.cells, w * h);
      for (var i = 0; i < cells.length; i++) if (cells[i] >= palette.length) cells[i] = 0;
      var p = makePuzzle(r.id, String(r.name || 'My Picture'), w, h, palette, cells);
      if (p.total > 0) out.push(p);
    } catch (e) {}
  });
  return out;
}

function saveCustomPuzzle(p) {
  var raw = customList();
  raw.unshift({
    id: p.id, name: p.name, w: p.w, h: p.h,
    palette: p.palette, cells: rleEncode(p.cells)
  });
  return store.set(CUSTOM_KEY, raw);
}

function deleteCustomPuzzle(id) {
  var raw = customList().filter(function (r) { return !r || r.id !== id; });
  store.set(CUSTOM_KEY, raw);
  store.del(progressKey(id));
}
