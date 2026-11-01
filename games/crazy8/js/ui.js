/* Crazy Eights screen: the table, your hand, computer turns and pass-and-play.
   Every move updates the state first, re-renders, then flies the card into
   place; the state is saved at the start of each turn. */
(function () {
  function $(id) { return document.getElementById(id); }
  var seatsEl = $('seats'), deckEl = $('deck'), discardEl = $('discard'), handEl = $('hand');
  var statusEl = $('status'), hintEl = $('hint'), passBtn = $('pass-btn');

  var st = null;          // game state (see game.js)
  var mode = 'solo';      // 'solo' (you against the computer) or 'pass' (two kids, one phone)
  var kind = '1';         // the setup button that started this game, for "Play again"
  var viewer = 0;         // whose hand is face up at the bottom
  var covered = false;    // pass-and-play: hand hidden while the phone changes hands
  var ready = false;      // the viewer may tap now
  var gen = 0;            // bumped on every new game so stale animations stop
  var seatsFor = -1;      // which viewer the seat row was built for
  var opts = Cards.load(C8.OPTS_KEY, null);
  if (!opts || typeof opts !== 'object') opts = { party: false, clever: false };
  var KINDS = ['1', '2', '3', 'pass'];

  var SUIT_CHOICES = Cards.SUITS.map(function (s) { return { label: Cards.SUIT_CHAR[s], value: s, cls: 's-' + s }; });

  function persist() { Cards.save(C8.SAVE_KEY, { st: st, mode: mode, kind: kind, viewer: viewer }); }
  function myTurn() { return ready && st.turn === viewer && !covered; }

  /* ---- drawing the table ---- */

  function seatOf(p) { return seatsEl.querySelector('[data-p="' + p + '"]'); }
  function avatarOf(p) { var s = seatOf(p); return s && s.querySelector('.cd-avatar'); }

  function renderSeats() {
    var n = st.players.length;
    if (seatsFor !== viewer) {
      seatsEl.innerHTML = '';
      for (var k = 1; k < n; k++) {   // everyone but the viewer, in seating order
        var p = (viewer + k) % n;
        seatsEl.appendChild(Cards.seat(st.players[p], p));
      }
      seatsFor = viewer;
    }
    for (var i = 0; i < seatsEl.children.length; i++) {
      var el = seatsEl.children[i], q = +el.getAttribute('data-p');
      Cards.updateSeat(el, st.hands[q].length, q === st.turn);
    }
  }

  function renderDeck() {
    var n = st.deck.length;
    deckEl.innerHTML = '';
    deckEl.classList.toggle('empty', !n);
    for (var i = 0; i < Math.min(3, n); i++) deckEl.appendChild(Cards.el(null, false));
    $('deck-label').textContent = n ? n + ' left' : '';
    deckEl.classList.toggle('can-draw', myTurn() && !st.drew && !C8.playable(st, viewer).length);
  }

  // a fixed little tilt per card, so the pile looks tossed but doesn't jump around
  function tilt(c) { return ((c.r * 7 + Cards.SUITS.indexOf(c.s) * 5) % 13) - 6; }

  function renderDiscard() {
    discardEl.innerHTML = '';
    st.pile.slice(-3).forEach(function (c) {
      var el = Cards.el(c, true);
      el.style.transform = 'rotate(' + tilt(c) + 'deg)';
      discardEl.appendChild(el);
    });
    var b = $('suit-badge');
    if (C8.top(st).r === 8) {
      b.className = 'suit-badge show s-' + st.suit;
      b.innerHTML = Cards.pip(st.suit) + '<span>' + Cards.SUIT_NAME[st.suit] + '</span>';
    } else {
      b.className = 'suit-badge';
    }
  }
  function topEl() { return discardEl.lastChild; }

  function renderHand() {
    var hand = st.hands[viewer], mine = myTurn();
    var ok = mine ? C8.playable(st, viewer) : [];
    handEl.innerHTML = '';
    var els = hand.map(function (c, i) {
      var el = Cards.el(c, !covered);
      el.setAttribute('data-i', i);
      if (mine) el.className += ok.indexOf(i) >= 0 ? ' playable' : ' dim';
      handEl.appendChild(el);
      return el;
    });
    Cards.fan(handEl, els);
  }
  function handCard(i) { return handEl.querySelector('[data-i="' + i + '"]'); }

  function renderStatus() {
    var p = st.players[st.turn];
    statusEl.textContent = st.turn === viewer && !covered ? 'Your turn' : p.name + '’s turn';
    $('dir').className = 'dir' + (st.dir < 0 ? ' ccw' : '');
    $('wins-chip').style.display = mode === 'solo' ? '' : 'none';   // wins count only against the computer
    passBtn.classList.toggle('hidden', !(myTurn() && st.drew));
  }

  function render() { renderSeats(); renderDeck(); renderDiscard(); renderHand(); renderStatus(); }

  // hint text is plain words; a {S} {H} {C} {D} becomes a suit picture
  function hint(text, loud) {
    hintEl.innerHTML = Kit.esc(text || '').replace(/\{([SHCD])\}/g, function (m, k) { return Cards.pip(k); });
    hintEl.className = 'hint' + (loud ? ' loud' : '');
  }
  function matchHint() {
    var top = C8.top(st), s = '{' + st.suit + '}';
    return top.r === 8 ? 'Match ' + s + ' or play an 8' : 'Match ' + s + ' or ' + Cards.RANK[top.r] + ' – eights are wild';
  }

  /* ---- moves ---- */

  /* Deal-in: the viewer's cards fly from the deck one after another. */
  function dealIn() {
    render();
    var els = handEl.children, hand = st.hands[viewer];
    for (var i = 0; i < els.length; i++) els[i].style.visibility = 'hidden';
    Array.prototype.forEach.call(els, function (el, i) {
      setTimeout(function () {
        Cards.sfx.deal();
        Cards.fly(deckEl, el, { card: hand[i], flip: true, hide: el, ms: 300 });
      }, i * 90);
    });
    return Cards.wait(els.length * 90 + 450);
  }

  /* Player p takes n cards from the deck, one at a time. Resolves with the cards. */
  function drawCards(p, n) {
    var got = [], g = gen;
    function one(k) {
      if (k >= n || g !== gen) return Promise.resolve(got);
      var r = C8.drawOne(st, p);
      if (!r) return Promise.resolve(got);
      got.push(r.card);
      var first = r.shuffled ? (Cards.sfx.shuffle(), Cards.banner('Shuffling…')) : Promise.resolve();
      return first.then(function () {
        if (g !== gen) return;
        render();
        Cards.sfx.draw();
        if (p === viewer && !covered) {
          var el = handCard(st.hands[p].indexOf(r.card));
          return Cards.fly(deckEl, el, { card: r.card, flip: true, hide: el, ms: 320 });
        }
        return Cards.fly(deckEl, avatarOf(p), { ms: 320 });
      }).then(function () { return one(k + 1); });
    }
    return one(0);
  }

  /* Player p plays card i (choosing `suit` for an eight). `from` is where the
     card starts, measured before anything re-renders. */
  function playCard(p, i, suit, from) {
    var g = gen, c = st.hands[p][i], faceUp = p === viewer && !covered;
    from = Cards.rect(from || (faceUp ? handCard(i) : avatarOf(p)));
    var fx = C8.play(st, p, i, suit);
    ready = false;
    hint('');
    render();
    Cards.sfx.play();
    return Cards.fly(from, topEl(), { card: c, faceUp: faceUp, flip: !faceUp, hide: topEl() }).then(function () {
      if (g !== gen) return;
      var bot = st.players[p].bot, left = st.hands[p].length, next = Promise.resolve();
      if (c.r === 8) {
        Cards.sfx.wild();
        if (bot) Cards.say(seatOf(p), 'Crazy eight!');
        next = Cards.banner(Cards.pip(st.suit) + Cards.SUIT_NAME[st.suit] + '!', 's-' + st.suit, 1000, { html: true });
      }
      if (left === 1) {
        if (bot || p !== viewer) Cards.say(seatOf(p), 'Last card!', 1600);
        else hint('Last card! One more and you win.', true);
      }
      return next.then(function () { return left ? applyEffect(p, fx) : null; }).then(function () {
        if (g === gen) endTurn(fx, true);
      });
    });
  }

  function applyEffect(p, fx) {
    if (!fx) return null;
    var victim = C8.next(st, p), you = victim === viewer;
    Cards.sfx.special();
    if (fx === 'skip') {
      Cards.say(seatOf(victim), 'Skipped!');
      return Cards.banner(you ? 'You’re skipped!' : 'Skip!');
    }
    if (fx === 'reverse') { $('dir').className = 'dir' + (st.dir > 0 ? ' ccw' : ''); return Cards.banner('Reverse!'); }
    return Cards.banner(you ? 'You draw 2!' : st.players[victim].name + ' draws 2!').then(function () { return drawCards(victim, 2); });
  }

  function endTurn(fx, played) {
    C8.endTurn(st, fx, played);
    nextTurn();
  }

  /* resumed: in pass-and-play, always ask for the hand-off first */
  function nextTurn(resumed) {
    var g = gen;
    var w = C8.winner(st);
    if (w >= 0) return finish(w, false);
    if (C8.stuck(st)) return finish(C8.fewest(st), true);
    persist();
    ready = false;
    var p = st.players[st.turn];
    if (p.bot) {
      hint('');
      render();
      Cards.wait(800).then(function () { if (g === gen) botTurn(g); });
    } else if (mode === 'pass' && (viewer !== st.turn || resumed)) {
      covered = true;
      hint('');
      render();
      Cards.handoff(p).then(function () {
        if (g !== gen) return;
        covered = false; viewer = st.turn;
        persist();
        startHumanTurn();
      });
    } else {
      startHumanTurn();
    }
  }

  function startHumanTurn() {
    ready = true;
    render();
    Cards.sfx.turn();
    if (st.drew) hint('It matches! Play it, or keep it and pass.', true);
    else if (C8.playable(st, viewer).length) hint(matchHint());
    else hint('No match – tap the deck to draw a card.', true);
  }

  function botTurn(g) {
    var p = st.turn, mv = C8.botMove(st, p);
    if (mv) { playCard(p, mv.i, mv.suit); return; }
    drawCards(p, 1).then(function () {
      if (g !== gen) return;
      st.drew = true;
      var again = C8.botMove(st, p);   // only the card just drawn can match now
      if (again) return Cards.wait(450).then(function () { if (g === gen) playCard(p, again.i, again.suit); });
      Cards.say(seatOf(p), 'Pass');
      return Cards.wait(600).then(function () { if (g === gen) endTurn(null, false); });
    });
  }

  function finish(w, stuck) {
    var g = gen;
    ready = false;
    Cards.drop(C8.SAVE_KEY);
    render();
    var p = st.players[w], won = mode === 'solo' && w === 0, title, text = '', stats = null, wins = null;
    if (mode === 'pass') {
      title = p.name + ' wins!';
    } else if (won) {
      title = 'You win!';
      wins = C8.addWin();
      $('wins').textContent = wins;
      Kit.anim($('wins-chip').firstElementChild, 'k-bump');
      Cards.buzz(60);
    } else {
      title = p.name + ' wins!';
      Cards.say(seatOf(w), 'Yay!');
    }
    text = stuck ? 'Nobody could move, so the fewest cards wins.' : (won || mode === 'pass' ? 'All cards gone!' : 'So close! Try again?');
    if (mode === 'solo') stats = [{ label: 'Wins', value: C8.loadWins(), hi: won }];
    statusEl.textContent = won ? 'You win!' : p.name + ' wins';
    hint('');
    Cards.wait(1100).then(function () {
      if (g !== gen) return;
      Kit.result({
        emoji: won ? '🏆' : p.face, title: title, text: text, stats: stats,
        confetti: won || mode === 'pass', sound: won || mode === 'pass' ? 'win' : 'lose', wiggle: true,
        badge: won && wins && (wins === 1 || wins % 10 === 0) ? (wins === 1 ? 'First win!' : wins + ' wins!') : '',
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
    var players;
    if (k === 'pass') {
      mode = 'pass';
      players = [{ name: 'Player 1', face: '🦁', bot: false }, { name: 'Player 2', face: '🐯', bot: false }];
    } else {
      mode = 'solo';
      players = [{ name: 'You', face: '🙂', bot: false }].concat(Cards.pickBots(+k));
    }
    st = C8.deal(players, opts);
    viewer = 0; covered = false; ready = false; seatsFor = -1;
    hint('');
    Kit.closeAll();
    $('setup').classList.add('hidden');
    var g = gen;
    dealIn().then(function () { if (g === gen) nextTurn(); });
  }

  /* ---- input ---- */

  handEl.addEventListener('click', function (e) {
    var el = e.target.closest('.card');
    if (!el || !myTurn()) return;
    var i = +el.getAttribute('data-i'), c = st.hands[viewer][i];
    if (!C8.canPlay(st, c)) {
      Cards.sfx.bad();
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      hint(matchHint(), true);
      return;
    }
    ready = false;
    var from = Cards.rect(el), g = gen;
    var pick = c.r === 8 ? Cards.choose('Crazy eight! Pick a suit', SUIT_CHOICES) : Promise.resolve(null);
    pick.then(function (suit) { if (g === gen) playCard(viewer, i, suit, from); });
  });

  deckEl.addEventListener('click', function () {
    if (!myTurn()) return;
    if (st.drew) { hint('Play the card you drew, or keep it and pass.', true); return; }
    var ok = C8.playable(st, viewer);
    if (ok.length) {
      Cards.sfx.bad();
      hint('You have a match! Play a glowing card.', true);
      ok.forEach(function (i) {
        var el = handCard(i);
        el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
      });
      return;
    }
    ready = false;
    var g = gen;
    drawCards(viewer, 1).then(function (got) {
      if (g !== gen) return;
      st.drew = true;
      var c = got[0];
      if (c && C8.canPlay(st, c)) {
        persist();
        startHumanTurn();
      } else {
        render();
        hint(c ? 'No match this time.' : 'Nothing left to draw.');
        Cards.wait(800).then(function () { if (g === gen) endTurn(null, false); });
      }
    });
  });

  passBtn.addEventListener('click', function () {
    if (!myTurn() || !st.drew) return;
    ready = false;
    endTurn(null, false);
  });

  /* ---- setup ---- */

  function setSeg(id, v) {
    var bs = $(id).children;
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('k-on', bs[i].getAttribute('data-v') === v);
  }
  function showOpts() {
    setSeg('seg-rules', opts.party ? 'party' : 'classic');
    setSeg('seg-bots', opts.clever ? 'clever' : 'easy');
    $('rules-note').textContent = opts.party
      ? '2 = next player draws two · Q = skip · A = turn around'
      : 'Match the suit or the number. Eights are wild!';
  }
  $('seg-rules').addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]');
    if (!b) return;
    var v = b.getAttribute('data-v');
    opts.party = v === 'party'; Cards.save(C8.OPTS_KEY, opts); Cards.sfx.tap(); showOpts();
  });
  $('seg-bots').addEventListener('click', function (e) {
    var v = e.target.closest('[data-v]');
    if (!v) return;
    opts.clever = v.getAttribute('data-v') === 'clever'; Cards.save(C8.OPTS_KEY, opts); Cards.sfx.tap(); showOpts();
  });
  var starts = document.querySelectorAll('[data-players]');
  for (var i = 0; i < starts.length; i++) {
    starts[i].addEventListener('click', function (e) { Kit.sfx.tap(); newGame(e.currentTarget.getAttribute('data-players')); });
  }

  function showSetup(canCancel) {
    showOpts();
    $('setup-cancel').classList.toggle('hidden', !canCancel);
    $('setup').classList.remove('hidden');
    Kit.sfx.open();
  }
  $('menu-btn').addEventListener('click', function () { showSetup(!!st && C8.winner(st) < 0); });
  $('setup-cancel').addEventListener('click', function () { Kit.sfx.close(); $('setup').classList.add('hidden'); });
  $('setup').addEventListener('click', function (e) {   // tap outside the card = keep playing
    if (e.target === $('setup') && !$('setup-cancel').classList.contains('hidden')) $('setup').classList.add('hidden');
  });

  var HOWTO = [
    { emoji: '🃏', text: 'Play a card that matches the <b>colour and shape</b> or the <b>number</b> on top of the pile.' },
    { emoji: '🌈', text: '<b>Eights are wild!</b> Play one any time and pick the next suit.' },
    { emoji: '✨', text: 'Cards you can play <b>glow</b>. No match? Tap the deck to draw.' },
    { emoji: '🏆', text: 'First to get rid of <b>all their cards</b> wins!' }
  ];
  $('help-btn').addEventListener('click', function () {
    Kit.howTo('crazy8', HOWTO, { force: true, title: 'Crazy Eights' });
  });
  (function () {   // three eights fanned on the setup card
    var art = document.querySelector('.setup-art');
    ['H', 'S', 'D'].forEach(function (su) { art.appendChild(Cards.el({ s: su, r: 8 }, true)); });
  })();

  Cards.bindMute($('mute-btn'));
  window.addEventListener('resize', function () { if (st) renderHand(); });

  $('wins').textContent = C8.loadWins();
  var saved = Cards.load(C8.SAVE_KEY, null);
  if (saved && C8.valid(saved.st) && C8.winner(saved.st) < 0) {
    st = saved.st; mode = saved.mode === 'pass' ? 'pass' : 'solo';
    kind = KINDS.indexOf(saved.kind) >= 0 ? saved.kind : (mode === 'pass' ? 'pass' : String(st.players.length - 1));
    viewer = saved.viewer >= 0 && saved.viewer < st.players.length ? saved.viewer : 0;
    nextTurn(true);
  } else {
    showSetup(false);
    Kit.howTo('crazy8', HOWTO, { title: 'Crazy Eights' });
  }
})();
