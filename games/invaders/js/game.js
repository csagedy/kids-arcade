/* Space Invaders on a W x H screen (set by the UI for the screen's shape).
   A block of aliens steps sideways and drops a row at each edge, faster as
   their numbers thin. The ship auto-fires, so the only control is sliding.
   Shields are little pixel bunkers that crumble where they are hit.
   Kind to small players: if the aliens reach the ground the ship loses a
   life and the block is pushed back up, rather than an instant game over. */

var W = 240, H = 320;

/* Shield bitmap: 22 x 15, the classic bunker with an arch. */
var SHIELD_ART = [
  '....##############....',
  '...################...',
  '..##################..',
  '.####################.',
  '######################',
  '######################',
  '######################',
  '######################',
  '######################',
  '######################',
  '######################',
  '#######........#######',
  '######..........######',
  '#####............#####',
  '#####............#####'
];
var SHIELD_W = 22, SHIELD_H = 15;

function InvadersGame() {
  this.score = 0;
  this.lives = 3;
  this.level = 1;
  this.ship = { x: W / 2, w: 13 };
  this.shipY = H - 22;
  this.shots = [];       // player bullets
  this.bombs = [];       // alien bullets
  this.fireTimer = 0.4;
  this.respawn = 0;
  this.kills = [];       // aliens just shot, for the UI to explode
  this.chips = [];       // shield hits, for the UI to spray
  this.pause = 0;        // breather between waves
  this.bombTimer = 1.8;
  this.ufo = null;       // { x, dir, pts }
  this.ufoTimer = 14;
  this.over = false;
  this.steps = 0;        // march beat counter, for the UI's four-note bass
  this.buildWave();
  this.buildShields();
}

InvadersGame.prototype.buildWave = function () {
  this.aliens = [];
  var cols = this.cols = Math.max(7, Math.min(11, Math.floor((W - 40) / 22)));
  var rows = this.level < 2 ? 4 : 5;   // a gentler first wave
  var x0 = Math.round(W / 2 - (cols - 1) * 22 / 2);
  var y0 = 26 + Math.min(this.level - 1, 3) * 8;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      this.aliens.push({ x: x0 + c * 22, y: y0 + r * 16, kind: r < 1 ? 2 : r < 3 ? 1 : 0, alive: true });
    }
  }
  this.dir = 1;
  this.stepTimer = 0;
  this.total = this.aliens.length;
  this.anim = 0;
  this.frame = 0;
  this.pause = 1.2;
};

/* n: how many (a kept round keeps its own; a new wave fits the width). */
InvadersGame.prototype.buildShields = function (n) {
  this.shields = [];
  n = n || (W >= 300 ? 4 : 3);
  for (var i = 0; i < n; i++) {
    var cx = Math.round(W * (i + 0.5) / n), px = new Uint8Array(SHIELD_W * SHIELD_H);
    for (var y = 0; y < SHIELD_H; y++) for (var x = 0; x < SHIELD_W; x++) px[y * SHIELD_W + x] = SHIELD_ART[y][x] === '#' ? 1 : 0;
    this.shields.push({ x: cx - SHIELD_W / 2, y: this.shipY - 40, px: px, dirty: true });
  }
};

InvadersGame.prototype.aliveCount = function () {
  var n = 0; for (var i = 0; i < this.aliens.length; i++) if (this.aliens[i].alive) n++; return n;
};

InvadersGame.prototype.moveShip = function (x) {
  this.ship.x = Math.max(this.ship.w / 2 + 1, Math.min(W - this.ship.w / 2 - 1, x));
};

