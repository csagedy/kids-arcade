/* Doodle Pad's picture store: IndexedDB database "draw", kept out of
   localStorage (a ~5MB quota shared by every game, and copied whole by the
   arcade's Backup code).

     pics  { id, t (made), u (last saved), paper, w, h, thumb (small JPEG data URL) }
     ink   { id, type, data (ArrayBuffer of a PNG of the ink layer, with alpha) }

   The gallery reads only `pics`, so opening it never loads every full-size
   picture. Every call resolves (null / false on failure) and never throws:
   if IndexedDB is missing (some private modes) the pad still draws, it just
   can't keep pictures. */
var DrawStore = (function () {
  'use strict';
  var DB = 'draw', VERSION = 1, dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      var done = false;
      function fin(v) { if (!done) { done = true; resolve(v); } }
      try {
        if (!window.indexedDB) { fin(null); return; }
        var req = indexedDB.open(DB, VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('pics')) db.createObjectStore('pics', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('ink')) db.createObjectStore('ink', { keyPath: 'id' });
        };
        req.onsuccess = function () {
          var db = req.result;
          // another tab upgrading: let go rather than block it
          db.onversionchange = function () { try { db.close(); } catch (e) {} dbp = null; };
          fin(db);
        };
        req.onerror = function () { fin(null); };
        req.onblocked = function () { fin(null); };
        setTimeout(function () { fin(null); }, 4000);   // never hang the pad
      } catch (e) { fin(null); }
    });
    return dbp;
  }

  /* Run fn(stores...) in one transaction; resolves with fn's request result
     (if it returned a request) once the transaction completes, else null. */
  function tx(names, mode, fn) {
    return open().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var t = db.transaction(names, mode);
          var stores = names.map(function (n) { return t.objectStore(n); });
          var req = fn.apply(null, stores);
          t.oncomplete = function () { resolve(req && 'result' in req ? req.result : true); };
          t.onerror = t.onabort = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  function valid(p) {
    return p && typeof p.id === 'string' && p.w > 0 && p.h > 0;
  }

  /* All picture records (no ink), newest first. */
  function list() {
    return tx(['pics'], 'readonly', function (st) {
      if (st.getAll) return st.getAll();
      // very old engines: walk a cursor
      var out = [], cur = st.openCursor(), fake = { result: out };
      cur.onsuccess = function () { var c = cur.result; if (c) { out.push(c.value); c['continue'](); } };
      return fake;
    }).then(function (recs) {
      if (!Array.isArray(recs)) return null;
      return recs.filter(valid).sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
    });
  }

  function getInk(id) {
    return tx(['ink'], 'readonly', function (st) { return st.get(id); }).then(function (r) {
      return r && r.data ? r : null;
    });
  }

  function put(meta, ink) {
    return tx(['pics', 'ink'], 'readwrite', function (pics, inks) {
      pics.put(meta);
      inks.put(ink);
    }).then(function (ok) { return !!ok; });
  }

  function putMeta(meta) {
    return tx(['pics'], 'readwrite', function (pics) { pics.put(meta); }).then(function (ok) { return !!ok; });
  }

  function remove(id) {
    return tx(['pics', 'ink'], 'readwrite', function (pics, inks) {
      pics['delete'](id);
      inks['delete'](id);
    }).then(function (ok) { return !!ok; });
  }

  return { open: open, list: list, getInk: getInk, put: put, putMeta: putMeta, remove: remove };
})();
