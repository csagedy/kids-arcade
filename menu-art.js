/* Little inline-SVG pictures for the menu tiles, one per game, keyed by the
   game's id in index.html. Puzzle art is drawn on the tile's own gradient
   (viewBox 120 x 90); cabinet art is a glowing CRT screen (100 x 75); card
   art sits on a white card face (60 x 84).

   To add a game: add a function here returning the <svg> markup. A game with
   no entry falls back to its emoji. */
var MENU_ART = (function () {
  var A = {};
  function svg(vb, body) {
    return '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  /* pixel grid from strings: each character maps to a fill (or is skipped) */
  function pix(rows, x0, y0, size, colors, opts) {
    opts = opts || {};
    var gap = opts.gap === undefined ? 1 : opts.gap, rx = opts.rx === undefined ? 2 : opts.rx, out = '';
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) {
        var col = colors[row[c]];
        if (!col) continue;
        var x = x0 + c * size, y = y0 + r * size;
        out += '<rect x="' + x + '" y="' + y + '" width="' + (size - gap) + '" height="' + (size - gap) + '" rx="' + rx + '" fill="' + col + '"/>';
        if (opts.shine) out += '<rect x="' + (x + 1.5) + '" y="' + (y + 1.5) + '" width="' + (size - gap - 3) + '" height="2" rx="1" fill="#fff" opacity="0.45"/>';
      }
    });
    return out;
  }
  var SH = '<ellipse cx="60" cy="84" rx="40" ry="4" fill="#000" opacity="0.15"/>';

  /* ---------- puzzles ---------- */
  A.color = function () {
    var heart = ['.XX.XX.', 'XXXXXXX', 'XXXXOXX', '.XXOOX.', '..WWW..', '...W...'];
    return svg('0 0 120 90', SH +
      '<rect x="22" y="9" width="76" height="68" rx="8" fill="#fff" opacity="0.92"/>' +
      pix(heart, 25, 12, 10, { X: '#ff5d73', O: '#ff9f43', W: '#eceaff' }, { gap: 1.2, rx: 2 }) +
      '<text x="59.5" y="59.5" font-size="7" fill="#9aa0cf" text-anchor="middle">1</text>' +
      '<text x="69.5" y="59.5" font-size="7" fill="#9aa0cf" text-anchor="middle">1</text>' +
      '<text x="59.5" y="69.5" font-size="7" fill="#9aa0cf" text-anchor="middle">1</text>' +
      '<g transform="translate(86 46) rotate(35)"><rect x="-4" y="0" width="8" height="34" rx="3" fill="#8b5a2b"/><rect x="-4.5" y="-6" width="9" height="8" rx="1.5" fill="#d9dbe8"/><path d="M-4-6 Q0-20 4-6z" fill="#ff5d73"/></g>');
  };

  A.watersort = function () {
    function tube(x, layers, top) {
      var out = '<rect x="' + x + '" y="12" width="22" height="66" rx="11" fill="#fff" opacity="0.22"/>', y = 74;
      layers.forEach(function (c, i) {
        var h = 13;
        y -= h;
        out += i === 0
          ? '<path d="M' + (x + 3) + ' ' + y + 'h16v' + (h - 8 + 5) + 'a8 8 0 0 1-16 0z" fill="' + c + '"/>'
          : '<rect x="' + (x + 3) + '" y="' + y + '" width="16" height="' + h + '" fill="' + c + '"/>';
      });
      out += '<rect x="' + x + '" y="12" width="22" height="66" rx="11" fill="none" stroke="#fff" stroke-width="3"/>';
      out += '<rect x="' + (x + 5) + '" y="18" width="3" height="48" rx="1.5" fill="#fff" opacity="0.5"/>';
      return out;
    }
    return svg('0 0 120 90', SH +
      tube(19, ['#ff5d73', '#4cc2ff', '#ffd23f', '#ff5d73']) +
      tube(49, ['#4cc2ff', '#ffd23f', '#4cc2ff']) +
      tube(79, ['#ffd23f', '#ff5d73']) +
      '<circle cx="90" cy="7" r="3" fill="#ff5d73"/>');
  };

  A.blockblast = function () {
    var rows = ['rr....gg', 'rr..b.gg', '...bbb..', 'pp......', 'ppp..yyy', '......y.'];
    return svg('0 0 120 90', SH +
      '<rect x="12" y="8" width="96" height="74" rx="9" fill="#1b1d4a" opacity="0.35"/>' +
      pix(rows, 16, 12, 11, { r: '#ff5d73', g: '#3ddc84', b: '#4cc2ff', p: '#ffd23f', y: '#ff7ac6' }, { gap: 1.5, rx: 3, shine: true }));
  };

  A['2048'] = function () {
    function t(x, y, c, ink, label, fs) {
      return '<rect x="' + x + '" y="' + y + '" width="36" height="36" rx="7" fill="' + c + '"/>' +
        '<rect x="' + x + '" y="' + (y + 31) + '" width="36" height="5" rx="2.5" fill="#000" opacity="0.15"/>' +
        '<text x="' + (x + 18) + '" y="' + (y + 18 + fs * 0.36) + '" font-size="' + fs + '" fill="' + ink + '" text-anchor="middle">' + label + '</text>';
    }
    return svg('0 0 120 90', SH +
      '<rect x="18" y="4" width="84" height="84" rx="12" fill="#1b1d4a" opacity="0.35"/>' +
      t(22, 8, '#eef0ff', '#2a2f7a', '2', 22) + t(62, 8, '#ff8a5c', '#fff', '16', 20) +
      t(22, 48, '#c77dff', '#fff', '128', 15) + t(62, 48, '#ffd23f', '#3b2a00', '2048', 12));
  };

  A.memory = function () {
    var back = '<rect width="30" height="42" rx="5" fill="#fff"/><rect x="3" y="3" width="24" height="36" rx="3" fill="#6c45c9"/>' +
      '<circle cx="15" cy="21" r="6" fill="none" stroke="#fff" stroke-width="2" opacity="0.7"/>';
    function face(sym) { return '<rect width="30" height="42" rx="5" fill="#fff"/>' + sym; }
    var heart = '<path d="M15 31s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12z" fill="#ff5d73"/>';
    return svg('0 0 120 90', SH +
      '<g transform="translate(14 26) rotate(-10)">' + face(heart) + '</g>' +
      '<g transform="translate(45 18)">' + back + '</g>' +
      '<g transform="translate(78 22) rotate(10)">' + face(heart) + '</g>' +
      '<path d="M60 10l2 4 4 .6-3 3 .8 4.4L60 20l-3.8 2 .8-4.4-3-3 4-.6z" fill="#ffd23f"/>');
  };

  A.nonogram = function () {
    var p = ['.#.#.', '#####', '#####', '.###.', '..#..'];
    var clues = ['1 1', '5', '5', '3', '1'], top = ['2', '4', '4', '4', '2'], out = '';
    clues.forEach(function (c, i) { out += '<text x="42" y="' + (37 + i * 10) + '" font-size="7" fill="#6f74a8" text-anchor="end">' + c + '</text>'; });
    top.forEach(function (c, i) { out += '<text x="' + (50 + i * 10) + '" y="26" font-size="7" fill="#6f74a8" text-anchor="middle">' + c + '</text>'; });
    var grid = '';
    for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) grid += '<rect x="' + (45.5 + c * 10) + '" y="' + (30.5 + r * 10) + '" width="9" height="9" rx="1.5" fill="#e6e8f6"/>';
    return svg('0 0 120 90', SH +
      '<rect x="24" y="12" width="78" height="72" rx="8" fill="#fff"/>' + out + grid +
      pix(p, 45.5, 30.5, 10, { '#': '#2d3275' }, { gap: 1, rx: 1.5 }));
  };

  A.flow = function () {
    var o = 22, s = 16;
    function c(i) { return o + 8 + i * s; }
    function cy(i) { return 10 + 8 + i * s; }
    function line(pts, col) {
      return '<polyline points="' + pts.map(function (p) { return c(p[0]) + ',' + cy(p[1]); }).join(' ') + '" fill="none" stroke="' + col + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="' + c(pts[0][0]) + '" cy="' + cy(pts[0][1]) + '" r="6.5" fill="' + col + '"/>' +
        '<circle cx="' + c(pts[pts.length - 1][0]) + '" cy="' + cy(pts[pts.length - 1][1]) + '" r="6.5" fill="' + col + '"/>';
    }
    var grid = '';
    for (var x = 0; x <= 5; x++) grid += '<line x1="' + (o + x * s) + '" y1="10" x2="' + (o + x * s) + '" y2="74" stroke="#fff" stroke-opacity="0.15"/>';
    for (var y = 0; y <= 4; y++) grid += '<line x1="' + o + '" y1="' + (10 + y * s) + '" x2="' + (o + 80) + '" y2="' + (10 + y * s) + '" stroke="#fff" stroke-opacity="0.15"/>';
    return svg('0 0 120 90', SH +
      '<rect x="' + (o - 4) + '" y="6" width="88" height="72" rx="9" fill="#1b1d4a" opacity="0.55"/>' + grid +
      line([[1, 0], [1, 2], [3, 2]], '#ff5d73') +
      line([[0, 0], [0, 3], [2, 3]], '#4cc2ff') +
      line([[2, 0], [4, 0], [4, 3]], '#ffd23f') +
      '<circle cx="' + c(2) + '" cy="' + cy(1) + '" r="6.5" fill="#3ddc84"/><circle cx="' + c(3) + '" cy="' + cy(3) + '" r="6.5" fill="#3ddc84"/>');
  };

  A.simon = function () {
    var cx = 60, cy = 45, r1 = 13, r2 = 37, g = 0.09;
    function sector(a0, a1, col, lit) {
      a0 += g; a1 -= g;
      function p(r, a) { return (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); }
      return '<path d="M' + p(r2, a0) + 'A' + r2 + ' ' + r2 + ' 0 0 1 ' + p(r2, a1) + 'L' + p(r1, a1) + 'A' + r1 + ' ' + r1 + ' 0 0 0 ' + p(r1, a0) + 'z" fill="' + col + '"' +
        (lit ? ' style="filter:drop-shadow(0 0 5px ' + col + ')"' : ' opacity="0.8"') + '/>';
    }
    var q = Math.PI / 2;
    return svg('0 0 120 90', SH +
      '<circle cx="60" cy="45" r="41" fill="#1b1d4a"/>' +
      sector(-2 * q, -q, '#3ddc84') + sector(-q, 0, '#ff5d73', true) + sector(0, q, '#4cc2ff') + sector(q, 2 * q, '#ffd23f') +
      '<circle cx="60" cy="45" r="9" fill="#2d3275"/>' +
      '<path d="M88 10q6 2 4 9M94 6q9 4 5 15" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>');
  };

  A.shapes = function () {
    return svg('0 0 120 90', SH +
      '<g stroke="#1b1d4a" stroke-opacity="0.25" stroke-width="2" stroke-linejoin="round">' +
      '<path d="M34 42 60 14l26 28z" fill="#a77bff"/>' +
      '<path d="M38 42h44v38H38z" fill="#ff9f43"/>' +
      '<path d="M38 42h44L38 80z" fill="#ffd23f"/>' +
      '<path d="M66 18h9v14l-9-9z" fill="#ff5d73"/>' +
      '<path d="M54 60h12v20H54z" fill="#4cc2ff"/>' +
      '</g>' +
      '<g transform="translate(96 60) rotate(-20)"><path d="M-8 8 0-8 8 8z" fill="#3ddc84" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/></g>');
  };

  A.dots = function () {
    var pts = [], out = '', i;
    for (i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 15 : 36;
      pts.push([60 + r * Math.cos(a), 47 + r * Math.sin(a)]);
    }
    var done = pts.slice(0, 7).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var rest = pts.slice(6).concat([pts[0]]).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    out += '<polyline points="' + rest + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="2 5" stroke-linecap="round" opacity="0.8"/>';
    out += '<polyline points="' + done + '" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    pts.forEach(function (p, k) {
      out += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" fill="' + (k < 7 ? '#ffd23f' : '#1b1d4a') + '" stroke="#fff" stroke-width="2"/>';
    });
    return svg('0 0 120 90', SH + out);
  };

  A.maze = function () {
    var walls = 'M18 10h84v70H18zM34 10v24h16M66 10v16h20v16M18 50h20v14M50 34v30h-12M66 42v38M82 58h20M82 58v-16H66M50 64h16';
    return svg('0 0 120 90', SH +
      '<rect x="18" y="10" width="84" height="70" rx="4" fill="#0d3b2a" opacity="0.4"/>' +
      '<path d="' + walls + '" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M26 18v24h16v30h16V50h16" fill="none" stroke="#ffd23f" stroke-width="2.5" stroke-dasharray="1 5" stroke-linecap="round"/>' +
      '<g transform="translate(26 18)"><circle r="6" fill="#d9dbe8"/><circle cx="-4.5" cy="-4.5" r="3" fill="#ffb3c6"/><circle cx="4.5" cy="-4.5" r="3" fill="#ffb3c6"/><circle cx="0" cy="2" r="1.3" fill="#ff5d73"/></g>' +
      '<path d="M86 66l12 6H86z" fill="#ffd23f" stroke="#d69a00" stroke-width="1.5" stroke-linejoin="round"/>');
  };

  A.connect4 = function () {
    var out = '<rect x="20" y="20" width="80" height="62" rx="8" fill="#2f5fd0"/>';
    var board = ['.......', '.......', '...y...', '..yr...', '.rry...', 'yrryr..'];
    var col = { r: '#ff5d73', y: '#ffd23f' };
    board.forEach(function (row, r) {
      for (var c = 0; c < 7; c++) {
        var f = col[row[c]] || '#14164a';
        out += '<circle cx="' + (29 + c * 10.4) + '' + '" cy="' + (28 + r * 9.6) + '" r="4.1" fill="' + f + '"/>';
      }
    });
    return svg('0 0 120 90', SH + out + '<circle cx="81.6" cy="9" r="5" fill="#ff5d73"/><path d="M81.6 15v3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>');
  };

  /* ---------- action: glowing CRT screens ---------- */
  function crt(body) { return svg('0 0 100 75', body); }
  function glow(col) { return ' style="filter:drop-shadow(0 0 2.5px ' + col + ')"'; }

  A.breakout = function () {
    var rows = ['#ff4d6d', '#ff9f43', '#ffd23f', '#3ddc84'], out = '';
    rows.forEach(function (c, r) { for (var i = 0; i < 8; i++) if (!(r === 3 && (i === 2 || i === 5))) out += '<rect x="' + (6 + i * 11.2) + '" y="' + (8 + r * 6) + '" width="10" height="4.5" fill="' + c + '"/>'; });
    return crt('<g' + glow('#ff9f43') + '>' + out + '</g><rect x="40" y="64" width="20" height="4" fill="#7cf2ff"' + glow('#7cf2ff') + '/><rect x="56" y="48" width="4" height="4" fill="#fff"' + glow('#fff') + '/>');
  };
  A.snake = function () {
    var segs = [[30, 52], [36, 52], [42, 52], [48, 52], [48, 46], [48, 40], [54, 40], [60, 40], [66, 40], [66, 34], [66, 28]], out = '';
    segs.forEach(function (s, i) { out += '<rect x="' + s[0] + '" y="' + s[1] + '" width="5.4" height="5.4" fill="' + (i === segs.length - 1 ? '#b6ff6a' : '#3ddc84') + '"/>'; });
    return crt('<g' + glow('#3ddc84') + '>' + out + '</g><rect x="66" y="12" width="5.4" height="5.4" fill="#ff4d6d"' + glow('#ff4d6d') + '/>');
  };
  A.missile = function () {
    return crt('<g stroke-width="1.2"' + glow('#ff4d6d') + '><path d="M18 0 34 44M60 0 50 34M88 0 72 50" stroke="#ff4d6d"/></g>' +
      '<circle cx="50" cy="34" r="9" fill="#ffd23f" opacity="0.85"' + glow('#ffd23f') + '/><circle cx="50" cy="34" r="5" fill="#fff"/>' +
      '<path d="M50 34 50 66" stroke="#7cf2ff" stroke-width="1" stroke-dasharray="2 2"/>' +
      '<g fill="#4cc2ff"' + glow('#4cc2ff') + '><rect x="10" y="64" width="10" height="5"/><rect x="24" y="62" width="8" height="7"/><rect x="68" y="63" width="9" height="6"/><rect x="82" y="61" width="8" height="8"/></g>' +
      '<path d="M44 69l6-7 6 7z" fill="#ffd23f"/><rect x="0" y="69" width="100" height="6" fill="#a77bff" opacity="0.6"/>');
  };
  A.frogger = function () {
    return crt('<rect y="6" width="100" height="22" fill="#1a3a8f"/>' +
      '<g fill="#b5712e"><rect x="8" y="9" width="30" height="6" rx="3"/><rect x="56" y="9" width="34" height="6" rx="3"/><rect x="24" y="19" width="28" height="6" rx="3"/></g>' +
      '<rect y="30" width="100" height="4" fill="#a77bff" opacity="0.6"/>' +
      '<g' + glow('#ff4d6d') + '><rect x="12" y="38" width="14" height="7" rx="2" fill="#ff4d6d"/><rect x="62" y="38" width="20" height="7" rx="2" fill="#ffd23f"/><rect x="36" y="50" width="14" height="7" rx="2" fill="#4cc2ff"/><rect x="80" y="50" width="14" height="7" rx="2" fill="#ff9f43"/></g>' +
      '<g fill="#3ddc84"' + glow('#3ddc84') + '><rect x="45" y="62" width="10" height="8" rx="2"/><rect x="42" y="61" width="4" height="4"/><rect x="54" y="61" width="4" height="4"/><rect x="42" y="68" width="4" height="4"/><rect x="54" y="68" width="4" height="4"/></g>');
  };
  A.invaders = function () {
    var inv = ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'];
    return crt('<g' + glow('#3ddc84') + '>' + pix(inv, 28, 8, 4, { '#': '#3ddc84' }, { gap: 0, rx: 0 }) + '</g>' +
      '<rect x="49" y="46" width="2" height="6" fill="#fff"/>' +
      '<g fill="#7cf2ff"' + glow('#7cf2ff') + '><rect x="42" y="64" width="16" height="5"/><rect x="47" y="60" width="6" height="4"/><rect x="49" y="57" width="2" height="3"/></g>');
  };
  A.pong = function () {
    return crt('<path d="M4 37.5h92" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>' +
      '<g fill="#fff"' + glow('#fff') + '><rect x="30" y="7" width="22" height="4"/><rect x="48" y="64" width="22" height="4"/><rect x="58" y="26" width="4.5" height="4.5"/></g>' +
      '<text x="20" y="30" font-size="12" fill="#fff" opacity="0.5" font-family="Courier New, monospace" font-weight="700">3</text><text x="20" y="54" font-size="12" fill="#fff" opacity="0.5" font-family="Courier New, monospace" font-weight="700">2</text>');
  };
  A.asteroids = function () {
    return crt('<g fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"' + glow('#7cf2ff') + '>' +
      '<path d="M12 14l10-6 12 3 3 10-6 9-12 1-8-7z"/><path d="M70 10l9 1 5 7-3 8-9 1-5-6z"/><path d="M74 50l6-2 5 4-1 6-6 2-5-4z"/>' +
      '<path d="M44 44l12 6-12 6 3-6z" stroke="#7cf2ff"/></g>' +
      '<g fill="#ffd23f"><circle cx="62" cy="50" r="1.3"/><circle cx="68" cy="50" r="1.3"/></g>');
  };

  /* ---------- card games: art on a white card face (60 x 84) ---------- */
  A.crazy8 = function () {
    return svg('0 0 60 84',
      '<defs><linearGradient id="c8g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d73"/><stop offset="0.35" stop-color="#ffd23f"/><stop offset="0.65" stop-color="#3ddc84"/><stop offset="1" stop-color="#4cc2ff"/></linearGradient></defs>' +
      '<text x="30" y="58" font-size="50" text-anchor="middle" fill="url(#c8g)" stroke="#1b1d4a" stroke-width="1.5" paint-order="stroke">8</text>' +
      '<path d="M30 74s-5-3-5-6.6a2.8 2.8 0 0 1 5-1.7 2.8 2.8 0 0 1 5 1.7c0 3.6-5 6.6-5 6.6z" fill="#e5484d"/>' +
      '<path d="M15 66l4 5-4 5-4-5z" fill="#2f6fe0"/><path d="M45 66l4 5-4 5-4-5z" fill="#2f6fe0" opacity="0"/>' +
      '<g fill="#23935f"><circle cx="45" cy="68" r="2.3"/><circle cx="42.6" cy="71.5" r="2.3"/><circle cx="47.4" cy="71.5" r="2.3"/><rect x="44.3" y="71" width="1.4" height="5"/></g>');
  };

  A.hatch = function () {
    var S = ' stroke="#1b1d4a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
    return svg('0 0 60 84',
      '<rect x="4" y="5" width="52" height="74" rx="7" fill="#ffd23f"/>' +
      '<ellipse cx="30" cy="44" rx="23" ry="27" fill="#fffaf0"/>' +
      '<g transform="translate(30,49) scale(0.56)">' +
        '<g transform="translate(0,-14)">' +
          '<path d="M-3,-17C-8,-28 1,-31 0,-21C4,-29 11,-25 3,-16" fill="#ffd23f"' + S + '/>' +
          '<circle r="19" fill="#ffd23f"' + S + '/>' +
          '<circle cx="-13" cy="5" r="3.6" fill="#ff7ac6" opacity="0.5"/><circle cx="13" cy="5" r="3.6" fill="#ff7ac6" opacity="0.5"/>' +
          '<path d="M-11,6C-11,-1 11,-1 11,6C11,13 -11,13 -11,6Z" fill="#ff9f43"' + S + '/>' +
          '<ellipse cx="-8" cy="-6" rx="3.4" ry="4.2" fill="#1b1d4a"/><ellipse cx="8" cy="-6" rx="3.4" ry="4.2" fill="#1b1d4a"/>' +
          '<path d="M-13,-1L-7,3L-1,-2L5,3L11,-1C11,-13 -13,-13 -13,-1Z" fill="#fff4c2"' + S + ' transform="translate(5,-25) rotate(20)"/>' +
        '</g>' +
        '<path d="M-26,4L-19,-3L-12,5L-5,-3L2,5L9,-3L16,5L22,-2L26,4C26,24 14,34 0,34C-14,34 -26,24 -26,4Z" fill="#fff4c2"' + S + '/>' +
        '<g fill="#e8b400"><circle cx="-12" cy="14" r="2.4"/><circle cx="8" cy="20" r="2.2"/><circle cx="14" cy="10" r="2"/></g>' +
        '<path d="M-38,18Q-36,44 0,44Q36,44 38,18Q0,32 -38,18Z" fill="#c98b4a"' + S + '/>' +
        '<g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M-32,-22l-6,-4"/><path d="M32,-22l6,-4"/></g>' +
      '</g>' +
      '<circle cx="13" cy="14" r="6" fill="#fffdf7" stroke="#1b1d4a" stroke-width="1.4"/><circle cx="10.8" cy="14" r="1.7" fill="#d69a00"/><circle cx="15.2" cy="14" r="1.7" fill="#d69a00"/>');
  };
  A.gofish = function () {
    return svg('0 0 60 84',
      '<ellipse cx="30" cy="58" rx="25" ry="13.5" fill="#e6d39c"/><ellipse cx="30" cy="58" rx="21.5" ry="10.5" fill="#2f9be0"/>' +
      '<ellipse cx="24" cy="55" rx="8" ry="3" fill="#fff" opacity=".25"/>' +
      '<path d="M10 8Q40 10 44 38" stroke="#8a5a2f" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M44 38v9" stroke="#1b1d4a" stroke-width=".9"/>' +
      '<g transform="rotate(-18 30 44)"><path d="M18 44c5-6 15-6 20 0-5 6-15 6-20 0z" fill="#ff9f43"/><path d="M38 44l7-5v10z" fill="#ff9f43"/><circle cx="23" cy="43" r="1.5" fill="#1b1d4a"/></g>' +
      '<circle cx="15" cy="34" r="2" fill="none" stroke="#4cc2ff" stroke-width="1.2"/><circle cx="11" cy="27" r="1.3" fill="none" stroke="#4cc2ff" stroke-width="1.1"/>');
  };
  A.klondike = function () {
    return svg('0 0 60 84',
      '<g stroke="#1b1d4a" stroke-width="1.2">' +
      '<rect x="13" y="8" width="34" height="46" rx="5" fill="#6f5cff"/>' +
      '<rect x="13" y="20" width="34" height="46" rx="5" fill="#fff"/>' +
      '<rect x="13" y="32" width="34" height="46" rx="5" fill="#fff"/></g>' +
      '<text x="17" y="31" font-size="10" font-weight="900" fill="#e0303f">K</text><text x="43" y="31" font-size="9" text-anchor="end" fill="#e0303f">♥</text>' +
      '<text x="17" y="43" font-size="10" font-weight="900" fill="#22252e">Q</text><text x="43" y="43" font-size="9" text-anchor="end" fill="#22252e">♠</text>' +
      '<text x="30" y="68" font-size="22" text-anchor="middle" fill="#e0303f">♦</text>' +
      '<path d="M48 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#ffd23f" stroke="#d69a00" stroke-width="1"/>');
  };
  return A;
})();
