/* BUSY BEE — an original cabinet game.

   Concept: a little bee lives in a hive in the middle of an evening meadow.
   Glowing flowers pop up all around. Fly to a flower to pick up a ball of
   pollen, carry it home to the hive and the hive fills with honey; fill the
   honey bar and the meadow moves up a level. Grumpy wasps patrol the meadow
   and give chase when the bee comes near; from level 3 a spider drops down
   on its thread now and then. A bump costs a heart and spills the pollen the
   bee was carrying (it lies on the grass for a few seconds, so it can be
   picked up again). The hive is a safe zone: wasps can't come in.

   Controls: one finger. Slide anywhere and the bee flies with the finger
   (relative, like a trackpad, so the finger never hides the bee and a bump
   in the car only nudges it); a quick tap sends the bee to that spot.
   Arrow keys on a keyboard.

   Why it's fun for 5-9 year olds: a cute hero with a face, flowers that
   smile and bloom, an obvious "pick up and bring home" goal that every kid
   gets at once, and a greedy little choice: go home now (safe), or grab one
   more flower first (each pollen in a trip is worth more than the last:
   1, 2, 3 ... 6 balls = 10, 30, 60, 100, 150, 210 points). There is always
   a safe place to rest (the hive), level 1 has a single slow wasp that only
   turns up after a few seconds, and lost pollen can be picked up again.
   Speed, wasp count and the spider ramp gently; a run is 1-4 minutes.

   How it differs from the rest of the cabinet: it's a free-roaming
   carry-and-deliver game on one screen with no shooting, no paddles, no
   lanes and no grid — the closest relatives are the drag-to-move games, but
   the loop (collect, risk, bank) is its own.

   Rules only, no DOM. The playfield is w x h logical pixels (any shape); the
   hive sits in the middle. Positions in a save are shares of the field. */

var BEE = {
  HIVE_R: 16,        // reach of the hive door
  SAFE_R: 30,        // wasps can't come inside this
  BEE_R: 7,
  BEE_SPEED: 130,    // logical px / s (top speed)
  FLOWER_R: 13,      // pick-up reach (generous)
  CARRY_MAX: 6,
  TRIP: [0, 10, 30, 60, 100, 150, 210]
};

function BeeGame(w, h, demo) {
  this.w = w; this.h = h;
  this.demo = !!demo;
  this.score = 0;
  this.lives = 3;
  this.level = 1;
  this.honey = 0;
  this.need = this.needFor(1);
  this.over = false;
  this.hive = { x: Math.round(w / 2), y: Math.round(h / 2) + 2 };
  this.bee = { x: this.hive.x, y: this.hive.y - 26, vx: 0, vy: 0, face: 1, carry: 0, invuln: 0, dizzy: 0 };
  this.target = null;
  this.flowers = [];
  this.crumbs = [];       // spilled pollen lying on the grass
  this.wasps = [];
  this.spider = null;
  this.flowerTimer = 0.2;
  this.waspTimer = 4;     // first wasp turns up after a few seconds
  this.spiderTimer = 8;
  this.levelGrace = 0;
  this.t = 0;
  this.fx = [];           // events with places, for the UI's effects
  for (var i = 0; i < 4; i++) this.addFlower(true);
}

BeeGame.prototype.needFor = function (lvl) { return Math.min(30, 8 + lvl * 3); };
BeeGame.prototype.maxFlowers = function () {
  var area = this.w * this.h / 45000;   // a bigger meadow gets a flower or two more
  return Math.min(7, 4 + Math.floor((this.level - 1) / 2) + (area > 1.4 ? 1 : 0));
};
BeeGame.prototype.flowerLife = function () { return Math.max(6, 11.5 - this.level * 0.7); };
BeeGame.prototype.waspCount = function () { return Math.min(5, Math.floor((this.level + 1) / 2)); };
BeeGame.prototype.waspSpeed = function () { return Math.min(52, 17 + this.level * 4.5); };
BeeGame.prototype.notice = function () { return Math.min(80, 38 + this.level * 5); };

function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

var FLOWER_COLS = ['pink', 'cyan', 'purple', 'orange', 'blue', 'red'];

