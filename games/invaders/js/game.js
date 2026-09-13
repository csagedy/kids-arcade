/* Space Invaders on 240 x H. A block of aliens steps sideways and drops a
   row at each edge, faster as their numbers thin. The ship auto-fires, so
   the only control is sliding. Three shields erode block by block. */

var W = 240, H = 320;

function InvadersGame() {
  this.score = 0;
  this.lives = 3;
  this.level = 1;
  this.ship = { x: W / 2, w: 14 };
  this.shipY = H - 26;
  this.shots = [];       // player bullets
  this.bombs = [];       // alien bullets
  this.fireTimer = 0;
  this.respawn = 0;
  this.over = false;
  this.buildWave();
  this.buildShields();
}

InvadersGame.prototype.buildWave = function () {
  this.aliens = [];
  var cols = 8, rows = 5;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      this.aliens.push({ x: 24 + c * 24, y: 30 + r * 16 + Math.min(this.level - 1, 4) * 8, kind: r < 1 ? 2 : r < 3 ? 1 : 0, alive: true });
    }
  }
  this.dir = 1;
  this.stepTimer = 0;
  this.total = this.aliens.length;
  this.anim = 0;
};

InvadersGame.prototype.buildShields = function () {
  this.shields = [];
  var xs = [40, 120, 200];
  for (var i = 0; i < xs.length; i++) {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 6; c++) {
        if (r >= 2 && c >= 2 && c <= 3) continue;   // arch
        this.shields.push({ x: xs[i] - 12 + c * 4, y: this.shipY - 34 + r * 4 });
      }
    }
  }
};

InvadersGame.prototype.aliveCount = function () {
  var n = 0; for (var i = 0; i < this.aliens.length; i++) if (this.aliens[i].alive) n++; return n;
};

InvadersGame.prototype.moveShip = function (x) {
  this.ship.x = Math.max(this.ship.w / 2, Math.min(W - this.ship.w / 2, x));
};

/* Returns events: 'shoot', 'hit', 'bomb', 'die', 'wave', 'over'. */
InvadersGame.prototype.update = function (dt) {
  var ev = [], self = this;
  if (this.over) return ev;
  this.anim += dt;

  if (this.respawn > 0) { this.respawn -= dt; if (this.respawn > 0) return ev; }

  // auto fire, one bullet on screen at a time
  this.fireTimer -= dt;
  if (this.fireTimer <= 0 && this.shots.length === 0) {
    this.shots.push({ x: this.ship.x, y: this.shipY - 6 });
    this.fireTimer = 0.45;
    ev.push('shoot');
  }

  // alien block stepping: faster as fewer remain
  var alive = this.aliveCount();
  var interval = Math.max(0.06, 0.6 * (alive / this.total)) / (1 + (this.level - 1) * 0.15);
  this.stepTimer += dt;
  if (this.stepTimer >= interval) {
    this.stepTimer = 0;
    var minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.aliens.forEach(function (a) { if (!a.alive) return; minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); maxY = Math.max(maxY, a.y); });
    var edge = (this.dir > 0 && maxX + 12 >= W - 4) || (this.dir < 0 && minX - 12 <= 4);
    if (edge) {
      this.dir = -this.dir;
      this.aliens.forEach(function (a) { a.y += 8; });
      if (maxY + 8 >= this.shipY - 10) { this.lives = 0; this.over = true; ev.push('over'); return ev; }
    } else {
      this.aliens.forEach(function (a) { a.x += self.dir * 6; });
    }
    // a random alien in the bottom of its column drops a bomb now and then
    if (Math.random() < 0.35 + this.level * 0.05) {
      var shooters = this.aliens.filter(function (a) {
        if (!a.alive) return false;
        return !self.aliens.some(function (b) { return b.alive && b !== a && Math.abs(b.x - a.x) < 1 && b.y > a.y; });
      });
      if (shooters.length) {
        var s = shooters[Math.floor(Math.random() * shooters.length)];
        this.bombs.push({ x: s.x, y: s.y + 6 });
        ev.push('bomb');
      }
    }
  }

  // player bullets
  for (var i = this.shots.length - 1; i >= 0; i--) {
    var sh = this.shots[i];
    sh.y -= 260 * dt;
    if (sh.y < 14) { this.shots.splice(i, 1); continue; }
    var hit = false;
    for (var a = 0; a < this.aliens.length; a++) {
      var al = this.aliens[a];
      if (!al.alive) continue;
      if (Math.abs(sh.x - al.x) <= 6 && Math.abs(sh.y - al.y) <= 5) {
        al.alive = false; hit = true;
        this.score += [10, 20, 40][al.kind];
        ev.push('hit');
        break;
      }
    }
    if (!hit) hit = this.hitShield(sh.x, sh.y);
    if (hit) this.shots.splice(i, 1);
  }

  // bombs
  for (var b = this.bombs.length - 1; b >= 0; b--) {
    var bm = this.bombs[b];
    bm.y += (90 + this.level * 10) * dt;
    if (bm.y > H) { this.bombs.splice(b, 1); continue; }
    if (this.hitShield(bm.x, bm.y)) { this.bombs.splice(b, 1); continue; }
    if (Math.abs(bm.x - this.ship.x) <= this.ship.w / 2 && bm.y >= this.shipY - 4 && bm.y <= this.shipY + 6) {
      this.bombs.splice(b, 1);
      this.lives--;
      ev.push(this.lives <= 0 ? 'over' : 'die');
      if (this.lives <= 0) { this.over = true; return ev; }
      this.respawn = 1.2;
      this.bombs = [];
      return ev;
    }
  }

  if (alive === 0) {
    this.level++;
    this.score += 100;
    this.buildWave();
    this.bombs = [];
    ev.push('wave');
  }
  return ev;
};

InvadersGame.prototype.hitShield = function (x, y) {
  for (var i = 0; i < this.shields.length; i++) {
    var s = this.shields[i];
    if (x >= s.x && x < s.x + 4 && y >= s.y && y < s.y + 4) { this.shields.splice(i, 1); return true; }
  }
  return false;
};
