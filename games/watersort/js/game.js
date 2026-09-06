/* Game state: an array of tubes, each an array of colour indices bottom to top,
   plus an undo stack. Rules live in level.js. */

function Game(level) {
  this.level = level.number;
  this.colors = level.colors;
  this.start = level.state.map(function (t) { return t.slice(); });
  this.reset();
}

Game.prototype.reset = function () {
  this.tubes = this.start.map(function (t) { return t.slice(); });
  this.history = [];
};

Game.prototype.canPour = function (from, to) { return canPour(this.tubes, from, to); };

Game.prototype.pour = function (from, to) {
  if (!this.canPour(from, to)) return 0;
  var n = pourCount(this.tubes, from, to);
  for (var i = 0; i < n; i++) this.tubes[to].push(this.tubes[from].pop());
  this.history.push({ from: from, to: to, n: n });
  return n;
};

Game.prototype.undo = function () {
  var m = this.history.pop();
  if (!m) return null;
  for (var i = 0; i < m.n; i++) this.tubes[m.from].push(this.tubes[m.to].pop());
  return m;
};

Game.prototype.isSolved = function () { return isSolved(this.tubes); };

/* A tube that's full of one colour is finished — worth showing, since it tells
   the player they can stop thinking about it. */
Game.prototype.isDone = function (i) {
  var t = this.tubes[i];
  if (t.length !== CAP) return false;
  for (var j = 1; j < t.length; j++) if (t[j] !== t[0]) return false;
  return true;
};

/* Any legal move left? If not, the player has to undo or restart. */
Game.prototype.hasMoves = function () {
  for (var a = 0; a < this.tubes.length; a++) {
    for (var b = 0; b < this.tubes.length; b++) {
      if (this.canPour(a, b) && !(this.tubes[b].length === 0 && this.isSingleColour(a))) return true;
    }
  }
  return false;
};

Game.prototype.isSingleColour = function (i) {
  var t = this.tubes[i];
  if (!t.length) return false;
  return topRun(t).count === t.length;
};
