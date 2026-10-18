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
  // gentle start, ramps 15% a level, capped so it stays fair for little hands
  var sp = Math.min(2.0, 0.9 + (this.level - 1) * 0.15);
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
  this.deathKind = null;   // 'splat' (road), 'splash' (water)
  this.hopT = 0;           // frames since the last hop, for the squash animation
  this.face = 1;           // 1 up, -1 down, 2 right, -2 left
};

FroggerGame.prototype.laneAt = function (row) {
  for (var i = 0; i < this.lanes.length; i++) if (this.lanes[i].row === row) return this.lanes[i];
  return null;
};

/* Hop one cell. Returns 'hop', 'home', 'level', 'blocked' or null. */
FroggerGame.prototype.hop = function (dx, dy) {
  if (this.dead || this.over) return null;
  var f = this.frog;
  this.hopT = 0;
  if (dx) { f.x = Math.max(0, Math.min(W - f.w, f.x + dx * CELL)); this.face = dx * 2; return 'hop'; }
  this.face = dy;
  var row = f.row - dy;   // dy +1 means up
  if (row > this.startRow || row < this.homeRow) return 'blocked';
  f.row = row;
  if (row < this.bestRow) { this.bestRow = row; this.score += 10; }
  if (row === this.homeRow) {
    var bay = Math.floor((f.x + f.w / 2) / (W / 5));
    var bayCenter = bay * (W / 5) + W / 10;
    // bays are 28px wide; anywhere inside one counts. Missing the gap, or an
    // already-filled bay, is a splash.
    if (bay > 4 || this.homes[bay] || Math.abs(f.x + f.w / 2 - bayCenter) > 14) { this.kill('splash'); return 'die'; }
    f.x = bayCenter - f.w / 2;
    this.homes[bay] = true;
    this.score += 50;
    if (this.homes.every(function (h) { return h; })) {
      this.score += 500;
      this.level++;
      if (this.lives < 5) this.lives++;   // a bonus frog for clearing the board
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

FroggerGame.prototype.kill = function (kind) {
  this.dead = 50;
  this.deathKind = kind;
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
  this.hopT++;
  // Forgiving hitboxes: on the road the frog is a small box (and cars a touch
  // shorter) so near misses live; on the water the frog's middle just has to
  // be over a log, with a little slack past each end.
  var road = lane.kind === 'car', cx = f.x + f.w / 2, onThing = false;
  var fx1 = f.x + 3, fx2 = f.x + f.w - 3;
  for (var k = 0; k < lane.items.length; k++) {
    var x1 = lane.items[k], x2 = x1 + lane.len;
    if (road ? (fx2 > x1 + 1 && fx1 < x2 - 1) : (cx > x1 - 3 && cx < x2 + 3)) { onThing = true; break; }
  }
  if (road && onThing) { this.kill('splat'); return 'die'; }
  if (!road) {
    if (!onThing) { this.kill('splash'); return 'die'; }
    // ride the log; the screen edge stops the frog, and once the log slides
    // out from under it, it's a splash
    f.x = Math.max(0, Math.min(W - f.w, f.x + lane.dir * lane.speed * dt));
  }
  return null;
};
