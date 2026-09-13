/* Pong, portrait: paddles at the top and bottom. Two kids share one phone,
   each dragging their own half, or the top paddle plays itself. First to 7. */

var W = 240, H = 320, PADDLE_W = 40, TARGET = 7;

function PongGame(twoPlayer) {
  this.twoPlayer = !!twoPlayer;
  this.paddles = [{ x: W / 2, y: H - 18 }, { x: W / 2, y: 14 }];   // 0 bottom (player 1), 1 top
  this.score = [0, 0];
  this.rally = 0;
  this.over = false;
  this.serve(1);
}

PongGame.prototype.serve = function (toward) {
  var a = (Math.random() - 0.5) * 1.0;
  var sp = 150;
  this.ball = { x: W / 2, y: H / 2, vx: Math.sin(a) * sp, vy: Math.cos(a) * sp * (toward > 0 ? 1 : -1), r: 3 };
  this.wait = 0.8;
  this.rally = 0;
};

PongGame.prototype.move = function (i, x) {
  this.paddles[i].x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
};

/* Returns 'paddle', 'wall', 'point', 'over' or null. */
PongGame.prototype.update = function (dt) {
  if (this.over) return null;
  if (this.wait > 0) { this.wait -= dt; return null; }
  var b = this.ball, ev = null;

  // computer opponent: eases toward the ball, imperfectly
  if (!this.twoPlayer) {
    var p = this.paddles[1];
    var target = b.vy < 0 ? b.x : W / 2;
    var maxStep = (95 + this.rally * 6) * dt;
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
    var near = i === 0 ? (b.y + b.r >= pd.y - 2 && b.y + b.r <= pd.y + 6) : (b.y - b.r <= pd.y + 2 && b.y - b.r >= pd.y - 6);
    if (near && Math.abs(b.x - pd.x) <= PADDLE_W / 2 + b.r) {
      var hit = (b.x - pd.x) / (PADDLE_W / 2);
      var speed = Math.min(360, Math.hypot(b.vx, b.vy) + 8);
      var ang = hit * 1.05;
      b.vx = Math.sin(ang) * speed;
      b.vy = Math.cos(ang) * speed * (i === 0 ? -1 : 1);
      b.y = i === 0 ? pd.y - 2 - b.r : pd.y + 2 + b.r;
      this.rally++;
      ev = 'paddle';
    }
  }

  if (b.y > H + 10) { this.score[1]++; ev = 'point'; this.serve(-1); }
  if (b.y < -10) { this.score[0]++; ev = 'point'; this.serve(1); }
  if (this.score[0] >= TARGET || this.score[1] >= TARGET) { this.over = true; ev = 'over'; }
  return ev;
};
