/* Scene Maker: the scene model (no DOM). A scene is a backdrop id plus a
   list of placed stickers. Every position is relative to the scene, which
   always has the same 4:3 shape, so a picture made in portrait looks the
   same in landscape and on a phone:

     x, y   centre of the sticker, 0..1 across / down the scene
     k      the sticker's size as a fraction of the scene's width
     r      rotation in degrees, f = 1 when mirrored, z = stacking order

   Saved as small JSON through Kit.load / Kit.save:
     scene.cur      the scene on screen (saved after every change)
     scene.gallery  older scenes, newest first (at most MAX_GALLERY)        */
var SceneModel = (function () {
  'use strict';
  var M = {};
  M.MAX_ITEMS = 80;
  M.MAX_GALLERY = 24;
  M.MAX_UNDO = 40;
  M.ASPECT = 4 / 3;
  M.MIN_K = 0.04;
  M.MAX_K = 0.8;
  M.KEY_CUR = 'scene.cur';
  M.KEY_GALLERY = 'scene.gallery';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function rnd(v, n) { var p = Math.pow(10, n); return Math.round(v * p) / p; }
  var uidN = 1;
  M.newId = function () { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); };
  M.clampK = function (k) { return clamp(k, M.MIN_K, M.MAX_K); };

  /* valid(stickerId) -> bool lets the screen drop stickers it no longer draws. */
  function Scene(data, valid) {
    data = data || {};
    this.id = typeof data.id === 'string' ? data.id : M.newId();
    this.bg = typeof data.bg === 'string' ? data.bg : 'farm';
    this.t = num(data.t, Date.now());
    this.items = [];
    this.undoStack = [];
    var list = Array.isArray(data.items) ? data.items : [];
    for (var i = 0; i < list.length && this.items.length < M.MAX_ITEMS; i++) {
      var d = list[i];
      if (!d || typeof d.s !== 'string' || (valid && !valid(d.s))) continue;
      this.items.push(this._mk(d));
    }
    this._renumber();
  }
  var P = Scene.prototype;

  P._mk = function (d) {
    return {
      u: uidN++, s: d.s,
      x: clamp(num(d.x, 0.5), 0, 1), y: clamp(num(d.y, 0.5), 0, 1),
      k: M.clampK(num(d.k, 0.18)), r: num(d.r, 0) % 360, f: d.f ? 1 : 0, z: num(d.z, 0)
    };
  };
  P._renumber = function () {
    this.items.sort(function (a, b) { return a.z - b.z; });
    this.items.forEach(function (it, i) { it.z = i + 1; });
  };
  P.top = function () { return this.items.length; };
  P.full = function () { return this.items.length >= M.MAX_ITEMS; };
  P.byU = function (u) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].u === u) return this.items[i];
    return null;
  };
  P.add = function (s, x, y, k, r, f) {
    if (this.full()) return null;
    var it = this._mk({ s: s, x: x, y: y, k: k, r: r || 0, f: f, z: this.items.length + 1 });
    this.items.push(it);
    return it;
  };
  P.remove = function (u) {
    this.items = this.items.filter(function (it) { return it.u !== u; });
    this._renumber();
  };
  P.update = function (u, o) {
    var it = this.byU(u);
    if (!it) return null;
    if (o.x !== undefined) it.x = clamp(o.x, 0, 1);
    if (o.y !== undefined) it.y = clamp(o.y, 0, 1);
    if (o.k !== undefined) it.k = M.clampK(o.k);
    if (o.r !== undefined) { var r = o.r % 360; if (r > 180) r -= 360; if (r < -180) r += 360; it.r = r; }
    if (o.f !== undefined) it.f = o.f ? 1 : 0;
    return it;
  };
  P.front = function (u) {
    var it = this.byU(u);
    if (!it) return;
    it.z = this.items.length + 1;
    this._renumber();
  };
  P.copy = function (u) {
    var it = this.byU(u);
    if (!it || this.full()) return null;
    var dx = it.x > 0.85 ? -0.06 : 0.06, dy = it.y > 0.85 ? -0.06 : 0.06;
    return this.add(it.s, it.x + dx, it.y + dy, it.k, it.r, it.f);
  };
  P.setBg = function (bg) { this.bg = bg; };
  P.clear = function () { this.items = []; };
  P.isEmpty = function () { return this.items.length === 0; };

  /* ---------- undo: whole-scene snapshots (they are tiny) ---------- */
  P.snap = function () { return JSON.stringify({ bg: this.bg, items: this.toJSON().items }); };
  P.checkpoint = function () {
    this.undoStack.push(this.snap());
    if (this.undoStack.length > M.MAX_UNDO) this.undoStack.shift();
  };
  P.canUndo = function () { return this.undoStack.length > 0; };
  P.undo = function () {
    if (!this.undoStack.length) return false;
    var d = JSON.parse(this.undoStack.pop());
    var self = this;
    this.bg = d.bg;
    this.items = d.items.map(function (x) { return self._mk(x); });
    this._renumber();
    return true;
  };

  P.toJSON = function () {
    return {
      v: 1, id: this.id, bg: this.bg, t: this.t,
      items: this.items.map(function (it) {
        return { s: it.s, x: rnd(it.x, 4), y: rnd(it.y, 4), k: rnd(it.k, 4), r: Math.round(it.r), f: it.f, z: it.z };
      })
    };
  };
  M.Scene = Scene;

  /* ---------- storage ---------- */
  M.loadCurrent = function (valid) {
    var d = Kit.load(M.KEY_CUR, null);
    if (!d || typeof d !== 'object') return null;
    return new Scene(d, valid);
  };
  M.saveCurrent = function (scene) {
    scene.t = Date.now();
    return Kit.save(M.KEY_CUR, scene.toJSON());
  };
  M.gallery = function () {
    var g = Kit.load(M.KEY_GALLERY, []);
    if (!Array.isArray(g)) return [];
    return g.filter(function (d) { return d && typeof d.id === 'string' && Array.isArray(d.items); }).slice(0, M.MAX_GALLERY);
  };
  function saveGallery(g) { Kit.save(M.KEY_GALLERY, g.slice(0, M.MAX_GALLERY)); }
  /* Keep a scene in the gallery (newest first). Empty scenes are not kept.
     Returns true when the oldest scene had to make room. */
  M.archive = function (scene) {
    if (scene.isEmpty()) return false;
    var g = M.gallery().filter(function (d) { return d.id !== scene.id; });
    scene.t = Date.now();
    g.unshift(scene.toJSON());
    var dropped = g.length > M.MAX_GALLERY;
    saveGallery(g);
    return dropped;
  };
  /* Take a scene out of the gallery to put it on screen. */
  M.take = function (id) {
    var g = M.gallery(), hit = null;
    g = g.filter(function (d) { if (d.id === id) { hit = d; return false; } return true; });
    if (hit) saveGallery(g);
    return hit;
  };
  M.removeSaved = function (id) { saveGallery(M.gallery().filter(function (d) { return d.id !== id; })); };
  M.count = function (scene) { return M.gallery().length + (scene && !scene.isEmpty() ? 1 : 0); };

  return M;
})();