BeeGame.prototype.addFlower = function (instant) {
  var w = this.w, h = this.h, tries = 0, x, y, ok;
  do {
    x = 10 + Math.random() * (w - 20);
    y = 13 + Math.random() * (h - 24);
    ok = dist(x, y, this.hive.x, this.hive.y) > BEE.SAFE_R + 12 && dist(x, y, this.bee.x, this.bee.y) > 24;
    for (var i = 0; ok && i < this.flowers.length; i++) if (dist(x, y, this.flowers[i].x, this.flowers[i].y) < 24) ok = false;
  } while (!ok && ++tries < 40);
  if (!ok) return;
  var r = Math.random(), kind = 'n';
  if (!this.demo && this.lives < 3 && r < 0.1) kind = 'heart';
  else if (r > 0.91 && this.t > 5) kind = 'gold';
  this.flowers.push({ x: x, y: y, kind: kind, col: FLOWER_COLS[Math.floor(Math.random() * FLOWER_COLS.length)],
    age: instant ? 0.6 : 0, life: this.flowerLife() + (kind === 'n' ? 0 : -1.5) });
};

BeeGame.prototype.addWasp = function () {
  // in from an edge, away from the bee
  var w = this.w, h = this.h, best = null;
  for (var k = 0; k < 6; k++) {
    var side = Math.floor(Math.random() * 4), p;
    if (side === 0) p = { x: Math.random() * w, y: -8 };
    else if (side === 1) p = { x: w + 8, y: Math.random() * h };
    else if (side === 2) p = { x: Math.random() * w, y: h + 8 };
    else p = { x: -8, y: Math.random() * h };
    p.d = dist(p.x, p.y, this.bee.x, this.bee.y);
    if (!best || p.d > best.d) best = p;
  }
  this.wasps.push({ x: best.x, y: best.y, vx: 0, vy: 0, mode: 'wander', t: 0, tx: w / 2, ty: h / 2, face: 1 });
  this.pickWander(this.wasps[this.wasps.length - 1]);
};

BeeGame.prototype.pickWander = function (ws) {
  // somewhere out in the meadow, not in the safe zone
  var tries = 0, x, y;
  do {
    x = 10 + Math.random() * (this.w - 20); y = 12 + Math.random() * (this.h - 22);
  } while (dist(x, y, this.hive.x, this.hive.y) < BEE.SAFE_R + 20 && ++tries < 20);
  ws.tx = x; ws.ty = y;
};

/* Where the bee is headed (null: hover where it is). */
BeeGame.prototype.setTarget = function (x, y) {
  if (x === null || x === undefined) { this.target = null; return; }
  this.target = { x: Math.max(6, Math.min(this.w - 6, x)), y: Math.max(8, Math.min(this.h - 6, y)) };
};

/* Returns events: 'pick', 'gold', 'heart', 'full', 'bank', 'crumb', 'notice',
   'hurt', 'level', 'wasp', 'spider', 'over'. Places for effects go in this.fx. */
