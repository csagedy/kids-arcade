/* Hatch Match — card faces and back, drawn as inline SVG (viewBox 100 x 140).
   Shared gradients and patterns live in one hidden <svg> of defs that
   HMArt.install() adds to the page once, so the many card SVGs never repeat
   ids. Every face is cached by its key ('c-2-3', 'storm-1', 'wild-0' ...). */
var HMArt = (function () {
  'use strict';
  var A = {};
  var INK = '#1b1d4a';
  var SW = 'stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
  // panel colours (light, base, dark edge) per habitat — the kit palette
  var PAL = [
    { lite: '#ff94a3', base: '#ff5d73', edge: '#c12c47', name: 'red' },
    { lite: '#ffe680', base: '#ffc928', edge: '#d69a00', name: 'yellow' },
    { lite: '#7df0b2', base: '#2fcf76', edge: '#1f9a57', name: 'green' },
    { lite: '#8ad9ff', base: '#36a7f0', edge: '#1a7fc0', name: 'blue' }
  ];
  A.PAL = PAL;
  // critter body colours
  var SKIN = ['#ff6b5a', '#ffd23f', '#3ddc84', '#8fe0ff'];
  var EGG = ['#ff8a6a', '#fff4c2', '#9df2c0', '#d7f2ff'];
  var EGGDOT = ['#ffd23f', '#e8b400', '#1f9a57', '#36a7f0'];

  A.install = function () {
    if (document.getElementById('hm-defs')) return;
    var g = '';
    PAL.forEach(function (p, i) {
      g += '<linearGradient id="hm-p' + i + '" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="' + p.lite + '"/><stop offset="1" stop-color="' + p.base + '"/></linearGradient>';
    });
    g += '<linearGradient id="hm-rb" x1="0" y1="0" x2="1" y2="1">' +
      ['#ff5d73', '#ff9f43', '#ffd23f', '#3ddc84', '#4cc2ff', '#a77bff'].map(function (c, i) {
        return '<stop offset="' + (i / 5) + '" stop-color="' + c + '"/>';
      }).join('') + '</linearGradient>';
    g += '<linearGradient id="hm-cham" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="#3ddc84"/><stop offset="0.45" stop-color="#2ee6c9"/><stop offset="0.8" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9f43"/></linearGradient>';
    g += '<linearGradient id="hm-back" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4a51a8"/><stop offset="1" stop-color="#232766"/></linearGradient>';
    g += '<radialGradient id="hm-gold" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.55" stop-color="#ffd23f"/><stop offset="1" stop-color="#e8a400"/></radialGradient>';
    g += '<pattern id="hm-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#fff" opacity="0.28"/><circle cx="9" cy="9" r="1.6" fill="#fff" opacity="0.28"/></pattern>';
    g += '<pattern id="hm-eggs" width="20" height="24" patternUnits="userSpaceOnUse"><path d="M5 3c2.4 0 4 3.6 4 5.6 0 2.4-1.8 3.9-4 3.9s-4-1.5-4-3.9C1 6.6 2.6 3 5 3z" fill="#fff" opacity="0.1"/><path d="M15 15c2.4 0 4 3.6 4 5.6 0 2.4-1.8 3.9-4 3.9s-4-1.5-4-3.9c0-2 1.6-5.6 4-5.6z" fill="#fff" opacity="0.1"/></pattern>';
    g += '<clipPath id="hm-eggclip"><path d="' + EGGP + '"/></clipPath>';
    g += '<clipPath id="hm-shellclip"><path d="' + SHELLP + '"/></clipPath>';
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('id', 'hm-defs');
    s.setAttribute('width', '0'); s.setAttribute('height', '0');
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    s.innerHTML = '<defs>' + g + '</defs>';
    document.body.insertBefore(s, document.body.firstChild);
  };

  /* ---------- little parts ---------- */
  function eye(x, y, r) {
    r = r || 5.5;
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" ' + SW + ' stroke-width="2"/>' +
      '<circle cx="' + (x + r * 0.12) + '" cy="' + (y + r * 0.18) + '" r="' + (r * 0.56) + '" fill="' + INK + '"/>' +
      '<circle cx="' + (x + r * 0.32) + '" cy="' + (y - r * 0.08) + '" r="' + (r * 0.22) + '" fill="#fff"/>';
  }
  function cheeks(x, y, r) {
    return '<circle cx="' + (-x) + '" cy="' + y + '" r="' + r + '" fill="#ff7ac6" opacity="0.5"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#ff7ac6" opacity="0.5"/>';
  }
  var EGGP = 'M0,-30C16,-30 26,-4 26,10C26,25 14,34 0,34C-14,34 -26,25 -26,10C-26,-4 -16,-30 0,-30Z';
  var SHELLP = 'M-26,4L-19,-3L-12,5L-5,-3L2,5L9,-3L16,5L22,-2L26,4C26,24 14,34 0,34C-14,34 -26,24 -26,4Z';
  function nest() {
    return '<path d="M-38,18Q-36,44 0,44Q36,44 38,18Q0,32 -38,18Z" fill="#c98b4a" ' + SW + '/>' +
      '<path d="M-28,27q8,4 16,3M-6,33q8,2 16,-1M14,29q8,-1 16,-5M-22,36q10,3 20,2" fill="none" stroke="#f0c389" stroke-width="2" stroke-linecap="round"/>';
  }
  function eggPattern(c) {
    if (c === 0) return '<path d="M-30,0L-22,-8L-14,0L-6,-8L2,0L10,-8L18,0L26,-8L34,0V8L26,0L18,8L10,0L2,8L-6,0L-14,8L-22,0L-30,8Z" fill="' + EGGDOT[0] + '"/>' +
      '<path d="M-30,20L-22,12L-14,20L-6,12L2,20L10,12L18,20L26,12L34,20V26H-30Z" fill="' + EGGDOT[0] + '"/>';
    if (c === 1) return '<g fill="' + EGGDOT[1] + '"><circle cx="-10" cy="-14" r="2.4"/><circle cx="8" cy="-6" r="2"/><circle cx="-15" cy="6" r="2.2"/><circle cx="14" cy="14" r="2.6"/><circle cx="-2" cy="20" r="2"/><circle cx="2" cy="-22" r="1.8"/><circle cx="18" cy="-2" r="1.6"/><circle cx="-6" cy="4" r="1.6"/></g>';
    if (c === 2) return '<g fill="' + EGGDOT[2] + '"><ellipse cx="-8" cy="-12" rx="6" ry="5"/><ellipse cx="12" cy="0" rx="5" ry="6"/><ellipse cx="-14" cy="14" rx="5" ry="4.4"/><ellipse cx="6" cy="22" rx="6" ry="4"/><circle cx="4" cy="-24" r="2.6"/></g>';
    return '<g fill="none" stroke="' + EGGDOT[3] + '" stroke-width="3"><path d="M-30,-6Q0,4 30,-6"/><path d="M-30,10Q0,20 30,10"/></g><g fill="' + EGGDOT[3] + '"><circle cx="-8" cy="-18" r="2.4"/><circle cx="8" cy="-16" r="2.4"/><circle cx="0" cy="22" r="2.6"/><circle cx="-14" cy="24" r="2"/><circle cx="14" cy="24" r="2"/></g>';
  }
  function shine(x, y) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="4.2" ry="8" fill="#fff" opacity="0.65" transform="rotate(24 ' + x + ' ' + y + ')"/>';
  }

  /* ---------- heads, centred at 0,0, about 20 radius ---------- */
  function head(c) {
    var s = SKIN[c];
    if (c === 0) return '' +   // dragon
      '<path d="M-13,-13L-18,-31L-5,-18Z" fill="#fff1c9" ' + SW + '/><path d="M13,-13L18,-31L5,-18Z" fill="#fff1c9" ' + SW + '/>' +
      '<ellipse cx="0" cy="0" rx="21" ry="19" fill="' + s + '" ' + SW + '/>' +
      '<path d="M-4,-18L0,-25L4,-18Z" fill="#ffd23f" ' + SW + ' stroke-width="2"/>' +
      '<ellipse cx="0" cy="8" rx="13" ry="8.5" fill="#ff9b85"/>' +
      '<ellipse cx="-4.5" cy="6" rx="1.7" ry="2.3" fill="' + INK + '"/><ellipse cx="4.5" cy="6" rx="1.7" ry="2.3" fill="' + INK + '"/>' +
      '<path d="M-5,12Q0,15.5 5,12" fill="none" ' + SW + ' stroke-width="2"/>' +
      eye(-9, -5) + eye(9, -5);
    if (c === 1) return '' +   // duck
      '<path d="M-3,-17C-8,-28 1,-31 0,-21C4,-29 11,-25 3,-16" fill="' + s + '" ' + SW + '/>' +
      '<circle cx="0" cy="0" r="19" fill="' + s + '" ' + SW + '/>' +
      cheeks(13, 5, 3.6) +
      '<path d="M-11,6C-11,-1 11,-1 11,6C11,13 -11,13 -11,6Z" fill="#ff9f43" ' + SW + '/>' +
      '<path d="M-9,6.5H9" fill="none" ' + SW + ' stroke-width="1.6"/>' +
      '<ellipse cx="-8" cy="-6" rx="3.4" ry="4.2" fill="' + INK + '"/><circle cx="-7" cy="-7.6" r="1.3" fill="#fff"/>' +
      '<ellipse cx="8" cy="-6" rx="3.4" ry="4.2" fill="' + INK + '"/><circle cx="9" cy="-7.6" r="1.3" fill="#fff"/>';
    if (c === 2) return '' +   // dino
      '<path d="M-13,-12L-10,-27L-3,-16Z" fill="#ff9f43" ' + SW + '/><path d="M-4,-17L1,-31L6,-17Z" fill="#ff9f43" ' + SW + '/><path d="M6,-15L12,-27L14,-11Z" fill="#ff9f43" ' + SW + '/>' +
      '<ellipse cx="0" cy="0" rx="22" ry="18" fill="' + s + '" ' + SW + '/>' +
      '<ellipse cx="0" cy="7" rx="14" ry="7.5" fill="#9df2c0"/>' +
      '<circle cx="-4" cy="3.5" r="1.5" fill="' + INK + '"/><circle cx="4" cy="3.5" r="1.5" fill="' + INK + '"/>' +
      '<path d="M-9,9Q0,17 9,9" fill="#fff" ' + SW + ' stroke-width="2"/>' +
      eye(-10, -5) + eye(10, -5);
    return '' +   // turtle
      '<ellipse cx="0" cy="0" rx="18" ry="17" fill="' + s + '" ' + SW + '/>' +
      '<circle cx="-6" cy="-12" r="2" fill="#4cc2ff"/><circle cx="2" cy="-14" r="2.4" fill="#4cc2ff"/><circle cx="9" cy="-10" r="1.8" fill="#4cc2ff"/>' +
      cheeks(11, 5, 3.4) +
      '<path d="M-6,7Q0,12 6,7" fill="none" ' + SW + ' stroke-width="2"/>' +
      eye(-7, -2, 5) + eye(7, -2, 5);
  }

  /* ---------- the three stages ---------- */
  function egg(c) {
    return '<g transform="translate(0,-4)">' +
      '<path d="' + EGGP + '" fill="' + EGG[c] + '" ' + SW + '/>' +
      '<g clip-path="url(#hm-eggclip)">' + eggPattern(c) + '</g>' +
      '<path d="' + EGGP + '" fill="none" ' + SW + '/>' + shine(-11, -12) + '</g>' + nest();
  }
  function hatching(c) {
    return '<g transform="translate(0,-14)">' + head(c) +
      '<path d="M-13,-1L-7,3L-1,-2L5,3L11,-1C11,-13 -13,-13 -13,-1Z" fill="' + EGG[c] + '" ' + SW + ' transform="translate(5,-25) rotate(20)"/></g>' +
      '<path d="' + SHELLP + '" fill="' + EGG[c] + '" ' + SW + '/>' +
      '<g clip-path="url(#hm-shellclip)">' + eggPattern(c) + '</g>' +
      '<path d="' + SHELLP + '" fill="none" ' + SW + '/>' +
      '<g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M-32,-22l-6,-4"/><path d="M-33,-8h-7"/><path d="M32,-22l6,-4"/><path d="M33,-8h7"/></g>' +
      nest();
  }
  function grown(c) {
    var s = SKIN[c];
    if (c === 0) return '' +   // dragon: wings, tail, horns
      '<path d="M8,26C26,34 40,26 36,8" fill="none" stroke="' + INK + '" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M8,26C26,34 40,26 36,8" fill="none" stroke="' + s + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M36,-1L43,10L29,10Z" fill="#ffd23f" ' + SW + '/>' +
      '<path d="M-14,2C-24,-14 -40,-14 -42,-8C-37,-4 -39,2 -39,2C-33,0 -32,7 -32,7C-26,4 -20,10 -14,12Z" fill="#e8435a" ' + SW + '/>' +
      '<path d="M14,2C24,-14 40,-14 42,-8C37,-4 39,2 39,2C33,0 32,7 32,7C26,4 20,10 14,12Z" fill="#e8435a" ' + SW + '/>' +
      '<ellipse cx="-10" cy="36" rx="8" ry="4.5" fill="' + s + '" ' + SW + '/><ellipse cx="10" cy="36" rx="8" ry="4.5" fill="' + s + '" ' + SW + '/>' +
      '<ellipse cx="0" cy="18" rx="20" ry="19" fill="' + s + '" ' + SW + '/>' +
      '<ellipse cx="0" cy="21" rx="12" ry="13" fill="#ffe08a"/>' +
      '<path d="M-10,16H10M-11,22H11M-9,28H9" stroke="#f2b84b" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="-17" cy="16" rx="4" ry="6.5" fill="' + s + '" ' + SW + ' transform="rotate(25 -17 16)"/><ellipse cx="17" cy="16" rx="4" ry="6.5" fill="' + s + '" ' + SW + ' transform="rotate(-25 17 16)"/>' +
      '<g transform="translate(0,-15) scale(0.92)">' + head(0) + '</g>';
    if (c === 1) return '' +   // duck: plump body, wing, tail point, webbed feet
      '<path d="M-14,30l-7,8h14zM6,30l-7,8h14z" fill="#ff9f43" ' + SW + '/>' +
      '<path d="M-24,12C-24,-2 2,0 12,4L36,-6C36,10 30,30 4,32C-16,34 -24,24 -24,12Z" fill="' + s + '" ' + SW + '/>' +
      '<path d="M-4,12C4,4 22,6 26,12C20,22 4,22 -4,12Z" fill="#ffe680" ' + SW + '/>' +
      '<g transform="translate(-12,-16) scale(0.9)">' + head(1) + '</g>';
    if (c === 2) return '' +   // dino: upright, back plates, tail
      '<path d="M12,22C26,26 36,22 42,10C38,28 26,36 8,34Z" fill="' + s + '" ' + SW + '/>' +
      '<path d="M22,23l5,-7l3,7zM32,19l6,-6l1,8z" fill="#ff9f43" ' + SW + ' stroke-width="2"/>' +
      '<path d="M-19,2l-9,-3l5,10zM-21,16l-10,1l7,8zM19,2l9,-3l-5,10z" fill="#ff9f43" ' + SW + '/>' +
      '<ellipse cx="-10" cy="37" rx="8.5" ry="4.5" fill="' + s + '" ' + SW + '/><ellipse cx="10" cy="37" rx="8.5" ry="4.5" fill="' + s + '" ' + SW + '/>' +
      '<ellipse cx="0" cy="19" rx="20" ry="19" fill="' + s + '" ' + SW + '/>' +
      '<ellipse cx="0" cy="23" rx="12" ry="12" fill="#9df2c0"/>' +
      '<path d="M-14,12q-6,4 -4,9M14,12q6,4 4,9" fill="none" ' + SW + '/>' +
      '<g transform="translate(0,-15) scale(0.92)">' + head(2) + '</g>';
    return '<g transform="translate(4,0) scale(1.08)">' +   // turtle: domed shell, head out front
      '<ellipse cx="-20" cy="24" rx="8" ry="6.5" fill="' + s + '" ' + SW + '/><ellipse cx="20" cy="24" rx="8" ry="6.5" fill="' + s + '" ' + SW + '/>' +
      '<path d="M34,16l7,3l-7,3z" fill="' + s + '" ' + SW + '/>' +
      '<path d="M-34,18C-34,-20 34,-20 34,18Z" fill="#2f8fe0" ' + SW + '/>' +
      '<path d="M-8,-8L8,-8L14,4L8,14L-8,14L-14,4Z" fill="#6cc8ff" ' + SW + ' stroke-width="2"/>' +
      '<path d="M-14,4L-29,4M14,4L29,4M-8,-8L-14,-13M8,-8L14,-13" fill="none" ' + SW + ' stroke-width="2"/>' +
      '<rect x="-37" y="14" width="74" height="8" rx="4" fill="#8fe0ff" ' + SW + '/>' +
      '<g transform="translate(-34,-6) scale(0.8)">' + head(3) + '</g>' + '</g>';
  }

  /* ---------- specials ---------- */
  function munch(c) {
    function mini(rot, x) {
      return '<g transform="translate(' + x + ',-6) rotate(' + rot + ')"><rect x="-14" y="-20" width="28" height="40" rx="5" fill="#fffdf7" ' + SW + '/>' +
        '<rect x="-9.5" y="-15.5" width="19" height="31" rx="3" fill="url(#hm-p' + c + ')"/></g>';
    }
    return '<ellipse cx="0" cy="40" rx="26" ry="4" fill="' + INK + '" opacity="0.12"/>' +
      mini(-16, -10) + mini(12, 10) +
      '<text x="0" y="34" text-anchor="middle" font-family="ui-rounded,-apple-system,system-ui,sans-serif" font-weight="900" font-size="40" fill="#fffdf7" stroke="' + INK + '" stroke-width="6" paint-order="stroke" stroke-linejoin="round">+2</text>';
  }
  function storm() {
    return '<path d="M-8,4L6,4L-1,15L10,15L-9,36L-3,20L-13,20Z" fill="#ffd23f" ' + SW + '/>' +
      '<path d="M-26,4C-37,4 -37,-13 -24,-13C-24,-28 -3,-31 1,-18C7,-29 27,-25 25,-10C36,-10 36,4 25,4Z" fill="#eef1ff" ' + SW + '/>' +
      '<path d="M-14,-9q3,-3 6,0M6,-9q3,-3 6,0" fill="none" ' + SW + ' stroke-width="2.2"/>' +
      '<circle cx="-1" cy="-2" r="3.2" fill="' + INK + '"/>' +
      '<circle cx="-15" cy="-3" r="3" fill="#ff7ac6" opacity="0.5"/><circle cx="13" cy="-3" r="3" fill="#ff7ac6" opacity="0.5"/>' +
      '<path d="M-38,26C-26,44 26,44 38,26" fill="none" stroke="#fffdf7" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M30,22L40,24L36,34" fill="none" stroke="#fffdf7" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M-34,-26q6,-4 12,0M24,-30q6,-4 12,0" fill="none" stroke="#fffdf7" stroke-width="3" stroke-linecap="round"/>';
  }
  function nap() {
    return '<circle cx="0" cy="2" r="34" fill="#22265e" ' + SW + '/>' +
      '<g fill="#fffdf7"><circle cx="-20" cy="-18" r="1.8"/><circle cx="-24" cy="16" r="1.4"/><circle cx="20" cy="22" r="1.6"/><circle cx="-8" cy="28" r="1.2"/></g>' +
      '<circle cx="-6" cy="4" r="21" fill="#ffd23f" ' + SW + '/>' +
      '<circle cx="5" cy="-4" r="17" fill="#22265e" ' + SW + '/>' +
      '<path d="M-21,4q4,4 8,0" fill="none" ' + SW + ' stroke-width="2.2"/>' +
      '<circle cx="-17" cy="13" r="2.6" fill="#ff7ac6" opacity="0.7"/>' +
      '<g font-family="ui-rounded,-apple-system,system-ui,sans-serif" font-weight="900" fill="#fffdf7" stroke="' + INK + '" stroke-width="3" paint-order="stroke">' +
      '<text x="10" y="-4" font-size="12">z</text><text x="16" y="-14" font-size="16">z</text><text x="22" y="-28" font-size="20">Z</text></g>';
  }
  function chameleon() {
    return '<path d="M-40,28C-14,22 14,24 40,30" fill="none" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M-40,28C-14,22 14,24 40,30" fill="none" stroke="#a86b35" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M-20,12C-36,14 -38,36 -22,38C-10,39 -10,26 -19,25C-24,25 -25,31 -21,32" fill="none" stroke="' + INK + '" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M-20,12C-36,14 -38,36 -22,38C-10,39 -10,26 -19,25C-24,25 -25,31 -21,32" fill="none" stroke="#3ddc84" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M-8,18l-4,8M10,18l4,8" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M-24,8C-24,-12 10,-20 20,-8L34,-4C36,6 28,14 16,14C6,22 -20,22 -24,8Z" fill="url(#hm-cham)" ' + SW + '/>' +
      '<path d="M-16,-6l4,-7l4,6l4,-7l4,6l4,-6l3,6" fill="none" ' + SW + ' stroke-width="2"/>' +
      '<path d="M-14,4q8,6 18,0" fill="none" stroke="#fffdf7" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>' +
      '<path d="M33,4C42,6 44,14 38,16C34,17 34,12 37,12" fill="none" stroke="#ff7ac6" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="16" cy="-4" r="8.5" fill="#ffd23f" ' + SW + '/>' + eye(16, -4, 4.6);
  }

  /* ---------- corners ---------- */
  function corner(card, col) {
    var ink = col >= 0 ? PAL[col].edge : INK, out = '<circle cx="0" cy="0" r="11" fill="#fffdf7" ' + SW + ' stroke-width="2"/>';
    if (card.t === 'c') {
      var pos = [[], [[0, 0]], [[-4, 0], [4, 0]], [[0, -4.2], [-4.4, 3], [4.4, 3]]][card.s];
      pos.forEach(function (p) { out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.1" fill="' + ink + '"/>'; });
    } else if (card.t === 'munch') {
      out += '<text x="0" y="4.2" text-anchor="middle" font-family="ui-rounded,-apple-system,system-ui,sans-serif" font-weight="900" font-size="12" fill="' + ink + '">+2</text>';
    } else if (card.t === 'storm') {
      out += '<path d="M-1,-7L4,-7L1,-1L5,-1L-3,8L-1,1L-5,1Z" fill="' + ink + '"/>';
    } else if (card.t === 'nap') {
      out += '<circle cx="-1.5" cy="1" r="7" fill="' + ink + '"/><circle cx="2.5" cy="-2" r="5.6" fill="#fffdf7"/>';
    } else {
      out += '<circle cx="0" cy="0" r="7" fill="url(#hm-rb)"/>';
    }
    return out;
  }

  /* ---------- whole faces ---------- */
  var cache = {};
  A.key = function (card) {
    if (card.t === 'c') return 'c-' + card.c + '-' + card.s;
    if (card.t === 'wild') return 'wild-' + (card.pick >= 0 ? card.pick : 'x');
    return card.t + '-' + card.c;
  };
  A.face = function (card) {
    var k = A.key(card);
    if (cache[k]) return cache[k];
    var col = card.t === 'wild' ? (card.pick >= 0 ? card.pick : -1) : card.c;
    var panel = col >= 0 ? 'url(#hm-p' + col + ')' : 'url(#hm-rb)';
    var art = card.t === 'c' ? [null, egg, hatching, grown][card.s](card.c)
      : card.t === 'munch' ? munch(card.c) : card.t === 'storm' ? storm() : card.t === 'nap' ? nap() : chameleon();
    var size = card.t === 'c' ? [0, 0.86, 0.92, 1.02][card.s] : 1;
    var svg = '<svg class="hc-svg" viewBox="0 0 100 140" aria-hidden="true" focusable="false">' +
      '<rect x="0" y="0" width="100" height="140" rx="11" fill="#fffdf7"/>' +
      '<rect x="4.5" y="4.5" width="91" height="131" rx="8" fill="' + panel + '"/>' +
      '<rect x="4.5" y="4.5" width="91" height="131" rx="8" fill="url(#hm-dots)"/>' +
      (card.t === 'wild' && col >= 0 ? '<rect x="5.5" y="5.5" width="89" height="129" rx="7.5" fill="none" stroke="url(#hm-rb)" stroke-width="4"/>' : '') +
      '<ellipse cx="50" cy="74" rx="42" ry="46" fill="#fffaf0" opacity="0.94"/>' +
      '<ellipse cx="50" cy="74" rx="42" ry="46" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.8"/>' +
      '<g transform="translate(50,76) scale(' + size + ')">' + art + '</g>' +
      '<g transform="translate(17,18)">' + corner(card, col) + '</g>' +
      '<g transform="translate(83,122) rotate(180)">' + corner(card, col) + '</g>' +
      '</svg>';
    cache[k] = svg;
    return svg;
  };
  var back = null;
  A.back = function () {
    if (back) return back;
    back = '<svg class="hc-svg" viewBox="0 0 100 140" aria-hidden="true" focusable="false">' +
      '<rect x="0" y="0" width="100" height="140" rx="11" fill="#fffdf7"/>' +
      '<rect x="4.5" y="4.5" width="91" height="131" rx="8" fill="url(#hm-back)"/>' +
      '<rect x="4.5" y="4.5" width="91" height="131" rx="8" fill="url(#hm-eggs)"/>' +
      '<rect x="10" y="10" width="80" height="120" rx="6" fill="none" stroke="#ffd23f" stroke-width="1.6" stroke-dasharray="3 4" opacity="0.7"/>' +
      '<g transform="translate(50,72) scale(0.9)">' +
      '<circle cx="0" cy="2" r="38" fill="#ffd23f" opacity="0.14"/>' +
      '<path d="' + EGGP + '" fill="url(#hm-gold)" ' + SW + '/>' +
      '<path d="M-24,2L-15,-6L-7,3L1,-6L9,3L17,-6L25,2" fill="none" ' + SW + '/>' +
      shine(-11, -14) +
      '<path d="M-36,-26l5,2l-5,2l-2,5l-2,-5l-5,-2l5,-2l2,-5zM36,20l4,1.6l-4,1.6l-1.6,4l-1.6,-4l-4,-1.6l4,-1.6l1.6,-4z" fill="#fffdf7"/>' +
      '</g></svg>';
    return back;
  };

  return A;
})();