/* Returns events: 'shoot', 'hit', 'step', 'bomb', 'die', 'wave', 'ufo', 'ufohit', 'landed', 'over'. */
InvadersGame.prototype.update = function (dt) {
  var ev = [], self = this;
  if (this.over) return ev;
  this.anim += dt;

  if (this.respawn > 0) { this.respawn -= dt; this.moveShots(dt, ev); if (this.respawn > 0) return ev; }
  if (this.pause > 0) { this.pause -= dt; this.moveShots(dt, ev); return ev; }

  // mystery ship: crosses the top now and then, worth a random bonus
  if (this.ufo) {
    this.ufo.x += this.ufo.dir * 44 * dt;
    if (this.ufo.x < -20 || this.ufo.x > W + 20) this.ufo = null;
  } else {
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0) {
      var d = Math.random() < 0.5 ? 1 : -1;
      this.ufo = { x: d > 0 ? -16 : W + 16, dir: d, pts: [50, 100, 150, 300][Math.floor(Math.random() * 4)] };
      this.ufoTimer = 16 + Math.random() * 10;
      ev.push('ufo');
    }
  }

  // auto fire, up to two bullets on screen so a tall screen doesn't feel sluggish
  this.fireTimer -= dt;
  if (this.fireTimer <= 0 && this.shots.length < 2) {
    this.shots.push({ x: Math.round(this.ship.x), y: this.shipY - 6 });
    this.fireTimer = 0.42;
    ev.push('shoot');
  }

  // alien block stepping: faster as fewer remain
  var alive = this.aliveCount();
  var interval = Math.max(0.07, 0.62 * (alive / this.total)) / Math.min(1.7, 1 + (this.level - 1) * 0.1);
  this.stepTimer += dt;
  if (this.stepTimer >= interval) {
    this.stepTimer = 0;
    this.frame ^= 1; this.steps++;
    ev.push('step');
    var minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.aliens.forEach(function (a) { if (!a.alive) return; minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); maxY = Math.max(maxY, a.y); });
    var edge = (this.dir > 0 && maxX + 8 >= W - 4) || (this.dir < 0 && minX - 8 <= 4);
    if (edge) {
      this.dir = -this.dir;
      this.aliens.forEach(function (a) { a.y += 8; });
      if (maxY + 8 >= this.shipY - 12) {
        // they landed: lose a ship, and the whole block is pushed back up
        this.lives--;
        ev.push('landed');
        if (this.lives <= 0) { this.over = true; ev.push('over'); return ev; }
        this.aliens.forEach(function (a) { a.y -= 56; });
        this.respawn = 1.4; this.bombs = [];
        return ev;
      }
    } else {
      this.aliens.forEach(function (a) { a.x += self.dir * 4; });
    }
    // aliens that wade into the shields chew them up
    this.aliens.forEach(function (a) { if (a.alive) self.erase(a.x, a.y, 7, 5, 1); });
  }

  // Bombs run on their own timer (not the step rate, which gets very fast when
  // few aliens are left) and are capped on screen so there's always a gap.
  this.bombTimer -= dt;
  if (this.bombTimer <= 0) {
    this.bombTimer = Math.max(0.6, 1.6 - this.level * 0.12) * (0.7 + Math.random() * 0.6);
    var maxBombs = Math.min(4, 1 + Math.ceil(this.level / 2));
    if (this.bombs.length < maxBombs) {
      var shooters = this.aliens.filter(function (a) {
        if (!a.alive) return false;
        return !self.aliens.some(function (b) { return b.alive && b !== a && Math.abs(b.x - a.x) < 1 && b.y > a.y; });
      });
      // half the time, the shooter is the one closest above the ship
      if (shooters.length) {
        var s = shooters[Math.floor(Math.random() * shooters.length)];
        if (Math.random() < 0.5) shooters.forEach(function (q) { if (Math.abs(q.x - self.ship.x) < Math.abs(s.x - self.ship.x)) s = q; });
        this.bombs.push({ x: Math.round(s.x), y: s.y + 6, t: 0 });
        ev.push('bomb');
      }
    }
  }

  this.moveShots(dt, ev);
  alive = this.aliveCount();

  // bombs
  for (var b = this.bombs.length - 1; b >= 0; b--) {
    var bm = this.bombs[b];
    bm.y += Math.min(125, 78 + this.level * 7) * dt; bm.t += dt;
    if (bm.y > H) { this.bombs.splice(b, 1); continue; }
    if (this.hitShield(bm.x, bm.y + 5, 1)) { this.bombs.splice(b, 1); continue; }
    if (this.respawn <= 0 && Math.abs(bm.x - this.ship.x) <= this.ship.w / 2 - 1 && bm.y + 5 >= this.shipY - 3 && bm.y <= this.shipY + 5) {
      this.bombs.splice(b, 1);
      this.lives--;
      ev.push(this.lives <= 0 ? 'over' : 'die');
      if (this.lives <= 0) { this.over = true; return ev; }
      this.respawn = 1.4;
      this.bombs = [];
      return ev;
    }
  }

  if (alive === 0) {
    this.level++;
    this.score += 100;
    this.buildWave();
    this.buildShields();   // fresh shields each wave
    this.bombs = [];
    this.shots = [];
    this.ufo = null;
    ev.push('wave');
  }
  return ev;
};

