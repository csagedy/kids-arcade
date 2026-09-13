/* Frogger on a 240-wide screen of 16px rows. From the bottom: a start
   strip, five lanes of traffic, a median, five lanes of river with logs and
   turtles, and a home row with five bays. Rows above that are sky. The
   number of rows follows the screen height set by the cabinet. */

var W = 240, H = 320, CELL = 16;

function FroggerGame() {
  this.rows = Math.floor(H / CELL);
  // The playfield is 14 rows; on taller screens sit it a little below centre,
  // leaving sky above the homes and grass under the start strip.
  var spare = Math.max(0, this.rows - 15);
  this.homeRow = 1 + Math.floor(spare * 0.45);
  this.startRow = this.homeRow + 12;
  this.level = 1;
  this.score = 0;
  this.lives = 3;
  this.homes = [false, false, false, false, false];
  this.buildLanes();
  this.resetFrog();
}

/* Lanes are described bottom-up. dir +1 moves right. */
FroggerGame.prototype.buildLanes = function () {
  var sp = 1 + (this.level - 1) * 0.18;
  var s = this.startRow;
  this.lanes = [
    { row: s - 1, kind: 'car', dir: -1, speed: 28 * sp, len: 16, gap: 64, color: '#ffe93b' },
    { row: s - 2, kind: 'car', dir: 1,  speed: 22 * sp, len: 24, gap: 80, color: '#ff9f1c' },
    { row: s - 3, kind: 'car', dir: -1, speed: 40 * sp, len: 16, gap: 72, color: '#c96bff' },
    { row: s - 4, kind: 'car', dir: 1,  speed: 26 * sp, len: 16, gap: 56, color: '#4de8ff' },
    { row: s - 5, kind: 'car', dir: -1, speed: 48 * sp, len: 32, gap: 96, color: '#ff3b3b' },
    // s - 6 is the median
    { row: s - 7,  kind: 'log', dir: 1,  speed: 24 * sp, len: 48, gap: 56, color: '#b3772e' },
    { row: s - 8,  kind: 'turtle', dir: -1, speed: 30 * sp, len: 40, gap: 48, color: '#3fb950' },
    { row: s - 9,  kind: 'log', dir: 1,  speed: 44 * sp, len: 80, gap: 72, color: '#b3772e' },
    { row: s - 10, kind: 'log', dir: 1,  speed: 20 * sp, len: 40, gap: 48, color: '#b3772e' },
    { row: s - 11, kind: 'turtle', dir: -1, speed: 36 * sp, len: 32, gap: 56, color: '#3fb950' }
  ];
  this.lanes.forEach(function (l, i) {
    l.items = [];
    var period = l.len + l.gap;
    for (var x = -period + (i * 37) % period; x < W + period; x += period) l.items.push(x);
  });
};

FroggerGame.prototype.resetFrog = function () {
  this.frog = { x: W / 2 - 6, row: this.startRow, w: 12 };
  this.bestRow = this.startRow;
  this.dead = 0;   // frames of death animation remaining
};

FroggerGame.prototype.laneAt = function (row) {
  for (var i = 0; i < this.lanes.length; i++) if (this.lanes[i].row === row) return this.lanes[i];
  return null;
};

/* Hop one cell. Returns 'hop', 'home', 'level', 'blocked' or null. */
FroggerGame.prototype.hop = function (dx, dy) {
  if (this.dead || this.over) return null;
  var f = this.frog;
  if (dx) { f.x = Math.max(0, Math.min(W - f.w, f.x + dx * CELL)); return 'hop'; }
  var row = f.row - dy;   // dy +1 means up
  if (row > this.startRow || row < this.homeRow) return 'blocked';
  f.row = row;
  if (row < this.bestRow) { this.bestRow = row; this.score += 10; }
  if (row === this.homeRow) {
    var bay = Math.floor((f.x + f.w / 2) / (W / 5));
    var bayCenter = bay * (W / 5) + W / 10;
    if (this.homes[bay] || Math.abs(f.x + f.w / 2 - bayCenter) > 12) { this.kill(); return 'hop'; }
    this.homes[bay] = true;
    this.score += 50;
    if (this.homes.every(function (h) { return h; })) {
      this.score += 500;
      this.level++;
      this.homes = [false, false, false, false, false];
      this.buildLanes();
      this.resetFrog();
      return 'level';
    }
    this.resetFrog();
    return 'home';
  }
  return 'hop';
};

FroggerGame.prototype.kill = function () {
  this.dead = 50;
};

/* Returns 'die', 'over' or null. */
FroggerGame.prototype.update = function (dt) {
  var self = this;
  this.lanes.forEach(function (l) {
    var period = l.len + l.gap;
    for (var i = 0; i < l.items.length; i++) {
      l.items[i] += l.dir * l.speed * dt;
      if (l.dir > 0 && l.items[i] > W + period) l.items[i] -= l.items.length * period;
      if (l.dir < 0 && l.items[i] < -period - l.len) l.items[i] += l.items.length * period;
    }
  });
  if (this.over) return null;
  if (this.dead) {
    this.dead--;
    if (this.dead === 0) {
      this.lives--;
      if (this.lives <= 0) { this.over = true; return 'over'; }
      this.resetFrog();
    }
    return null;
  }
  var f = this.frog, lane = this.laneAt(f.row);
  if (!lane) return null;
  var fx1 = f.x + 2, fx2 = f.x + f.w - 2, onThing = false;
  for (var k = 0; k < lane.items.length; k++) {
    var x1 = lane.items[k], x2 = x1 + lane.len;
    if (fx2 > x1 && fx1 < x2) { onThing = true; break; }
  }
  if (lane.kind === 'car' && onThing) { this.kill(); return 'die'; }
  if (lane.kind !== 'car') {
    if (!onThing) { this.kill(); return 'die'; }
    f.x += lane.dir * lane.speed * dt;   // ride the log
    if (f.x < -f.w || f.x > W) { this.kill(); return 'die'; }
  }
  return null;
};
