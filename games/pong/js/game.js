/* Pong, portrait: paddles at the top and bottom. Two kids share one phone,
   each dragging their own half, or the top paddle plays itself. First to 7. */

var W = 240, H = 320, PADDLE_W = 40, TARGET = 7;

/* Computer difficulty. speed: how fast its paddle slides (px/s); err: how far
   off-centre it aims, as a fraction of the paddle half-width (it re-rolls each
   time the ball heads its way, so it sometimes catches the ball on the edge
   and sometimes misses); lag: seconds before it reacts to a new return;
   maxBall: ball speed cap, so rallies stay playable. */
var DIFFS = {
  easy:   { name: 'EASY',   speed: 70,  grow: 2, err: 1.25, lag: 0.30, maxBall: 250 },
  medium: { name: 'MEDIUM', speed: 105, grow: 3, err: 0.80, lag: 0.15, maxBall: 300 },
  hard:   { name: 'HARD',   speed: 140, grow: 4, err: 0.40, lag: 0.05, maxBall: 340 }
};

function PongGame(twoPlayer, diff) {
  this.twoPlayer = !!twoPlayer;
  this.diff = DIFFS[diff] || DIFFS.medium;
  this.paddles = [{ x: W / 2, y: H - 18 }, { x: W / 2, y: 14 }];   // 0 bottom (player 1), 1 top
  this.score = [0, 0];
  this.rally = 0;
  this.over = false;
  this.serve(1, 1.6);
}

/* toward: +1 sends the ball down at player 1, -1 up at the top paddle. */
PongGame.prototype.serve = function (toward, wait) {
  var a = (Math.random() - 0.5) * 0.9;
  var sp = 130;
  this.ball = { x: W / 2, y: H / 2, vx: Math.sin(a) * sp, vy: Math.cos(a) * sp * (toward > 0 ? 1 : -1), r: 3 };
  this.wait = wait || 1.5;
  this.waitMax = this.wait;
  this.serveDir = toward;
  this.rally = 0;
  this.lag = 0;
  this.aim = (Math.random() * 2 - 1) * this.diff.err * (PADDLE_W / 2);
};

PongGame.prototype.move = function (i, x) {
  this.paddles[i].x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
};

/* Returns 'paddle', 'wall', 'point', 'over' or null. */
PongGame.prototype.update = function (dt) {
  if (this.over) return null;
  if (this.wait > 0) { this.wait -= dt; return null; }
  var b = this.ball, ev = null, df = this.diff;

  // computer opponent: slides toward where it thinks the ball will land, with a
  // reaction delay and a random aim error, and drifts home when the ball is going away
  if (!this.twoPlayer) {
    var p = this.paddles[1];
    var target = W / 2;
    if (b.vy < 0) {
      if (this.lag > 0) this.lag -= dt;
      else target = b.x + this.aim;
    } else this.lag = df.lag;
    var maxStep = (df.speed + Math.min(this.rally, 10) * df.grow) * dt;
    var d = target - p.x;
    p.x += Math.max(-maxStep, Math.min(maxStep, d));
    p.x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, p.x));
  }

  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); ev = 'wall'; }
  if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); ev = 'wall'; }

  for (var i = 0; i < 2; i++) {
    var pd = this.paddles[i];
    var towards = i === 0 ? b.vy > 0 : b.vy < 0;
    if (!towards) continue;
    var near = i === 0 ? (b.y + b.r >= pd.y - 2 && b.y + b.r <= pd.y + 8) : (b.y - b.r <= pd.y + 2 && b.y - b.r >= pd.y - 8);
    if (near && Math.abs(b.x - pd.x) <= PADDLE_W / 2 + b.r + 1) {
      var hit = Math.max(-1, Math.min(1, (b.x - pd.x) / (PADDLE_W / 2)));
      // ball speeds up a little every return, up to a cap that suits the level
      var cap = this.twoPlayer ? 340 : df.maxBall;
      var speed = Math.min(cap, Math.hypot(b.vx, b.vy) + 9);
      var ang = hit * 1.0;
      b.vx = Math.sin(ang) * speed;
      b.vy = Math.cos(ang) * speed * (i === 0 ? -1 : 1);
      b.y = i === 0 ? pd.y - 2 - b.r : pd.y + 2 + b.r;
      this.rally++;
      this.lastHit = { x: b.x, y: pd.y, side: i };
      if (i === 0) this.aim = (Math.random() * 2 - 1) * df.err * (PADDLE_W / 2);   // CPU picks its next aim
      ev = 'paddle';
    }
  }

  // the next serve heads toward whoever just lost the point
  if (b.y > H + 10) { this.score[1]++; ev = 'point'; this.lastPoint = 1; this.serve(1); }
  if (b.y < -10) { this.score[0]++; ev = 'point'; this.lastPoint = 0; this.serve(-1); }
  if (this.score[0] >= TARGET || this.score[1] >= TARGET) { this.over = true; ev = 'over'; }
  return ev;
};
