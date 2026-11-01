/* Shared kit for the card games. Each game keeps its rules in js/game.js and
   its screen in js/ui.js; this file draws cards, lays out a hand, flies cards
   between places, seats the computer opponents, and provides the overlays
   every card game needs (pick one, pass the phone, a big banner), plus
   sounds and safe saving. Plain script, no build step.

   It sits on top of the arcade kit (kit/kit.js) when a page loads it:
   sounds go through Kit.sfx and the one arcade-wide mute switch, and the
   overlays use the kit's card look. Without the kit it still works on its
   own (older pages).

   A standard card is { s, r }: suit 'S' 'H' 'C' 'D' and rank 1 (ace) to 13
   (king). Card sizes all follow the CSS variable --cw (card width), so a
   game sets --cw once on its table and everything scales. Faces are one
   inline SVG (viewBox 100 x 140), so they stay crisp at any size. */

var Cards = (function () {
  var K = {};
  var KIT = typeof Kit !== 'undefined' ? Kit : null;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- deck ---------- */
  // Four colours rather than two, so younger kids can match suits at a glance.
  K.SUITS = ['S', 'H', 'C', 'D'];
  // U+FE0E asks for the text glyph; without it iOS may draw an emoji heart.
  K.SUIT_CHAR = { S: '♠︎', H: '♥︎', C: '♣︎', D: '♦︎' };
  K.SUIT_NAME = { S: 'Spades', H: 'Hearts', C: 'Clubs', D: 'Diamonds' };
  K.SUIT_COLOR = { S: '#23264f', H: '#e5374a', C: '#16955a', D: '#2a6ee8' };
  K.RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  K.standardDeck = function () {
    var d = [];
    for (var s = 0; s < 4; s++) for (var r = 1; r <= 13; r++) d.push({ s: K.SUITS[s], r: r });
    return d;
  };

  K.shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* Sort in place by suit, then rank, so a hand reads left to right. */
  K.sort = function (hand) {
    return hand.sort(function (a, b) {
      return (K.SUITS.indexOf(a.s) - K.SUITS.indexOf(b.s)) || (a.r - b.r);
    });
  };

  K.label = function (c) { return K.RANK[c.r] + K.SUIT_CHAR[c.s]; };

  /* ---------- suit pips ----------
     One <symbol> per suit (20 x 20, filled with currentColor) lives in a
     hidden <svg> added to the page once; faces <use> them. */
  var PIPS = {
    H: '<path d="M10 18.4C4.2 14 1.2 10.4 1.2 6.6 1.2 3.7 3.4 1.6 6 1.6c1.8 0 3.3 1 4 2.5.7-1.5 2.2-2.5 4-2.5 2.6 0 4.8 2.1 4.8 5 0 3.8-3 7.4-8.8 11.8z"/>',
    D: '<path d="M10 .9c2.2 3.5 4.7 6.4 7.6 9.1-2.9 2.7-5.4 5.6-7.6 9.1-2.2-3.5-4.7-6.4-7.6-9.1C5.3 7.3 7.8 4.4 10 .9z"/>',
    S: '<path d="M10 1C4.3 5.6 1.3 8.8 1.3 12.2c0 2.6 2 4.5 4.5 4.5 1.5 0 2.8-.7 3.5-1.8-.3 1.8-1.1 3.1-2.7 4.1h6.8c-1.6-1-2.4-2.3-2.7-4.1.7 1.1 2 1.8 3.5 1.8 2.5 0 4.5-1.9 4.5-4.5C18.7 8.8 15.7 5.6 10 1z"/>',
    C: '<circle cx="10" cy="5.7" r="4.4"/><circle cx="5.1" cy="11.6" r="4.4"/><circle cx="14.9" cy="11.6" r="4.4"/><circle cx="10" cy="10.4" r="2.6"/>' +
       '<path d="M9.1 11.5c-.1 3.7-.9 5.9-2.6 7.5h7c-1.7-1.6-2.5-3.8-2.6-7.5z"/>'
  };
  var defsReady = false;
  function ensureDefs() {
    if (defsReady || !document.body) return;
    defsReady = true;
    var s = '<svg xmlns="' + SVGNS + '" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">';
    K.SUITS.forEach(function (k) { s += '<symbol id="cd-pip-' + k + '" viewBox="0 0 20 20" fill="currentColor">' + PIPS[k] + '</symbol>'; });
    s += '</svg>';
    var box = document.createElement('div');
    box.innerHTML = s;
    document.body.insertBefore(box.firstChild, document.body.firstChild);
  }
  function use(suit, x, y, size, extra) {
    return '<use href="#cd-pip-' + suit + '" xlink:href="#cd-pip-' + suit + '" x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '"' + (extra || '') + '/>';
  }
  /* A suit pip as a standalone <svg> (for buttons, badges, bubbles). */
  K.pip = function (suit, cls) {
    ensureDefs();
    return '<svg class="cd-pip' + (cls ? ' ' + cls : '') + '" viewBox="0 0 20 20" aria-hidden="true" style="color:var(--s-' + suit + ',' + K.SUIT_COLOR[suit] + ')">' + use(suit, 0, 0, 20) + '</svg>';
  };

  /* ---------- card faces ----------
     Pip spots for 2-10 (centres in the 100 x 140 face); spots below the
     middle are drawn upside down like a real deck. */
  var L = 34, M = 50, R = 66;
  var SPOTS = {
    2: [[M, 24], [M, 116]],
    3: [[M, 24], [M, 70], [M, 116]],
    4: [[L, 24], [R, 24], [L, 116], [R, 116]],
    5: [[L, 24], [R, 24], [M, 70], [L, 116], [R, 116]],
    6: [[L, 24], [R, 24], [L, 70], [R, 70], [L, 116], [R, 116]],
    7: [[L, 24], [R, 24], [M, 47], [L, 70], [R, 70], [L, 116], [R, 116]],
    8: [[L, 24], [R, 24], [M, 47], [L, 70], [R, 70], [M, 93], [L, 116], [R, 116]],
    9: [[L, 24], [R, 24], [L, 54.7], [R, 54.7], [M, 70], [L, 85.3], [R, 85.3], [L, 116], [R, 116]],
    10: [[L, 24], [R, 24], [M, 39.3], [L, 54.7], [R, 54.7], [L, 85.3], [R, 85.3], [M, 100.7], [L, 116], [R, 116]]
  };
  function pipsFor(c) {
    var out = '', sz = 18, h = sz / 2;
    SPOTS[c.r].forEach(function (p) {
      var flip = p[1] > 70 ? ' transform="rotate(180 ' + p[0] + ' ' + p[1] + ')"' : '';
      out += use(c.s, p[0] - h, p[1] - h, sz, flip);
    });
    return out;
  }

  // Court cards: a friendly painted figure in a frame tinted with the suit.
  var TINT = { S: '#e7e8f6', H: '#fde3e6', C: '#dcf3e6', D: '#e0eafd' };
  var SKIN = { S: '#9a6440', H: '#f5cfa4', C: '#c98a58', D: '#ffdcb8' };
  var HAIR = { S: '#2b1a12', H: '#b4562a', C: '#3a2416', D: '#e2a93b' };
  function face(c, x) {   // shared head: skin, eyes, cheeks, smile (x = head centre)
    var sk = SKIN[c.s];
    return '<circle cx="' + x + '" cy="47" r="12.5" fill="' + sk + '" stroke="#3a2a22" stroke-width="1"/>' +
      '<circle cx="' + (x - 4.6) + '" cy="45.5" r="1.7" fill="#23264f"/><circle cx="' + (x + 4.6) + '" cy="45.5" r="1.7" fill="#23264f"/>' +
      '<circle cx="' + (x - 7.4) + '" cy="50.6" r="2.4" fill="#ff7a8a" opacity=".55"/><circle cx="' + (x + 7.4) + '" cy="50.6" r="2.4" fill="#ff7a8a" opacity=".55"/>';
  }
  function smile(x, y) { return '<path d="M' + (x - 4.4) + ' ' + y + 'q4.4 4 8.8 0" fill="none" stroke="#7a2b2b" stroke-width="1.6" stroke-linecap="round"/>'; }
  function courtArt(c) {
    // var(--suit) so a two-colour table (.cd-two-color) recolours the robes too
    var col = 'var(--suit,' + K.SUIT_COLOR[c.s] + ')', x = 26, hair = HAIR[c.s];
    var g = '<rect x="0" y="0" width="52" height="120" rx="7" fill="' + TINT[c.s] + '" style="stroke:' + col + '" stroke-width="1.6"/>';
    // robe and shoulders, with a white suit badge on the chest
    var robe = '<path d="M5 119C5 89 12 71 26 67c14 4 21 22 21 52z" style="fill:' + col + '"/>' +
      '<path d="M20 69c2 3 10 3 12 0l1 50H19z" fill="#fffdf7" opacity=".95"/>';
    var badge = use(c.s, 17, 84, 18, ' style="color:' + col + '"');
    if (c.r === 13) {        // king: crown, white beard
      g += robe + badge +
        face(c, x) +
        '<path d="M15 50c0 12 6 16 11 16s11-4 11-16c-3 4-6 6-11 6s-8-2-11-6z" fill="#fffdf7" stroke="#3a2a22" stroke-width="1"/>' +
        smile(x, 55) +
        '<path d="M13.5 37V21l6.5 7 6-11 6 11 6.5-7v16z" fill="#ffd23f" stroke="#c98a00" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<circle cx="26" cy="31" r="2" fill="' + (c.s === 'H' ? '#2a6ee8' : '#e5374a') + '"/><circle cx="18" cy="32" r="1.3" fill="#fffdf7"/><circle cx="34" cy="32" r="1.3" fill="#fffdf7"/>';
    } else if (c.r === 12) { // queen: long hair, tiara
      g += '<path d="M11 50c-2-16 6-24 15-24s17 8 15 24l3 18H8z" fill="' + hair + '"/>' +
        robe + badge + face(c, x) + smile(x, 52) +
        '<path d="M14 42c1-9 6-13 12-13s11 4 12 13c-4-5-8-7-12-7s-8 2-12 7z" fill="' + hair + '"/>' +
        '<path d="M16.5 33l3-7 3 4.5 3.5-7.5 3.5 7.5 3-4.5 3 7z" fill="#ffd23f" stroke="#c98a00" stroke-width="1.1" stroke-linejoin="round"/>' +
        '<circle cx="26" cy="27" r="1.6" fill="' + (c.s === 'H' ? '#2a6ee8' : '#ff7ac6') + '"/>';
    } else {                 // jack: feathered cap, frilly collar
      g += robe + badge +
        '<path d="M14 66l3 4 3-4 3 4 3-4 3 4 3-4 3 4 3-4" fill="none" stroke="#fffdf7" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
        face(c, x) + smile(x, 52) +
        '<path d="M14 45c-1-6 1-9 4-10M38 45c1-6-1-9-4-10" fill="none" stroke="' + hair + '" stroke-width="3.5" stroke-linecap="round"/>' +
        '<path d="M12.5 39c0-10 6-14 13.5-14s13.5 4 13.5 14z" style="fill:' + col + '" stroke="#1d1f40" stroke-width="1"/>' +
        '<rect x="11" y="36.5" width="30" height="4.5" rx="2.2" fill="#ffd23f" stroke="#c98a00" stroke-width=".8"/>' +
        '<path d="M37 30c5-7 9-14 6-19-4 6-8 11-10 17z" fill="#ffd23f" stroke="#c98a00" stroke-width=".9"/>';
    }
    return '<g class="c-art" transform="translate(24 10)">' + g + '</g>';
  }

  /* The court figure alone, as an <svg> (52 x 120 viewBox). */
  K.courtSVG = function (c) {
    ensureDefs();
    return '<svg class="cd-court" viewBox="0 0 52 120" aria-hidden="true">' + courtArt(c).replace('transform="translate(24 10)"', '') + '</svg>';
  };
  // The emoji the court cards used before they were drawn (kept for any game that used them).
  K.FACE_ART = { 11: '🦸', 12: '👸', 13: '🤴' };

  function corner(c) {
    var rank = K.RANK[c.r];
    var t = '<text x="13" y="29" text-anchor="middle"' + (rank.length > 1 ? ' textLength="23" lengthAdjust="spacingAndGlyphs"' : '') + '>' + rank + '</text>';
    return t + use(c.s, 5.5, 33, 15);
  }

  /* A peek strip for stacked columns (shown under .cd-peek instead of the
     top corner): a big rank on the left and a big suit on the right of the
     top edge, so a card that only peeks out from under another still reads.
     The middle of the face shrinks a little to make room. */
  function peekStrip(c) {
    var rank = K.RANK[c.r];
    return '<text class="c-pk-r" x="5" y="36"' + (rank.length > 1 ? ' textLength="40" lengthAdjust="spacingAndGlyphs"' : '') + '>' + rank + '</text>' +
      use(c.s, 66, 6, 29);
  }

  /* The inner HTML of a face. Games with their own decks (pictures instead
     of suits) may replace Cards.faceHTML; Cards.el and Cards.fly use it. */
  K.faceHTML = function (c) {
    ensureDefs();
    var mid;
    if (c.r === 1) mid = use(c.s, 26, 46, 48);
    else if (c.r >= 11) mid = courtArt(c);
    else mid = pipsFor(c);
    return '<svg class="c-svg" viewBox="0 0 100 140" aria-hidden="true">' +
      '<g class="c-tl">' + corner(c) + use(c.s, 81, 6, 13) + '</g>' +
      '<g class="c-pk">' + peekStrip(c) + '</g>' +
      '<g class="c-mid">' + mid + '</g>' +
      '<g class="c-br" transform="rotate(180 50 70)">' + corner(c) + use(c.s, 81, 6, 13) + '</g>' +
      '</svg>';
  };

  /* ---------- drawing a card ----------
     <div class="card faceup s-H r-5">
       <div class="card-in"><div class="card-face">…</div><div class="card-back"></div></div>
     </div>
     Face down is the same element without .faceup; flipping is a CSS
     transition on .card-in. `card` may be null for a card only ever seen
     from the back. */
  K.el = function (card, faceUp) {
    var el = document.createElement('div');
    el.className = 'card' + (faceUp ? ' faceup' : '');
    var face = '';
    if (card) {
      el.className += ' s-' + card.s + ' r-' + card.r;
      face = K.faceHTML(card);
    }
    el.innerHTML = '<div class="card-in"><div class="card-face">' + face + '</div><div class="card-back"></div></div>';
    return el;
  };

  /* ---------- hand layout ----------
     Positions `els` (already children of `box`) in up to three overlapping
     rows centred in the box, and sets the box height to fit. The overlap
     tightens as the hand grows; a new row starts once cards would show less
     than `minStep` px each, so every card keeps a tappable strip. */
  K.fan = function (box, els, opts) {
    opts = opts || {};
    var n = els.length;
    // Measure a card rather than reading --cw, which may be a clamp() formula.
    var cw = opts.cw || (n && els[0].offsetWidth) || 70;
    var ch = cw * 1.4, W = box.clientWidth;
    var minStep = opts.minStep || cw * 0.42, maxStep = opts.maxStep || cw * 1.06;
    var rowGap = ch * 0.5;
    var rows = 1, perRow = n, step = maxStep;
    for (;;) {
      perRow = Math.ceil(n / rows);
      step = perRow > 1 ? Math.min(maxStep, (W - cw) / (perRow - 1)) : 0;
      // (one card per row never needs another row: that used to give a
      // one-card hand three rows of empty height)
      if (step >= minStep || perRow <= 1 || rows >= 3) break;
      rows++;
    }
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / perRow), col = i - row * perRow;
      var inRow = Math.min(perRow, n - row * perRow);
      var left = (W - (cw + (inRow - 1) * step)) / 2 + col * step;
      els[i].style.left = Math.round(left) + 'px';
      els[i].style.top = Math.round(row * rowGap) + 'px';
      els[i].style.zIndex = i + 1;
    }
    box.style.height = Math.round(ch + (Math.max(1, Math.min(rows, Math.ceil(n / perRow) || 1)) - 1) * rowGap) + 'px';
  };

  /* ---------- flying cards ----------
     Animates a temporary card from `from` to `to` (elements or rects) on top
     of everything, then removes it. Callers update the real piles first and
     pass the destination element as `hide`, so it appears the moment the
     flyer lands. opts: card, faceUp (at the start), flip (turn over on the
     way), ms. Resolves when it lands. */
  var reduced = KIT ? KIT.reduced : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  K.reduced = reduced;
  function rectOf(x) {
    if (!x) return null;
    var r = x.getBoundingClientRect ? x.getBoundingClientRect() : x;
    return r.width ? r : null;
  }
  K.rect = rectOf;

  K.fly = function (from, to, opts) {
    opts = opts || {};
    var a = rectOf(from), b = rectOf(to), hide = opts.hide;
    var ms = reduced ? 0 : (opts.ms || 360);
    if (!a || !b || !ms) { if (hide) hide.style.visibility = ''; return Promise.resolve(); }
    if (hide) hide.style.visibility = 'hidden';
    var el = K.el(opts.card || null, !!opts.faceUp);
    el.className += ' cd-flyer';
    // A card flying to a seat or a badge (not card-shaped) keeps card proportions.
    var w = b.height && b.width / b.height > 0.85 ? Math.min(b.width, b.height / 1.4) : b.width;
    var bx = b.left + (b.width - w) / 2, by = b.top + (b.height - w * 1.4) / 2;
    el.style.setProperty('--cw', w + 'px');
    el.style.left = bx + 'px';
    el.style.top = by + 'px';
    var sc = Math.min(a.width / w, 3);
    el.style.transform = 'translate(' + (a.left - bx) + 'px,' + (a.top - by) + 'px) scale(' + sc + ')';
    document.body.appendChild(el);
    el.getBoundingClientRect();   // commit the start position before transitioning
    el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.3,.75,.35,1)';
    el.style.transform = 'none';
    if (opts.flip) setTimeout(function () { el.classList.toggle('faceup'); }, ms * 0.15);
    return new Promise(function (done) {
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (hide) hide.style.visibility = '';
        done();
      }, ms + 20);
    });
  };

  K.wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduced ? Math.min(ms, 200) : ms); }); };

  /* ---------- opponents ---------- */
  K.BOTS = [
    { name: 'Bella', face: '🐻' }, { name: 'Ollie', face: '🦉' },
    { name: 'Pip', face: '🐧' },   { name: 'Rosie', face: '🦊' },
    { name: 'Max', face: '🐶' },   { name: 'Coco', face: '🐵' },
    { name: 'Luna', face: '🐱' },  { name: 'Hopper', face: '🐰' }
  ];
  K.pickBots = function (n) {
    return K.shuffle(K.BOTS.slice()).slice(0, n).map(function (b) { return { name: b.name, face: b.face, bot: true }; });
  };

  /* A seat: face, name, card count, and a speech bubble. data-p holds the
     player index so a game can find where that player's cards fly from. */
  K.seat = function (p, index) {
    var el = document.createElement('div');
    el.className = 'cd-seat';
    el.setAttribute('data-p', index);
    el.innerHTML = '<div class="cd-avatar"></div><div class="cd-info"><div class="cd-name"></div>' +
      '<div class="cd-count"><span class="cd-mini"></span><span class="cd-n"></span></div></div><div class="cd-bubble"></div>';
    el.querySelector('.cd-avatar').textContent = p.face;
    el.querySelector('.cd-name').textContent = p.name;
    return el;
  };
  K.updateSeat = function (el, count, active) {
    el.querySelector('.cd-n').textContent = count;
    el.classList.toggle('active', !!active);
    el.classList.toggle('last', count === 1);
  };
  /* A speech bubble over a seat. opts.html: the text is markup (pictures,
     pips) rather than plain words. */
  K.say = function (seatEl, text, ms, opts) {
    if (!seatEl) return;
    var b = seatEl.querySelector('.cd-bubble');
    if (opts && opts.html) b.innerHTML = text; else b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(b._t);
    b._t = setTimeout(function () { b.classList.remove('show'); }, ms || 1300);
  };

  /* ---------- overlays ----------
     Drawn with the arcade kit's overlay and card look (.k-overlay / .k-card). */
  function overlay(cls, html) {
    var bg = document.createElement('div');
    bg.className = 'k-overlay cd-overlay ' + (cls || '');
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    bg.innerHTML = '<div class="k-card cd-sheet">' + html + '</div>';
    document.body.appendChild(bg);
    if (KIT) KIT.sfx.open();
    return bg;
  }
  function close(bg) {
    if (!bg.parentNode) return;
    if (reduced) { bg.parentNode.removeChild(bg); return; }
    bg.classList.add('k-out');
    setTimeout(function () { if (bg.parentNode) bg.parentNode.removeChild(bg); }, 170);
  }

  /* Ask the player to pick one of a few big buttons. options:
     [{ label, value, cls, suit, html }]. A suit option (suit: 'H', or cls
     's-H') shows a big pip and the suit's name. Resolves with the value. */
  K.choose = function (title, options) {
    var bg = overlay('cd-choose', '<h2></h2><div class="cd-choices"></div>');
    bg.querySelector('h2').textContent = title;
    var box = bg.querySelector('.cd-choices');
    return new Promise(function (done) {
      options.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cd-choice ' + (o.cls || '');
        var suit = o.suit || (/(^|\s)s-([SHCD])(\s|$)/.exec(o.cls || '') || [])[2];
        if (o.html) b.innerHTML = o.html;
        else if (suit) {
          b.innerHTML = K.pip(suit) + '<span class="cd-choice__name"></span>';
          b.querySelector('.cd-choice__name').textContent = K.SUIT_NAME[suit];
          b.setAttribute('aria-label', K.SUIT_NAME[suit]);
        } else b.textContent = o.label;
        b.addEventListener('click', function () { K.sfx.tap(); close(bg); done(o.value); });
        box.appendChild(b);
      });
    });
  };

  /* Pass-and-play: cover the table until the next player says they're ready,
     so nobody sees the hand they shouldn't. */
  K.handoff = function (p) {
    var bg = overlay('cd-handoff', '<div class="k-card__art cd-big"></div><h2></h2><p>Don’t peek at each other’s cards!</p>' +
      '<div class="k-row"><button type="button" class="' + (KIT ? 'k-btn k-btn--lg k-btn--primary' : 'pill primary') + '"></button></div>');
    bg.querySelector('.cd-big').textContent = p.face;
    bg.querySelector('h2').textContent = 'Pass to ' + p.name;
    bg.querySelector('button').textContent = 'I’m ' + p.name + ' – show my cards';
    return new Promise(function (done) {
      bg.querySelector('button').addEventListener('click', function () { K.sfx.tap(); close(bg); done(); });
    });
  };

  /* A big word across the table ("Skip!", "Shuffling…"). Doesn't block taps.
     opts.html: the text is markup. */
  K.banner = function (text, cls, ms, opts) {
    var el = document.createElement('div');
    el.className = 'cd-banner ' + (cls || '');
    if (opts && opts.html) el.innerHTML = text; else el.textContent = text;
    document.body.appendChild(el);
    ms = ms || 900;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms);
    return K.wait(Math.min(ms, 700));
  };

  /* ---------- sound ----------
     Short blips. With the kit loaded they go through Kit.sfx (one audio
     context, one arcade-wide mute that also writes 'cards.mute'); without it
     a small synth of our own honours 'cards.mute'. */
  var MUTE_KEY = 'cards.mute';
  var muted = false, actx = null;
  if (!KIT) {
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    var audio = function () {
      if (!actx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { actx = new AC(); } catch (e) { return null; }
      }
      if (actx.state !== 'running' && actx.resume) actx.resume();
      return actx;
    };
    // iOS counts touchend/click (not always pointerdown) as the unlocking gesture.
    ['pointerdown', 'touchend', 'click'].forEach(function (n) {
      document.addEventListener(n, audio, { passive: true });
    });
  }
  function tone(freq, when, dur, vol, glideTo, type) {
    if (KIT) { KIT.sfx.tone(freq, dur, type || 'sine', { when: when, vol: vol || 0.1, to: glideTo || 0 }); return; }
    if (muted || !actx) return;
    try {
      var t = actx.currentTime + when;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  K.tone = tone;
  K.sfx = {
    tap: function () { tone(660, 0, 0.06, 0.06); },
    deal: function () { tone(900, 0, 0.05, 0.05, 600, 'triangle'); },
    play: function () { tone(380, 0, 0.1, 0.1, 620); },
    draw: function () { tone(520, 0, 0.08, 0.07, 360, 'triangle'); },
    turn: function () { tone(784, 0, 0.12, 0.07); tone(1047, 0.09, 0.16, 0.07); },
    bad: function () { tone(180, 0, 0.14, 0.08, 150, 'triangle'); },
    wild: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, i * 0.06, 0.18, 0.07); }); },
    special: function () { tone(300, 0, 0.12, 0.09, 900); tone(900, 0.1, 0.12, 0.07, 450); },
    shuffle: function () { for (var i = 0; i < 6; i++) tone(700 + (i % 2) * 200, i * 0.04, 0.04, 0.04, 0, 'triangle'); },
    flip: function () { tone(1100, 0, 0.04, 0.05, 700, 'triangle'); },
    good: function () { tone(660, 0, 0.12, 0.1); tone(990, 0.08, 0.18, 0.09); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.11, 0.35, 0.11); }); },
    lose: function () { [523, 440, 392].forEach(function (f, i) { tone(f, i * 0.16, 0.3, 0.08); }); }
  };
  K.muted = function () { return KIT ? KIT.muted() : muted; };
  K.bindMute = function (btn) {
    if (KIT) { KIT.bindMute(btn); return btn; }
    function show() {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    }
    btn.addEventListener('click', function () {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
      show();
      K.sfx.tap();
    });
    show();
    return btn;
  };

  /* ---------- saving ----------
     localStorage can throw in private browsing; never let that stop play. */
  K.load = function (key, fallback) {
    try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
  };
  K.save = function (key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} };
  K.drop = function (key) { try { localStorage.removeItem(key); } catch (e) {} };
  /* The one contract with the arcade menu: a short line for the game's tile. */
  K.stat = function (id, text) { try { localStorage.setItem('arcade.stat.' + id, text); } catch (e) {} };

  K.buzz = function (ms) {
    if (KIT) { KIT.buzz(ms); return; }
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  if (document.body) ensureDefs(); else document.addEventListener('DOMContentLoaded', ensureDefs);
  return K;
})();
