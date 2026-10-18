/* Asteroids on 240 x H. The ship turns toward the finger and drifts gently
   after it; it fires by itself while touched. Rocks split big -> medium ->
   small. Everything wraps around the edges. After a hit the ship comes back
   blinking and cannot be hurt for a few seconds. */

var W = 240, H = 320;

var ROCK_R = [0, 5, 9, 14];            // radius by size (1 small .. 3 big)
var ROCK_SCORE = [0, 100, 50, 20];

function AsteroidsGame() {
  this.score = 0;
  this.lives = 3;
  this.wave = 1;
  this.over = false;
  this.shots = [];
  this.rocks = [];
  this.ufo = null;
  this.ufoShots = [];
  this.ufoTimer = 14;
  this.fireTimer = 0;
  this.waveDelay = 0;
  this.respawn = 0;
  this.invuln = 2;          // seconds of blinking safety (also at the start)
  this.target = null;       // {x, y} while a finger is down
  this.ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, r: 5 };
  this.buildWave();
}

AsteroidsGame.prototype.buildWave = function () {
  var n = Math.min(2 + this.wave, 6);
  this.rocks = [];
  for (var i = 0; i < n; i++) {
    // start on an edge, away from the ship
    var x, y, tries = 0;
    do {
      x = Math.random() * W; y = Math.random() * H; tries++;
    } while (tries < 20 && this.dist(x, y, this.ship.x, this.ship.y) < 70);
    this.rocks.push(this.makeRock(x, y, 3));
  }
  this.ufoTimer = Math.max(8, 18 - this.wave);
};

AsteroidsGame.prototype.dist = function (x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
};

AsteroidsGame.prototype.makeRock = function (x, y, size) {
  var ang = Math.random() * Math.PI * 2;
  var sp = (8 + Math.random() * 10 + this.wave * 2) * (size === 1 ? 2 : size === 2 ? 1.5 : 1);
  var pts = [], n = 9, r = ROCK_R[size];
  for (var i = 0; i < n; i++) pts.push(r * (0.72 + Math.random() * 0.4));
  return { x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, size: size, r: r, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 1.2, pts: pts };
};

/* Finger down: steer toward (x, y). Finger up: setTarget(null). */
AsteroidsGame.prototype.setTarget = function (x, y) {
  this.target = x === null || x === undefined ? null : { x: x, y: y };
};

function wrap(o, pad) {
  if (o.x < -pad) o.x += W + pad * 2; else if (o.x > W + pad) o.x -= W + pad * 2;
  if (o.y < -pad) o.y += H + pad * 2; else if (o.y > H + pad) o.y -= H + pad * 2;
}

