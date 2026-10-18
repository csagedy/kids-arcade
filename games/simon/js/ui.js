(function () {
  var pads = Array.prototype.slice.call(document.querySelectorAll('.pad'));
  var game = new SimonGame();
  var state = 'idle';      // idle | showing | input | over
  var audio = null;
  var TONES = [329.63, 261.63, 220.0, 164.81];   // E4 C4 A3 E3, the classic-ish set

  /* Tones are synthesised so there are no audio files to cache. The context
     has to be created inside a tap handler or iOS keeps it muted. */
  function ensureAudio() {
    if (audio) { if (audio.state !== 'running') unlock(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
    unlock();
  }
  /* iOS starts the context suspended: resume it and play a silent blip
     while still inside the tap, so later (timer-driven) tones are audible. */
  function unlock() {
    if (!audio) return;
    try {
      if (audio.state !== 'running') audio.resume();
      var b = audio.createBuffer(1, 1, 22050), s = audio.createBufferSource();
      s.buffer = b; s.connect(audio.destination); s.start(0);
    } catch (e) {}
  }
  function tone(i, ms) {
    if (!audio || muted()) return;
    try {
      if (audio.state === 'suspended') audio.resume();
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle'; o.frequency.value = TONES[i];
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + ms / 1000 + 0.02);
    } catch (e) {}
  }
  /* A soft, falling "boop-boop" rather than a harsh buzz. */
  function buzz() {
    if (!audio || muted()) return;
    try {
      var t = audio.currentTime;
      [[300, 0], [220, 0.16]].forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t + n[1]);
        g.gain.exponentialRampToValueAtTime(0.3, t + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.3);
        o.connect(g); g.connect(audio.destination);
        o.start(t + n[1]); o.stop(t + n[1] + 0.32);
      });
    } catch (e) {}
  }
  /* Little rising arpeggio when a round is cleared. */
  function chime() {
    if (!audio || muted()) return;
    try {
      var t = audio.currentTime;
      [523.25, 659.25, 783.99].forEach(function (f, k) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + k * 0.08);
        g.gain.exponentialRampToValueAtTime(0.18, t + k * 0.08 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.08 + 0.2);
        o.connect(g); g.connect(audio.destination);
        o.start(t + k * 0.08); o.stop(t + k * 0.08 + 0.22);
      });
    } catch (e) {}
  }

  function muted() { try { return localStorage.getItem('simon.mute') === '1'; } catch (e) { return false; } }
  function setMuted(m) {
    try { localStorage.setItem('simon.mute', m ? '1' : '0'); } catch (e) {}
    document.getElementById('mute-btn').textContent = m ? '🔇' : '🔊';
  }

  function light(i, ms) {
    pads[i].classList.add('lit');
    tone(i, ms);
    setTimeout(function () { pads[i].classList.remove('lit'); }, ms);
  }

  function setStatus(text) { document.getElementById('status').textContent = text; }
  function renderLives() {
    var h = '';
    for (var i = 0; i < SimonGame.LIVES; i++) h += '<span' + (i >= game.lives ? ' class="gone"' : '') + '>❤️</span>';
    document.getElementById('lives').innerHTML = h;
  }
  function renderScore() {
    renderLives();
    document.getElementById('round').textContent = game.round();
    document.getElementById('best').textContent = game.best;
  }

  /* Playback speeds up a little as the sequence grows, like the original. */
  function showSequence() {
    state = 'showing';
    document.body.classList.add('showing');
    setStatus('Watch…');
    var n = game.round();
    var on = Math.max(200, 560 - n * 20), gap = Math.max(100, 280 - n * 9);
    game.seq.forEach(function (pad, k) {
      setTimeout(function () { light(pad, on); }, 400 + k * (on + gap));
    });
    setTimeout(function () {
      state = 'input';
      document.body.classList.remove('showing');
      setStatus('Your turn');
    }, 400 + n * (on + gap));
  }

  function nextRound() {
    game.next();
    renderScore();
    showSequence();
  }

  function startGame() {
    ensureAudio();
    game = new SimonGame();
    document.getElementById('over').classList.add('hidden');
    document.getElementById('start').classList.add('hidden');
    nextRound();
  }

  function press(i) {
    if (state !== 'input') return;
    ensureAudio();
    var r = game.press(i);
    if (r === 'wrong') {
      var want = game.expected();
      var again = game.oops();
      state = again ? 'showing' : 'over';
      buzz();
      renderLives();
      pads[i].classList.add('wrong');
      setStatus(again ? 'Oops! Watch again…' : '');
      setTimeout(function () { pads[i].classList.remove('wrong'); light(want, 500); }, 350);
      // Same sequence again: nobody loses their place over one slip.
      if (again) setTimeout(showSequence, 1500); else setTimeout(gameOver, 1100);
      return;
    }
    light(i, 240);
    if (r === 'round') {
      state = 'showing';
      setStatus('Yes! ⭐');
      chime();
      setTimeout(nextRound, 700);
    }
  }

  function gameOver() {
    var rounds = game.round() - 1;
    document.getElementById('over-n').textContent = rounds;
    document.getElementById('over-best').textContent = game.best;
    document.getElementById('over').classList.remove('hidden');
    setStatus('');
  }

  pads.forEach(function (p, i) {
    p.addEventListener('pointerdown', function (e) { e.preventDefault(); press(i); });
  });
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('over-again').addEventListener('click', startGame);
  document.getElementById('mute-btn').addEventListener('click', function () {
    ensureAudio();
    setMuted(!muted());
    if (!muted()) tone(0, 200);
  });

  setMuted(muted());
  renderScore();
  window.__simon = { game: function () { return game; }, press: press, start: startGame, state: function () { return state; } };
})();