BeeGame.prototype.update = function (dt) {
  var ev = [], b = this.bee, i, j;
  if (this.over) return ev;
  this.t += dt;
  if (b.invuln > 0) b.invuln -= dt;
  if (b.dizzy > 0) b.dizzy -= dt;
  if (this.levelGrace > 0) this.levelGrace -= dt;

  // ---- bee: springs toward the target, capped speed, soft stop
  var top = BEE.BEE_SPEED * (b.dizzy > 0 ? 0.45 : 1);
  var wx = 0, wy = 0;
  if (this.target) { wx = (this.target.x - b.x) * 7; wy = (this.target.y - b.y) * 7; }
  var ws = Math.sqrt(wx * wx + wy * wy);
  if (ws > top) { wx *= top / ws; wy *= top / ws; }
  var k = Math.min(1, dt * 10);
  b.vx += (wx - b.vx) * k; b.vy += (wy - b.vy) * k;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.x = Math.max(6, Math.min(this.w - 6, b.x)); b.y = Math.max(8, Math.min(this.h - 6, b.y));
  if (b.vx > 6) b.face = 1; else if (b.vx < -6) b.face = -1;

  // ---- flowers: bloom, wait, wilt; new ones pop up
  for (i = this.flowers.length - 1; i >= 0; i--) {
    var f = this.flowers[i];
    f.age += dt;
    if (f.age > f.life) { this.flowers.splice(i, 1); continue; }
    if (f.age < 0.45) continue;   // still opening
    if (dist(f.x, f.y, b.x, b.y) < BEE.FLOWER_R) {
      if (f.kind === 'heart') {
        if (this.lives < 3) this.lives++;
        this.flowers.splice(i, 1);
        this.fx.push({ k: 'heart', x: f.x, y: f.y });
        ev.push('heart');
        continue;
      }
      if (b.carry >= BEE.CARRY_MAX) {
        if (!f.toldFull) { f.toldFull = true; ev.push('full'); this.fx.push({ k: 'full', x: b.x, y: b.y }); }
        continue;
      }
      var n = f.kind === 'gold' ? 3 : 1;
      b.carry = Math.min(BEE.CARRY_MAX, b.carry + n);
      if (f.kind === 'gold') this.score += 50;
      this.flowers.splice(i, 1);
      this.fx.push({ k: f.kind === 'gold' ? 'gold' : 'pick', x: f.x, y: f.y, col: f.col, carry: b.carry });
      ev.push(f.kind === 'gold' ? 'gold' : 'pick');
    }
  }
  this.flowerTimer -= dt;
  if (this.flowerTimer <= 0) {
    if (this.flowers.length < this.maxFlowers()) this.addFlower(false);
    this.flowerTimer = 0.9 + Math.random() * 0.8;
  }

  // ---- spilled pollen: pick it up again before it fades
  for (i = this.crumbs.length - 1; i >= 0; i--) {
    var c = this.crumbs[i];
    c.t -= dt;
    if (c.z > 0 || c.vz) { c.x += c.vx * dt; c.y += c.vy * dt; c.vz -= 160 * dt; c.z += c.vz * dt; if (c.z <= 0) { c.z = 0; c.vz = 0; c.vx = c.vy = 0; } }
    c.x = Math.max(4, Math.min(this.w - 4, c.x)); c.y = Math.max(6, Math.min(this.h - 4, c.y));
    if (c.t <= 0) { this.crumbs.splice(i, 1); continue; }
    if (c.z === 0 && c.t < 4.6 && b.carry < BEE.CARRY_MAX && dist(c.x, c.y, b.x, b.y) < 10) {
      b.carry++;
      this.crumbs.splice(i, 1);
      this.fx.push({ k: 'crumb', x: c.x, y: c.y, carry: b.carry });
      ev.push('crumb');
    }
  }

  // ---- home: bank the pollen
  var atHive = dist(b.x, b.y, this.hive.x, this.hive.y) < BEE.HIVE_R + 4;
  if (atHive && b.carry > 0) {
    var got = BEE.TRIP[b.carry];
    this.score += got;
    this.honey += b.carry;
    this.fx.push({ k: 'bank', x: this.hive.x, y: this.hive.y, n: b.carry, pts: got });
    b.carry = 0;
    ev.push('bank');
    if (this.honey >= this.need && !this.demo) {
      this.level++;
      this.score += 100 * (this.level - 1);
      this.honey = 0;
      this.need = this.needFor(this.level);
      this.levelGrace = 2.5;
      // the wasps buzz off for a moment; the next level's lot come back in
      for (j = 0; j < this.wasps.length; j++) this.wasps[j].mode = 'leave';
      this.waspTimer = 3;
      this.spiderTimer = Math.max(this.spiderTimer, 6);
      this.fx.push({ k: 'level', x: this.hive.x, y: this.hive.y });
      ev.push('level');
    } else if (this.honey >= this.need) this.honey = 0;
  }
  var inSafe = dist(b.x, b.y, this.hive.x, this.hive.y) < BEE.SAFE_R;

  if (this.demo) return ev;

  // ---- wasps
  var want = this.waspCount();
  var live = 0;
  for (i = 0; i < this.wasps.length; i++) if (this.wasps[i].mode !== 'leave') live++;
  if (live < want && this.levelGrace <= 0) {
    this.waspTimer -= dt;
    if (this.waspTimer <= 0) { this.addWasp(); this.waspTimer = 3.5; ev.push('wasp'); }
  }
  var sp = this.waspSpeed(), seeR = this.notice();
  for (i = this.wasps.length - 1; i >= 0; i--) {
    var a = this.wasps[i], tx, ty, speed = sp;
    a.t += dt;
    var dBee = dist(a.x, a.y, b.x, b.y);
    if (a.mode === 'leave') {
      // fly straight out of the nearest edge
      tx = a.x < this.w / 2 ? -30 : this.w + 30; ty = a.y;
      speed = 70;
      if (a.x < -20 || a.x > this.w + 20) { this.wasps.splice(i, 1); continue; }
    } else {
      if (a.mode === 'wander' && dBee < seeR && !inSafe && b.invuln <= 0 && this.levelGrace <= 0 && a.t > 1) {
        a.mode = 'chase'; a.t = 0;
        this.fx.push({ k: 'notice', x: a.x, y: a.y });
        ev.push('notice');
      }
      if (a.mode === 'chase') {
        tx = b.x; ty = b.y; speed = sp * 1.3;
        if (a.t > 2.6 || inSafe || b.invuln > 0) { a.mode = 'bored'; a.t = 0; this.pickWander(a); this.fx.push({ k: 'bored', x: a.x, y: a.y }); }
      } else {
        tx = a.tx; ty = a.ty;
        if (dist(a.x, a.y, tx, ty) < 6) this.pickWander(a);
        if (a.mode === 'bored' && a.t > 2.2) { a.mode = 'wander'; a.t = 0; }
      }
    }
    var dx = tx - a.x, dy = ty - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    // a little wobble so they buzz rather than glide
    var wob = Math.sin(this.t * 7 + i * 2.1) * 0.5;
    var vx = dx / d * speed, vy = dy / d * speed;
    a.vx += (vx - a.vx) * Math.min(1, dt * 3); a.vy += (vy - a.vy) * Math.min(1, dt * 3);
    a.x += (a.vx - a.vy * wob) * dt; a.y += (a.vy + a.vx * wob) * dt;
    if (a.vx > 4) a.face = 1; else if (a.vx < -4) a.face = -1;
    // keep out of the hive's safe zone
    if (a.mode !== 'leave') {
      var hd = dist(a.x, a.y, this.hive.x, this.hive.y);
      if (hd < BEE.SAFE_R + 4) {
        var nx = (a.x - this.hive.x) / (hd || 1), ny = (a.y - this.hive.y) / (hd || 1);
        a.x = this.hive.x + nx * (BEE.SAFE_R + 4); a.y = this.hive.y + ny * (BEE.SAFE_R + 4);
      }
    }
    if (b.invuln <= 0 && !inSafe && a.mode !== 'leave' && dBee < 10) { this.hurt(ev, a); if (this.over) return ev; }
  }

  // ---- spider (level 3 on): drops on its thread, hangs a moment, climbs back up
  if (this.level >= 3) {
    var s = this.spider;
    if (!s) {
      this.spiderTimer -= dt;
      if (this.spiderTimer <= 0 && this.levelGrace <= 0) this.dropSpider(ev);
    } else {
      s.t += dt;
      if (s.st === 'warn' && s.t > 1.1) { s.st = 'down'; s.t = 0; }
      else if (s.st === 'down') { s.y = Math.min(s.ty, s.y + 110 * dt); if (s.y >= s.ty) { s.st = 'hang'; s.t = 0; } }
      else if (s.st === 'hang' && s.t > 1.7) { s.st = 'up'; s.t = 0; }
      else if (s.st === 'up') { s.y -= 80 * dt; if (s.y < -12) { this.spider = null; this.spiderTimer = Math.max(4, 10 - this.level * 0.6) + Math.random() * 3; } }
      if (this.spider && s.st !== 'warn' && b.invuln <= 0 && dist(s.x, s.y, b.x, b.y) < 9) this.hurt(ev, null);
    }
  }
  return ev;
};