/* Player bullets: fly up, hit aliens, the mystery ship, bombs or shields. */
InvadersGame.prototype.moveShots = function (dt, ev) {
  for (var i = this.shots.length - 1; i >= 0; i--) {
    var sh = this.shots[i];
    sh.y -= 250 * dt;
    if (sh.y < -6) { this.shots.splice(i, 1); continue; }
    var hit = false;
    for (var a = 0; a < this.aliens.length; a++) {
      var al = this.aliens[a];
      if (!al.alive) continue;
      if (Math.abs(sh.x - al.x) <= 6 && sh.y <= al.y + 4 && sh.y + 5 >= al.y - 4) {
        al.alive = false; hit = true;
        var pts = [10, 20, 30][al.kind];
        this.score += pts;
        this.kills.push({ x: al.x, y: al.y, kind: al.kind, pts: pts });
        ev.push('hit');
        break;
      }
    }
    if (!hit && this.ufo && Math.abs(sh.x - this.ufo.x) <= 9 && sh.y < 16) {
      this.score += this.ufo.pts;
      this.kills.push({ x: this.ufo.x, y: 10, kind: 3, pts: this.ufo.pts });
      this.ufo = null; hit = true;
      ev.push('ufohit');
    }
    if (!hit) {   // a bullet can knock out a bomb
      for (var b = 0; b < this.bombs.length; b++) {
        if (Math.abs(this.bombs[b].x - sh.x) <= 2 && Math.abs(this.bombs[b].y + 3 - sh.y) <= 5) {
          this.kills.push({ x: sh.x, y: sh.y, kind: 4 });
          this.bombs.splice(b, 1); hit = true; break;
        }
      }
    }
    if (!hit) hit = this.hitShield(sh.x, sh.y, -1);
    if (hit) this.shots.splice(i, 1);
  }
};

/* Erase a rough blob of shield pixels around (x, y). */
InvadersGame.prototype.erase = function (x, y, rx, ry, density) {
  for (var s = 0; s < this.shields.length; s++) {
    var sh = this.shields[s];
    var lx = Math.round(x - sh.x), ly = Math.round(y - sh.y);
    if (lx < -rx || lx >= SHIELD_W + rx || ly < -ry || ly >= SHIELD_H + ry) continue;
    for (var yy = ly - ry; yy <= ly + ry; yy++) for (var xx = lx - rx; xx <= lx + rx; xx++) {
      if (xx < 0 || yy < 0 || xx >= SHIELD_W || yy >= SHIELD_H) continue;
      if (Math.random() < density) { if (sh.px[yy * SHIELD_W + xx]) { sh.px[yy * SHIELD_W + xx] = 0; sh.dirty = true; } }
    }
  }
};

/* Does (x, y) touch a shield pixel? If so, crumble a little splat there.
   dir: +1 for a bomb travelling down, -1 for a bullet going up. */
InvadersGame.prototype.hitShield = function (x, y, dir) {
  for (var s = 0; s < this.shields.length; s++) {
    var sh = this.shields[s], lx = Math.round(x - sh.x);
    if (lx < 0 || lx >= SHIELD_W) continue;
    for (var k = 0; k < 5; k++) {   // check the bullet's length so it can't skip over thin bits
      var ly = Math.round(y - sh.y) - dir * k;
      if (ly < 0 || ly >= SHIELD_H) continue;
      if (sh.px[ly * SHIELD_W + lx]) {
        for (var yy = -2; yy <= 2; yy++) for (var xx = -2; xx <= 2; xx++) {
          var px = lx + xx, py = ly + yy + dir;
          if (px < 0 || py < 0 || px >= SHIELD_W || py >= SHIELD_H) continue;
          if (Math.abs(xx) + Math.abs(yy) <= 1 || Math.random() < 0.45) sh.px[py * SHIELD_W + px] = 0;
        }
        sh.px[ly * SHIELD_W + lx] = 0;
        sh.dirty = true;
        this.chips.push({ x: sh.x + lx, y: sh.y + ly });
        return true;
      }
    }
  }
  return false;
};