/* Returns events: 'shoot', 'boom1'..'boom3', 'ufoboom', 'ufo', 'die', 'wave', 'thrust', 'over'. */
AsteroidsGame.prototype.update = function (dt) {
  var ev = [], s = this.ship, i, j;
  if (this.over) return ev;

  if (this.invuln > 0) this.invuln -= dt;
  var alive = this.respawn <= 0;
  if (!alive) {
    this.respawn -= dt;
    if (this.respawn <= 0) {
      s.x = W / 2; s.y = H / 2; s.vx = s.vy = 0; s.a = -Math.PI / 2;
      this.invuln = 3;
    }
  }

  // ship: turn toward the finger, thrust gently when it is away from the ship
  if (alive) {
    var thrusting = false;
    if (this.target) {
      var dx = this.target.x - s.x, dy = this.target.y - s.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8) {
        var want = Math.atan2(dy, dx), diff = want - s.a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        var maxTurn = 5.5 * dt;
        s.a += Math.max(-maxTurn, Math.min(maxTurn, diff));
        if (d > 34 && Math.abs(diff) < 1.2) {
          s.vx += Math.cos(s.a) * 70 * dt; s.vy += Math.sin(s.a) * 70 * dt;
          thrusting = true;
        }
      }
      // auto fire while touching
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && this.shots.length < 5) {
        this.shots.push({ x: s.x + Math.cos(s.a) * 7, y: s.y + Math.sin(s.a) * 7, vx: s.vx * 0.5 + Math.cos(s.a) * 170, vy: s.vy * 0.5 + Math.sin(s.a) * 170, life: 1.1 });
        this.fireTimer = 0.32;
        ev.push('shoot');
      }
    } else {
      this.fireTimer = Math.min(this.fireTimer, 0.1);
    }
    this.thrusting = thrusting;
    if (thrusting) ev.push('thrust');
    // gentle drag and a speed cap so it never gets away from a small kid
    var drag = Math.pow(0.6, dt);
    s.vx *= drag; s.vy *= drag;
    var sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > 60) { s.vx *= 60 / sp; s.vy *= 60 / sp; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    wrap(s, 4);
  } else {
    this.thrusting = false;
  }

  // shots
  for (i = this.shots.length - 1; i >= 0; i--) {
    var sh = this.shots[i];
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
    wrap(sh, 0);
    if (sh.life <= 0) this.shots.splice(i, 1);
  }

  // rocks
  for (i = 0; i < this.rocks.length; i++) {
    var r = this.rocks[i];
    r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
    wrap(r, r.r);
  }

  // shots vs rocks and ufo
  for (i = this.shots.length - 1; i >= 0; i--) {
    var b = this.shots[i], hit = false;
    for (j = 0; j < this.rocks.length; j++) {
      var rk = this.rocks[j];
      if (this.dist(b.x, b.y, rk.x, rk.y) <= rk.r + 1) {
        this.breakRock(j, ev);
        hit = true; break;
      }
    }
    if (!hit && this.ufo && this.dist(b.x, b.y, this.ufo.x, this.ufo.y) <= 8) {
      this.score += 200; ev.push('ufoboom'); this.ufo = null; hit = true;
    }
    if (hit) this.shots.splice(i, 1);
  }

  // ufo: drifts across, fires slow loose shots
  this.ufoTimer -= dt;
  if (!this.ufo && this.ufoTimer <= 0 && this.wave >= 2 && this.rocks.length > 0) {
    var fromLeft = Math.random() < 0.5;
    this.ufo = { x: fromLeft ? -8 : W + 8, y: 30 + Math.random() * (H - 60), vx: fromLeft ? 28 : -28, t: 0, fire: 1.5 };
    ev.push('ufo');
  }
  if (this.ufo) {
    var u = this.ufo;
    u.x += u.vx * dt; u.t += dt; u.y += Math.sin(u.t * 1.5) * 14 * dt;
    u.fire -= dt;
    if (u.fire <= 0) {
      u.fire = 2.2;
      var ua = Math.atan2(s.y - u.y, s.x - u.x) + (Math.random() - 0.5) * 1.4;   // deliberately sloppy aim
      this.ufoShots.push({ x: u.x, y: u.y, vx: Math.cos(ua) * 55, vy: Math.sin(ua) * 55, life: 3 });
    }
    if (u.x < -12 || u.x > W + 12) { this.ufo = null; this.ufoTimer = 14; }
    else if (this.ufo && alive && this.invuln <= 0 && this.dist(u.x, u.y, s.x, s.y) < 11) this.hurt(ev);
  }
  if (!this.ufo && this.ufoTimer <= 0) this.ufoTimer = 14;
  for (i = this.ufoShots.length - 1; i >= 0; i--) {
    var us = this.ufoShots[i];
    us.x += us.vx * dt; us.y += us.vy * dt; us.life -= dt;
    wrap(us, 0);
    if (us.life <= 0) { this.ufoShots.splice(i, 1); continue; }
    if (alive && this.invuln <= 0 && this.dist(us.x, us.y, s.x, s.y) < s.r + 1) { this.ufoShots.splice(i, 1); this.hurt(ev); }
  }

  // rocks vs ship
  if (alive && this.invuln <= 0 && !this.over) {
    for (j = 0; j < this.rocks.length; j++) {
      var q = this.rocks[j];
      if (this.dist(q.x, q.y, s.x, s.y) < q.r + s.r - 1) {
        this.breakRock(j, ev);
        this.hurt(ev);
        break;
      }
    }
  }

  // wave clear
  if (this.rocks.length === 0 && !this.over) {
    if (this.waveDelay <= 0) this.waveDelay = 1.6;
    this.waveDelay -= dt;
    if (this.waveDelay <= 0) {
      this.wave++;
      this.score += 100;
      this.buildWave();
      this.invuln = Math.max(this.invuln, 1);
      ev.push('wave');
    }
  }
  return ev;
};

AsteroidsGame.prototype.breakRock = function (idx, ev) {
  var rk = this.rocks.splice(idx, 1)[0];
  this.score += ROCK_SCORE[rk.size];
  ev.push('boom' + rk.size);
  if (rk.size > 1) {
    for (var k = 0; k < 2; k++) this.rocks.push(this.makeRock(rk.x, rk.y, rk.size - 1));
  }
};

AsteroidsGame.prototype.hurt = function (ev) {
  this.lives--;
  this.ufoShots = [];
  if (this.lives <= 0) { this.over = true; ev.push('over'); return; }
  this.respawn = 1.2;
  this.shots = [];
  ev.push('die');
};