BeeGame.prototype.dropSpider = function (ev) {
  var tries = 0, x, y;
  do {
    x = 14 + Math.random() * (this.w - 28); y = this.h * (0.3 + Math.random() * 0.5);
  } while ((Math.abs(x - this.hive.x) < BEE.SAFE_R + 6 || dist(x, y, this.bee.x, this.bee.y) < 30) && ++tries < 20);
  this.spider = { x: Math.round(x), y: -8, ty: Math.round(y), st: 'warn', t: 0 };
  ev.push('spider');
};

BeeGame.prototype.hurt = function (ev, wasp) {
  var b = this.bee;
  this.lives--;
  // the pollen spills and bounces onto the grass
  for (var i = 0; i < b.carry; i++) {
    var ang = Math.random() * Math.PI * 2, v = 30 + Math.random() * 30;
    this.crumbs.push({ x: b.x, y: b.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, z: 1, vz: 60 + Math.random() * 30, t: 5.5 });
  }
  b.carry = 0;
  b.invuln = 2.6; b.dizzy = 1.1;
  b.vx *= -0.5; b.vy *= -0.5;
  if (wasp) { wasp.mode = 'bored'; wasp.t = 0; this.pickWander(wasp); }
  for (var j = 0; j < this.wasps.length; j++) if (this.wasps[j].mode === 'chase') { this.wasps[j].mode = 'bored'; this.wasps[j].t = 0; }
  this.fx.push({ k: 'hurt', x: b.x, y: b.y });
  if (this.lives <= 0) { this.lives = 0; this.over = true; ev.push('over'); return; }
  ev.push('hurt');
};
