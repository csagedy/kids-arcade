/* Dot-to-dot state: which dot comes next. Progress per picture is saved so
   a kid can leave a half-joined picture and come back to it. */

function DotsGame(def) {
  this.id = def.id;
  this.name = def.name;
  this.color = def.color;
  this.points = def.points;
  this.next = 0;          // index of the dot to tap next
  this.misses = 0;
  this.load();
}

DotsGame.prototype.key = function () { return 'dots.p.' + this.id; };

DotsGame.prototype.save = function () {
  try { localStorage.setItem(this.key(), String(this.next)); } catch (e) {}
};

DotsGame.prototype.load = function () {
  try {
    var n = parseInt(localStorage.getItem(this.key()), 10);
    if (n > 0 && n <= this.points.length) this.next = n;
  } catch (e) {}
};

DotsGame.prototype.reset = function () {
  this.next = 0; this.misses = 0;
  try { localStorage.removeItem(this.key()); } catch (e) {}
};

DotsGame.prototype.isDone = function () { return this.next >= this.points.length; };

/* Tap dot i. 'hit' advances, 'done' closes the shape, 'miss' otherwise. */
DotsGame.prototype.tap = function (i) {
  if (this.isDone()) return 'done';
  if (i !== this.next) { this.misses++; return 'miss'; }
  this.next++;
  this.save();
  return this.isDone() ? 'done' : 'hit';
};

DotsGame.doneSet = function () {
  try { return JSON.parse(localStorage.getItem('dots.done')) || {}; } catch (e) { return {}; }
};

DotsGame.prototype.markDone = function () {
  var set = DotsGame.doneSet();
  set[this.id] = 1;
  try {
    localStorage.setItem('dots.done', JSON.stringify(set));
    localStorage.setItem('arcade.stat.dots', Object.keys(set).length + ' of ' + DOT_PICTURES.length + ' done');
  } catch (e) {}
};
