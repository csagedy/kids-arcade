/* Simon screen, on the arcade kit. The hub in the middle is the play
   button, then shows the round number; its yellow ring fills as the kid
   repeats the sequence. Tones go through Kit.sfx so the arcade-wide mute
   switch and iOS audio unlock are shared. */
(function () {
  var pads = Array.prototype.slice.call(document.querySelectorAll('.pad'));
  var boardEl = document.getElementById('board');
  var hub = document.getElementById('hub');
  var statusEl = document.getElementById('status');
  var game = new SimonGame();
  var state = 'idle';      // idle | showing | input | over
  var timers = [];
  var bestAtStart = 0;
  var TONES = [329.63, 261.63, 220.0, 164.81];   // E4 C4 A3 E3, the classic-ish set
  var NAMES = ['green', 'red', 'yellow', 'blue'];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

  function tone(i, ms) {
    var f = TONES[i], d = ms / 1000;
    Kit.sfx.tone(f, d, 'triangle', { vol: 0.26, attack: 0.012 });
    Kit.sfx.tone(f * 2, d * 0.8, 'sine', { vol: 0.04 });
  }
  function light(i, ms) {
    var p = pads[i];
    p.classList.add('lit');
    tone(i, ms);
    clearTimeout(p._off);
    p._off = setTimeout(function () { p.classList.remove('lit'); }, ms);
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }
  function setState(s) {
    state = s;
    boardEl.classList.toggle('input', s === 'input');
    hub.classList.toggle('idle', s === 'idle' || s === 'over');
    hub.classList.toggle('input', s === 'input');
    document.getElementById('hub-label').textContent = s === 'input' ? 'Your turn' : 'Watch';
  }
  function setProgress() {
    var n = game.round();
    hub.style.setProperty('--prog', state === 'input' && n ? game.pos / n : 0);
  }
  function renderLives(lostOne) {
    var h = '';
    for (var i = 0; i < SimonGame.LIVES; i++) {
      var cls = i >= game.lives ? 'gone' : '';
      if (lostOne && i === game.lives) cls += ' lost';
      h += '<span class="' + cls + '">' + Kit.icon('heart') + '</span>';
    }
    document.getElementById('lives').innerHTML = h;
  }
  function renderScore() {
    document.getElementById('round').textContent = game.round();
    document.getElementById('best').textContent = game.best;
    document.getElementById('hub-n').textContent = game.round();
  }

  /* Playback speeds up a little as the sequence grows, like the original. */
  function showSequence() {
    setState('showing');
    setProgress();
    setStatus('Watch…');
    var n = game.round();
    var on = Math.max(220, 560 - n * 20), gap = Math.max(110, 280 - n * 9);
    game.seq.forEach(function (pad, k) {
      later(function () { light(pad, on); }, 500 + k * (on + gap));
    });
    later(function () {
      setState('input');
      setProgress();
      setStatus('Your turn!', 'go-time');
    }, 500 + n * (on + gap) - gap + 60);
  }

  function nextRound() {
    game.next();
    renderScore();
    Kit.anim(hub, 'pop');
    if (game.round() > 1) Kit.anim(document.getElementById('round-chip'), 'k-bump');
    showSequence();
  }

  function startGame() {
    clearTimers();
    Kit.closeAll();
    game = new SimonGame();
    bestAtStart = game.best;
    renderLives();
    soundHint();
    nextRound();
  }

  /* iPhones silence Web Audio when the side switch is on silent, and there
     is no way to detect that. Say so once. */
  function soundHint() {
    if (Kit.muted() || Kit.raw('simon.hint') === '1') return;
    Kit.setRaw('simon.hint', '1');
    Kit.toast('No sound? Check the silent switch', { icon: 'sound', ms: 4000, top: true });
  }

  function press(i) {
    if (state !== 'input' || Kit.overlayOpen()) return;
    var r = game.press(i);
    if (r === 'wrong') {
      var want = game.expected();
      var again = game.oops();
      setState(again ? 'showing' : 'over');
      setProgress();
      Kit.sfx.tone(300, 0.28, 'sine', { vol: 0.2 });
      Kit.sfx.tone(220, 0.3, 'sine', { vol: 0.2, when: 0.16 });
      Kit.buzz([20, 40, 20]);
      renderLives(true);
      pads[i].classList.add('wrong');
      setStatus(again ? 'Oops! Watch again…' : 'Oh no, out of hearts!', 'oops');
      later(function () { pads[i].classList.remove('wrong'); light(want, 600); pads[want].classList.add('hintme'); }, 380);
      later(function () { pads[want].classList.remove('hintme'); }, 1400);
      // Same sequence again: nobody loses their place over one slip.
      later(again ? showSequence : gameOver, again ? 1900 : 1500);
      return;
    }
    light(i, 260);
    Kit.buzz(6);
    setProgress();
    if (r === 'round') {
      setState('showing');
      hub.style.setProperty('--prog', 1);
      var n = game.round();
      setStatus(['Yes!', 'Great!', 'Super!', 'You got it!', 'Wow!'][n % 5], 'yay');
      later(function () {
        Kit.sfx.good();
        Kit.floatText('+1', document.getElementById('round-chip'));
        Kit.anim(boardEl, 'happy');
        if (bestAtStart > 0 && n > bestAtStart) {
          bestAtStart = 0;
          Kit.toast('New best!', { icon: 'star', top: true });
          Kit.anim(document.getElementById('best-chip'), 'k-bump');
          Kit.sfx.star(2);
        }
        if (n % 5 === 0) Kit.confetti({ count: 40 });
      }, 280);
      later(nextRound, 1100);
    }
  }

  function gameOver() {
    setState('over');
    var rounds = game.round() - 1;
    document.getElementById('round').textContent = rounds;   // the round that was lost doesn't count
    var isBest = rounds > 0 && rounds >= game.best && rounds > bestAtStart;
    setStatus('Play again?');
    Kit.result({
      emoji: rounds >= 10 ? '🏆' : rounds >= 5 ? '🌟' : '🎵',
      title: rounds >= 10 ? 'Super memory!' : rounds >= 5 ? 'Great memory!' : 'Good try!',
      text: rounds ? 'You remembered <b>' + rounds + '</b> in a row.' : 'Watch closely and copy the lights. You can do it!',
      stars: rounds >= 10 ? 3 : rounds >= 6 ? 2 : rounds >= 3 ? 1 : 0,
      badge: isBest ? 'New best!' : '',
      stats: [{ label: 'Rounds', value: rounds, hi: true }, { label: 'Best', value: game.best }],
      confetti: isBest, sound: isBest ? 'win' : 'good',
      buttons: [{ label: 'Play again', value: 'again', primary: true }]
    }).then(function (v) { if (v === 'again') startGame(); });
  }

  pads.forEach(function (p, i) {
    p.addEventListener('pointerdown', function (e) { e.preventDefault(); press(i); });
  });
  // keyboard: Q W / A S, or 1-4, match the pad layout
  document.addEventListener('keydown', function (e) {
    var k = { q: 0, w: 1, a: 2, s: 3, '1': 0, '2': 1, '3': 2, '4': 3 }[e.key.toLowerCase()];
    if (k !== undefined) { press(k); e.preventDefault(); }
    else if ((e.key === ' ' || e.key === 'Enter') && (state === 'idle' || state === 'over') && !Kit.overlayOpen()) { startGame(); e.preventDefault(); }
  });
  document.getElementById('start-btn').addEventListener('click', function () { Kit.sfx.tap(); startGame(); });

  var HOWTO = [
    { emoji: '👀', text: 'Watch the pads light up and listen to their notes.' },
    { emoji: '👆', text: 'Tap the same pads in the <b>same order</b>.' },
    { emoji: '➕', text: 'Every round adds one more. How far can you go?' },
    { icon: 'heart', text: 'A slip costs a heart, then you see it again. Three hearts.' }
  ];
  /* Help, or the iPad going to sleep, in the middle of a round would let the
     lights play out unseen. Stop, and show the same sequence again after. */
  function pauseRound() {
    if (state !== 'showing' && state !== 'input') return false;
    clearTimers();
    pads.forEach(function (p) { p.classList.remove('lit', 'wrong', 'hintme'); });
    setState('showing');
    setStatus('Paused');
    return true;
  }
  function resumeRound() {
    if (state !== 'showing' || !game.round()) return;
    if (game.pos >= game.round()) { nextRound(); return; }   // paused right after a finished round
    game.pos = 0;
    showSequence();
  }
  document.getElementById('help-btn').addEventListener('click', function () {
    var paused = pauseRound();
    Kit.howTo('simon', HOWTO, { force: true }).then(function () { if (paused) resumeRound(); });
  });
  var hiddenMidRound = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (pauseRound()) hiddenMidRound = true; }
    else if (hiddenMidRound) { hiddenMidRound = false; if (!Kit.overlayOpen()) resumeRound(); }
  });
  Kit.bindMute(document.getElementById('mute-btn'));

  setState('idle');
  renderScore();
  renderLives();
  Kit.howTo('simon', HOWTO);
  window.__simon = { game: function () { return game; }, press: press, start: startGame, state: function () { return state; } };
})();
