/* Simon rules: the sequence grows by one pad each round; the player repeats
   it. Round N means N pads to remember. Nothing to resume — a round takes
   seconds — but the best round is kept. */

function SimonGame() {
  this.seq = [];
  this.pos = 0;        // how far through the sequence the player is
  this.best = SimonGame.loadBest();
}

SimonGame.loadBest = function () {
  try { return parseInt(localStorage.getItem('simon.best'), 10) || 0; } catch (e) { return 0; }
};

SimonGame.prototype.saveBest = function () {
  try {
    localStorage.setItem('simon.best', String(this.best));
    localStorage.setItem('arcade.stat.simon', 'Best round ' + this.best);
  } catch (e) {}
};

SimonGame.prototype.round = function () { return this.seq.length; };

SimonGame.prototype.next = function () {
  this.seq.push(Math.floor(Math.random() * 4));
  this.pos = 0;
};

/* Returns 'wrong', 'more' (keep going) or 'round' (sequence complete). */
SimonGame.prototype.press = function (pad) {
  if (pad !== this.seq[this.pos]) return 'wrong';
  this.pos++;
  if (this.pos < this.seq.length) return 'more';
  if (this.seq.length > this.best) { this.best = this.seq.length; this.saveBest(); }
  return 'round';
};

SimonGame.prototype.expected = function () { return this.seq[this.pos]; };
