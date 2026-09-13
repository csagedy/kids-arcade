(function () {
  var pads = Array.prototype.slice.call(document.querySelectorAll('.pad'));
  var game = new SimonGame();
  var state = 'idle';      // idle | showing | input | over
  var audio = null;
  var TONES = [329.63, 261.63, 220.0, 164.81];   // E4 C4 A3 E3, the classic-ish set

  /* Tones are synthesised so there are no audio files to cache. The context
     has to be created inside a tap handler or iOS keeps it muted. */
  function ensureAudio() {
    if (audio) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
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
  function buzz() {
    if (!audio || muted()) return;
    try {
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sawtooth'; o.frequency.value = 80;
      g.gain.value = 0.25;
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.4);
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
  function renderScore() {
    document.getElementById('round').textContent = game.round();
    document.getElementById('best').textContent = game.best;
  }

  /* Playback speeds up a little as the sequence grows, like the original. */
  function showSequence() {
    state = 'showing';
    document.body.classList.add('showing');
    setStatus('Watch…');
    var n = game.round();
    var on = Math.max(220, 520 - n * 18), gap = Math.max(120, 260 - n * 8);
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
      state = 'over';
      buzz();
      pads[i].classList.add('wrong');
      var want = game.expected();
      setTimeout(function () { pads[i].classList.remove('wrong'); light(want, 500); }, 300);
      setTimeout(gameOver, 1000);
      return;
    }
    light(i, 240);
    if (r === 'round') {
      state = 'showing';
      setStatus('Yes!');
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
  document.getElementById('mute-btn').addEventListener('click', function () { setMuted(!muted()); });

  setMuted(muted());
  renderScore();
  window.__simon = { game: function () { return game; }, press: press, start: startGame, state: function () { return state; } };
})();
