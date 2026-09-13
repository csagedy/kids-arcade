/* Breakout on a 240x320 logical screen. Slide a finger anywhere to move the
   paddle. Levels are brick layouts as text; a letter is a brick colour, '.'
   is a gap. Bricks marked with a capital letter take two hits. */

var W = 240, H = 320;

var BRICK_COLORS = { r: '#ff3b3b', o: '#ff9f1c', y: '#ffe93b', g: '#5eff5e', c: '#4de8ff', b: '#4d7bff', p: '#c96bff', w: '#ffffff' };

var LEVELS = [
  ['rrrrrrrrrr', 'oooooooooo', 'yyyyyyyyyy', 'gggggggggg', 'cccccccccc'],
  ['..rrrrrr..', '.oooooooo.', 'yyyyyyyyyy', '.gggggggg.', '..cccccc..', '...bbbb...'],
  ['r.r.r.r.r.', '.o.o.o.o.o', 'y.y.y.y.y.', '.g.g.g.g.g', 'c.c.c.c.c.', '.b.b.b.b.b'],
  ['RRRRRRRRRR', 'oooooooooo', '..........', 'yyyyyyyyyy', 'GGGGGGGGGG', 'cccccccccc'],
  ['....rr....', '...oooo...', '..yyyyyy..', '.gggggggg.', 'cccccccccc', '.bbbbbbbb.', '..pppppp..', '...wwww...'],
  ['RR.RR.RR.R', 'oo.oo.oo.o', 'yy.yy.yy.y', 'GG.GG.GG.G', 'cc.cc.cc.c', 'bb.bb.bb.b', 'PP.PP.PP.P'],
  ['wwwwwwwwww', 'RRRRRRRRRR', 'OOOOOOOOOO', 'yyyyyyyyyy', 'gggggggggg', 'CCCCCCCCCC', 'bbbbbbbbbb', 'PPPPPPPPPP']
];

var BRICK_W = 22, BRICK_H = 9, BRICK_TOP = 34, BRICK_GAP = 2;

function BreakoutGame() {
  this.score = 0;
  this.lives = 3;
  this.levelIndex = 0;
  this.paddleW = 44;
  this.px = W / 2;
  this.loadLevel(0);
  this.serve();
}

BreakoutGame.prototype.loadLevel = function (i) {
  this.levelIndex = i;
  this.bricks = [];
  var rows = LEVELS[i % LEVELS.length];
  var speedup = Math.floor(i / LEVELS.length);   // loop the layouts, faster each time
  this.baseSpeed = 120 + i * 8 + speedup * 20;
  for (var r = 0; r < rows.length; r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c];
      if (ch === '.') continue;
      this.bricks.push({
        x: c * (BRICK_W + BRICK_GAP) + 1, y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        color: BRICK_COLORS[ch.toLowerCase()], hp: ch === ch.toUpperCase() ? 2 : 1, row: r
      });
    }
  }
};

BreakoutGame.prototype.serve = function () {
  this.ball = { x: this.px, y: H - 40, vx: 0, vy: 0, r: 3 };
  this.stuck = true;      // ball rides the paddle until the first tap
};

BreakoutGame.prototype.launch = function () {
  if (!this.stuck) return;
  this.stuck = false;
  var a = (Math.random() - 0.5) * 0.8;
  this.ball.vx = Math.sin(a) * this.baseSpeed;
  this.ball.vy = -Math.cos(a) * this.baseSpeed;
};

BreakoutGame.prototype.movePaddle = function (x) {
  this.px = Math.max(this.paddleW / 2, Math.min(W - this.paddleW / 2, x));
  if (this.stuck) this.ball.x = this.px;
};

/* Returns a list of events for the UI to react to: 'brick', 'paddle', 'wall', 'lose', 'clear', 'over'. */
BreakoutGame.prototype.update = function (dt) {
  var ev = [];
  if (this.stuck) return ev;
  var b = this.ball;
  var steps = 3;   // sub-steps so a fast ball can't tunnel through a brick
  for (var s = 0; s < steps; s++) {
    b.x += b.vx * dt / steps;
    b.y += b.vy * dt / steps;

    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); ev.push('wall'); }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); ev.push('wall'); }
    if (b.y < 12 + b.r) { b.y = 12 + b.r; b.vy = Math.abs(b.vy); ev.push('wall'); }

    // paddle
    var py = H - 24;
    if (b.vy > 0 && b.y + b.r >= py && b.y + b.r <= py + 6 && Math.abs(b.x - this.px) <= this.paddleW / 2 + b.r) {
      var hit = (b.x - this.px) / (this.paddleW / 2);   // -1..1
      var speed = Math.min(this.baseSpeed * 1.6, Math.hypot(b.vx, b.vy) + 3);
      var ang = hit * 1.1;
      b.vx = Math.sin(ang) * speed;
      b.vy = -Math.cos(ang) * speed;
      b.y = py - b.r;
      ev.push('paddle');
    }

    // bricks
    for (var i = 0; i < this.bricks.length; i++) {
      var k = this.bricks[i];
      if (b.x + b.r < k.x || b.x - b.r > k.x + BRICK_W || b.y + b.r < k.y || b.y - b.r > k.y + BRICK_H) continue;
      // Decide which face: compare penetration depths.
      var dx = Math.min(b.x + b.r - k.x, k.x + BRICK_W - (b.x - b.r));
      var dy = Math.min(b.y + b.r - k.y, k.y + BRICK_H - (b.y - b.r));
      if (dx < dy) b.vx = -b.vx; else b.vy = -b.vy;
      k.hp--;
      this.score += 10 * (LEVELS[this.levelIndex % LEVELS.length].length - k.row);
      if (k.hp <= 0) this.bricks.splice(i, 1);
      ev.push('brick');
      break;
    }

    if (b.y > H + 10) {
      this.lives--;
      ev.push(this.lives <= 0 ? 'over' : 'lose');
      if (this.lives > 0) this.serve();
      return ev;
    }
  }
  if (!this.bricks.length) {
    ev.push('clear');
    this.loadLevel(this.levelIndex + 1);
    this.serve();
  }
  return ev;
};
