/* Breakout on a logical screen of W x H (about 240 px on the short side; the
   UI sets W and H for the screen before building a game). Slide a finger to
   move the paddle. Levels are brick layouts as text; a letter is a brick
   colour, '.' is a gap. Bricks marked with a capital letter take two hits. */

var W = 240, H = 320;

var BRICK_COLORS = { r: '#ff4d6d', o: '#ff9f43', y: '#ffd23f', g: '#3ddc84', c: '#2ee6c9', b: '#4c8dff', p: '#a77bff', w: '#e8ecff' };

var LEVELS = [
  ['rrrrrrrrrr', 'oooooooooo', 'yyyyyyyyyy', 'gggggggggg', 'cccccccccc'],
  ['..rrrrrr..', '.oooooooo.', 'yyyyyyyyyy', '.gggggggg.', '..cccccc..', '...bbbb...'],
  ['r.r.r.r.r.', '.o.o.o.o.o', 'y.y.y.y.y.', '.g.g.g.g.g', 'c.c.c.c.c.', '.b.b.b.b.b'],
  ['RRRRRRRRRR', 'oooooooooo', '..........', 'yyyyyyyyyy', 'GGGGGGGGGG', 'cccccccccc'],
  ['....rr....', '...oooo...', '..yyyyyy..', '.gggggggg.', 'cccccccccc', '.bbbbbbbb.', '..pppppp..', '...wwww...'],
  ['RR.RR.RR.R', 'oo.oo.oo.o', 'yy.yy.yy.y', 'GG.GG.GG.G', 'cc.cc.cc.c', 'bb.bb.bb.b', 'PP.PP.PP.P'],
  ['wwwwwwwwww', 'RRRRRRRRRR', 'OOOOOOOOOO', 'yyyyyyyyyy', 'gggggggggg', 'CCCCCCCCCC', 'bbbbbbbbbb', 'PPPPPPPPPP']
];

var BRICK_H = 10, BRICK_GAP = 2, BRICK_TOP = 26;

function BreakoutGame() {
  // brick grid fills the width, whatever the screen
  this.pitch = Math.floor((W - 2) / 10);
  this.brickW = this.pitch - BRICK_GAP;
  this.brickX0 = Math.floor((W - this.pitch * 10 + BRICK_GAP) / 2);
  this.paddleY = H - 22;
  this.score = 0;
  this.lives = 3;
  this.levelIndex = 0;
  this.paddleBase = Math.max(48, Math.min(64, Math.round(W * 0.2)));
  this.paddleW = this.paddleBase;
  this.px = W / 2;
  // a tall phone court is a long way up and back: speed up to match, so a
  // rally takes about as long as on an iPad (where H is about 340)
  this.speedK = Math.max(1, H / 340);
  this.caps = [];        // falling power-up capsules
  this.fxQueue = [];     // things that happened, for the UI's particles: { kind, x, y, color }
  this.wide = 0;         // seconds of wide paddle left
  this.slow = 0;         // seconds of slow ball left
  this.loadLevel(0);
  this.serve();
}

BreakoutGame.prototype.loadLevel = function (i) {
  this.levelIndex = i;
  this.bricks = [];
  this.caps = [];
  var rows = LEVELS[i % LEVELS.length];
  var loops = Math.floor(i / LEVELS.length);   // loop the layouts, faster each time
  // a gentle start that ramps a little each level, capped so it stays catchable
  this.baseSpeed = Math.min(190, 108 + i * 6 + loops * 14) * this.speedK;
  this.rowCount = rows.length;
  for (var r = 0; r < rows.length; r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c];
      if (ch === '.') continue;
      var two = ch === ch.toUpperCase();
      this.bricks.push({
        x: this.brickX0 + c * this.pitch, y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        color: BRICK_COLORS[ch.toLowerCase()], hp: two ? 2 : 1, max: two ? 2 : 1, row: r, hit: 0
      });
    }
  }
};

/* Power-ups drop from about one brick in seven: W wide paddle, S slow ball,
   M multi-ball, + extra life (rare, max 5 lives). Catch them with the paddle. */
var POWERS = ['W', 'W', 'S', 'M', 'M', '+'];
BreakoutGame.prototype.dropPower = function (k) {
  if (Math.random() > 0.14 || this.caps.length >= 2) return;
  this.caps.push({ x: k.x + this.brickW / 2, y: k.y + BRICK_H, type: POWERS[Math.floor(Math.random() * POWERS.length)], t: 0 });
};

BreakoutGame.prototype.serve = function () {
  this.balls = [{ x: this.px, y: this.paddleY - 4, vx: 0, vy: 0, r: 3 }];
  this.stuck = true;      // ball rides the paddle until the finger lifts
  this.slow = 0;
  this.lockT = 0.45;      // brief grace so a finger lifting from the last ball doesn't launch the next
};

BreakoutGame.prototype.launch = function () {
  if (!this.stuck || this.lockT > 0) return false;
  this.stuck = false;
  var a = (Math.random() - 0.5) * 0.8, b = this.balls[0];
  b.vx = Math.sin(a) * this.baseSpeed;
  b.vy = -Math.cos(a) * this.baseSpeed;
  return true;
};

BreakoutGame.prototype.setWide = function (on) {
  this.paddleW = on ? Math.round(this.paddleBase * 1.5) : this.paddleBase;
  this.movePaddle(this.px);
};

BreakoutGame.prototype.movePaddle = function (x) {
  this.px = Math.max(this.paddleW / 2, Math.min(W - this.paddleW / 2, x));
  if (this.stuck) this.balls[0].x = this.px;
};

