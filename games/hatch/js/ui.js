/* Hatch Match — the table: rendering, taps, turns, animations, saving.
   Rules live in game.js (HM), card pictures in art.js (HMArt). */
(function () {
  'use strict';
  var SAVE = 'hatch.save', OPTS = 'hatch.opts', WINS = 'hatch.wins', ID = 'hatch';
  var $ = function (id) { return document.getElementById(id); };
  var table = $('table'), handBox = $('hand'), deckEl = $('deck'), pileEl = $('pile'), seatsBox = $('seats');
  var statusEl = $('status'), doneBtn = $('done-btn'), keepBtn = $('keep-btn'), munchEl = $('munch');
  var COLOR_NAME = ['Red', 'Yellow', 'Green', 'Blue'];
  var PASS_FACES = [{ name: 'Player 1', face: '🦖' }, { name: 'Player 2', face: '🐢' }];

  HMArt.install();

  var st = null;              // game state (HM)
  var opts = Kit.load(OPTS, null);
  if (!opts || typeof opts !== 'object') opts = {};
  opts = { friends: [1, 2, 3].indexOf(opts.friends) >= 0 ? opts.friends : 1, level: opts.level === 'clever' ? 'clever' : 'easy', mode: opts.mode === 'pass' ? 'pass' : 'bots' };
  var wins = Kit.load(WINS, 0) | 0;
  var viewer = 0;             // whose hand is shown at the bottom
  var covered = false;        // pass-and-play: hand hidden until the hand-off is confirmed
  var busy = true;            // input gate while things animate / bots play
  var token = 0;              // bumps on every new game so old async turns stop
  var seatEls = {};           // player index -> seat element
  var handEls = {};           // card id -> element in my hand

  function wait(ms) { return new Promise(function (r) { setTimeout(r, Kit.reduced ? Math.min(ms, 150) : ms); }); }
  function cur() { return st.players[st.turn]; }
  function myTurn() { return st && st.phase !== 'over' && st.turn === viewer && !cur().bot && !covered; }
  var dealing = false;
  function save() { if (st && st.phase !== 'over' && !dealing) Kit.save(SAVE, { st: st, viewer: viewer, mode: opts.mode }); }
  function cwPx() { var c = handBox.querySelector('.hc') || pileEl.querySelector('.hc'); return c ? c.offsetWidth : 80; }

  /* ---------- sounds ---------- */
  var T = Kit.sfx.tone;
  var snd = {
    play: function () { Kit.sfx.place(); },
    draw: function () { T(520, 0.07, 'triangle', { vol: 0.07, to: 340 }); },
    turn: function () { T(784, 0.12, 'sine', { vol: 0.08 }); T(1047, 0.16, 'sine', { vol: 0.08, when: 0.09 }); },
    grow: function (n) { var f = [0, 523, 659, 784, 1047][n] || 880; T(f, 0.16, 'sine', { vol: 0.12, to: f * 1.5 }); T(f * 2, 0.08, 'sine', { vol: 0.04, when: 0.05 }); },
    grown: function () { [784, 988, 1175, 1568].forEach(function (f, i) { T(f, 0.2, 'sine', { vol: 0.09, when: 0.12 + i * 0.07 }); }); },
    munch: function () { T(240, 0.07, 'square', { vol: 0.05, to: 150 }); T(260, 0.07, 'square', { vol: 0.05, to: 160, when: 0.12 }); T(280, 0.09, 'square', { vol: 0.05, to: 170, when: 0.24 }); },
    storm: function () { T(1200, 0.7, 'sawtooth', { vol: 0.025, to: 140 }); T(500, 0.8, 'triangle', { vol: 0.07, to: 160, when: 0.08 }); T(90, 0.4, 'square', { vol: 0.04, to: 50, when: 0.35 }); },
    nap: function () { T(659, 0.3, 'sine', { vol: 0.08 }); T(523, 0.3, 'sine', { vol: 0.08, when: 0.28 }); T(392, 0.5, 'sine', { vol: 0.08, when: 0.56 }); },
    wild: function () { [523, 659, 784, 988, 1175, 1319].forEach(function (f, i) { T(f, 0.16, 'triangle', { vol: 0.07, when: i * 0.05 }); }); },
    shuffle: function () { for (var i = 0; i < 7; i++) T(700 + (i % 2) * 220, 0.04, 'triangle', { vol: 0.04, when: i * 0.045 }); }
  };

  /* ---------- cards ---------- */
  function cardEl(card, up) {
    var el = document.createElement('div');
    el.className = 'hc' + (up ? ' up' : '');
    el.innerHTML = '<div class="hc-in"><div class="hc-face">' + (card ? HMArt.face(card) : '') + '</div><div class="hc-back">' + HMArt.back() + '</div></div>';
    if (card) el.setAttribute('data-id', card.id);
    return el;
  }
  function setFace(el, card) { el.querySelector('.hc-face').innerHTML = HMArt.face(card); }
  function rectOf(x) {
    if (!x) return null;
    var r = x.getBoundingClientRect ? x.getBoundingClientRect() : x;
    return r.width ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  }
  /* A small card-sized rect at a seat's avatar, for cards flying to/from a friend. */
  function seatRect(i) {
    var s = seatEls[i];
    if (!s) return null;
    var a = (s.querySelector('.cd-avatar') || s).getBoundingClientRect(), w = cwPx() * 0.45;
    return { left: a.left + a.width / 2 - w / 2, top: a.top + a.height / 2 - w * 0.7, width: w, height: w * 1.4 };
  }
  function handRect() {
    var r = handBox.getBoundingClientRect(), w = cwPx();
    return { left: r.left + r.width / 2 - w / 2, top: r.top, width: w, height: w * 1.4 };
  }
  function placeOf(pi) { return pi === viewer ? handRect() : seatRect(pi); }

  /* Fly a temporary card from a to b (rects or elements). */
  function fly(card, from, to, o) {
    o = o || {};
    var a = rectOf(from), b = rectOf(to), ms = o.ms || 380;
    if (Kit.reduced || !a || !b) return Promise.resolve();
    var el = cardEl(card, !!o.up);
    el.classList.add('hm-flyer');
    el.style.setProperty('--cw', b.width + 'px');
    el.style.left = b.left + 'px'; el.style.top = b.top + 'px';
    el.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ') rotate(' + (o.rot0 || 0) + 'deg)';
    document.body.appendChild(el);
    el.getBoundingClientRect();
    el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.3,.75,.35,1)';
    el.style.transform = 'rotate(' + (o.rot || 0) + 'deg)';
    if (o.flip) setTimeout(function () { el.classList.toggle('up'); }, ms * 0.2);
    return new Promise(function (done) {
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); done(); }, ms + 20);
    });
  }
  function tilt(card) { return ((card.id * 37) % 15) - 7; }

  /* ---------- rendering ---------- */
  function sortHand(h) {
    var order = { c: 0, munch: 1, nap: 2, storm: 3, wild: 9 };
    h.sort(function (a, b) {
      var ca = a.c < 0 ? 9 : a.c, cb = b.c < 0 ? 9 : b.c;
      return (ca - cb) || (order[a.t] - order[b.t]) || ((a.s || 0) - (b.s || 0)) || (a.id - b.id);
    });
  }

  function buildSeats() {
    seatsBox.innerHTML = '';
    seatEls = {};
    var n = st.players.length;
    for (var k = 1; k < n; k++) {
      var i = (viewer + k) % n, p = st.players[i];
      var el = Cards.seat(p, i);
      seatsBox.appendChild(el);
      seatEls[i] = el;
    }
    renderSeats();
  }
  function renderSeats() {
    Object.keys(seatEls).forEach(function (k) {
      var i = +k, el = seatEls[i], n = st.players[i].hand.length;
      Cards.updateSeat(el, n, st.turn === i && st.phase !== 'over');
    });
  }

  function renderPiles(pop) {
    // deck: up to three backs
    var dn = st.deck.length, want = Math.min(3, dn);
    if (deckEl.children.length !== want) {
      deckEl.innerHTML = '';
      for (var i = 0; i < want; i++) deckEl.appendChild(cardEl(null, false));
    }
    deckEl.classList.toggle('empty', !dn);
    $('deck-n').textContent = dn;
    // pile: the top three, each a little tilted
    var top = st.pile.slice(-3);
    pileEl.innerHTML = '';
    top.forEach(function (c) {
      var el = cardEl(c, true);
      el.style.transform = 'rotate(' + tilt(c) + 'deg)';
      pileEl.appendChild(el);
    });
    pileEl.setAttribute('data-col', st.color);
    pileEl.setAttribute('aria-label', 'Top card: ' + describe(HM.top(st)));
    if (pop && !Kit.reduced) Kit.anim(pileEl, 'pop');
    munchEl.textContent = '+' + st.munch;
    munchEl.classList.toggle('on', st.munch > 0);
  }
  function describe(c) {
    if (c.t === 'c') return COLOR_NAME[c.c] + ' ' + HM.CRITTER[c.c] + ' ' + HM.STAGE[c.s];
    if (c.t === 'wild') return 'Chameleon' + (c.pick >= 0 ? ', ' + COLOR_NAME[c.pick] : '');
    return COLOR_NAME[c.c] + ' ' + { munch: 'Munch +2', storm: 'Storm', nap: 'Nap' }[c.t];
  }

  function renderHand(fresh) {
    var hand = st.players[viewer].hand;
    sortHand(hand);
    var keep = {}, els = [];
    hand.forEach(function (c) {
      var el = handEls[c.id];
      if (!el) {
        el = cardEl(c, !covered);
        el.setAttribute('aria-label', describe(c));
        el.setAttribute('role', 'button');
        handBox.appendChild(el);
        handEls[c.id] = el;
        if (fresh && !Kit.reduced) { el.classList.add('new'); setTimeout(function (e) { e.classList.remove('new'); }.bind(null, el), 450); }
      }
      el.classList.toggle('up', !covered);
      keep[c.id] = 1;
      els.push(el);
    });
    Object.keys(handEls).forEach(function (id) {
      if (!keep[id]) { var e = handEls[id]; if (e.parentNode) e.parentNode.removeChild(e); delete handEls[id]; }
    });
    // keep DOM order = hand order so the fan stacks left to right
    els.forEach(function (e) { handBox.appendChild(e); });
    handBox.classList.toggle('covered', covered);
    layoutHand();
    markPlayable();
  }
  function layoutHand() {
    var els = Array.prototype.slice.call(handBox.children);
    if (!els.length) { handBox.style.height = ''; return; }
    var cw = els[0].offsetWidth;
    Cards.fan(handBox, els, { cw: cw, minStep: cw * 0.34, maxStep: cw * 0.92 });
  }
  function markPlayable() {
    var mine = myTurn() && !busy, hand = st.players[viewer].hand, anyOk = false;
    hand.forEach(function (c) {
      var el = handEls[c.id];
      if (!el) return;
      var ok = mine && HM.canPlay(st, c);
      if (ok) anyOk = true;
      el.classList.toggle('ok', ok && st.phase !== 'chain');
      el.classList.toggle('grow', ok && st.phase === 'chain');
      el.classList.toggle('dim', mine && !ok);
    });
    deckEl.classList.toggle('go', mine && st.phase === 'play' && (!anyOk || st.munch > 0));
    doneBtn.classList.toggle('k-hidden', !(mine && st.phase === 'chain'));
    keepBtn.classList.toggle('k-hidden', !(mine && st.phase === 'drawn'));
  }

  function status(html, cls) {
    statusEl.className = 'hm-status' + (cls ? ' ' + cls : '');
    statusEl.innerHTML = html;
  }
  function face(p) { return '<span class="hm-face">' + Kit.esc(p.face) + '</span>'; }
  function myStatus() {
    var p = cur();
    if (st.phase === 'chain') return status('✨ Grow it!', 'grow');
    if (st.phase === 'drawn') return status('Play it or keep it?', 'me');
    if (st.munch > 0) {
      var has = HM.playable(st).length > 0;
      return status(has ? '😋 +' + st.munch + '! Munch back or tap the deck' : '😋 Munch! Take ' + st.munch, 'bad');
    }
    var two = opts.mode === 'pass';
    status(face(p) + (two ? Kit.esc(p.name) + ', your turn!' : 'Your turn!'), 'me');
  }

  function render(fresh) {
    renderSeats();
    renderPiles(false);
    renderHand(fresh);
    $('wins').textContent = wins;
    $('wins-chip').classList.toggle('k-hidden', opts.mode === 'pass');
    save();
  }

  /* ---------- turn flow ---------- */
  async function startTurn() {
    var tok = token;
    if (!st || st.phase === 'over') return;
    busy = true;
    var p = cur();
    if (opts.mode === 'pass' && !p.bot && (viewer !== st.turn || covered)) {
      // hide the old hand, swap seats, ask for the hand-off
      covered = true;
      viewer = st.turn;
      handBox.innerHTML = ''; handEls = {};
      buildSeats();
      render();
      status('');
      await wait(250);
      if (tok !== token) return;
      await Cards.handoff(p);
      if (tok !== token) return;
      covered = false;
      Kit.sfx.open();
      renderHand(true);
    }
    render();
    if (p.bot) return botTurn(tok);
    busy = false;
    myStatus();
    markPlayable();
    snd.turn();
    if (st.munch > 0 && !HM.playable(st).length) Kit.anim(statusEl, 'k-shake');
  }

  /* Put a card down. Animates from the hand or the friend's seat. -> result */
  async function doPlay(id, color) {
    var pi = st.turn, hand = st.players[pi].hand, card = hand[HM.find(hand, id)];
    var from = pi === viewer && handEls[id] ? rectOf(handEls[id]) : seatRect(pi);
    var res = HM.play(st, id, color);
    if (!res) return null;
    if (pi === viewer && handEls[id]) { handBox.removeChild(handEls[id]); delete handEls[id]; layoutHand(); }
    renderSeats();
    var target = pileEl.getBoundingClientRect();
    if (card.t === 'wild') card.pick = st.color;
    await fly(card, from, target, { up: pi === viewer, flip: pi !== viewer, rot: tilt(card), ms: 360 });
    renderPiles(true);
    snd.play();
    if (res.win) { await finish(); return res; }
    var seat = seatEls[pi];
    if (card.t === 'c' && res.run > 1) {
      snd.grow(res.run);
      if (res.run === 3) {
        snd.grown();
        Cards.banner('Grown up! 🎉', 'hm-b-grow', 1100);
        var r = pileEl.getBoundingClientRect();
        Kit.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 50 });
      } else Kit.floatText('Grow!', pileEl, '#3ddc84');
    }
    if (card.t === 'wild') {
      snd.wild();
      Kit.floatText(COLOR_NAME[st.color] + '!', pileEl, HMArt.PAL[st.color].lite);
      await wait(400);
    }
    if (card.t === 'munch') {
      snd.munch();
      await Cards.banner('😋 +' + st.munch, 'hm-b-munch', 900);
    }
    if (pi !== viewer && seat && card.t !== 'c') Cards.say(seat, { munch: 'Munch!', storm: 'Whoosh!', nap: 'Shh!', wild: '🦎 ' + COLOR_NAME[st.color] + '!' }[card.t], 1300);
    return res;
  }

  /* Draw for the current player (one card, or the whole Munch pile). */
  async function doDraw() {
    var pi = st.turn, before = st.players[pi].hand.length;
    var munched = st.munch;
    var d = HM.drawTurn(st);
    if (d.reshuffled) { snd.shuffle(); renderPiles(); await Cards.banner('Shuffle!', '', 700); }
    var to = placeOf(pi);
    var flights = d.cards.map(function (c, k) {
      return wait(k * 110).then(function () {
        snd.draw();
        return fly(c, deckEl.lastElementChild || deckEl, to, { up: false, flip: pi === viewer, ms: 340 });
      });
    });
    renderPiles();
    await Promise.all(flights);
    if (munched) {
      snd.munch();
      if (seatEls[pi]) Cards.say(seatEls[pi], '😋 +' + munched, 1400);
      else Kit.floatText('+' + munched, handBox, '#ff5d73');
    }
    if (pi === viewer) renderHand(true); else renderSeats();
    if (!d.cards.length && before === st.players[pi].hand.length) Kit.toast('No cards left to draw', { icon: 'shuffle' });
    return d;
  }

  /* After a card or a draw: storm, nap and the next player. */
  async function endTurn(played) {
    var tok = token;
    busy = true;
    markPlayable();
    status('');
    var counts = st.players.map(function (p) { return p.hand.length; });
    // pass-and-play: turn this hand over now, before the phone changes hands
    if (opts.mode === 'pass' && !covered) { covered = true; renderHand(); }
    var res = HM.endTurn(st, played);
    if (res.storm) {
      snd.storm();
      Cards.banner('🌪️ Storm!', 'hm-b-storm', 1100);
      var flights = [];
      st.players.forEach(function (p, i) {
        var nx = HM.next(st, i, 1), from = placeOf(i), to = placeOf(nx);
        if (opts.mode === 'pass' && i === viewer) from = handRect();
        for (var k = 0; k < Math.min(counts[i], 4); k++) {
          flights.push(wait(k * 90).then(fly.bind(null, null, from, to, { ms: 600, rot: 20 })));
        }
      });
      // my old hand blows away
      Object.keys(handEls).forEach(function (id) { handEls[id].style.opacity = '0'; });
      await Promise.all(flights);
      if (tok !== token) return;
      handBox.innerHTML = ''; handEls = {};
      if (opts.mode !== 'pass') renderHand(true);
      renderSeats();
      await wait(350);
    }
    if (res.skipped >= 0) {
      snd.nap();
      var s = seatEls[res.skipped];
      if (s) {
        s.classList.add('nap');
        Cards.say(s, '💤 Zzz…', 1400);
      } else {
        status('💤 Shh… you nap this turn', 'bad');
      }
      await Cards.banner('💤 Nap!', 'hm-b-nap', 1000);
      await wait(500);
      if (s) s.classList.remove('nap');
    }
    if (tok !== token) return;
    save();
    startTurn();
  }

  async function botTurn(tok) {
    busy = true;
    var p = cur();
    status(face(p) + Kit.esc(p.name) + '…');
    markPlayable();
    await wait(opts.level === 'clever' ? 800 : 700);
    for (;;) {
      // friends wait politely while the rules or the menu are open
      while (Kit.overlayOpen() && tok === token) await wait(300);
      if (tok !== token || st.phase === 'over') return;
      var m = HM.botMove(st);
      if (m.stop || (m.draw && st.phase !== 'play')) { return endTurn(st.phase !== 'drawn'); }
      if (m.draw) {
        var d = await doDraw();
        if (tok !== token) return;
        if (!d.canPlay) { await wait(350); return endTurn(false); }
        await wait(450);
        continue;
      }
      var r = await doPlay(m.play, m.color);
      if (tok !== token || !r || r.win) return;
      if (!r.grow) { await wait(250); return endTurn(true); }
      Cards.say(seatEls[st.turn], '✨ Grow!', 900);
      await wait(550);
    }
  }

  /* ---------- my taps ---------- */
  handBox.addEventListener('click', async function (e) {
    var el = e.target.closest('.hc');
    if (!el || !st) return;
    if (!myTurn() || busy) return;
    var id = +el.getAttribute('data-id'), hand = st.players[viewer].hand, card = hand[HM.find(hand, id)];
    if (!card) return;
    if (!HM.canPlay(st, card)) {
      Kit.sfx.bad();
      Kit.anim(el, 'shake');
      if (st.phase === 'chain') Kit.toast('Tap a glowing card, or Done', { icon: 'check' });
      else if (st.phase === 'drawn') Kit.toast('Play the new card, or keep it', { icon: 'check' });
      else if (st.munch > 0) Kit.toast('Only a Munch card can go now', { icon: 'hint' });
      return;
    }
    busy = true;
    markPlayable();
    var color;
    if (card.t === 'wild') {
      color = await pickColor();
      if (color === null || color === undefined) { busy = false; markPlayable(); return; }
    }
    var tok = token;
    var r = await doPlay(id, color);
    if (tok !== token || !r || r.win) return;
    if (r.grow) {
      busy = false;
      myStatus();
      markPlayable();
      save();
      return;
    }
    endTurn(true);
  });

  deckEl.addEventListener('click', async function () {
    if (!myTurn() || busy) return;
    if (st.phase === 'chain' || st.phase === 'drawn') { Kit.sfx.bad(); Kit.anim(st.phase === 'chain' ? doneBtn : keepBtn, 'k-shake'); return; }
    var can = HM.playable(st);
    if (can.length && st.munch === 0) {
      // you have a move: show it instead of drawing
      Kit.sfx.bad();
      can.forEach(function (c) { var el = handEls[c.id]; if (el) Kit.anim(el, 'nudge'); });
      Kit.toast('You can play a glowing card!', { icon: 'hint' });
      return;
    }
    busy = true;
    markPlayable();
    var tok = token;
    var d = await doDraw();
    if (tok !== token) return;
    if (d.canPlay) {
      busy = false;
      myStatus();
      markPlayable();
      save();
      return;
    }
    if (!d.munched) { status('No match — next friend', ''); await wait(700); }
    if (tok !== token) return;
    endTurn(false);
  });

  doneBtn.addEventListener('click', function () {
    if (!myTurn() || busy || st.phase !== 'chain') return;
    Kit.sfx.tap();
    endTurn(true);
  });
  keepBtn.addEventListener('click', function () {
    if (!myTurn() || busy || st.phase !== 'drawn') return;
    Kit.sfx.tap();
    endTurn(false);
  });

  /* Chameleon: pick a colour (big critter cards, no reading needed). */
  function pickColor() {
    var html = '<div class="hm-pick">' + [0, 1, 2, 3].map(function (c) {
      return '<button type="button" data-c="' + c + '" aria-label="' + COLOR_NAME[c] + '">' +
        '<div class="hc up"><div class="hc-in"><div class="hc-face">' + HMArt.face({ t: 'c', c: c, s: 3 }) + '</div></div></div></button>';
    }).join('') + '</div>';
    snd.wild();
    return Kit.sheet({
      title: '🦎 Pick a colour', html: html, dismissValue: null,
      onOpen: function (card, close) {
        card.querySelector('.hm-pick').addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (b) { Kit.sfx.pop(); close(+b.getAttribute('data-c')); }
        });
      }
    });
  }

  /* ---------- game over ---------- */
  async function finish() {
    var tok = token;
    busy = true;
    Kit.drop(SAVE);
    var w = st.winner, p = st.players[w];
    renderSeats();
    markPlayable();
    status(face(p) + Kit.esc(p.bot ? p.name + ' wins!' : opts.mode === 'pass' ? p.name + ' wins!' : 'You win!'), p.bot ? 'bad' : 'me');
    if (seatEls[w]) seatEls[w].classList.add('won');
    var human = opts.mode !== 'pass' && !p.bot;
    if (human) { wins++; Kit.save(WINS, wins); $('wins').textContent = wins; Kit.anim($('wins-chip'), 'k-bump'); }
    if (opts.mode !== 'pass') Kit.stat(ID, 'Wins ' + wins);
    await wait(900);
    if (tok !== token) return;
    var left = st.players.map(function (q, i) { return i === w ? null : { label: q.name === 'You' ? 'You' : q.name, value: q.hand.length + ' left' }; }).filter(Boolean);
    var v = await Kit.result({
      emoji: p.bot || opts.mode === 'pass' ? p.face : '🏆',
      title: p.bot ? p.name + ' wins!' : opts.mode === 'pass' ? p.name + ' wins!' : 'You win!',
      text: p.bot ? 'So close! Want a rematch?' : 'Every card played. Hatch-tastic!',
      stats: left.slice(0, 3),
      confetti: !p.bot,
      sound: p.bot ? 'lose' : 'win',
      wiggle: true,
      buttons: [{ label: 'New game', value: 'setup', icon: 'settings' }, { label: 'Play again', value: 'again', primary: true, icon: 'restart' }]
    });
    if (tok !== token) return;
    if (v === 'setup') openSetup(false); else newGame();
  }

  /* ---------- starting ---------- */
  function players() {
    if (opts.mode === 'pass') return PASS_FACES.map(function (p) { return { name: p.name, face: p.face, bot: false }; });
    return [{ name: 'You', face: '🙂', bot: false }].concat(Cards.pickBots(opts.friends));
  }
  function newGame() {
    token++;
    Kit.closeAll();
    st = HM.newGame(players(), opts.level);
    viewer = 0; covered = false;
    handBox.innerHTML = ''; handEls = {};
    buildSeats();
    dealIn();
  }
  async function dealIn() {
    var tok = token;
    busy = true;
    dealing = true;
    var hands = st.players.map(function (p) { return p.hand; });
    // show an empty table, then deal round the table
    st.players.forEach(function (p) { p.hand = []; });
    var pileTop = st.pile;
    st.pile = [pileTop[0]];
    render();
    pileEl.innerHTML = '';
    status('Dealing…');
    if (opts.mode === 'pass') covered = true;
    for (var r = 0; r < HM.HAND; r++) {
      for (var i = 0; i < st.players.length; i++) {
        if (tok !== token) return;
        st.players[i].hand.push(hands[i][r]);
        Kit.sfx.click();
        fly(null, deckEl, placeOf(i), { ms: 260 });
        await wait(Kit.reduced ? 0 : 55);
      }
    }
    await wait(300);
    if (tok !== token) return;
    st.players.forEach(function (p, i) { p.hand = hands[i]; });
    st.pile = pileTop;
    dealing = false;
    renderSeats();
    renderHand(true);
    await fly(HM.top(st), deckEl, pileEl, { flip: true, ms: 380, rot: tilt(HM.top(st)) });
    renderPiles(true);
    snd.play();
    await wait(250);
    if (tok !== token) return;
    startTurn();
  }

  function resume(saved) {
    token++;
    st = saved.st;
    viewer = saved.viewer || 0;
    opts.mode = saved.mode || (st.players.every(function (p) { return !p.bot; }) ? 'pass' : 'bots');
    covered = opts.mode === 'pass';
    handBox.innerHTML = ''; handEls = {};
    buildSeats();
    render();
    if (opts.mode === 'pass') viewer = -1;   // forces the hand-off for whoever is up
    if (st.phase === 'chain' || st.phase === 'drawn') {
      if (cur().bot) { startTurn(); return; }
      // a human in the middle of a grow run or a drawn card
      (async function () {
        var tok = token;
        if (opts.mode === 'pass') {
          viewer = st.turn; covered = true;
          buildSeats(); render();
          await Cards.handoff(cur());
          if (tok !== token) return;
          covered = false;
          renderHand(true);
        }
        busy = false; myStatus(); markPlayable(); render();
      })();
      return;
    }
    startTurn();
  }

  /* ---------- setup ---------- */
  function openSetup(canCancel) {
    var faces = ['🐻', '🦉', '🐧'];
    var who = [1, 2, 3].map(function (n) {
      return '<button type="button" data-who="' + n + '"><span class="f">' + faces.slice(0, n).join('') + '</span>' + n + (n === 1 ? ' friend' : ' friends') + '</button>';
    }).join('') + '<button type="button" data-who="pass"><span class="f">🦖🐢</span>2 players</button>';
    var html = '<div class="hm-setup">' +
      '<span class="k-label">Who’s playing?</span><div class="hm-who">' + who + '</div>' +
      '<span class="k-label">Computer friends are…</span>' +
      '<div class="k-seg hm-seg"><button type="button" data-lv="easy">🙂 Easy</button><button type="button" data-lv="clever">🧠 Clever</button></div>' +
      '</div>';
    var sel = { who: opts.mode === 'pass' ? 'pass' : String(opts.friends), level: opts.level };
    var buttons = [{ label: 'Play!', value: 'go', primary: true, icon: 'play' }];
    if (canCancel) buttons.unshift({ label: 'Keep playing', value: null });
    Kit.sfx.open();
    return Kit.sheet({
      title: '🥚 Hatch Match', html: html, buttons: buttons, dismissValue: canCancel ? null : 'go',
      onOpen: function (card) {
        function paint() {
          card.querySelectorAll('[data-who]').forEach(function (b) { b.classList.toggle('k-on', b.getAttribute('data-who') === sel.who); });
          card.querySelectorAll('[data-lv]').forEach(function (b) { b.classList.toggle('k-on', b.getAttribute('data-lv') === sel.level); });
          card.querySelector('.hm-seg').classList.toggle('off', sel.who === 'pass');
        }
        card.addEventListener('click', function (e) {
          var b = e.target.closest('[data-who],[data-lv]');
          if (!b) return;
          Kit.sfx.tap();
          if (b.hasAttribute('data-who')) sel.who = b.getAttribute('data-who'); else sel.level = b.getAttribute('data-lv');
          paint();
        });
        paint();
      }
    }).then(function (v) {
      if (v !== 'go') return;
      opts = { friends: sel.who === 'pass' ? opts.friends : +sel.who, level: sel.level, mode: sel.who === 'pass' ? 'pass' : 'bots' };
      Kit.save(OPTS, opts);
      newGame();
    });
  }

  /* ---------- how to play: little cards act it out ---------- */
  function mini(card, cls) {
    return '<div class="hc up ' + (cls || '') + '"><div class="hc-in"><div class="hc-face">' + HMArt.face(card) + '</div></div></div>';
  }
  function howTo(force) {
    var seen = Kit.raw('arcade.howto.' + ID);
    if (seen && !force) return Promise.resolve();
    Kit.setRaw('arcade.howto.' + ID, '1');
    var html = '<div class="hm-how">' +
      '<div class="hm-step"><div class="hm-demo">' + mini({ t: 'c', c: 3, s: 1 }, 'a') + mini({ t: 'c', c: 3, s: 3 }, 'b') + '</div>' +
        '<div class="hm-cap"><b>Same colour</b>blue on blue</div></div>' +
      '<div class="hm-step"><div class="hm-demo">' + mini({ t: 'c', c: 0, s: 1 }, 'a') + mini({ t: 'c', c: 2, s: 1 }, 'b') + '</div>' +
        '<div class="hm-cap"><b>…or same picture</b>egg on egg, baby on baby</div></div>' +
      '<div class="hm-step"><div class="hm-demo grow">' + mini({ t: 'c', c: 1, s: 1 }, 'g1') + mini({ t: 'c', c: 1, s: 2 }, 'g2') + mini({ t: 'c', c: 1, s: 3 }, 'g3') + '</div>' +
        '<div class="hm-cap"><b>Grow! ✨</b>Got the next one? Play it too!</div></div>' +
      '<div class="hm-specials">' +
        '<div class="hm-step"><div class="hm-demo">' + mini({ t: 'munch', c: 0 }) + '</div><div class="hm-cap"><b>Munch</b>next friend takes 2… or munches back!</div></div>' +
        '<div class="hm-step"><div class="hm-demo">' + mini({ t: 'storm', c: 3 }) + '</div><div class="hm-cap"><b>Storm</b>all hands blow to the next friend</div></div>' +
        '<div class="hm-step"><div class="hm-demo">' + mini({ t: 'nap', c: 1 }) + '</div><div class="hm-cap"><b>Nap</b>next friend misses a turn</div></div>' +
        '<div class="hm-step"><div class="hm-demo">' + mini({ t: 'wild', c: -1 }) + '</div><div class="hm-cap"><b>Chameleon</b>goes on anything, pick a colour</div></div>' +
      '</div>' +
      '<div class="k-howto-end">' +
        '<div class="hm-step hm-tapdeck"><div class="hm-demo" style="width:var(--cw)"><div class="hc"><div class="hc-in"><div class="hc-face"></div><div class="hc-back">' + HMArt.back() + '</div></div></div></div><div class="hm-cap"><b>Stuck?</b>tap the deck</div></div>' +
        '<div class="hm-step"><div class="hm-trophy">🏆</div><div class="hm-cap"><b>No cards left?</b>You win!</div></div>' +
      '</div></div>';
    Kit.sfx.open();
    return Kit.sheet({ title: 'How to play', html: html, buttons: [{ label: "Let's play!", value: true, primary: true }], dismissValue: true });
  }

  /* ---------- wiring ---------- */
  Kit.bindMute($('mute-btn'));
  $('help-btn').addEventListener('click', function () { howTo(true); });
  $('new-btn').addEventListener('click', function () { Kit.sfx.tap(); openSetup(!!st && st.phase !== 'over'); });
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (st) layoutHand(); }, 80);
  });
  $('wins').textContent = wins;
  if (wins) Kit.stat(ID, 'Wins ' + wins);

  var saved = Kit.load(SAVE, null);
  if (saved && HM.valid(saved.st)) {
    resume(saved);
  } else {
    Kit.drop(SAVE);
    howTo(false).then(function () { openSetup(false); });
  }

  // for tests
  window.__hatch = { get st() { return st; }, get busy() { return busy; }, get viewer() { return viewer; }, get covered() { return covered; }, endTurn: endTurn, newGame: newGame, startTurn: startTurn, render: render, opts: function () { return opts; }, setOpts: function (o) { opts = o; } };
})();
