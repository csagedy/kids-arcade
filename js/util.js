/* Small shared helpers. No modules, so everything hangs off window. */

function $(sel) { return document.querySelector(sel); }

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* Run-length encoding for the cell grid: "count,value count,value ..." */
function rleEncode(arr) {
  var out = [], i = 0;
  while (i < arr.length) {
    var v = arr[i], n = 1;
    while (i + n < arr.length && arr[i + n] === v) n++;
    out.push(n + ',' + v);
    i += n;
  }
  return out.join(' ');
}

function rleDecode(str, length) {
  var arr = new Uint8Array(length), pos = 0;
  var parts = str.split(' ');
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].split(',');
    var n = +p[0], v = +p[1];
    for (var j = 0; j < n && pos < length; j++) arr[pos++] = v;
  }
  return arr;
}

/* Painted flags travel as a base64 bitset — one bit per cell. */
function packBits(flags) {
  var bytes = new Uint8Array(Math.ceil(flags.length / 8));
  for (var i = 0; i < flags.length; i++) {
    if (flags[i]) bytes[i >> 3] |= 1 << (i & 7);
  }
  var s = '';
  for (var k = 0; k < bytes.length; k += 4096) {
    s += String.fromCharCode.apply(null, bytes.subarray(k, k + 4096));
  }
  return btoa(s);
}

function unpackBits(b64, length) {
  var flags = new Uint8Array(length);
  try {
    var s = atob(b64);
    for (var i = 0; i < length; i++) {
      var byte = s.charCodeAt(i >> 3) || 0;
      flags[i] = (byte >> (i & 7)) & 1;
    }
  } catch (e) { /* corrupt save: start clean rather than fail to open */ }
  return flags;
}

/* localStorage can throw (private mode, full quota) — never let that break play. */
var store = {
  get: function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set: function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
  del: function (key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

/* Pick black or white text so a number stays readable on its own colour. */
function contrastInk(hex) {
  var c = hex.replace('#', '');
  var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a1a1a' : '#ffffff';
}

function hexToRgb(hex) {
  var c = hex.replace('#', '');
  return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(function (v) {
    var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length === 1 ? '0' + s : s;
  }).join('');
}
