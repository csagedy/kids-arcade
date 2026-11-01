/* Pictures for Jigsaw.

   The built-in pictures are Color by Number's pixel art (BUILTIN_PUZZLES,
   loaded read-only from games/color/js), shown finished and scaled up with
   nearest-neighbour so every square stays crisp. Photos from the camera roll
   come from photos.js. Every picture is a { id, name, theme, w, h, kind }
   with a source that can draw itself at any size:

     Pics.source(pic)  -> canvas or image (w x h for pixel art)
     Pics.draw(ctx, pic, x, y, w, h)  draws it into a box (crisp for pixel art)
     Pics.thumb(pic)   -> a small canvas for the library
*/
var Pics = (function () {
  var THEMES = [
    { id: 'pets', name: 'Pets & farm', emoji: '🐶' },
    { id: 'wild', name: 'Wild animals', emoji: '🦁' },
    { id: 'sea', name: 'Under the sea', emoji: '🐠' },
    { id: 'dinos', name: 'Dinos & dragons', emoji: '🦕' },
    { id: 'magic', name: 'Magic', emoji: '🦄' },
    { id: 'go', name: 'Things that go', emoji: '🚒' },
    { id: 'food', name: 'Yummy', emoji: '🍩' },
    { id: 'space', name: 'Space & robots', emoji: '🚀' },
    { id: 'outdoors', name: 'Outdoors', emoji: '🌻' },
    { id: 'shapes', name: 'Shapes & patterns', emoji: '⭐' },
    { id: 'more', name: 'More pictures', emoji: '🎨' }
  ];
  var themeIds = {};
  THEMES.forEach(function (t) { themeIds[t.id] = 1; });

  var builtin = [];
  var src = typeof BUILTIN_PUZZLES !== 'undefined' && Array.isArray(BUILTIN_PUZZLES) ? BUILTIN_PUZZLES : [];
  src.forEach(function (p) {
    if (!p || !p.id || !Array.isArray(p.art) || !p.art.length || !p.legend) return;
    var w = p.art[0].length, h = p.art.length;
    if (!w || p.art.some(function (r) { return typeof r !== 'string' || r.length !== w; })) return;
    builtin.push({
      id: p.id, name: p.name || p.id, theme: themeIds[p.theme] ? p.theme : 'more',
      w: w, h: h, kind: 'pixel', art: p.art, legend: p.legend
    });
  });
  // smaller (simpler) pictures first inside each theme
  builtin.sort(function (a, b) { return Math.max(a.w, a.h) - Math.max(b.w, b.h); });

  var byId = {};
  builtin.forEach(function (p) { byId[p.id] = p; });

  function hexRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* One canvas pixel per square, made once per picture. */
  function pixelCanvas(p) {
    if (p._c) return p._c;
    var c = document.createElement('canvas');
    c.width = p.w; c.height = p.h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(p.w, p.h), d = img.data;
    var cols = {};
    Object.keys(p.legend).forEach(function (k) { cols[k] = hexRgb(p.legend[k]); });
    for (var y = 0; y < p.h; y++) {
      var row = p.art[y];
      for (var x = 0; x < p.w; x++) {
        var o = (y * p.w + x) * 4, col = cols[row.charAt(x)] || [255, 255, 255];
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    p._c = c;
    return c;
  }

  function source(p) { return p.kind === 'photo' ? p.img : pixelCanvas(p); }

  /* Draws the picture into a box. Pixel art is scaled with no smoothing, and
     snapped to whole device pixels per square where that barely changes the
     size, so the squares come out even. */
  function draw(ctx, p, x, y, w, h) {
    var s = source(p);
    if (!s) return;
    ctx.save();
    if (p.kind === 'pixel') {
      ctx.imageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(s, 0, 0, s.width || s.naturalWidth, s.height || s.naturalHeight, x, y, w, h);
    ctx.restore();
  }

  function thumb(p, max) {
    max = max || 0;
    var c = document.createElement('canvas');
    if (p.kind === 'pixel' && !max) {
      c.width = p.w; c.height = p.h;
      c.getContext('2d').drawImage(pixelCanvas(p), 0, 0);
      c.className = 'pixelated';
      return c;
    }
    var m = max || 160, sc = Math.min(1, m / Math.max(p.w, p.h));
    c.width = Math.max(1, Math.round(p.w * sc)); c.height = Math.max(1, Math.round(p.h * sc));
    draw(c.getContext('2d'), p, 0, 0, c.width, c.height);
    if (p.kind === 'pixel') c.className = 'pixelated';
    return c;
  }

  return {
    THEMES: THEMES,
    builtin: builtin,
    get: function (id) { return byId[id] || Photos.get(id) || null; },
    source: source,
    draw: draw,
    thumb: thumb
  };
})();
