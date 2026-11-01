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
  this.shineUntil = 0;
  this.dirty = true;

  var self = this;
  this.frame = function () {
    var now = performance.now();
    if (self.dirty || now < self.hintUntil || now < self.shineUntil) self.draw();
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
    tint = 'rgb(' + [0, 1, 2].map(function (c) { return Math.round(rgb[c] * 0.4 + 255 * 0.6); }).join(',') + ')';
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

Renderer.prototype.unmarkPainted = function (i) {
  var p = this.puzzle;
  this.flags[i] = 0;
  this.pctx.clearRect(i % p.w, Math.floor(i / p.w), 1, 1);
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
  var s = Math.min((this.cw - 32) / p.w, (this.ch - 40) / p.h);
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
  // the sheet of paper: a soft shadow and a dark under-edge, like the kit's boards
  var pw = p.w * v.s, ph = p.h * v.s, rad = Math.min(14, Math.max(4, v.s * 0.6));
  ctx.save();
  ctx.fillStyle = '#090a22';
  roundRectPath(ctx, v.tx - 6, v.ty - 6 + 8, pw + 12, ph + 12, rad + 6); ctx.fill();
  ctx.shadowColor = 'rgba(5, 6, 30, 0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, v.tx - 6, v.ty - 6, pw + 12, ph + 12, rad + 6); ctx.fill();
  ctx.restore();

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
    var grow = 4 + pulse * Math.max(6, v.s * 0.4);
    ctx.strokeStyle = 'rgba(255, 210, 63,' + (0.6 + 0.4 * pulse) + ')';
    ctx.lineWidth = 4;
    roundRectPath(ctx, x - grow, y - grow, v.s + grow * 2, v.s + grow * 2, 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(214, 154, 0, 0.9)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, x - 2, y - 2, v.s + 4, v.s + 4, 4); ctx.stroke();
  } else {
    this.hintIdx = -1;
  }

  if (now < this.shineUntil) this.drawShine(ctx, now, pw, ph);

  this.dirty = false;
};

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* Glide the view to { s, tx, ty } (zoom buttons, hints, the finish). */
Renderer.prototype.animateTo = function (to, ms) {
  var self = this, from = { s: this.view.s, tx: this.view.tx, ty: this.view.ty }, t0 = performance.now();
  ms = Kit.reduced ? 0 : (ms || 320);
  this.animId = (this.animId || 0) + 1;
  var id = this.animId;
  (function step(now) {
    if (id !== self.animId) return;
    var k = ms ? Math.min(1, (now - t0) / ms) : 1, e = 1 - Math.pow(1 - k, 3);
    self.view.s = from.s + (to.s - from.s) * e;
    self.view.tx = from.tx + (to.tx - from.tx) * e;
    self.view.ty = from.ty + (to.ty - from.ty) * e;
    self.dirty = true;
    if (k < 1) requestAnimationFrame(step); else self.clamp();
  })(t0);
};

/* The view that shows the whole picture. */
Renderer.prototype.fitView = function () {
  var p = this.puzzle, s = Math.min((this.cw - 32) / p.w, (this.ch - 40) / p.h);
  return { s: s, tx: (this.cw - p.w * s) / 2, ty: (this.ch - p.h * s) / 2 };
};

/* Zoom by k about the middle of the stage, kept within the usual limits. */
Renderer.prototype.zoomView = function (k) {
  var v = this.view, s = Math.max(this.fitScale * 0.9, Math.min(v.s * k, 90)), kk = s / v.s;
  var cx = this.cw / 2, cy = this.ch / 2;
  return { s: s, tx: cx - (cx - v.tx) * kk, ty: cy - (cy - v.ty) * kk };
};

/* The finish: a band of light sweeps across the picture and little
   four-point sparkles twinkle over it. */
Renderer.prototype.shine = function (ms) {
  var now = performance.now();
  this.shineStart = now;
  this.shineMs = ms;
  this.shineUntil = now + ms + 40;
  this.sparkles = [];
  for (var i = 0; i < 16; i++) {
    this.sparkles.push({ u: 0.06 + Math.random() * 0.88, v: 0.06 + Math.random() * 0.88, at: Math.random() * 0.7, size: 0.6 + Math.random() * 0.6 });
  }
  this.dirty = true;
};

Renderer.prototype.drawShine = function (ctx, now, pw, ph) {
  var v = this.view, t = (now - this.shineStart) / this.shineMs;
  if (t < 0 || t > 1) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(v.tx, v.ty, pw, ph); ctx.clip();
  // the sweep: a soft white band moving along the diagonal
  var span = pw + ph, pos = -0.25 + t * 1.5, band = 0.18;
  var g = ctx.createLinearGradient(v.tx, v.ty, v.tx + span / 2, v.ty + span / 2);
  var stop = function (o, a) { if (o > 0 && o < 1) g.addColorStop(o, 'rgba(255,255,255,' + a + ')'); };
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  stop(pos - band, 0); stop(pos, 0.6); stop(pos + band, 0);
  ctx.fillStyle = g;
  ctx.fillRect(v.tx, v.ty, pw, ph);
  ctx.restore();
  var unit = Math.min(pw, ph) / 9;
  for (var i = 0; i < this.sparkles.length; i++) {
    var sp = this.sparkles[i], k = (t - sp.at) / 0.3;
    if (k <= 0 || k >= 1) continue;
    var r = Math.sin(k * Math.PI) * unit * sp.size, x = v.tx + sp.u * pw, y = v.ty + sp.v * ph;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(k * 1.2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 210, 63, 0.9)'; ctx.shadowBlur = r * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.quadraticCurveTo(0, 0, 0, r);
    ctx.quadraticCurveTo(0, 0, -r, 0); ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.fill();
    ctx.restore();
  }
};
