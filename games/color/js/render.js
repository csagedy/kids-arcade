/* Three cached layers, two drawImage calls a frame:
     paint   - w x h, one pixel per cell, holds what's been coloured in
     overlay - w*CELL x h*CELL, the grey numbered cells still to do
   Painting a cell writes one pixel and punches a hole in the overlay, so
   panning and zooming never re-walk the grid. */

var CELL = 22;

function Renderer(canvas, stage) {
  this.canvas = canvas;
  this.stage = stage;
  this.ctx = canvas.getContext('2d');
  this.view = { s: 1, tx: 0, ty: 0 };
  this.active = 1;
  this.hintIdx = -1;
  this.hintUntil = 0;
  this.dirty = true;

  var self = this;
  this.frame = function () {
    if (self.dirty || performance.now() < self.hintUntil) self.draw();
    requestAnimationFrame(self.frame);
  };
  requestAnimationFrame(this.frame);
}

Renderer.prototype.setPuzzle = function (puzzle, flags) {
  this.puzzle = puzzle;
  this.flags = flags;

  this.paint = document.createElement('canvas');
  this.paint.width = puzzle.w;
  this.paint.height = puzzle.h;
  this.pctx = this.paint.getContext('2d');

  this.overlay = document.createElement('canvas');
  this.overlay.width = puzzle.w * CELL;
  this.overlay.height = puzzle.h * CELL;
  this.octx = this.overlay.getContext('2d');

  for (var i = 0; i < puzzle.cells.length; i++) {
    if (flags[i] && puzzle.cells[i] !== 0) this.drawPaintPixel(i);
  }
  this.rebuildOverlay();
  this.resize();
  this.fit();
};

Renderer.prototype.drawPaintPixel = function (i) {
  var p = this.puzzle;
  this.pctx.fillStyle = p.palette[p.cells[i]];
  this.pctx.fillRect(i % p.w, Math.floor(i / p.w), 1, 1);
};

/* Cells of the selected colour get a wash of that colour so they're easy to
   spot — the number alone is hard work for a five-year-old. */
Renderer.prototype.rebuildOverlay = function () {
  var p = this.puzzle, ctx = this.octx;
  ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  var tint = null;
  if (p.palette[this.active]) {
    var rgb = hexToRgb(p.palette[this.active]);
    tint = 'rgb(' + [0, 1, 2].map(function (c) { return Math.round(rgb[c] * 0.22 + 255 * 0.78); }).join(',') + ')';
  }

  for (var i = 0; i < p.cells.length; i++) {
    var v = p.cells[i];
    if (v === 0 || this.flags[i]) continue;
    var x = (i % p.w) * CELL, y = Math.floor(i / p.w) * CELL;

    ctx.fillStyle = v === this.active ? tint : '#ededed';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);

    var label = String(v);
    ctx.fillStyle = v === this.active ? '#3a3a3a' : '#9a9a9a';
    ctx.font = (label.length > 1 ? 9 : 11) + 'px -apple-system, system-ui, sans-serif';
    ctx.fillText(label, x + CELL / 2, y + CELL / 2 + 0.5);
  }
  this.dirty = true;
};

Renderer.prototype.setActive = function (n) {
  if (this.active === n) return;
  this.active = n;
  this.rebuildOverlay();
};

Renderer.prototype.markPainted = function (i) {
  this.flags[i] = 1;
  this.drawPaintPixel(i);
  var p = this.puzzle;
  this.octx.clearRect((i % p.w) * CELL, Math.floor(i / p.w) * CELL, CELL, CELL);
  this.dirty = true;
};

Renderer.prototype.resize = function () {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var r = this.stage.getBoundingClientRect();
  this.cw = r.width; this.ch = r.height;
  this.canvas.width = Math.round(r.width * dpr);
  this.canvas.height = Math.round(r.height * dpr);
  this.dpr = dpr;
  this.dirty = true;
};

Renderer.prototype.fit = function () {
  var p = this.puzzle;
  var s = Math.min(this.cw / p.w, this.ch / p.h) * 0.92;
  this.view.s = s;
  this.view.tx = (this.cw - p.w * s) / 2;
  this.view.ty = (this.ch - p.h * s) / 2;
  this.fitScale = s;
  this.dirty = true;
};

Renderer.prototype.clamp = function () {
  var v = this.view, p = this.puzzle;
  v.s = Math.max(this.fitScale * 0.9, Math.min(v.s, 90));
  // Keep at least a third of the picture on screen in each direction.
  var w = p.w * v.s, h = p.h * v.s;
  var padX = Math.min(this.cw * 0.5, w * 0.5), padY = Math.min(this.ch * 0.5, h * 0.5);
  v.tx = Math.max(this.cw - w - padX, Math.min(v.tx, padX));
  v.ty = Math.max(this.ch - h - padY, Math.min(v.ty, padY));
  this.dirty = true;
};

Renderer.prototype.cellAt = function (px, py) {
  var v = this.view, p = this.puzzle;
  var x = Math.floor((px - v.tx) / v.s), y = Math.floor((py - v.ty) / v.s);
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return -1;
  return y * p.w + x;
};

Renderer.prototype.showHint = function (i) {
  this.hintIdx = i;
  this.hintUntil = performance.now() + 2200;
  this.dirty = true;
};

Renderer.prototype.draw = function () {
  var ctx = this.ctx, v = this.view, p = this.puzzle;
  if (!p) return;

  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  ctx.clearRect(0, 0, this.cw, this.ch);
  ctx.save();
  ctx.translate(v.tx, v.ty);
  ctx.scale(v.s, v.s);
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, p.w, p.h);
  ctx.drawImage(this.paint, 0, 0, p.w, p.h);
  ctx.drawImage(this.overlay, 0, 0, p.w, p.h);
  ctx.restore();

  var now = performance.now();
  if (this.hintIdx >= 0 && now < this.hintUntil) {
    var x = (this.hintIdx % p.w) * v.s + v.tx, y = Math.floor(this.hintIdx / p.w) * v.s + v.ty;
    var pulse = 0.5 + 0.5 * Math.sin(now / 140);
    ctx.strokeStyle = 'rgba(255,197,61,' + (0.55 + 0.45 * pulse) + ')';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 2, y - 2, v.s + 4, v.s + 4);
  } else {
    this.hintIdx = -1;
  }

  this.dirty = false;
};
