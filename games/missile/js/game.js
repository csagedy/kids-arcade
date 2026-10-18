/* Missile Command on 240x320. Enemy missiles fall toward six cities and a
   central battery; the player taps where a counter-missile should explode.
   Explosions grow, linger, and shrink; anything caught in one is destroyed.
   Waves get faster and denser. */

var W = 240, H = 320, GROUND = H - 22;

function MissileGame() {
  this.score = 0;
  this.wave = 0;
  this.cities = [30, 62, 94, 146, 178, 210].map(function (x) { return { x: x, alive: true }; });
  this.battery = { x: W / 2, ammo: 0 };
  this.enemies = [];
  this.shots = [];
  this.booms = [];
  this.hits = [];       // where things blew up, drained by the UI for particles
  this.time = 0;
  this.over = false;
  this.startWave();
}

MissileGame.prototype.startWave = function () {
  this.wave++;
  this.toSpawn = 6 + this.wave * 3;
  this.spawnGap = Math.max(0.35, 1.4 - this.wave * 0.1);
  this.enemySpeed = Math.min(66, 14 + this.wave * 4);   // capped so late waves stay playable
  this.splitChance = this.wave < 3 ? 0 : Math.min(0.35, 0.08 * (this.wave - 2));   // from wave 3, some missiles split in two
  this.spawnTimer = 0.8;
  this.battery.ammo = 20 + this.wave * 2;
  this.betweenWaves = false;
};

MissileGame.prototype.aliveCities = function () {
  return this.cities.filter(function (c) { return c.alive; }).length;
};

MissileGame.prototype.spawn = function () {
  var targets = this.cities.filter(function (c) { return c.alive; }).map(function (c) { return c.x; });
  targets.push(this.battery.x);
  var tx = targets[Math.floor(Math.random() * targets.length)] + (Math.random() - 0.5) * 8;
  var sx = Math.random() * W;
  var d = Math.hypot(tx - sx, GROUND - 0);
  var en = { x: sx, y: 0, sx: sx, sy: 0, vx: (tx - sx) / d * this.enemySpeed, vy: GROUND / d * this.enemySpeed, tx: tx, splitAt: 0 };
  if (Math.random() < this.splitChance) en.splitAt = GROUND * (0.3 + Math.random() * 0.25);
  this.enemies.push(en);
  this.toSpawn--;
};

/* Fire at (x, y). Counter-missiles travel fast from the battery. */
MissileGame.prototype.fire = function (x, y) {
  if (this.over || this.battery.ammo <= 0) return false;
  if (y > GROUND - 24) y = GROUND - 24;   // taps low on the screen still fire, just above the cities
  this.battery.ammo--;
  var d = Math.hypot(x - this.battery.x, y - GROUND), sp = 220;
  this.shots.push({ x: this.battery.x, y: GROUND, tx: x, ty: y, vx: (x - this.battery.x) / d * sp, vy: (y - GROUND) / d * sp });
  return true;
};

MissileGame.prototype.explode = function (x, y, big) {
  this.booms.push({ x: x, y: y, r: 1, max: big ? 26 : 20, phase: 'grow' });
};

/* Returns events: 'fire' handled by UI, 'boom', 'city', 'kill', 'wave', 'over'. */
MissileGame.prototype.update = function (dt) {
  var ev = [], self = this;
  if (this.over) return ev;
  this.time += dt;

  // spawning
  if (this.toSpawn > 0) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawn(); this.spawnTimer = this.spawnGap * (0.6 + Math.random() * 0.8); }
  }

  // player shots reach their target and explode
  for (var i = this.shots.length - 1; i >= 0; i--) {
    var s = this.shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt;
    if ((s.vy < 0 && s.y <= s.ty) || Math.hypot(s.x - s.tx, s.y - s.ty) < 3) {
      this.shots.splice(i, 1);
      this.explode(s.tx, s.ty, false);
      ev.push('boom');
    }
  }

  // explosions
  for (var b = this.booms.length - 1; b >= 0; b--) {
    var bm = this.booms[b];
    if (bm.phase === 'grow') { bm.r += 60 * dt; if (bm.r >= bm.max) { bm.phase = 'hold'; bm.t = 0.25; } }
    else if (bm.phase === 'hold') { bm.t -= dt; if (bm.t <= 0) bm.phase = 'shrink'; }
    else { bm.r -= 50 * dt; if (bm.r <= 0) this.booms.splice(b, 1); }
  }

  // enemy missiles
  for (var e = this.enemies.length - 1; e >= 0; e--) {
    var m = this.enemies[e];
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.splitAt && m.y >= m.splitAt) {   // a second missile peels off toward another target
      m.splitAt = 0;
      var tg = this.cities.filter(function (c) { return c.alive; }).map(function (c) { return c.x; });
      tg.push(this.battery.x);
      var t2 = tg[Math.floor(Math.random() * tg.length)], d2 = Math.hypot(t2 - m.x, GROUND - m.y) || 1;
      this.enemies.push({ x: m.x, y: m.y, sx: m.x, sy: m.y, vx: (t2 - m.x) / d2 * this.enemySpeed, vy: (GROUND - m.y) / d2 * this.enemySpeed, tx: t2, splitAt: 0 });
      ev.push('split');
    }
    var killed = false;
    for (var k = 0; k < this.booms.length; k++) {
      if (Math.hypot(m.x - this.booms[k].x, m.y - this.booms[k].y) < this.booms[k].r) { killed = true; break; }
    }
    if (killed) {
      this.enemies.splice(e, 1);
      this.score += 25;
      this.explode(m.x, m.y, false);
      this.hits.push({ x: m.x, y: m.y });
      ev.push('kill');
      continue;
    }
    if (m.y >= GROUND) {
      this.enemies.splice(e, 1);
      this.explode(m.x, GROUND, true);
      this.hits.push({ x: m.x, y: GROUND, ground: true });
      // hit a city?
      this.cities.forEach(function (c) {
        if (c.alive && Math.abs(c.x - m.x) < 12) { c.alive = false; self.hits.push({ x: c.x, y: GROUND - 4, city: true }); ev.push('city'); }
      });
      if (Math.abs(this.battery.x - m.x) < 12) { this.battery.ammo = Math.max(0, this.battery.ammo - 5); }
      ev.push('boom');
    }
  }

  // wave end
  if (this.toSpawn <= 0 && !this.enemies.length && !this.booms.length && !this.shots.length) {
    if (this.aliveCities() === 0) { this.over = true; ev.push('over'); return ev; }
    this.bonus = this.aliveCities() * 100 + this.battery.ammo * 5;
    this.score += this.bonus;
    // every other wave, one ruined city is rebuilt so a rough wave isn't the end
    this.rebuilt = false;
    if (this.wave % 2 === 0) {
      var dead = this.cities.filter(function (c) { return !c.alive; });
      if (dead.length) { dead[Math.floor(Math.random() * dead.length)].alive = true; this.rebuilt = true; }
    }
    ev.push('wave');
    this.startWave();
  }
  if (this.aliveCities() === 0 && !this.enemies.length && !this.booms.length) { this.over = true; ev.push('over'); }
  return ev;
};
