/* Go Fish screen. Built so a child who can't read can play: every card is
   a picture, every prompt is a picture (a pointing finger, a fishing rod,
   a friend's face), and every event has its own little sound.

   Your turn: tap a card in your hand (all the same pictures lift), then tap
   a friend to ask them for it. They hand them over, or say "go fish" and
   the pond starts to glow: tap it to fish. Sets of four fly to your shelf.
   The state is saved at the start of every turn. */
(function () {
  function $(id) { return document.getElementById(id); }
  var seatsEl = $('seats'), handEl = $('hand'), pondEl = $('pond'), shelfEl = $('shelf'), hintEl = $('hint');

  var st = null;        // game state (see game.js)
  var kind = '1';       // how many friends, for "Play again"
  var gen = 0;          // bumped on every new game so stale animations stop
  var phase = null;     // your turn: 'pick' a card, then 'target' a friend; 'fish' at the pond
  var selRank = 0;      // the picture you picked
  var askedRank = 0;    // what you asked for (a lucky fish lets you go again)
  var idleT = 0;

  /* ---- pictures ---- */
  function pic(r) { return GF.PICS[r]; }
  function tintStyle(r) { var p = pic(r); return '--tint:' + p.tint + ';--edge:' + p.edge; }
  // Every card in this game is a picture card.
  Cards.faceHTML = function (c) {
    var p = pic(c.r);
    return '<div class="gf-face" style="' + tintStyle(c.r) + '">' +
      '<span class="gf-c gf-tl">' + p.e + '</span><span class="gf-big">' + p.e + '</span><span class="gf-c gf-br">' + p.e + '</span></div>';
  };
  function chip(r, cls) { return '<span class="gf-chip' + (cls ? ' ' + cls : '') + '" style="' + tintStyle(r) + '">' + pic(r).e + '</span>'; }
  function faceOf(p) { return p === 0 ? '🙋' : st.players[p].face; }

  /* ---- sounds (no voices) ---- */
  var T = Kit.sfx.tone;
  var sfx = {
    pick: function (r) { Kit.sfx.pop(380 + r * 28); },
    ask: function () { T(520, 0.1, 'sine', { vol: 0.1 }); T(700, 0.16, 'sine', { vol: 0.1, when: 0.1, to: 900 }); },
    yes: function () { Kit.sfx.good(); },
    give: function (i) { T(600 + i * 120, 0.08, 'triangle', { vol: 0.09, to: 900 + i * 120 }); },
    nope: function () {   // a bloop into the water, then bubbles
      T(620, 0.28, 'sine', { vol: 0.12, to: 170 });
      T(900, 0.05, 'sine', { vol: 0.05, when: 0.22 }); T(1250, 0.05, 'sine', { vol: 0.05, when: 0.3 }); T(1500, 0.04, 'sine', { vol: 0.04, when: 0.37 });
    },
    catch: function () { T(300, 0.12, 'sine', { vol: 0.1, to: 700 }); T(1100, 0.05, 'triangle', { vol: 0.05, when: 0.1 }); },
    lucky: function () { Cards.sfx.wild(); },
    book: function () { [0, 1, 2, 3].forEach(function (n) { T(660 * Math.pow(1.19, n), 0.2, 'sine', { vol: 0.1, when: n * 0.08 }); }); Kit.sfx.star(2); },
    turn: function () { Cards.sfx.turn(); }
  };

  // fish: you were told to go fish (the picture you asked for, 0 for none),
  // so a reload puts you back at the pond rather than replaying the ask
  function persist() { Kit.save(GF.SAVE_KEY, { st: st, kind: kind, fish: phase === 'fish' && st.turn === 0 ? askedRank : -1 }); }

  /* ---- drawing the table ---- */
  function seatOf(p) { return seatsEl.querySelector('[data-p="' + p + '"]'); }
  function avatarOf(p) { var s = seatOf(p); return s && s.querySelector('.cd-avatar'); }

  function buildSeats() {
    seatsEl.innerHTML = '';
    for (var p = 1; p < st.players.length; p++) {
      var el = Cards.seat(st.players[p], p);
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Ask ' + st.players[p].name);
      var books = document.createElement('div');
      books.className = 'gf-books';
      el.querySelector('.cd-info').appendChild(books);
      seatsEl.appendChild(el);
    }
  }
  function renderSeats() {
    var targets = phase === 'target' ? GF.targets(st, 0) : [];
    for (var i = 0; i < seatsEl.children.length; i++) {
      var el = seatsEl.children[i], q = +el.getAttribute('data-p');
      Cards.updateSeat(el, st.hands[q].length, q === st.turn);
      el.classList.remove('last');
      el.classList.toggle('gf-target', targets.indexOf(q) >= 0);
      el.classList.toggle('gf-out', !st.hands[q].length);
      var b = st.books[q], html = '';
      b.slice(0, 4).forEach(function (r) { html += chip(r, 'gf-chip--sm'); });
      if (b.length > 4) html += '<span class="gf-more">+' + (b.length - 4) + '</span>';
      el.querySelector('.gf-books').innerHTML = html;
    }
  }

  var POND_SPOTS = [[18, 30, -14], [44, 18, 8], [64, 36, 22], [30, 52, 4], [54, 54, -10], [74, 20, -24]];
  function renderPond() {
    var n = st.pond.length, box = $('pond-cards');
    box.innerHTML = '';
    for (var i = 0; i < Math.min(n, POND_SPOTS.length); i++) {
      var c = Cards.el(null, false), s = POND_SPOTS[i];
      c.style.left = s[0] + '%'; c.style.top = s[1] + '%';
      c.style.transform = 'rotate(' + s[2] + 'deg)';
      box.appendChild(c);
    }
    pondEl.classList.toggle('empty', !n);
    pondEl.classList.toggle('can-fish', phase === 'fish');
    $('pond-n').textContent = n;
  }
  function pondCard() { var b = $('pond-cards'); return b.lastChild || pondEl; }

  function renderShelf() {
    var b = st.books[0];
    shelfEl.innerHTML = '';
    if (!b.length) { shelfEl.innerHTML = '<div class="shelf-empty" aria-hidden="true"><span></span><span></span><span></span></div>'; }
    b.forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'gf-book';
      el.setAttribute('data-r', r);
      el.innerHTML = chip(r, 'gf-chip--book');
      shelfEl.appendChild(el);
    });
    $('sets').textContent = b.length;
  }
  function bookEl(r) { return shelfEl.querySelector('[data-r="' + r + '"]'); }

  function renderHand() {
    var hand = st.hands[0];
    handEl.innerHTML = '';
    var mine = st.turn === 0 && (phase === 'pick' || phase === 'target');
    var els = hand.map(function (c, i) {
      var el = Cards.el(c, true);
      el.setAttribute('data-i', i);
      if (selRank && c.r === selRank) el.className += ' sel';
      else if (phase === 'fish') el.className += ' dim';
      handEl.appendChild(el);
      return el;
    });
    handEl.classList.toggle('gf-pick', mine && phase === 'pick');
    Cards.fan(handEl, els, { minStep: els.length ? els[0].offsetWidth * 0.4 : 30 });
  }
  function handCards(r) {
    var out = [];
    st.hands[0].forEach(function (c, i) { if (c.r === r) out.push(handEl.querySelector('[data-i="' + i + '"]')); });
    return out;
  }
  function handCardOf(card) {
    var i = st.hands[0].indexOf(card);
    return i >= 0 ? handEl.querySelector('[data-i="' + i + '"]') : null;
  }

  /* Prompts are pictures: a pointing finger at what to tap next. */
  function hint(kindOf) {
    var h = '', label = '';
    if (kindOf === 'pick') { h = '<span class="gf-point">👇</span><span class="gf-cardicon"></span>'; label = 'Tap a card in your hand'; }
    else if (kindOf === 'target') {
      label = 'Now tap a friend to ask';
      h = chip(selRank) + '<span class="gf-q">?</span><span class="gf-arrow">' + Kit.icon('next') + '</span>' +
        GF.targets(st, 0).map(function (q) { return '<span class="gf-face-i">' + st.players[q].face + '</span>'; }).join('');
    } else if (kindOf === 'fish') { h = '<span class="gf-point">👆</span><span class="gf-face-i">🎣</span>'; label = 'Go fish! Tap the pond'; }
    else if (kindOf === 'wait') {
      var p = st.players[st.turn];
      h = '<span class="gf-face-i gf-thinking">' + p.face + '</span><span class="gf-dots"><i></i><i></i><i></i></span>';
      label = p.name + ' is thinking';
    }
    hintEl.innerHTML = h;
    hintEl.setAttribute('aria-label', label);
    hintEl.className = 'hint' + (kindOf ? ' hint--' + kindOf : '');
  }

  function render() { renderSeats(); renderPond(); renderShelf(); renderHand(); }

  /* ---- moves ---- */
  function dealIn() {
    render();
    var els = handEl.children, hand = st.hands[0];
    for (var i = 0; i < els.length; i++) els[i].style.visibility = 'hidden';
    Array.prototype.forEach.call(els, function (el, i) {
      setTimeout(function () {
        Cards.sfx.deal();
        Cards.fly(pondEl, el, { card: hand[i], flip: true, hide: el, ms: 320 });
      }, i * 90);
    });
    for (var p = 1; p < st.players.length; p++) {
      (function (p) { setTimeout(function () { Cards.fly(pondEl, avatarOf(p), { ms: 300 }); }, 200 + p * 120); })(p);
    }
    return Cards.wait(els.length * 90 + 500);
  }

  /* A speech bubble: from a friend's seat, or (for you) over your hand. */
  function say(p, html, ms) {
    if (p === 0) {
      var b = $('my-bubble');
      if (!b) { b = document.createElement('div'); b.id = 'my-bubble'; b.className = 'gf-mybubble'; $('table').appendChild(b); }
      b.innerHTML = html;
      b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      clearTimeout(b._t);
      b._t = setTimeout(function () { b.classList.remove('show'); }, ms || 1300);
    } else {
      Cards.say(seatOf(p), html, ms || 1300, { html: true });
    }
  }

  /* p asks q for picture r. Resolves 'again' (got some) or 'fish'. */
  function ask(p, q, r) {
    var g = gen;
    phase = null; selRank = p === 0 ? r : 0;
    hint(p === 0 ? '' : 'wait');
    render();
    sfx.ask();
    say(p, (p === 0 ? '' : '<span class="gf-bub-face">' + faceOf(q) + '</span>') + chip(r, 'gf-chip--bub') + '<b class="gf-bq">?</b>', 1500);
    // when a friend asks you, your matching cards light up so you can see what's going
    if (q === 0) { selRank = r; renderHand(); }
    return Cards.wait(1150).then(function () {
      if (g !== gen) return;
      var from = q === 0 ? handCards(r).map(Cards.rect) : null;
      var got = GF.ask(st, p, q, r);
      if (!got.length) {
        say(q, '<span class="gf-bub-big">🎣</span>', 1500);
        sfx.nope();
        if (p === 0) Kit.anim(pondEl, 'gf-splash');
        selRank = 0;
        render();
        return Cards.wait(750).then(function () { return 'fish'; });
      }
      say(q, '<span class="gf-bub-big">👍</span>' + chip(r, 'gf-chip--bub') + (got.length > 1 ? '<b class="gf-bx">×' + got.length + '</b>' : ''), 1400);
      sfx.yes();
      selRank = p === 0 ? r : 0;
      render();
      var flights = got.map(function (c, i) {
        return Cards.wait(i * 140).then(function () {
          if (g !== gen) return;
          sfx.give(i);
          var src = from ? from[i] : avatarOf(q);
          if (p === 0) { var el = handCardOf(c); return Cards.fly(src, el, { card: c, faceUp: true, hide: el, ms: 420 }); }
          return Cards.fly(src, avatarOf(p), { card: c, faceUp: true, ms: 420 });
        });
      });
      return Promise.all(flights).then(function () { return books(p); }).then(function () { return 'again'; });
    });
  }

  /* p fishes one card from the pond. If it's the picture they asked for
     (r), it's a lucky catch: 'again'. Otherwise 'pass'. */
  function fish(p, r) {
    var g = gen;
    var src = Cards.rect(pondCard());
    var c = GF.fish(st, p);
    phase = null;
    if (!c) return Promise.resolve('pass');
    selRank = 0;
    hint(p === 0 ? '' : 'wait');
    render();
    sfx.catch();
    var fly = p === 0
      ? Cards.fly(src, handCardOf(c), { card: c, flip: true, hide: handCardOf(c), ms: 480 })
      : Cards.fly(src, avatarOf(p), { ms: 420 });
    return fly.then(function () {
      if (g !== gen) return;
      if (r && c.r === r) {
        sfx.lucky();
        if (p === 0) { var el = handCardOf(c); if (el) Kit.anim(el, 'gf-lucky'); }
        say(p, '<span class="gf-bub-big">🍀</span>' + chip(r, 'gf-chip--bub'), 1500);
        if (p === 0) Cards.banner('<span class="gf-ban">🍀</span>' + chip(r, 'gf-chip--ban'), 'gf-banner', 1100, { html: true });
        return Cards.wait(900).then(function () { return books(p); }).then(function () { return 'again'; });
      }
      return Cards.wait(250).then(function () { return books(p); }).then(function () { return 'pass'; });
    });
  }

  /* Lay down any sets of four p holds, flying them to the shelf (you) or
     the friend's seat. */
  function books(p) {
    var g = gen;
    var ranks = GF.ranks(st.hands[p]).filter(function (r) { return GF.count(st.hands[p], r) === 4; });
    if (!ranks.length) return Promise.resolve();
    var src = {};
    ranks.forEach(function (r) { src[r] = p === 0 ? handCards(r).map(Cards.rect) : null; });
    var cards = {};
    ranks.forEach(function (r) { cards[r] = st.hands[p].filter(function (c) { return c.r === r; }); });
    if (p === 0) { selRank = ranks[0]; renderHand(); }
    return Cards.wait(p === 0 ? 450 : 200).then(function () {
      if (g !== gen) return;
      GF.takeBooks(st, p);
      selRank = 0;
      render();
      var all = [];
      ranks.forEach(function (r, k) {
        var dest = p === 0 ? bookEl(r) : seatOf(p).querySelector('.gf-books');
        if (dest && p === 0) dest.style.visibility = 'hidden';
        cards[r].forEach(function (c, i) {
          all.push(Cards.wait(k * 500 + i * 90).then(function () {
            if (g !== gen) return;
            return Cards.fly(src[r] ? src[r][i] : avatarOf(p), dest, { card: c, faceUp: true, ms: 520 });
          }));
        });
        all.push(Cards.wait(k * 500 + 600).then(function () {
          if (g !== gen) return;
          if (dest) { dest.style.visibility = ''; Kit.anim(dest, 'gf-pop'); }
          sfx.book();
          if (p === 0) {
            var rr = dest && dest.getBoundingClientRect();
            if (rr) Kit.confetti({ x: rr.left + rr.width / 2, y: rr.top + rr.height / 2, count: 40, colors: [pic(r).edge, pic(r).tint, '#ffd23f', '#fffdf7'] });
            Kit.anim($('sets-chip'), 'k-bump');
            Kit.floatText('+1', rr ? rr.left + rr.width / 2 : innerWidth / 2, rr ? rr.top : innerHeight / 2);
          } else {
            say(p, chip(r, 'gf-chip--bub') + '<b class="gf-bx">×4</b><span class="gf-bub-big">⭐</span>', 1400);
          }
        }));
      });
      return Promise.all(all).then(function () { return Cards.wait(300); });
    });
  }

  /* ---- turns ---- */
  function nextTurn() {
    var g = gen;
    if (GF.over(st)) return finish();
    phase = null; selRank = 0;
    persist();
    var p = st.turn;
    if (!st.hands[p].length) {
      // out of cards: take one from the pond, then carry on
      if (!st.pond.length) return pass();
      hint(p === 0 ? '' : 'wait');
      render();
      return Cards.wait(500).then(function () { return fish(p, 0); }).then(function () { if (g === gen) turnBody(); });
    }
    turnBody();
  }

  function turnBody() {
    var g = gen, p = st.turn;
    if (GF.over(st)) return finish();
    if (!st.hands[p].length) return nextTurn();
    if (st.players[p].bot) {
      hint('wait');
      render();
      Cards.wait(700).then(function () { if (g === gen) botTurn(); });
    } else {
      startHuman();
    }
  }

  function startHuman() {
    if (!GF.targets(st, 0).length) {    // nobody left to ask: just fish
      if (!st.pond.length) return pass();
      phase = 'fish'; askedRank = 0;
      hint('fish'); render(); persist();
      return;
    }
    phase = 'pick'; selRank = 0;
    hint('pick');
    render();
    sfx.turn();
    idle();
  }
  // If nothing happens for a while, wiggle what to tap.
  function idle() {
    clearTimeout(idleT);
    var g = gen;
    idleT = setTimeout(function () {
      if (g !== gen || st.turn !== 0 || Kit.overlayOpen()) return;
      if (phase === 'pick') Kit.anim(handEl, 'gf-nudge');
      else if (phase === 'target') Array.prototype.forEach.call(seatsEl.querySelectorAll('.gf-target'), function (s) { Kit.anim(s, 'gf-nudge'); });
      else if (phase === 'fish') Kit.anim(pondEl, 'gf-nudge');
      if (phase) idle();
    }, 5000);
  }

  function after(p, res, r) {
    var g = gen;
    if (g !== gen) return;
    if (GF.over(st)) return finish();
    if (res === 'again') {
      if (p === 0 && st.hands[0].length) { persist(); return startHuman(); }
      return Cards.wait(500).then(function () { if (g === gen) { persist(); nextTurnSame(); } });
    }
    if (res === 'fish') {
      if (p === 0) {
        if (!st.pond.length) return pass();
        phase = 'fish'; askedRank = r;
        hint('fish'); render(); persist(); idle();
        return;
      }
      return Cards.wait(400).then(function () { return fish(p, r); }).then(function (res2) { if (g === gen) after(p, res2, r); });
    }
    pass();
  }
  // the same player goes again (after a catch); nextTurn refills an empty hand first
  function nextTurnSame() { nextTurn(); }

  function pass() {
    if (GF.nextTurn(st) < 0 || GF.over(st)) return finish();
    nextTurn();
  }

  function botTurn() {
    var g = gen, p = st.turn;
    var mv = GF.botMove(st, p);
    if (!mv) { fish(p, 0).then(function (res) { if (g === gen) after(p, res, 0); }); return; }
    ask(p, mv.target, mv.rank).then(function (res) { if (g === gen) after(p, res, mv.rank); });
  }

  function finish() {
    var g = gen;
    phase = null; selRank = 0;
    clearTimeout(idleT);
    Kit.drop(GF.SAVE_KEY);
    hint('');
    render();
    var win = GF.winners(st), youWin = win.indexOf(0) >= 0, tie = win.length > 1;
    var title, emoji, wins = null;
    if (youWin) {
      wins = GF.addWin();
      title = tie ? 'It’s a tie!' : 'You win!';
      emoji = tie ? '🤝' : '🏆';
      Cards.buzz(60);
    } else {
      title = win.length > 1 ? win.map(function (w) { return st.players[w].name; }).join(' and ') + ' tie!' : st.players[win[0]].name + ' wins!';
      emoji = st.players[win[0]].face;
      win.forEach(function (w) { say(w, '<span class="gf-bub-big">🎉</span>', 1800); });
    }
    var stats = st.players.map(function (pl, p) { return { label: p === 0 ? 'You' : pl.name, value: st.books[p].length, hi: win.indexOf(p) >= 0 }; });
    Cards.wait(1000).then(function () {
      if (g !== gen) return;
      Kit.result({
        emoji: emoji, title: title, stats: stats, wiggle: true,
        text: youWin ? 'You collected the most sets!' : 'Great fishing! Play again?',
        confetti: youWin, sound: youWin ? 'win' : 'good',
        badge: wins === 1 ? 'First win!' : (wins && wins % 10 === 0 ? wins + ' wins!' : ''),
        buttons: [{ label: 'New game', value: 'menu', icon: 'settings' }, { label: 'Play again', value: 'again', primary: true, icon: 'restart' }]
      }).then(function (v) {
        if (g !== gen) return;
        if (v === 'again') newGame(kind);
        else if (v === 'menu') showSetup(false);
      });
    });
  }

  function newGame(k) {
    gen++;
    kind = k;
    clearTimeout(idleT);
    Kit.closeAll();
    $('setup').classList.add('hidden');
    var players = [{ name: 'You', face: '🙋', bot: false }].concat(Cards.pickBots(+k));
    st = GF.deal(players);
    phase = null; selRank = 0;
    buildSeats();
    hint('');
    var g = gen;
    dealIn().then(function () {
      if (g !== gen) return;
      // a lucky deal can hold a set already: lay those down first
      var chain = Promise.resolve();
      for (var p = 0; p < st.players.length; p++) (function (p) { chain = chain.then(function () { if (g === gen) return books(p); }); })(p);
      chain.then(function () { if (g === gen) nextTurn(); });
    });
  }

  /* ---- input ---- */
  handEl.addEventListener('click', function (e) {
    var el = e.target.closest('.card');
    if (!el || st.turn !== 0 || Kit.overlayOpen()) return;
    if (phase === 'fish') { Kit.anim(pondEl, 'gf-nudge'); Kit.sfx.tap(); return; }
    if (phase !== 'pick' && phase !== 'target') return;
    var c = st.hands[0][+el.getAttribute('data-i')];
    var targets = GF.targets(st, 0);
    if (phase === 'target' && c.r === selRank && targets.length === 1) {   // tap it again: ask the only friend
      ask(0, targets[0], selRank).then(function (res) { after(0, res, c.r); });
      return;
    }
    selRank = c.r; phase = 'target';
    sfx.pick(c.r);
    hint('target');
    renderHand(); renderSeats();
    idle();
  });

  seatsEl.addEventListener('click', function (e) {
    var s = e.target.closest('.cd-seat');
    if (!s || st.turn !== 0 || Kit.overlayOpen()) return;
    var q = +s.getAttribute('data-p');
    if (phase === 'pick') { Kit.sfx.tap(); Kit.anim(handEl, 'gf-nudge'); return; }
    if (phase !== 'target') return;
    if (!st.hands[q].length) { Kit.sfx.bad(); Kit.anim(s, 'k-shake'); return; }
    var r = selRank;
    ask(0, q, r).then(function (res) { after(0, res, r); });
  });

  pondEl.addEventListener('click', function () {
    if (!st || st.turn !== 0 || Kit.overlayOpen()) return;
    if (phase === 'pick' || phase === 'target') { Kit.sfx.tap(); Kit.anim(handEl, 'gf-nudge'); return; }
    if (phase !== 'fish') return;
    var r = askedRank, g = gen;
    clearTimeout(idleT);
    fish(0, r).then(function (res) { if (g === gen) after(0, res, r); });
  });

  /* ---- setup ---- */
  var HOWTO = [
    { emoji: '👆', text: 'Tap a <b>card</b> in your hand.' },
    { emoji: '🦊', text: 'Then tap a <b>friend</b> to ask for that picture.' },
    { emoji: '👍', text: 'If they have it, they give it to you. <b>Go again!</b>' },
    { emoji: '🎣', text: 'If not, <b>go fish</b>: tap the pond.' },
    { emoji: '⭐', text: '<b>Four the same</b> make a set. Most sets wins!' }
  ];
  function showSetup(canCancel) {
    $('setup-cancel').classList.toggle('hidden', !canCancel);
    $('setup').classList.remove('hidden');
    Kit.sfx.open();
  }
  var starts = document.querySelectorAll('[data-players]');
  for (var i = 0; i < starts.length; i++) {
    starts[i].addEventListener('click', function (e) { Kit.sfx.tap(); newGame(e.currentTarget.getAttribute('data-players')); });
  }
  $('menu-btn').addEventListener('click', function () { showSetup(!!st && !GF.over(st)); });
  $('setup-cancel').addEventListener('click', function () { Kit.sfx.close(); $('setup').classList.add('hidden'); });
  $('setup').addEventListener('click', function (e) {
    if (e.target === $('setup') && !$('setup-cancel').classList.contains('hidden')) $('setup').classList.add('hidden');
  });
  $('help-btn').addEventListener('click', function () { Kit.howTo('gofish', HOWTO, { force: true, title: 'Go Fish' }); });
  (function () {   // three pictures fanned on the setup card
    var art = document.querySelector('.setup-art');
    [{ s: 'H', r: 2 }, { s: 'S', r: 1 }, { s: 'D', r: 3 }].forEach(function (c) { art.appendChild(Cards.el(c, true)); });
  })();

  Cards.bindMute($('mute-btn'));
  window.addEventListener('resize', function () { if (st) renderHand(); });

  var saved = Kit.load(GF.SAVE_KEY, null);
  if (saved && GF.valid(saved.st) && !GF.over(saved.st)) {
    st = saved.st; kind = ['1', '2', '3'].indexOf(saved.kind) >= 0 ? saved.kind : String(st.players.length - 1);
    buildSeats();
    if (st.turn === 0 && saved.fish >= 0 && st.pond.length) {
      phase = 'fish'; askedRank = saved.fish;
      hint('fish'); render(); idle();
    } else nextTurn();
  } else {
    showSetup(false);
    Kit.howTo('gofish', HOWTO, { title: 'Go Fish' });
  }
})();
