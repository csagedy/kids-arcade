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
  this.kills = [];       // aliens just shot, for the UI to explode
  this.chips = [];       // shield hits, for the UI to spray
  this.pause = 0;        // breather between waves
  this.bombTimer = 1.5;
  this.ufo = null;       // { x, dir, pts }
  this.ufoTimer = 14;
  this.over = false;
  this.buildWave();
  this.buildShields();
}

InvadersGame.prototype.buildWave = function () {
  this.aliens = [];
  var cols = 8, rows = this.level < 2 ? 4 : 5;   // a gentler first wave
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      this.aliens.push({ x: 24 + c * 24, y: 30 + r * 16 + Math.min(this.level - 1, 3) * 8, kind: r < 1 ? 2 : r < 3 ? 1 : 0, alive: true });
    }
  }
  this.dir = 1;
  this.stepTimer = 0;
  this.total = this.aliens.length;
  this.anim = 0;
  this.pause = 1.0;
};

InvadersGame.prototype.buildShields = function () {
  this.shields = [];
  var xs = [40, 120, 200];
  for (var i = 0; i < xs.length; i++) {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 6; c++) {
        if (r >= 2 && c >= 2 && c <= 3) continue;   // arch
        this.shields.push({ x: xs[i] - 12 + c * 4, y: this.shipY - 34 + r * 4, hp: 3 });
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
  if (this.pause > 0) { this.pause -= dt; this.moveShots(dt, ev); return ev; }

  // mystery ship: crosses the top now and then, worth a random bonus
  if (this.ufo) {
    this.ufo.x += this.ufo.dir * 48 * dt;
    if (this.ufo.x < -16 || this.ufo.x > W + 16) this.ufo = null;
  } else {
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0) {
      var d = Math.random() < 0.5 ? 1 : -1;
      this.ufo = { x: d > 0 ? -12 : W + 12, dir: d, pts: [50, 100, 150, 300][Math.floor(Math.random() * 4)] };
      this.ufoTimer = 18 + Math.random() * 10;
      ev.push('ufo');
    }
  }

  // auto fire, up to two bullets on screen so a tall screen doesn't feel sluggish
  this.fireTimer -= dt;
  if (this.fireTimer <= 0 && this.shots.length < 2) {
    this.shots.push({ x: this.ship.x, y: this.shipY - 6 });
    this.fireTimer = 0.45;
    ev.push('shoot');
  }

  // alien block stepping: faster as fewer remain
  var alive = this.aliveCount();
  var interval = Math.max(0.08, 0.6 * (alive / this.total)) / Math.min(1.8, 1 + (this.level - 1) * 0.12);
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
    // aliens that wade into the shields chew them up
    this.aliens.forEach(function (a) {
      if (a.alive) self.shields = self.shields.filter(function (s) { return !(Math.abs(s.x + 2 - a.x) < 8 && Math.abs(s.y + 2 - a.y) < 6); });
    });
  }

  // Bombs run on their own timer (not the step rate, which gets very fast when
  // few aliens are left) and are capped on screen so there's always a gap.
  this.bombTimer -= dt;
  if (this.bombTimer <= 0) {
    this.bombTimer = Math.max(0.55, 1.5 - this.level * 0.12) * (0.7 + Math.random() * 0.6);
    var maxBombs = Math.min(4, 1 + Math.ceil(this.level / 2));
    if (this.bombs.length < maxBombs) {
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

  this.moveShots(dt, ev);
  alive = this.aliveCount();

  // bombs
  for (var b = this.bombs.length - 1; b >= 0; b--) {
    var bm = this.bombs[b];
    bm.y += Math.min(130, 80 + this.level * 8) * dt;   // slow enough for a kid to dodge
    if (bm.y > H) { this.bombs.splice(b, 1); continue; }
    if (this.hitShield(bm.x, bm.y + 4)) { this.bombs.splice(b, 1); continue; }
    if (Math.abs(bm.x - this.ship.x) <= this.ship.w / 2 - 1 && bm.y >= this.shipY - 4 && bm.y <= this.shipY + 6) {
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

/* Player bullets: fly up, hit aliens, the mystery ship, bombs or shields.
   Pushes 'hit' / 'ufohit' events and records what died in this.kills. */
InvadersGame.prototype.moveShots = function (dt, ev) {
  for (var i = this.shots.length - 1; i >= 0; i--) {
    var sh = this.shots[i];
    sh.y -= 240 * dt;
    if (sh.y < 14) { this.shots.splice(i, 1); continue; }
    var hit = false;
    for (var a = 0; a < this.aliens.length; a++) {
      var al = this.aliens[a];
      if (!al.alive) continue;
      if (Math.abs(sh.x - al.x) <= 7 && Math.abs(sh.y - al.y) <= 6) {
        al.alive = false; hit = true;
        this.score += [10, 20, 40][al.kind];
        this.kills.push({ x: al.x, y: al.y, kind: al.kind });
        ev.push('hit');
        break;
      }
    }
    if (!hit && this.ufo && Math.abs(sh.x - this.ufo.x) <= 9 && sh.y < 28) {
      this.score += this.ufo.pts;
      this.kills.push({ x: this.ufo.x, y: 20, kind: 3, pts: this.ufo.pts });
      this.ufo = null; hit = true;
      ev.push('ufohit');
    }
    // a bullet can knock out a bomb
    if (!hit) {
      for (var b = 0; b < this.bombs.length; b++) {
        if (Math.abs(this.bombs[b].x - sh.x) <= 3 && Math.abs(this.bombs[b].y + 2 - sh.y) <= 5) {
          this.kills.push({ x: sh.x, y: sh.y, kind: 4 });
          this.bombs.splice(b, 1); hit = true; break;
        }
      }
    }
    if (!hit) hit = this.hitShield(sh.x, sh.y);
    if (hit) this.shots.splice(i, 1);
  }
};

/* A hit takes one point of health off the block; the blocks crumble from
   solid to cracked to nearly gone, and a hit sometimes chips a neighbour. */
InvadersGame.prototype.hitShield = function (x, y) {
  for (var i = 0; i < this.shields.length; i++) {
    var s = this.shields[i];
    if (x >= s.x && x < s.x + 4 && y >= s.y && y < s.y + 4) {
      s.hp--;
      this.chips.push({ x: s.x + 2, y: s.y + 2 });
      if (Math.random() < 0.3) {
        for (var j = 0; j < this.shields.length; j++) {
          var n = this.shields[j];
          if (n !== s && Math.abs(n.x - s.x) <= 4 && Math.abs(n.y - s.y) <= 4 && Math.random() < 0.5) { n.hp--; if (n.hp <= 0) this.shields.splice(j, 1); break; }
        }
        i = this.shields.indexOf(s);
      }
      if (s.hp <= 0 && i >= 0) this.shields.splice(i, 1);
      return true;
    }
  }
  return false;
};
