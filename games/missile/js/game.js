/* Missile Command on a W x H logical screen (set by the UI for the screen's
   shape: tall on a phone, wide in landscape). Enemy rockets fall toward six
   cities and a central battery; the player taps where a counter-missile
   should explode. Explosions grow, linger, and shrink; anything caught in one
   is destroyed, and each blast can set off the next (chains score more).
   Waves get faster and denser, gently. */

var W = 240, H = 320, GROUND = H - 22;
var CITY_AT = [0.11, 0.24, 0.37, 0.63, 0.76, 0.89];

function MissileGame() {
  GROUND = H - 22;
  this.score = 0;
  this.wave = 0;
  this.cities = CITY_AT.map(function (f) { return { x: Math.round(W * f), alive: true }; });
  this.battery = { x: Math.round(W / 2), ammo: 0, aim: -Math.PI / 2 };
  this.enemies = [];
  this.shots = [];
  this.booms = [];
  this.hits = [];       // where things blew up, drained by the UI for particles
  this.time = 0;
  this.over = false;
  this.scale = Math.max(1, H / 320);   // taller screens fall a little faster, so a wave takes as long
  this.startWave();
}

MissileGame.prototype.startWave = function () {
  this.wave++;
  this.toSpawn = 5 + this.wave * 3;
  this.spawnGap = Math.max(0.4, 1.5 - this.wave * 0.1);
  this.enemySpeed = Math.min(62, 13 + this.wave * 4) * this.scale;   // capped so late waves stay playable
  this.splitChance = this.wave < 3 ? 0 : Math.min(0.3, 0.07 * (this.wave - 2));   // from wave 3, some rockets split in two
  this.spawnTimer = this.wave === 1 ? 1.2 : 2.4;   // a breather for the bonus
  this.battery.ammo = 20 + this.wave * 2;
  this.chain = 0;
};

MissileGame.prototype.aliveCities = function () {
  return this.cities.filter(function (c) { return c.alive; }).length;
};

MissileGame.prototype.targetX = function () {
  var targets = this.cities.filter(function (c) { return c.alive; }).map(function (c) { return c.x; });
  targets.push(this.battery.x);
  return targets[Math.floor(Math.random() * targets.length)] + (Math.random() - 0.5) * 8;
};

MissileGame.prototype.addEnemy = function (sx, sy, tx) {
  var d = Math.hypot(tx - sx, GROUND - sy) || 1;
  var en = { x: sx, y: sy, sx: sx, sy: sy, vx: (tx - sx) / d * this.enemySpeed, vy: (GROUND - sy) / d * this.enemySpeed, tx: tx, splitAt: 0 };
  this.enemies.push(en);
  return en;
};

MissileGame.prototype.spawn = function () {
  var en = this.addEnemy(Math.random() * W, 0, this.targetX());
  if (Math.random() < this.splitChance) en.splitAt = GROUND * (0.3 + Math.random() * 0.25);
  this.toSpawn--;
};

/* Fire at (x, y). Counter-missiles travel fast from the battery. */
MissileGame.prototype.fire = function (x, y) {
  if (this.over || this.battery.ammo <= 0) return false;
  if (y > GROUND - 20) y = GROUND - 20;   // taps low on the screen still fire, just above the cities
  this.battery.ammo--;
  var bx = this.battery.x, by = GROUND - 10;
  var d = Math.hypot(x - bx, y - by) || 1, sp = 240 * this.scale;
  this.battery.aim = Math.atan2(y - by, x - bx);
  this.shots.push({ x: bx, y: by, ox: bx, oy: by, tx: x, ty: y, vx: (x - bx) / d * sp, vy: (y - by) / d * sp });
  return true;
};

MissileGame.prototype.explode = function (x, y, big, chain) {
  this.booms.push({ x: x, y: y, r: 1, max: big ? 26 : 22, phase: 'grow', chain: chain || 0 });
};

/* Returns events: 'boom', 'city', 'kill', 'split', 'wave', 'over'. */
MissileGame.prototype.update = function (dt) {
  var ev = [], self = this;
  if (this.over) return ev;
  this.time += dt;
  // kind to button-mashers: an empty battery slowly reloads (up to 6) while a wave is on
  this.reload = (this.reload || 0) + dt;
  if (this.reload > 1.6) { this.reload = 0; if (this.battery.ammo < 6 && (this.toSpawn > 0 || this.enemies.length)) { this.battery.ammo++; ev.push('reload'); } }

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
      this.explode(s.tx, s.ty, false, 0);
      ev.push('boom');
    }
  }

  for (var b = this.booms.length - 1; b >= 0; b--) {
    var bm = this.booms[b];
    if (bm.phase === 'grow') { bm.r += 64 * dt; if (bm.r >= bm.max) { bm.r = bm.max; bm.phase = 'hold'; bm.t = 0.3; } }
    else if (bm.phase === 'hold') { bm.t -= dt; if (bm.t <= 0) bm.phase = 'shrink'; }
    else { bm.r -= 48 * dt; if (bm.r <= 0) this.booms.splice(b, 1); }
  }

  for (var e = this.enemies.length - 1; e >= 0; e--) {
    var m = this.enemies[e];
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.splitAt && m.y >= m.splitAt) {   // a second rocket peels off toward another target
      m.splitAt = 0;
      this.addEnemy(m.x, m.y, this.targetX());
      ev.push('split');
    }
    var killer = null;
    for (var k = 0; k < this.booms.length; k++) {
      if (Math.hypot(m.x - this.booms[k].x, m.y - this.booms[k].y) < this.booms[k].r + 1) { killer = this.booms[k]; break; }
    }
    if (killer) {
      this.enemies.splice(e, 1);
      var link = killer.chain + 1, pts = 25 * link;
      this.score += pts;
      this.explode(m.x, m.y, false, link);
      this.hits.push({ x: m.x, y: m.y, pts: pts, chain: link });
      ev.push('kill');
      continue;
    }
    if (m.y >= GROUND) {
      this.enemies.splice(e, 1);
      this.explode(m.x, GROUND, true, 0);
      this.hits.push({ x: m.x, y: GROUND, ground: true });
      this.cities.forEach(function (c) {
        if (c.alive && Math.abs(c.x - m.x) < 13) { c.alive = false; self.hits.push({ x: c.x, y: GROUND - 4, city: true }); ev.push('city'); }
      });
      if (Math.abs(this.battery.x - m.x) < 12) { this.battery.ammo = Math.max(0, this.battery.ammo - 5); ev.push('battery'); }
      ev.push('boom');
    }
  }

  // wave end
  if (this.toSpawn <= 0 && !this.enemies.length && !this.booms.length && !this.shots.length) {
    if (this.aliveCities() === 0) { this.over = true; ev.push('over'); return ev; }
    this.bonusCities = this.aliveCities(); this.bonusAmmo = this.battery.ammo;
    this.bonus = this.bonusCities * 100 + this.bonusAmmo * 5;
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
