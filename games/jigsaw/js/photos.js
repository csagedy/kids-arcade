/* Photo puzzles: a picture from the camera roll, kept on this device only.

   Photos are cropped to between 3:4 and 4:3 (so the pieces stay chunky),
   scaled down to at most 1280 px on the long side, and stored as JPEG data
   in IndexedDB (database "jigsaw", store "photos"), not localStorage: they
   are far too big for it, and the arcade's Backup code copies every
   localStorage key. If IndexedDB is unavailable (some private modes) a photo
   still works until the page is closed. Nothing ever leaves the device. */
var Photos = (function () {
  var DB = 'jigsaw', STORE = 'photos', MAX_SIDE = 1280, MAX_PHOTOS = 24;
  var list = [], byId = {}, dbp = null;

  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        if (!window.indexedDB) { resolve(null); return; }
        var req = indexedDB.open(DB, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
        setTimeout(function () { resolve(null); }, 4000);   // never hang the library
      } catch (e) { resolve(null); }
    });
    return dbp;
  }

  function tx(mode, fn) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
          t.oncomplete = function () { resolve(out && 'result' in out ? out.result : true); };
          t.onerror = t.onabort = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img.naturalWidth ? img : null); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function toPic(rec, img) {
    return { id: rec.id, name: rec.name || 'My photo', theme: 'photos', w: img.naturalWidth, h: img.naturalHeight, kind: 'photo', img: img, t: rec.t || 0 };
  }

  function valid(rec) {
    return rec && typeof rec.id === 'string' && rec.id.indexOf('photo-') === 0 && typeof rec.data === 'string' && rec.data.indexOf('data:image/') === 0;
  }

  /* Loads every stored photo -> Promise(list). */
  function init() {
    return tx('readonly', function (st) { return st.getAll ? st.getAll() : null; }).then(function (recs) {
      if (!Array.isArray(recs)) return list;
      recs = recs.filter(valid).sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
      return Promise.all(recs.map(function (r) { return loadImage(r.data).then(function (img) { return img ? toPic(r, img) : null; }); }))
        .then(function (pics) {
          pics.forEach(function (p) { if (p && !byId[p.id]) { list.push(p); byId[p.id] = p; } });
          list.sort(function (a, b) { return a.t - b.t; });
          return list;
        });
    });
  }

  /* A File from the picker -> Promise(pic | { error }). */
  function add(file) {
    if (list.length >= MAX_PHOTOS) return Promise.resolve({ error: 'full' });
    return new Promise(function (resolve) {
      var url;
      try { url = URL.createObjectURL(file); } catch (e) { resolve({ error: 'open' }); return; }
      loadImage(url).then(function (img) {
        URL.revokeObjectURL(url);
        if (!img) { resolve({ error: 'open' }); return; }
        // crop the middle to between 3:4 and 4:3
        var iw = img.naturalWidth, ih = img.naturalHeight, sx = 0, sy = 0, sw = iw, sh = ih;
        if (sw / sh > 4 / 3) { sw = Math.round(sh * 4 / 3); sx = Math.round((iw - sw) / 2); }
        if (sh / sw > 4 / 3) { sh = Math.round(sw * 4 / 3); sy = Math.round((ih - sh) / 2); }
        var sc = Math.min(1, MAX_SIDE / Math.max(sw, sh));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sw * sc)); c.height = Math.max(1, Math.round(sh * sc));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        var data;
        try { data = c.toDataURL('image/jpeg', 0.86); } catch (e) { resolve({ error: 'open' }); return; }
        var n = 1;
        while (list.some(function (p) { return p.name === (n > 1 ? 'My photo ' + n : 'My photo'); })) n++;
        var rec = { id: 'photo-' + Date.now().toString(36), name: n > 1 ? 'My photo ' + n : 'My photo', data: data, t: Date.now() };
        loadImage(data).then(function (small) {
          if (!small) { resolve({ error: 'open' }); return; }
          var pic = toPic(rec, small);
          list.push(pic); byId[pic.id] = pic;
          tx('readwrite', function (st) { st.put(rec); }).then(function (ok) {
            pic.temp = !ok;
            resolve(pic);
          });
        });
      });
    });
  }

  function remove(id) {
    var p = byId[id];
    if (!p) return Promise.resolve(false);
    delete byId[id];
    list.splice(list.indexOf(p), 1);
    return tx('readwrite', function (st) { st['delete'](id); });
  }

  return {
    init: init,
    add: add,
    remove: remove,
    list: function () { return list.slice(); },
    get: function (id) { return byId[id] || null; },
    MAX: MAX_PHOTOS
  };
})();