BreakoutGame.prototype.multi = function () {
  var src = this.balls[0];
  if (!src || this.balls.length >= 6) return;
  var sp = Math.max(this.baseSpeed, Math.hypot(src.vx, src.vy));
  for (var i = 0; i < 2; i++) {
    var a = (i ? 0.5 : -0.5) + (Math.random() - 0.5) * 0.3;
    this.balls.push({ x: src.x, y: src.y, vx: Math.sin(a) * sp, vy: -Math.abs(Math.cos(a) * sp), r: 3 });
  }
};

/* Returns a list of events for the UI to react to: 'brick', 'dent', 'paddle',
   'wall', 'power', 'lose', 'clear', 'over'. */
BreakoutGame.prototype.update = function (dt) {
  var ev = [], py = this.paddleY, self = this;

  // power-up timers and falling capsules keep going even while the ball is parked
  if (this.wide > 0) { this.wide -= dt; if (this.wide <= 0) this.setWide(false); }
  if (this.slow > 0) this.slow -= dt;
  if (this.lockT > 0) this.lockT -= dt;
  for (var i = 0; i < this.bricks.length; i++) if (this.bricks[i].hit > 0) this.bricks[i].hit -= dt;
  for (var c = this.caps.length - 1; c >= 0; c--) {
    var cp = this.caps[c];
    cp.y += 50 * this.speedK * dt; cp.t += dt;
    if (cp.y + 4 >= py && cp.y - 4 <= py + 6 && Math.abs(cp.x - this.px) <= this.paddleW / 2 + 6) {
      this.caps.splice(c, 1);
      this.score += 50;
      if (cp.type === 'W') { this.wide = 12; this.setWide(true); }
      else if (cp.type === 'S') this.slow = 9;
      else if (cp.type === 'M') { if (this.stuck) this.launch(); this.multi(); }
      else this.lives = Math.min(5, this.lives + 1);
      this.lastPower = cp.type;
      this.fxQueue.push({ kind: 'power', x: cp.x, y: py, type: cp.type });
      ev.push('power');
    } else if (cp.y > H + 6) this.caps.splice(c, 1);
  }

  if (this.stuck) return ev;
  var mul = this.slow > 0 ? 0.68 : 1;
  for (var bi = this.balls.length - 1; bi >= 0; bi--) {
    var b = this.balls[bi], lost = false;
    var steps = 4;   // sub-steps so a fast ball can't tunnel through a brick
    for (var s = 0; s < steps && !lost; s++) {
      b.x += b.vx * mul * dt / steps;
      b.y += b.vy * mul * dt / steps;

      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); ev.push('wall'); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); ev.push('wall'); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); ev.push('wall'); }

      // never let the ball go nearly horizontal (it would bounce side to side for ages)
      var sp = Math.hypot(b.vx, b.vy), minVy = sp * 0.32;
      if (sp > 0 && Math.abs(b.vy) < minVy) {
        b.vy = (b.vy < 0 ? -1 : 1) * minVy;
        b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - minVy * minVy);
      }

      // paddle (a little forgiving at the ends)
      if (b.vy > 0 && b.y + b.r >= py && b.y + b.r <= py + 7 && Math.abs(b.x - this.px) <= this.paddleW / 2 + b.r + 1) {
        var hit = Math.max(-1, Math.min(1, (b.x - this.px) / (this.paddleW / 2)));   // -1..1
        var speed = Math.min(this.baseSpeed * 1.45, Math.hypot(b.vx, b.vy) + 2);
        var ang = hit * 1.05;
        b.vx = Math.sin(ang) * speed;
        b.vy = -Math.cos(ang) * speed;
        b.y = py - b.r;
        this.fxQueue.push({ kind: 'paddle', x: b.x, y: py });
        ev.push('paddle');
      }

      // bricks
      for (var k = 0; k < this.bricks.length; k++) {
        var br = this.bricks[k], bw = this.brickW;
        if (b.x + b.r < br.x || b.x - b.r > br.x + bw || b.y + b.r < br.y || b.y - b.r > br.y + BRICK_H) continue;
        // which face: compare penetration depths, and push the ball out of the brick
        var dx = Math.min(b.x + b.r - br.x, br.x + bw - (b.x - b.r));
        var dy = Math.min(b.y + b.r - br.y, br.y + BRICK_H - (b.y - b.r));
        if (dx < dy) { b.vx = b.x < br.x + bw / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); }
        else { b.vy = b.y < br.y + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); }
        br.hp--; br.hit = 0.12;
        this.score += 10 * (this.rowCount - br.row);
        if (br.hp <= 0) {
          this.bricks.splice(k, 1);
          this.fxQueue.push({ kind: 'brick', x: br.x + bw / 2, y: br.y + BRICK_H / 2, color: br.color, w: bw });
          this.dropPower(br);
          ev.push('brick');
        } else ev.push('dent');
        break;
      }

      if (b.y > H + 8) lost = true;
    }
    if (lost) this.balls.splice(bi, 1);
  }
  if (!this.balls.length) {
    this.lives--;
    this.wide = 0; this.setWide(false);
    this.caps = [];
    ev.push(this.lives <= 0 ? 'over' : 'lose');
    if (this.lives > 0) this.serve();
    return ev;
  }
  if (!this.bricks.length) {
    ev.push('clear');
    this.score += 100 + this.levelIndex * 50;
    if (this.lives < 5) this.lives++;   // a bonus ball for clearing the wall
    this.wide = 0; this.setWide(false);
    this.loadLevel(this.levelIndex + 1);
    this.serve();
  }
  return ev;
};
